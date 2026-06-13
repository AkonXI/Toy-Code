import { Router, Request, Response } from 'express'
import { createAuthWithUserMiddleware } from '../auth/token'
import { isConversationOwner } from '../storage/repository'
import { generateConversationSummary } from '../storage/summary-manager'

const router: Router = Router()
const authWithUser = createAuthWithUserMiddleware()

router.post('/summarize', authWithUser, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.body
    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required' })
      return
    }
    const userId = (req as any).userId as number
    const isOwner = await isConversationOwner(conversationId, userId)
    if (!isOwner) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
    const summary = await generateConversationSummary(conversationId)
    res.json({ message: 'Summary generated', summary })
  } catch (error) {
    console.error('Error summarizing:', error)
    res.status(500).json({ error: 'Failed to generate summary' })
  }
})

export default router
