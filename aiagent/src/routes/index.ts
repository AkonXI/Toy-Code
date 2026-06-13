import { Router } from 'express'
import ragStart from '../controllers/rag-start'
import ragSearch from '../controllers/rag-search'
import ragModify from '../controllers/rag-modify'
import ragDocuments from '../controllers/rag-documents'
import ragSummarize from '../controllers/rag-summarize'
import authRoute from '../auth'
import captchaRouter from '../auth/captcha'
import userRoute from '../controllers/user'
import conversationRoute from '../controllers/conversation'
import adminRoute from '../controllers/admin'

const ragRouter = Router()
ragRouter.use(ragStart)
ragRouter.use(ragSearch)
ragRouter.use(ragModify)
ragRouter.use(ragDocuments)
ragRouter.use(ragSummarize)

const routes: { name: string; handler: Router }[] = [
  { name: 'admin', handler: adminRoute },
  { name: 'rag', handler: ragRouter },
  { name: 'auth', handler: authRoute },
  { name: 'captcha', handler: captchaRouter },
  { name: 'user', handler: userRoute },
  { name: 'conversations', handler: conversationRoute }
]

export default routes
