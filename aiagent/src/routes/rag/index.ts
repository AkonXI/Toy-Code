import { Router, Request, Response } from "express";
import multer from "multer";
import {
  streamText,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  stepCountIs,
} from "ai";
import { tool } from "ai";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { PDFRAG } from "../../rag";
import {
  getChatModel,
  getFastModel,
  deepseek,
  DEFAULT_MODEL,
} from "../../lib/providers";
import {
  buildSearchPrompt,
  buildTitlePrompt,
  buildApplyPrompt,
  buildAcceptPrompt,
} from "../../lib/prompts";

// 上传进度跟踪（内存存储，进程重启后失效）
const uploadProgress = new Map<string, { progress: number; status: string }>();

import {
  parseAIContent,
  parseResumeSections,
  sectionsToContentArray,
  generateResumePDF,
} from "../../lib/resume-pdfmaker";
import { replaceText } from "../../lib/resume-markdown";
import {
  addFileToConversation,
  removeFileFromConversation,
  getConversationDocsByType,
  cleanupOldVersions,
} from "../../storage/file-manager";
import {
  getConversationChunksWithTypes,
  setConversationChunksWithTypes,
  getConversationDocs,
  appendConversationChunks,
  storeMessage,
  createConversation,
  buildHistoryPrompt,
  getConversationTitle,
  updateConversationTitle,
  isConversationOwner,
} from "../../storage/repository";
import { getDatabase } from "../../storage/database";
import { verifyToken } from "../../auth";
import {
  createAuthMiddleware,
  createAuthWithUserMiddleware,
} from "../../auth/token";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function decodeFilename(filename: string): string {
  try {
    return Buffer.from(filename, "latin1").toString("utf8");
  } catch {
    return filename;
  }
}

function mergeOverlappingChunks(chunks: { pageContent: string }[]): string {
  if (chunks.length === 0) return "";
  if (chunks.length === 1) return chunks[0].pageContent;

  const MAX_OVERLAP = 200;
  let result = chunks[0].pageContent;

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i].pageContent;
    const overlapLen = Math.min(MAX_OVERLAP, result.length, next.length);
    let merged = false;

    for (let len = overlapLen; len > 0; len--) {
      if (result.endsWith(next.substring(0, len))) {
        result += next.substring(len);
        merged = true;
        break;
      }
    }

    if (!merged) {
      result += "\n\n" + next;
    }
  }

  return result;
}

async function classifyReferenceFile(content: string): Promise<string | null> {
  const refParser = StructuredOutputParser.fromNamesAndDescriptions({
    category: "excellent_resume | reference_doc | unknown",
  });
  try {
    const response = await getChatModel().invoke([
      {
        role: "user",
        content: `判断下面文本属于哪一类参考资料。
${refParser.getFormatInstructions()}

- excellent_resume：包含个人信息、工作经历、教育背景、技能等简历内容（典型简历）
- reference_doc：除简历外的其它参考文件，包括但不限于岗位描述(JD)、招聘准则、行业报告、公司介绍等
- unknown：无法判断

文本前300字：
${content.slice(0, 300)}`,
      },
    ]);
    const parsed = await refParser.parse(
      typeof response.content === "string" ? response.content : "",
    );
    return parsed.category === "unknown" ? null : parsed.category;
  } catch (e) {
    console.error("Failed to classify reference file:", e);
    return null;
  }
}

function refCategoryLabel(category: string | null): string {
  return category === "excellent_resume"
    ? "优秀简历"
    : category === "reference_doc"
      ? "参考资料"
      : "参考资料";
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const router = Router();
router.get("/start/progress/:convId", async (req: Request, res: Response) => {
  const data = uploadProgress.get(String(req.params.convId));
  if (!data) return res.json({ progress: 100, status: "完成" });
  res.json(data);
});
const docsDir = path.join(process.cwd(), "docs");
const docsDirResolved = path.resolve(docsDir);

function isPathSafe(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(docsDirResolved, resolved);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const systemRAG = new PDFRAG({ chunkSize: 1000, chunkOverlap: 200 });
let systemRAGReady = false;

async function initSystemRAG(retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const files = fs.readdirSync(docsDir);
      if (files.length > 0) {
        await systemRAG.loadDocuments(docsDir);
        console.log(`System RAG initialized with ${files.length} documents`);
      } else {
        console.log("System RAG: no documents found, skipping initialization");
      }
      return;
    } catch (error) {
      console.error(
        `System RAG init attempt ${i + 1}/${retries} failed:`,
        error,
      );
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
    } finally {
      systemRAGReady = true;
    }
  }
}

initSystemRAG();

function validateURL(rawUrl: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http/https protocols allowed" };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]"
  ) {
    return { valid: false, error: "Localhost URLs are not allowed" };
  }
  if (
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    return { valid: false, error: "Private IP URLs are not allowed" };
  }
  return { valid: true };
}

