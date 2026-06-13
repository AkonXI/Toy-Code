import { Router, Request, Response } from 'express'
import { createAuthMiddleware, createAuthWithUserMiddleware } from '../auth/token'
import { upload } from '../utils/multer'
import { applyModification, renderResumePdf } from '../services/apply-modification'
import { isConversationOwner } from '../storage/repository'

const router: Router = Router()
const authMiddleware = createAuthMiddleware()
const authWithUser = createAuthWithUserMiddleware()

router.post(
  '/apply-modification',
  authWithUser,
  upload.none(),
  async (req: Request, res: Response) => {
    try {
      const { conversationId, optimization, type, clientIds, assistantMsgId } = req.body
      const userId = (req as any).userId as number
      const isOwner = await isConversationOwner(conversationId, userId)
      if (!isOwner) {
        res.status(403).json({ error: 'Access denied' })
        return
      }

      let parsedOptimization
      if (typeof optimization === 'string') {
        try {
          parsedOptimization = JSON.parse(optimization)
        } catch {
          res.status(400).json({ error: 'Invalid optimization JSON format' })
          return
        }
      } else {
        parsedOptimization = optimization
      }

      if (!conversationId || !parsedOptimization) {
        res.status(400).json({ error: 'conversationId and optimization are required' })
        return
      }

      const { field, current, suggestion, reason } = parsedOptimization
      if (!field || !suggestion) {
        res.status(400).json({ error: 'field and suggestion are required' })
        return
      }
      if (!current) {
        res.status(400).json({ error: 'current is required for text positioning' })
        return
      }

      await applyModification(
        { conversationId, optimization: parsedOptimization, type, clientIds, assistantMsgId },
        res
      )
    } catch (error) {
      console.error('Error applying modification:', error)
      res.status(500).json({ error: 'Failed to apply modification' })
    }
  }
)

router.post(
  '/render-resume-pdf',
  authMiddleware,
  upload.none(),
  async (req: Request, res: Response) => {
    try {
      const { markdown } = req.body
      if (!markdown || typeof markdown !== 'string') {
        res.status(400).json({ error: 'markdown text is required' })
        return
      }
      const pdfBuffer = await renderResumePdf(markdown)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', pdfBuffer.length)
      res.send(Buffer.from(pdfBuffer))
    } catch (error) {
      console.error('Error rendering resume PDF:', error)
      res.status(500).json({ error: 'Failed to render resume PDF' })
    }
  }
)

export default router
