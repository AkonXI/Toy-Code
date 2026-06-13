import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { createAuthMiddleware } from '../auth/token'

const upload = multer({ storage: multer.memoryStorage() })
import {
  getSystemDoc,
  getSystemDocWithFilePath,
  listSystemDocs,
  createSystemDoc,
  deleteSystemDoc,
  updateSystemDocActive,
  decrementGlobalDocRefCount,
  getGlobalDocRefCount,
  deleteGlobalDoc
} from '../storage/repository'
import { deleteSystemChunks } from '../lib/vector-db'
import { processDocumentUpload, indexDocumentChunks } from '../services/document-service'

const router: Router = Router()
const authMiddleware = createAuthMiddleware()

router.post(
  '/system-documents',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { docType, category } = req.body
      if (!docType || !['excellent_resume', 'reference_doc'].includes(docType)) {
        res.status(400).json({ error: 'docType must be excellent_resume or reference_doc' })
        return
      }
      if (!category) {
        res.status(400).json({ error: 'category is required' })
        return
      }
      const file = (req as any).file
      if (!file) {
        res.status(400).json({ error: 'File is required' })
        return
      }
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')

      const processed = await processDocumentUpload(
        {
          buffer: file.buffer,
          originalname: originalName,
          mimetype: file.mimetype,
          size: file.size
        },
        originalName
      )
      createSystemDoc(processed.globalDocId, docType, category, originalName)

      const chunksCount = await indexDocumentChunks(
        processed.fileContent,
        originalName,
        processed.globalDocId,
        docType,
        category,
        'system'
      )
      res.json({
        message: 'System document uploaded',
        globalDocId: processed.globalDocId,
        chunksCount
      })
    } catch (error: any) {
      if (error.message?.includes('too short')) {
        res.status(400).json({ error: 'File content too short' })
        return
      }
      console.error('Error uploading system document:', error)
      res.status(500).json({ error: 'Failed to upload system document' })
    }
  }
)

router.delete('/system-documents/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const doc = getSystemDocWithFilePath(id)
    if (!doc) {
      res.status(404).json({ error: 'System document not found' })
      return
    }
    await deleteSystemChunks(doc.global_doc_id)
    deleteSystemDoc(id)
    decrementGlobalDocRefCount(doc.global_doc_id)
    const refCount = getGlobalDocRefCount(doc.global_doc_id)
    if (refCount <= 0) {
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path)
      }
      deleteGlobalDoc(doc.global_doc_id)
    }
    res.json({ message: 'System document deleted' })
  } catch (error) {
    console.error('Error deleting system document:', error)
    res.status(500).json({ error: 'Failed to delete system document' })
  }
})

router.get('/system-documents', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = listSystemDocs()
    res.json({ data: rows })
  } catch (error) {
    console.error('Error listing system documents:', error)
    res.status(500).json({ error: 'Failed to list system documents' })
  }
})

router.get('/system-documents/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const row = getSystemDoc(id)
    if (!row) {
      res.status(404).json({ error: 'System document not found' })
      return
    }
    res.json({ data: row })
  } catch (error) {
    console.error('Error fetching system document:', error)
    res.status(500).json({ error: 'Failed to fetch system document' })
  }
})

router.patch('/system-documents/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10)
    const { active } = req.body
    if (active !== 0 && active !== 1) {
      res.status(400).json({ error: 'active must be 0 or 1' })
      return
    }
    const changes = updateSystemDocActive(id, active)
    if (changes === 0) {
      res.status(404).json({ error: 'System document not found' })
      return
    }
    res.json({ data: { id, active } })
  } catch (error) {
    console.error('Error updating system document:', error)
    res.status(500).json({ error: 'Failed to update system document' })
  }
})

export default router
