import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import { createAuthWithUserMiddleware } from '../auth/token'
import { getUserByPhone } from '../storage/repository'
import {
  listUserDocs,
  getUserDoc,
  deleteUserDoc,
  updateUserDocActive,
  createUserDoc,
  decrementGlobalDocRefCount,
  getGlobalDocRefCount,
  deleteGlobalDoc
} from '../storage/repository'
import { deleteUserChunks } from '../lib/vector-db'
import { processDocumentUpload, indexDocumentChunks } from '../services/document-service'

const router: Router = Router()
const authWithUser = createAuthWithUserMiddleware()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/profile', authWithUser, async (req: Request, res: Response) => {
  try {
    const phone = (req as any).username?.replace(/^user_/, '')
    if (!phone) {
      res.status(401).json({ error: 'Token required' })
      return
    }
    const user = await getUserByPhone(phone)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(user)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

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
      createUserDoc(userId, processed.globalDocId, docType, category || null, originalName)

      const chunksCount = await indexDocumentChunks(
        processed.fileContent,
        originalName,
        processed.globalDocId,
        docType,
        category || null,
        'user',
        userId
      )
      res.json({
        message: 'User document uploaded',
        globalDocId: processed.globalDocId,
        chunksCount
      })
    } catch (error: any) {
      if (error.message?.includes('too short')) {
        res.status(400).json({ error: 'File content too short' })
        return
      }
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
    await deleteUserChunks(userId, doc.global_doc_id)
    deleteUserDoc(id)
    decrementGlobalDocRefCount(doc.global_doc_id)
    const refCount = getGlobalDocRefCount(doc.global_doc_id)
    if (refCount <= 0) {
      if (fsSync.existsSync(doc.file_path)) {
        await fs.unlink(doc.file_path)
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
