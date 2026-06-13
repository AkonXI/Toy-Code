import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { verifyCaptcha } from './captcha'
import { storeToken, verifyToken, removeToken } from './token'
import { ensureUser, recordLogin } from '../storage/repository'

const router: Router = Router()

router.post('/login', async (req: Request, res: Response) => {
  const { phone, captcha, key } = req.body

  if (!phone || !captcha || !key) {
    res.status(400).json({ error: 'Phone, captcha and key are required' })
    return
  }

  const result = await verifyCaptcha(key, captcha)
  if (!result.valid) {
    res.status(400).json({ error: 'Invalid or expired captcha' })
    return
  }

  const username = `user_${phone}`
  const token = crypto.randomUUID()
  await storeToken(token, username, 86400)

  const userId = await ensureUser(phone)
  const ip = req.ip || req.socket.remoteAddress
  const userAgent = req.headers['user-agent'] as string
  await recordLogin(userId, token, ip, userAgent)

  res.json({ message: 'Login successful', token, username })
})

router.post('/logout', async (req: Request, res: Response) => {
  const token = (req.headers['token'] as string) || (req.headers['Token'] as string)

  if (token) {
    await removeToken(token)
  }

  res.json({ message: 'Logged out' })
})

export default router
export { verifyToken }
