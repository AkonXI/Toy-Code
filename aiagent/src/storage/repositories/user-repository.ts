import crypto from 'crypto'
import { getDatabase } from '../database'

export interface User {
  id: number
  phone: string
  nickname: string
  created_at: number
  updated_at: number
}

export function ensureUser(phone: string): number {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) as
    | { id: number }
    | undefined
  if (existing) return existing.id

  const now = Date.now()
  const nickname = `user_${phone}`
  const result = db
    .prepare('INSERT INTO users (phone, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(phone, nickname, now, now)
  return result.lastInsertRowid as number
}

export function recordLogin(userId: number, token: string, ip?: string | null, userAgent?: string) {
  const db = getDatabase()
  const now = Date.now()
  const hashed = crypto.createHash('sha256').update(token).digest('hex')
  db.prepare(
    'INSERT INTO login_history (user_id, token, ip, user_agent, login_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, hashed, ip || null, userAgent || null, now)
  db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(now, userId)
}

export function getUserIdByPhone(phone: string): number | null {
  const db = getDatabase()
  const row = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) as
    | { id: number }
    | undefined
  return row ? row.id : null
}

export function getUserByPhone(phone: string): User | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT id, phone, nickname, created_at, updated_at FROM users WHERE phone = ?')
    .get(phone) as User | undefined
  return row || null
}