async function extractUserId(req: Request): Promise<number | null> {
  const token =
    (req.headers["token"] as string) || (req.headers["Token"] as string);
  if (!token) return null;
  const username = await verifyToken(token);
  if (!username) return null;
  const phone = username.replace(/^user_/, "");
  const { getUserIdByPhone } = await import("../../storage/repository");
  return getUserIdByPhone(phone);
}

async function parseFileContent(file: MulterFile): Promise<string> {
  const ext = file.originalname.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") {
    const pdfParser = new PDFParse({ data: file.buffer });
    try {
      const pdfData = await pdfParser.getText();
      return pdfData.text;
    } finally {
      await pdfParser.destroy();
    }
  } else if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  } else {
    return file.buffer.toString("utf-8");
  }
}

async function performSearch(
  reqBody: {
    query: string;
    content?: string;
    files?: MulterFile[];
    k?: number;
    url?: string;
    useSystemDocs?: boolean;
    conversationId?: string;
  },
  res: Response,
  req: Request,
) {
  const {
    query,
    content,
    files,
    url,
    k,
    useSystemDocs = true,
    conversationId,
  } = reqBody;

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  if (conversationId) {
    const userId = await extractUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication failed" });
      return;
    }
    const isOwner = await isConversationOwner(conversationId, userId);
    if (!isOwner) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const title = await getConversationTitle(conversationId);
    if (!title) {
      try {
        const response = await getChatModel().invoke([
          { role: "user", content: await buildTitlePrompt(query) },
        ]);
        const titleText =
          typeof response.content === "string" ? response.content : "";
        await updateConversationTitle(conversationId, titleText.trim());
        console.log("Generated conversation title:", titleText.trim());
      } catch (e) {
        console.error("Failed to generate title:", e);
      }
    }
  }

  const rag = new PDFRAG({ chunkSize: 1000, chunkOverlap: 200 });
  const tempDir = path.join(process.cwd(), "temp", Date.now().toString());
  fs.mkdirSync(tempDir, { recursive: true });

  let resumeContent = "";
  let excellentResumeContent = "";
  let referenceDocContent = "";
  const resumeChunks: { pageContent: string }[] = [];
  const excellentResumeChunks: { pageContent: string; refId?: number }[] = [];
  const referenceDocChunks: { pageContent: string; refId?: number }[] = [];

  try {
    if (conversationId) {
      console.time("[perf] load-chunks");
      const typedChunks = await getConversationChunksWithTypes(conversationId);
      console.timeEnd("[perf] load-chunks");
      if (typedChunks.length > 0) {
        console.log(
          "conversationId:",
          conversationId,
          "loaded typed chunks:",
          typedChunks.length,
        );
        for (const chunk of typedChunks) {
          if (chunk.docType === "resume") {
            resumeChunks.push(chunk);
          } else if (chunk.refCategory === "excellent_resume") {
            excellentResumeChunks.push(chunk);
          } else {
            referenceDocChunks.push(chunk);
          }
          rag.chunks.push(chunk);
        }
        resumeContent = mergeOverlappingChunks(resumeChunks);

        // 按 refId 分组优秀简历
        if (excellentResumeChunks.length > 0) {
          const refDocs = await getConversationDocsByType(
            conversationId,
            "reference",
          );
          const nameByRefId: Record<number, string> = {};
          for (const d of refDocs) {
            nameByRefId[d.id] = d.original_name;
          }
          const groups: Record<number, { pageContent: string }[]> = {};
          for (const c of excellentResumeChunks) {
            const key = c.refId || 0;
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
          }
          const parts: string[] = [];
          for (const [refIdStr, chunks] of Object.entries(groups)) {
            const rid = Number(refIdStr);
            const name = rid ? nameByRefId[rid] : undefined;
            const merged = mergeOverlappingChunks(chunks);
            parts.push(name ? `--- ${name} ---\n${merged}` : merged);
          }
          excellentResumeContent = parts.join("\n\n");
        }

        // 按 refId 分组岗位参考资料
        if (referenceDocChunks.length > 0) {
          const refDocs = await getConversationDocsByType(
            conversationId,
            "reference",
          );
          const nameByRefId: Record<number, string> = {};
          for (const d of refDocs) {
            nameByRefId[d.id] = d.original_name;
          }
          const groups: Record<number, { pageContent: string }[]> = {};
          for (const c of referenceDocChunks) {
            const key = c.refId || 0;
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
          }
          const parts: string[] = [];
          for (const [refIdStr, chunks] of Object.entries(groups)) {
            const rid = Number(refIdStr);
            const name = rid ? nameByRefId[rid] : undefined;
            const merged = mergeOverlappingChunks(chunks);
            parts.push(name ? `--- ${name} ---\n${merged}` : merged);
          }
          referenceDocContent = parts.join("\n\n");
        }

        // 向量搜索系统级知识库（独立 system_chunks 表）
        try {
          const { searchSystemChunks } = await import("../../lib/vector-db");
          const sysResults = await searchSystemChunks(query, 3);
          if (sysResults.length > 0) {
            const sysText =
              "【系统知识库相关参考】\n" +
              sysResults.map((r) => r.text).join("\n\n");
            if (referenceDocContent) {
              referenceDocContent += "\n\n" + sysText;
            } else {
              referenceDocContent = sysText;
            }
          }
        } catch (e) {
          console.error("[vector-db] search error:", e);
        }
      } else {
        const conversationDocs = await getConversationDocs(conversationId);
        console.log(
          "conversationId:",
          conversationId,
          "docs:",
          conversationDocs,
        );
        if (conversationDocs.length > 0) {
          const docDir = path.dirname(conversationDocs[0]);
          console.log("loading docs from directory:", docDir);
          if (fs.existsSync(docDir)) {
            const docRAG = new PDFRAG();
            await docRAG.loadDocuments(docDir);
            console.log("loaded chunks:", docRAG.chunks.length);
            for (const chunk of docRAG.chunks) {
              resumeChunks.push(chunk);
              rag.chunks.push(chunk);
            }
        resumeContent = mergeOverlappingChunks(resumeChunks);
          }
        }
      }
    }

    if (files && files.length > 0) {
      for (const file of files) {
        const decodedName = path.basename(decodeFilename(file.originalname));
        const filePath = path.join(tempDir, decodedName);
        fs.writeFileSync(filePath, file.buffer);

        const fileContent = await parseFileContent(file);
        const refCategory = await classifyReferenceFile(fileContent);
        const categoryLabel = refCategoryLabel(refCategory);
        if (refCategory === "excellent_resume") {
          excellentResumeContent += `[${categoryLabel}: ${decodedName}]\n${fileContent}\n\n`;
        } else {
          referenceDocContent += `[${categoryLabel}: ${decodedName}]\n${fileContent}\n\n`;
        }

        if (conversationId) {
          const fileType = decodedName.toLowerCase().endsWith(".pdf")
            ? "pdf"
            : decodedName.toLowerCase().endsWith(".docx")
              ? "docx"
              : "txt";
          const result = await addFileToConversation(
            conversationId,
            file.buffer,
            decodedName,
            fileType,
            "reference",
            refCategory || undefined,
          );

          const fileRAG = new PDFRAG();
          await fileRAG.loadDocumentsFromText([
            {
              text: fileContent,
              metadata: { source: decodedName, file_type: "reference" },
            },
          ]);

          const refChunks = fileRAG.chunks.map((chunk) => ({
            pageContent: `[${categoryLabel}: ${decodedName}]\n${chunk.pageContent}`,
            metadata: chunk.metadata,
            docType: "reference" as const,
            refCategory: refCategory || undefined,
            scope: "conversation",
          }));

          for (const chunk of refChunks) {
            rag.chunks.push(chunk);
          }

          await appendConversationChunks(
            conversationId,
            refChunks,
            result.refId,
          );
        }
      }
    } else if (content) {
      await rag.loadDocumentsFromText([
        { text: content, metadata: { source: "inline" } },
      ]);
    } else if (url) {
      const urlResult = validateURL(url);
      if (!urlResult.valid) {
        res.status(400).json({ error: `URL rejected: ${urlResult.error}` });
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          res
            .status(502)
            .json({ error: `Remote server returned ${response.status}` });
          return;
        }
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
          res.status(413).json({ error: "Response too large (>5MB)" });
          return;
        }
        const text = await response.text();
        if (text.length > 5 * 1024 * 1024) {
          res.status(413).json({ error: "Response too large (>5MB)" });
          return;
        }
        await rag.loadDocumentsFromText([{ text, metadata: { source: url } }]);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (useSystemDocs) {
      for (const chunk of [...systemRAG.chunks]) {
        rag.chunks.push(chunk);
      }
    }

    const history = conversationId
      ? await buildHistoryPrompt(conversationId)
      : "";
    const historySection = history ? `\n对话历史:\n${history}\n` : "";

    const updateResumeTool = tool({
      description:
        '适用于用户笼统询问简历优化建议的场景（如"有什么建议"、"哪里需要优化"、"帮我分析"等）。每次只输出一条建议，可多次调用此工具输出多条建议。suggestion 填入简短修改建议即可。如果是要求具体修改某字段的内容，请使用 proposeModification。注意：field 必须是简历内容中的字段，不要对参考资料中的内容提出修改建议。current 从原文中精确复制要修改的文本片段，必须保证在整篇简历中唯一匹配。reason 简要说明为什么建议这样修改。',
      inputSchema: z.object({
        field: z.string(),
        current: z.string(),
        suggestion: z.string(),
        reason: z.string(),
        priority: z.string(),
      }),
      execute: async ({
        field,
        current,
        suggestion,
        reason,
        priority,
      }) => ({
        optimization: { field, current, suggestion, reason, priority },
      }),
    });

    const proposeModificationTool = tool({
      description:
        '当用户提出具体修改指令时调用（如"把XX改详细"、"简化XX"）。suggestion 填入修改后的完整段落。current 从原文中精确复制要修改的文本片段，必须保证在整篇简历中唯一匹配。reason 简要说明为什么这样修改。注意：field 必须是简历内容中的字段，不能是参考资料中的内容。只修改简历，不修改参考资料。',
      inputSchema: z.object({
        field: z.string(),
        current: z.string(),
        suggestion: z.string(),
        reason: z.string(),
      }),
      execute: async ({ field, current, suggestion, reason }) => ({
        modification: { field, current, suggestion, reason },
      }),
    });

    const resumeSection = resumeContent
      ? `【待修改简历】\n${resumeContent}\n\n`
      : "";
    const excellentResumeSection = excellentResumeContent
      ? `【优秀简历范例】\n${excellentResumeContent}\n\n`
      : "";
    const referenceDocSection = referenceDocContent
      ? `【岗位参考资料】\n${referenceDocContent}\n\n`
      : "";

    // 预分类用户意图
    console.time("[perf] intent-classify");
    const intentParser = StructuredOutputParser.fromNamesAndDescriptions({
      intent: "建议、修改 或 追问",
    });
    let intent: "建议" | "修改" | "追问" = "建议";
    try {
      const response = await getChatModel().invoke([
        {
          role: "user",
          content: `判断用户对简历的操作意图。
${intentParser.getFormatInstructions()}

"建议"：用户要求分析简历、提改进方向、哪里可以优化，没有指定具体怎么改。即使用户说"请分析这份简历"、"帮我看看"、"有什么建议"、"提点意见"、"你觉得呢"等笼统表达，只要涉及简历分析或优化需求，都应归为"建议"。
"修改"：用户明确要求对某个具体字段做直接修改（如"把XX改详细"、"简化XX"、"补充XX内容"）。
"追问"：用户的表达完全无关或过于模糊，既不像在要求分析简历，也不像要修改具体字段（如只说"你好"、"在吗"、"不知道"等无实质内容的招呼）。不要因为用户没说具体要改哪里就输出"追问"。

用户问题: ${query}`,
        },
      ]);
      const parsed = await intentParser.parse(
        typeof response.content === "string" ? response.content : "",
      );
      intent =
        parsed.intent === "修改"
          ? "修改"
          : parsed.intent === "追问"
            ? "追问"
            : "建议";
      console.log(
        "[DEBUG] intent classified:",
        intent,
        "| query:",
        query.slice(0, 50),
      );
    } catch (e) {
      console.error("Failed to classify intent, defaulting to 建议:", e);
    }
    console.timeEnd("[perf] intent-classify");

    // 意图不明时降级为建议，不追问（避免 SSE 流格式问题）
    const originalIntent = intent;
    if (intent === "追问") {
      intent = "建议";
    }

    const tools: Record<string, any> =
      originalIntent === "追问"
        ? {}
        : {
            updateResume: updateResumeTool,
            proposeModification: proposeModificationTool,
          };
    console.log("[DEBUG] tools registered:", Object.keys(tools));

    console.time("[perf] build-prompt");
    const searchPrompt = await buildSearchPrompt({
      historySection,
      resumeSection,
      excellentResumeSection,
      referenceDocSection,
      query,
      intent,
    });
    console.timeEnd("[perf] build-prompt");
    console.log(
      "[DEBUG] search prompt (first 300):",
      searchPrompt.slice(0, 300),
    );

    console.time("[perf] streamText");

    const reasonChunks: string[] = [];
    const result = streamText({
      model: deepseek(DEFAULT_MODEL),
      tools,
      stopWhen: stepCountIs(6),
      prompt: searchPrompt,
      onStepFinish: ({ reasoning }) => {
        if (reasoning) {
          for (const part of reasoning) {
            if ('text' in part) reasonChunks.push(part.text);
          }
        }
      },
      onFinish: async ({ text }) => {
        console.timeEnd("[perf] streamText");
        if (conversationId) {
          try {
            const reasonText = reasonChunks.join('\n');
            console.log("[reasoning] chunks:", reasonChunks.length, "total length:", reasonText.length);
            const displayText = req.body.displayText || query;
            await storeMessage(conversationId, "user", displayText);
            await storeMessage(
              conversationId,
              "assistant",
              String(text),
              reasonText,
            );
          } catch (e) {
            console.error("Failed to store messages:", e);
          }
        }
      },
    });

    result.pipeUIMessageStreamToResponse(res as any);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const authMiddleware = createAuthMiddleware();
const authWithUser = createAuthWithUserMiddleware();

router.post(
  "/start",
  authMiddleware,
  upload.array("files"),
  async (req: Request, res: Response) => {
    req.setTimeout(240000);
    let tempDir: string | null = null;
    try {
      const conversationId = `conv_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      uploadProgress.set(conversationId, {
        progress: 0,
        status: "正在准备...",
      });
      const files = req.files as MulterFile[];
      const query = req.body.query;

      const userId = await extractUserId(req);
      const initialPrompt = query && query.trim() ? query.trim() : "";
      if (userId) {
        await createConversation(conversationId, userId, initialPrompt);
      }

      let firstMarkdownText = '';
      let firstOriginalRefId = 0;

      if (files && files.length > 0) {
        tempDir = path.join(process.cwd(), "temp", conversationId);
        fs.mkdirSync(tempDir, { recursive: true });

        const decodedFiles = files.map((file) => ({
          ...file,
          originalname: decodeFilename(file.originalname),
        }));

        let totalChunkCount = 0;
        let firstFile = true;
        for (const file of decodedFiles) {
          const safeName = path.basename(file.originalname);
          const filePath = path.join(tempDir, safeName);
          fs.writeFileSync(filePath, file.buffer);

          const fileType = file.originalname.toLowerCase().endsWith(".pdf")
            ? "pdf"
            : file.originalname.toLowerCase().endsWith(".docx")
              ? "docx"
              : "txt";
          const result = await addFileToConversation(
            conversationId,
            file.buffer,
            file.originalname,
            fileType,
            "original",
          );

          const fileContent = await parseFileContent(file);
          uploadProgress.set(conversationId, {
            progress: 30,
            status: "正在解析为结构化格式...",
          });

          // 首次上传时将原始文本转为结构化 Markdown（后续 modifySection 和 PDF 渲染依赖标题格式）
          const markdownResponse = await getFastModel().invoke([
            {
              role: "user",
              content: `将以下简历文本转换为结构化 Markdown 格式。用 ## 标题分层，保留全部内容。\n\n${fileContent}`,
            },
          ]);
          let markdownText =
            typeof markdownResponse.content === "string"
              ? markdownResponse.content
              : fileContent;
          // 提取纯 Markdown：去掉 LLM 附加的包装文字
          const mdMatch = markdownText.match(
            /```(?:markdown)?\s*([\s\S]*?)```/,
          );
          if (mdMatch) {
            markdownText = mdMatch[1].trim();
          } else {
            const headingStart = markdownText.search(/^#{1,3}\s/m);
            if (headingStart > 0)
              markdownText = markdownText.slice(headingStart);
          }
          uploadProgress.set(conversationId, {
            progress: 80,
            status: "正在构建索引...",
          });

          const fileRAG = new PDFRAG();
          await fileRAG.loadDocumentsFromText([
            {
              text: markdownText,
              metadata: { source: file.originalname, file_type: "resume" },
            },
          ]);

          const typedChunks = fileRAG.chunks.map((chunk) => ({
            pageContent: chunk.pageContent,
            metadata: chunk.metadata,
            docType: "resume" as const,
          }));
          totalChunkCount += typedChunks.length;

          if (firstFile) {
            firstMarkdownText = markdownText;
            firstOriginalRefId = result.refId;
            getDatabase().prepare(
              "UPDATE conversation_document_refs SET content_snapshot = ? WHERE id = ?"
            ).run(markdownText, result.refId);
            await setConversationChunksWithTypes(
              conversationId,
              typedChunks,
              result.refId,
            );
            firstFile = false;
          } else {
            await appendConversationChunks(
              conversationId,
              typedChunks,
              result.refId,
            );
          }
        }
        await cleanupOldVersions(conversationId, "original", 5);

        console.log(
          "Parsed and cached",
          totalChunkCount,
          "chunks for conversation",
          conversationId,
        );
      }

      uploadProgress.set(conversationId, { progress: 100, status: "完成" });
      setTimeout(() => uploadProgress.delete(conversationId), 30000);

      res.json({ conversationId, initialPrompt, resumeContent: firstMarkdownText, originalRefId: firstOriginalRefId });
    } catch (error) {
      console.error("Error starting conversation:", error);
      res.status(500).json({ error: "Failed to start conversation" });
    } finally {
      if (tempDir) {
        try {
          if (fs.existsSync(tempDir))
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error("Failed to clean up temp dir:", cleanupErr);
        }
      }
    }
  },
);

