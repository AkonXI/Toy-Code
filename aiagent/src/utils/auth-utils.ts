import { Request } from 'express'
import { verifyToken } from '../auth/token'
import { getUserIdByPhone } from '../storage/repositories/user-repository'

export async function extractUserId(req: Request): Promise<number | null> {
  const token = (req.headers['token'] as string) || (req.headers['Token'] as string)
  if (!token) return null
  const username = await verifyToken(token)
  if (!username) return null
  const phone = username.replace(/^user_/, '')
  return getUserIdByPhone(phone)
}
