import { Router, Request, Response } from 'express'
import { createAuthMiddleware } from '../auth/token'
import { upload } from '../utils/multer'
import { MulterFile } from '../utils/file-parser'
import { startConversation, getUploadProgress } from '../services/start-conversation'

const router: Router = Router()
const authMiddleware = createAuthMiddleware()

router.get('/start/progress/:convId', authMiddleware, async (req: Request, res: Response) => {
  const data = getUploadProgress(String(req.params.convId))
  if (!data) return res.json({ progress: 100, status: '完成' })
  res.json(data)
})

router.post(
  '/start',
  authMiddleware,
  upload.array('files'),
  async (req: Request, res: Response) => {
    req.setTimeout(240000)
    try {
      const files = req.files as MulterFile[]
      const query = req.body.query
      const result = await startConversation(files, query, req)
      res.json(result)
    } catch (error: any) {
      if (error.message?.includes('不是简历')) {
        res.status(400).json({ error: error.message })
        return
      }
      console.error('Error starting conversation:', error)
      res.status(500).json({ error: 'Failed to start conversation' })
    }
  }
)

export default router