router.post(
  "/search",
  authMiddleware,
  upload.array("files"),
  async (req: Request, res: Response) => {
    try {
      const {
        query,
        content,
        url,
        k,
        useSystemDocs,
        conversationId,
        messages,
      } = req.body;

      let extractedQuery = query;
      if (!extractedQuery && messages) {
        const lastUserMessage = messages
          .filter((m: any) => m.role === "user")
          .pop();
        extractedQuery =
          lastUserMessage?.parts?.find((p: any) => p.type === "text")?.text ||
          lastUserMessage?.content ||
          "";
      }

      const files = req.files as MulterFile[] | undefined;

      await performSearch(
        {
          query: extractedQuery,
          content,
          files,
          url,
          k,
          useSystemDocs,
          conversationId,
        },
        res,
        req,
      );
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ error: "Failed to search" });
    }
  },
);

router.get("/docs", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.query;
    if (!conversationId) {
      res.status(400).json({ error: "conversationId is required" });
      return;
    }
    const docs = await getConversationDocsByType(
      conversationId as string,
      "reference",
    );
    res.json({ docs });
  } catch (error) {
    console.error("Error getting docs:", error);
    res.status(500).json({ error: "Failed to get documents" });
  }
});

// 获取对话文档历史（原始简历 + 所有修改版本）
router.get(
  "/docs/:conversationId/history",
  authWithUser,
  async (req: Request, res: Response) => {
    try {
      const conversationId = String(req.params.conversationId);
      const userId = (req as any).userId as number;
      const isOwner = await isConversationOwner(conversationId, userId);
      if (!isOwner) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const originals = await getConversationDocsByType(
        conversationId as string,
        "original",
      );
      const modified = await getConversationDocsByType(
        conversationId as string,
        "modified",
      );
      const versions = [
        ...originals.map((d) => ({
          refId: d.id,
          type: "original" as const,
          version: 1,
          fileName: d.original_name,
          fileSize: d.file_size,
          createdAt: d.created_at,
        })),
        ...modified.map((d) => ({
          refId: d.id,
          type: "modified" as const,
          version: d.version,
          fileName: d.original_name,
          fileSize: d.file_size,
          createdAt: d.created_at,
        })),
      ];
      versions.sort((a, b) => a.createdAt - b.createdAt);
      res.json({ versions });
    } catch (error) {
      console.error("Error getting doc history:", error);
      res.status(500).json({ error: "Failed to get document history" });
    }
  },
);

