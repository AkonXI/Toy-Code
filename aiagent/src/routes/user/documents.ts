import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { DocumentLoader } from '../../lib/document-loader'
import { createAuthWithUserMiddleware } from '../../auth/token'
import {
  getGlobalDocByHash,
  createGlobalDoc,
  incrementGlobalDocRefCount,
  decrementGlobalDocRefCount,
  getGlobalDocRefCount,
  deleteGlobalDoc,
  createUserDoc,
  listUserDocs,
  getUserDoc,
  deleteUserDoc,
  updateUserDocActive
} from '../../storage/repository'

const router: Router = Router()
const authWithUser = createAuthWithUserMiddleware()
const upload = multer({ storage: multer.memoryStorage() })

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents', 'by_hash')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

router.post(
  '/documents',
  authWithUser,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number
      const { docType, category } = req.body

      if (!docType || !['excellent_resume', 'reference_doc'].includes(docType)) {
        res.status(400).json({ error: 'docType must be excellent_resume or reference_doc' })
        return
      }

      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'File is required' })
        return
      }

      // 修复中文文件名乱码
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')

      let fileContent = file.buffer.toString('utf-8')
      if (originalName.toLowerCase().endsWith('.pdf')) {
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: file.buffer })
        const pdfData = await parser.getText()
        await parser.destroy()
        fileContent = pdfData.text
      }
      if (fileContent.trim().length < 100) {
        res.status(400).json({ error: 'File content too short' })
        return
      }

      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex')
      const ext = originalName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt'
      const fileName = `${fileHash}.${ext}`
      const filePath = path.join(UPLOADS_DIR, fileName)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file.buffer)
      }

      let globalDocId: number
      const existingGlobal = getGlobalDocByHash(fileHash)
      if (existingGlobal) {
        globalDocId = existingGlobal.id
        incrementGlobalDocRefCount(globalDocId)
      } else {
        globalDocId = createGlobalDoc(fileHash, filePath, originalName, ext, file.buffer.length)
      }

      createUserDoc(userId, globalDocId, docType, category || null, originalName)

      const rag = new DocumentLoader()
      await rag.loadDocumentsFromText([
        { text: fileContent, metadata: { source: originalName, file_type: 'user' } }
      ])
      if (rag.chunks.length > 0) {
        const { indexUserDocumentChunks } = await import('../../lib/vector-db')
        await indexUserDocumentChunks(
          userId,
          globalDocId,
          rag.chunks.map((c, i) => ({ pageContent: c.pageContent, chunkIndex: i })),
          docType,
          category || undefined
        )
      }

      res.json({
        message: 'User document uploaded',
        globalDocId,
        chunksCount: rag.chunks.length
      })
    } catch (error) {
      console.error('Error uploading user document:', error)
      res.status(500).json({ error: 'Failed to upload user document' })
    }
  }
)

router.get('/documents', authWithUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number
    const rows = listUserDocs(userId)
    res.json({ data: rows })
  } catch (error) {
    console.error('Error listing user documents:', error)
    res.status(500).json({ error: 'Failed to list user documents' })
  }
})

router.delete('/documents/:id', authWithUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number
    const id = parseInt(req.params.id as string)

    const doc = getUserDoc(id, userId)
    if (!doc) {
      res.status(404).json({ error: 'User document not found' })
      return
    }

    const { deleteUserChunks } = await import('../../lib/vector-db')
    await deleteUserChunks(userId, doc.global_doc_id)

    deleteUserDoc(id)
    decrementGlobalDocRefCount(doc.global_doc_id)

    const refCount = getGlobalDocRefCount(doc.global_doc_id)
    if (refCount <= 0) {
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path)
      }
      deleteGlobalDoc(doc.global_doc_id)
    }

    res.json({ message: 'User document deleted' })
  } catch (error) {
    console.error('Error deleting user document:', error)
    res.status(500).json({ error: 'Failed to delete user document' })
  }
})

router.patch('/documents/:id', authWithUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number
    const id = parseInt(req.params.id as string, 10)
    const { active } = req.body

    if (active !== 0 && active !== 1) {
      res.status(400).json({ error: 'active must be 0 or 1' })
      return
    }

    const changes = updateUserDocActive(id, userId, active)
    if (changes === 0) {
      res.status(404).json({ error: 'User document not found' })
      return
    }

    res.json({ data: { id, active } })
  } catch (error) {
    console.error('Error updating user document:', error)
    res.status(500).json({ error: 'Failed to update user document' })
  }
})

export default router
