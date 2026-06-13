import { Router, Request, Response } from 'express'
import { upload } from '../utils/multer'
import { MulterFile } from '../utils/file-parser'
import { performSearch } from '../services/perform-search'
import { createAuthMiddleware } from '../auth/token'

const router: Router = Router()
const authMiddleware = createAuthMiddleware()

router.post(
  '/search',
  authMiddleware,
  upload.array('files'),
  async (req: Request, res: Response) => {
    try {
      const { query, content, url, k, conversationId, messages, userMsgId, assistantMsgId } =
        req.body

      let extractedQuery = query
      if (!extractedQuery && messages) {
        const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()
        extractedQuery =
          lastUserMessage?.parts?.find((p: any) => p.type === 'text')?.text ||
          lastUserMessage?.content ||
          ''
      }

      const files = req.files as MulterFile[] | undefined

      await performSearch(
        {
          query: extractedQuery,
          content,
          files,
          url,
          k,
          conversationId,
          userMsgId,
          assistantMsgId
        },
        res,
        req
      )
    } catch (error) {
      console.error('Error searching:', error)
      res.status(500).json({ error: 'Failed to search' })
    }
  }
)

export default router