router.post(
  "/docs",
  authMiddleware,
  upload.array("files"),
  async (req: Request, res: Response) => {
    const files = req.files as MulterFile[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    for (const file of files) {
      const decodedName = decodeFilename(file.originalname);
      const filePath = path.join(docsDir, decodedName);
      if (!isPathSafe(filePath)) {
        res.status(400).json({ error: "Invalid filename" });
        return;
      }
      fs.writeFileSync(filePath, file.buffer);
    }

    const newRAG = new PDFRAG({ chunkSize: 1000, chunkOverlap: 200 });
    await newRAG.loadDocuments(docsDir);
    systemRAG.chunks = newRAG.chunks;
    res.json({ message: "Documents added", fileCount: files.length });
  },
);

router.post("/summarize", authWithUser, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId) {
      res.status(400).json({ error: "conversationId is required" });
      return;
    }
    const userId = (req as any).userId as number;
    const isOwner = await isConversationOwner(conversationId, userId);
    if (!isOwner) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const { generateConversationSummary } =
      await import("../../storage/repository");
    const summary = await generateConversationSummary(conversationId);
    res.json({ message: "Summary generated", summary });
  } catch (error) {
    console.error("Error summarizing:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

router.delete(
  "/docs/:refId",
  authWithUser,
  async (req: Request, res: Response) => {
    try {
      const refId = parseInt(req.params.refId as string);
      const conversationId = req.query.conversationId as string;
      if (!conversationId) {
        res
          .status(400)
          .json({ error: "conversationId query param is required" });
        return;
      }
      const userId = (req as any).userId as number;
      const isOwner = await isConversationOwner(conversationId, userId);
      if (!isOwner) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const { removeFileFromConversation } =
        await import("../../storage/file-manager");
      await removeFileFromConversation(conversationId, refId);
      res.json({ message: "Document removed" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  },
);

// 恢复历史版本
router.post(
  "/docs/:refId/restore",
  authWithUser,
  async (req: Request, res: Response) => {
    try {
      const refId = parseInt(req.params.refId as string);
      const userId = (req as any).userId as number;
      const db = getDatabase();

      const ref = db
        .prepare(
          "SELECT r.conversation_id, g.file_path, r.content_snapshot FROM conversation_document_refs r JOIN global_documents g ON r.global_doc_id = g.id WHERE r.id = ?",
        )
        .get(refId) as
        | {
            conversation_id: string;
            file_path: string;
            content_snapshot: string | null;
          }
        | undefined;

      if (!ref) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      const isOwner = await isConversationOwner(ref.conversation_id, userId);
      if (!isOwner) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      let fullText: string;

      if (ref.content_snapshot) {
        // 有结构化快照 → 跳过 PDF 解析，样式完全保留
        fullText = ref.content_snapshot;
      } else {
        // 无快照 → 回溯到 PDF 文本提取
        if (!fs.existsSync(ref.file_path)) {
          res.status(404).json({ error: "File not found on disk" });
          return;
        }
        const pdfBuffer = fs.readFileSync(ref.file_path);
        const pdfParser = new PDFParse({ data: pdfBuffer });
        const pdfData = await pdfParser.getText();
        await pdfParser.destroy();
        fullText = pdfData.text
          .replace(/--\s*\d+\s*of\s*\d+\s*--/g, "")
          .replace(/(?:Page|第)\s*\d+\s*(?:of|\/)\s*\d+/gi, "")
          .replace(/^\s*\d+\s*\/\s*\d+\s*$/gm, "")
          .trim();
      }

      if (fullText.length < 100) {
        res.status(400).json({ error: "该版本 PDF 不包含可恢复的文本内容" });
        return;
      }

      // 重建 chunks
      const updatedRAG = new PDFRAG();
      await updatedRAG.loadDocumentsFromText([
        { text: fullText, metadata: { source: "restored" } },
      ]);
      const updatedChunks = updatedRAG.chunks.map((chunk) => ({
        pageContent: chunk.pageContent,
        metadata: chunk.metadata,
        docType: "resume" as const,
      }));
      await setConversationChunksWithTypes(ref.conversation_id, updatedChunks);

      // 存一条系统提示消息
      await storeMessage(
        ref.conversation_id,
        "assistant",
        "已恢复到旧版本，当前展示的是恢复后的简历内容",
      );

      // 重新生成 PDF
      const aiContent = parseAIContent(fullText);
      const newPdf = await generateResumePDF(structuredClone(aiContent));
      const fileName = `resume_restored_${Date.now()}.pdf`;
      const fileResult = await addFileToConversation(
        ref.conversation_id,
        Buffer.from(newPdf),
        fileName,
        "pdf",
        "modified",
        undefined,
        fullText,
      );
      await cleanupOldVersions(ref.conversation_id, "modified", 5);

      res.json({
        message: "Restored successfully",
        downloadUrl: `/rag/docs/${fileResult.refId}/download`,
        refId: fileResult.refId,
      });
    } catch (error) {
      console.error("Error restoring document:", error);
      res.status(500).json({ error: "Failed to restore document" });
    }
  },
);

router.post(
  "/apply-modification",
  authWithUser,
  upload.none(),
  async (req: Request, res: Response) => {
    try {
      const { conversationId, optimization, type } = req.body;
      const userId = (req as any).userId as number;
      const isOwner = await isConversationOwner(
        conversationId as string,
        userId,
      );
      if (!isOwner) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      let parsedOptimization;
      if (typeof optimization === "string") {
        try {
          parsedOptimization = JSON.parse(optimization);
        } catch {
          res.status(400).json({ error: "Invalid optimization JSON format" });
          return;
        }
      } else {
        parsedOptimization = optimization;
      }

      if (!conversationId || !parsedOptimization) {
        res
          .status(400)
          .json({ error: "conversationId and optimization are required" });
        return;
      }

      const { field, current, suggestion, reason } = parsedOptimization;
      if (!field || !suggestion) {
        res.status(400).json({ error: "field and suggestion are required" });
        return;
      }
      if (!current) {
        res.status(400).json({ error: "current is required for text positioning" });
        return;
      }

      // 优先使用缓存的 chunks（纯文本，不受 PDF 格式影响）
      const typedChunks = await getConversationChunksWithTypes(conversationId);
      const cachedChunks = typedChunks.map((c) => ({
        pageContent: c.pageContent,
        metadata: c.metadata,
      }));
      let fullText = "";

      if (cachedChunks.length > 0) {
        fullText = mergeOverlappingChunks(cachedChunks);
        console.log(
          "[apply-modification] using cached chunks:",
          cachedChunks.length,
          "total length:",
          fullText.length,
        );
      } else {
        // fallback: 按 doc_type=original 精确查找原始简历 PDF
        console.log("[apply-modification] no cached chunks, loading from PDF");
        const originals = await getConversationDocsByType(
          conversationId,
          "original",
        );
        if (originals.length === 0 || !originals[0].file_path) {
          console.error("[apply-modification] no original PDF found");
          res.status(404).json({ error: "Original resume PDF not found" });
          return;
        }
        const pdfPath = originals[0].file_path;

        if (!fs.existsSync(pdfPath)) {
          console.warn("[apply-modification] PDF not found:", pdfPath);
          res.status(404).json({ error: "PDF file not found on disk" });
          return;
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfParser = new PDFParse({ data: pdfBuffer });
        const pdfData = await pdfParser.getText();
        await pdfParser.destroy();
        fullText = pdfData.text;

        if (fullText.trim().length < 100) {
          res.status(400).json({
            error:
              "无法从 PDF 提取文本内容，可能是图片型 PDF。请重新上传包含文本的 PDF 文件。",
          });
          return;
        }
      }

      // 先存储用户消息
      await storeMessage(conversationId, "user", `采纳建议修改：${field}`);
      const perfStart = Date.now();

      const stream = createUIMessageStream({
        async execute({ writer }) {
          const t0 = performance.now();
          const promptFn = (type || "apply") === "accept" ? buildAcceptPrompt : buildApplyPrompt;
          const response = await getChatModel().invoke([
            {
              role: "user",
              content: await promptFn({
                fullText,
                field,
                current,
                suggestion,
                reason: reason || "",
              }),
            },
          ]);
          const newContent =
            typeof response.content === "string" ? response.content.trim() : "";
          console.log("[perf] AI generateText:", performance.now() - t0, "ms");
          console.log("[DEBUG] newContent length:", newContent.length);

          // 用 current 定位 + 替换为 newContent
          const newFullText = replaceText(fullText, current.trim(), newContent);
          console.log("[DEBUG] newFullText length:", newFullText.length);
          console.log(
            "[DEBUG] newFullText first 500:",
            newFullText.slice(0, 500),
          );

          // 解析完整简历生成 PDF
          const sections = parseResumeSections(newFullText);
          const aiContent = sectionsToContentArray(sections);
          console.log("[DEBUG] content items:", aiContent.length);

          console.time("[perf] PDF generation");
          const pdfBuffer = await generateResumePDF(structuredClone(aiContent));
          console.timeEnd("[perf] PDF generation");
          console.log(
            "[DEBUG] pdfBuffer.length:",
            pdfBuffer.length,
            "content items:",
            aiContent.length,
          );

          console.time("[perf] addFileToConversation");
          const fileName = `resume_${Date.now()}.pdf`;
          const fileResult = await addFileToConversation(
            conversationId,
            Buffer.from(pdfBuffer),
            fileName,
            "pdf",
            "modified",
            undefined,
            newFullText,
          );
          console.timeEnd("[perf] addFileToConversation");

          await cleanupOldVersions(conversationId, "modified", 5);
          console.log(
            "[perf] total (since handler):",
            Date.now() - perfStart,
            "ms",
          );

          const toolCallId = `tool-pdf-${Date.now()}`;
          const toolStream = new ReadableStream({
            start(controller) {
              controller.enqueue({
                type: "tool-input-available",
                toolCallId,
                toolName: "generateResumePDF",
                input: {},
                dynamic: true,
              });
              controller.enqueue({
                type: "tool-output-available",
                toolCallId,
                output: {
                  pdfUrl: `/rag/docs/${fileResult.refId}/download`,
                  fileName,
                  refId: fileResult.refId,
                },
                dynamic: true,
              });
              controller.close();
            },
          });
          writer.merge(toolStream);

          const updatedRAG = new PDFRAG();
          await updatedRAG.loadDocumentsFromText([
            { text: newFullText, metadata: { source: "updated" } },
          ]);

          const updatedChunks = updatedRAG.chunks.map((chunk) => ({
            pageContent: chunk.pageContent,
            metadata: chunk.metadata,
            docType: "resume" as const,
          }));
          await setConversationChunksWithTypes(conversationId, updatedChunks);
          console.log(
            "Updated",
            updatedRAG.chunks.length,
            "chunks for conversation",
            conversationId,
          );

          await storeMessage(
            conversationId,
            "assistant",
            `正在处理「${field}」...`,
          );
          await storeMessage(
            conversationId,
            "assistant",
            `已采纳建议并生成修改内容`,
          );
        },
      });

      pipeUIMessageStreamToResponse({ response: res as any, stream });
    } catch (error) {
      console.error("Error applying modification:", error);
      res.status(500).json({ error: "Failed to apply modification" });
    }
  },
);

router.post(
  "/render-resume-pdf",
  authMiddleware,
  upload.none(),
  async (req: Request, res: Response) => {
    try {
      const { markdown } = req.body;
      if (!markdown || typeof markdown !== "string") {
        res.status(400).json({ error: "markdown text is required" });
        return;
      }
      const sections = parseResumeSections(markdown);
      const contentArray = sectionsToContentArray(sections);
      const pdfBuffer = await generateResumePDF(structuredClone(contentArray));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("Error rendering resume PDF:", error);
      res.status(500).json({ error: "Failed to render resume PDF" });
    }
  },
);

router.post(
  "/upload-pdf",
  authMiddleware,
  upload.single("pdf"),
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.body;
      const file = req.file as MulterFile;

      if (!conversationId || !file) {
        res.status(400).json({ error: "conversationId and pdf file required" });
        return;
      }

      const tempDir = path.join(process.cwd(), "temp", conversationId);
      fs.mkdirSync(tempDir, { recursive: true });

      const decodedName = path.basename(decodeFilename(file.originalname));
      const nameWithoutExt = decodedName.replace(/\.[^/.]+$/, "");
      const ext = decodedName.split(".").pop() || "pdf";
      const timestamp = Date.now();
      const newFileName = `${nameWithoutExt}_${timestamp}.${ext}`;
      const filePath = path.join(tempDir, newFileName);
      fs.writeFileSync(filePath, file.buffer);

      res.json({ message: "PDF uploaded successfully" });
    } catch (error) {
      console.error("Error uploading PDF:", error);
      res.status(500).json({ error: "Failed to upload PDF" });
    }
  },
);

router.get(
  "/docs/:refId/download",
  authWithUser,
  async (req: Request, res: Response) => {
    try {
      const refId = parseInt(req.params.refId as string);
      const userId = (req as any).userId as number;
      const db = getDatabase();

      const ref = db
        .prepare(
          "SELECT r.conversation_id, g.file_path, g.file_type, g.original_name FROM conversation_document_refs r JOIN global_documents g ON r.global_doc_id = g.id WHERE r.id = ?",
        )
        .get(refId) as
        | {
            conversation_id: string;
            file_path: string;
            file_type: string;
            original_name: string;
          }
        | undefined;

      if (!ref) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      const isOwner = await isConversationOwner(ref.conversation_id, userId);
      if (!isOwner) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (!fs.existsSync(ref.file_path)) {
        res.status(404).json({ error: "File not found on disk" });
        return;
      }

      const fileBuffer = fs.readFileSync(ref.file_path);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(ref.original_name)}"`,
      );
      res.setHeader("Content-Length", fileBuffer.length);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error serving document:", error);
      res.status(500).json({ error: "Failed to serve document" });
    }
  },
);

export default router;


