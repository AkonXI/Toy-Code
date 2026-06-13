import { Router, Request, Response } from 'express'
import fs from 'fs'
import { createAuthMiddleware, createAuthWithUserMiddleware } from '../auth/token'
import { getConversationDocsByType, removeFileFromConversation } from '../storage/file-manager'
import { isConversationOwner } from '../storage/repository'
import { getDatabase } from '../storage/database'
import { restoreDocument } from '../services/restore-document'

const router: Router = Router()
const authMiddleware = createAuthMiddleware()
const authWithUser = createAuthWithUserMiddleware()

router.get('/docs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.query
    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required' })
      return
    }
    const docs = await getConversationDocsByType(conversationId as string, 'reference')
    res.json({ docs })
  } catch (error) {
    console.error('Error getting docs:', error)
    res.status(500).json({ error: 'Failed to get documents' })
  }
})

router.get('/docs/:conversationId/history', authWithUser, async (req: Request, res: Response) => {
  try {
    const conversationId = String(req.params.conversationId)
    const userId = (req as any).userId as number
    const isOwner = await isConversationOwner(conversationId, userId)
    if (!isOwner) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
    const originals = await getConversationDocsByType(conversationId, 'original')
    const modified = await getConversationDocsByType(conversationId, 'modified')
    const versions = [
      ...originals.map((d) => ({
        refId: d.id,
        type: 'original' as const,
        version: 1,
        fileName: d.original_name,
        fileSize: d.file_size,
        createdAt: d.created_at
      })),
      ...modified.map((d) => ({
        refId: d.id,
        type: 'modified' as const,
        version: d.version,
        fileName: d.original_name,
        fileSize: d.file_size,
        createdAt: d.created_at
      }))
    ]
    versions.sort((a, b) => a.createdAt - b.createdAt)
    res.json({ versions })
  } catch (error) {
    console.error('Error getting doc history:', error)
    res.status(500).json({ error: 'Failed to get document history' })
  }
})

router.delete('/docs/:refId', authWithUser, async (req: Request, res: Response) => {
  try {
    const refId = parseInt(req.params.refId as string)
    const conversationId = req.query.conversationId as string
    if (!conversationId) {
      res.status(400).json({ error: 'conversationId query param is required' })
      return
    }
    const userId = (req as any).userId as number
    const isOwner = await isConversationOwner(conversationId, userId)
    if (!isOwner) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
    await removeFileFromConversation(conversationId, refId)
    res.json({ message: 'Document removed' })
  } catch (error) {
    console.error('Error deleting document:', error)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

router.post('/docs/:refId/restore', authWithUser, async (req: Request, res: Response) => {
  try {
    const refId = parseInt(req.params.refId as string)
    const userId = (req as any).userId as number
    const { conversationId, downloadUrl, newRefId } = await restoreDocument(refId)
    const isOwner = await isConversationOwner(conversationId, userId)
    if (!isOwner) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
    res.json({ message: 'Restored successfully', downloadUrl, refId: newRefId })
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('不包含')) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Error restoring document:', error)
    res.status(500).json({ error: 'Failed to restore document' })
  }
})

router.get('/docs/:refId/download', authWithUser, async (req: Request, res: Response) => {
  try {
    const refId = parseInt(req.params.refId as string)
    const userId = (req as any).userId as number
    const db = getDatabase()

    const ref = db
      .prepare(
        'SELECT r.conversation_id, g.file_path, g.file_type, g.original_name FROM conversation_document_refs r JOIN global_documents g ON r.global_doc_id = g.id WHERE r.id = ?'
      )
      .get(refId) as
      | { conversation_id: string; file_path: string; file_type: string; original_name: string }
      | undefined

    if (!ref) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    const isOwner = await isConversationOwner(ref.conversation_id, userId)
    if (!isOwner) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    if (!fs.existsSync(ref.file_path)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }

    const fileBuffer = fs.readFileSync(ref.file_path)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(ref.original_name)}"`
    )
    res.setHeader('Content-Length', fileBuffer.length)
    res.send(fileBuffer)
  } catch (error) {
    console.error('Error serving document:', error)
    res.status(500).json({ error: 'Failed to serve document' })
  }
})

export default router
