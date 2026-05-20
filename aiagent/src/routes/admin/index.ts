import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { getDatabase } from "../../storage/database";
import { PDFRAG } from "../../rag";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "documents", "by_hash");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post(
  "/system-documents",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const { docType, category } = req.body;
      if (!docType || !["excellent_resume", "reference_doc"].includes(docType)) {
        res.status(400).json({ error: "docType must be excellent_resume or reference_doc" });
        return;
      }
      if (!category) {
        res.status(400).json({ error: "category is required" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "File is required" });
        return;
      }

      // 提取文本
      let fileContent = file.buffer.toString("utf-8");
      if (file.originalname.toLowerCase().endsWith(".pdf")) {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: file.buffer });
        const pdfData = await parser.getText();
        await parser.destroy();
        fileContent = pdfData.text;
      }
      if (fileContent.trim().length < 100) {
        res.status(400).json({ error: "File content too short" });
        return;
      }

      // 物理存储 + global_documents
      const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
      const ext = file.originalname.toLowerCase().endsWith(".pdf") ? "pdf" : "txt";
      const fileName = `${fileHash}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file.buffer);
      }

      const db = getDatabase();
      let globalDocId: number;
      const existingGlobal = db.prepare("SELECT id FROM global_documents WHERE file_hash = ?").get(fileHash) as { id: number } | undefined;
      if (existingGlobal) {
        globalDocId = existingGlobal.id;
        db.prepare("UPDATE global_documents SET reference_count = reference_count + 1 WHERE id = ?").run(globalDocId);
      } else {
        const result = db.prepare(
          `INSERT INTO global_documents (file_hash, file_path, original_name, file_type, file_size, reference_count, created_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
        ).run(fileHash, filePath, file.originalname, ext, file.buffer.length, Date.now());
        globalDocId = result.lastInsertRowid as number;
      }

      // 写入 system_documents
      db.prepare(
        `INSERT INTO system_documents (global_doc_id, doc_type, category, local_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(globalDocId, docType, category, file.originalname, Date.now());

      // 分块 + 索引到 LanceDB
      const rag = new PDFRAG();
      await rag.loadDocumentsFromText([{ text: fileContent, metadata: { source: file.originalname, file_type: "system" } }]);
      if (rag.chunks.length > 0) {
        const { indexSystemDocumentChunks } = await import("../../lib/vector-db");
        await indexSystemDocumentChunks(
          globalDocId,
          rag.chunks.map((c, i) => ({ pageContent: c.pageContent, chunkIndex: i })),
          docType,
          category,
        );
      }

      res.json({
        message: "System document uploaded",
        globalDocId,
        chunksCount: rag.chunks.length,
      });
    } catch (error) {
      console.error("Error uploading system document:", error);
      res.status(500).json({ error: "Failed to upload system document" });
    }
  },
);

router.delete(
  "/system-documents/:id",
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const db = getDatabase();

      const doc = db.prepare(
        "SELECT s.global_doc_id, g.file_path FROM system_documents s JOIN global_documents g ON s.global_doc_id = g.id WHERE s.id = ?",
      ).get(id) as { global_doc_id: number; file_path: string } | undefined;

      if (!doc) {
        res.status(404).json({ error: "System document not found" });
        return;
      }

      // 清理 LanceDB 向量
      const { deleteSystemChunks } = await import("../../lib/vector-db");
      await deleteSystemChunks(doc.global_doc_id);

      // 删除关联记录
      db.prepare("DELETE FROM system_documents WHERE id = ?").run(id);

      // 递减引用计数
      db.prepare(
        "UPDATE global_documents SET reference_count = reference_count - 1 WHERE id = ?",
      ).run(doc.global_doc_id);

      const count = db.prepare(
        "SELECT reference_count FROM global_documents WHERE id = ?",
      ).get(doc.global_doc_id) as { reference_count: number };

      // 引用归零时删除物理文件
      if (count.reference_count <= 0) {
        if (fs.existsSync(doc.file_path)) {
          fs.unlinkSync(doc.file_path);
        }
        db.prepare("DELETE FROM global_documents WHERE id = ?").run(doc.global_doc_id);
      }

      res.json({ message: "System document deleted" });
    } catch (error) {
      console.error("Error deleting system document:", error);
      res.status(500).json({ error: "Failed to delete system document" });
    }
  },
);

export default router;
