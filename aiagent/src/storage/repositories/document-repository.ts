import { getDatabase } from '../database'

export interface GlobalDocument {
  id: number
  file_hash: string
  file_path: string
  original_name: string
  file_type: string
  file_size: number
  reference_count: number
  created_at: number
}

export interface SystemDocument {
  id: number
  global_doc_id: number
  doc_type: string
  category: string
  local_name: string
  active: number
  created_at: number
}

export interface SystemDocumentWithMeta extends SystemDocument {
  file_type: string
  file_size: number
  original_name: string
  file_path?: string
}

export interface UserDocument {
  id: number
  user_id: number
  global_doc_id: number
  doc_type: string
  category: string | null
  local_name: string
  active: number
  created_at: number
}

export interface UserDocumentWithMeta extends UserDocument {
  file_type: string
  file_size: number
  original_name: string
}

export function getGlobalDocByHash(fileHash: string): GlobalDocument | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM global_documents WHERE file_hash = ?').get(fileHash) as
    | GlobalDocument
    | undefined
}

export function createGlobalDoc(
  fileHash: string,
  filePath: string,
  originalName: string,
  fileType: string,
  fileSize: number
): number {
  const db = getDatabase()
  const result = db
    .prepare(
      `INSERT INTO global_documents (file_hash, file_path, original_name, file_type, file_size, reference_count, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    )
    .run(fileHash, filePath, originalName, fileType, fileSize, Date.now())
  return result.lastInsertRowid as number
}

export function incrementGlobalDocRefCount(id: number): void {
  const db = getDatabase()
  db.prepare('UPDATE global_documents SET reference_count = reference_count + 1 WHERE id = ?').run(
    id
  )
}

export function decrementGlobalDocRefCount(id: number): void {
  const db = getDatabase()
  db.prepare('UPDATE global_documents SET reference_count = reference_count - 1 WHERE id = ?').run(
    id
  )
}

export function getGlobalDocRefCount(id: number): number {
  const db = getDatabase()
  const row = db.prepare('SELECT reference_count FROM global_documents WHERE id = ?').get(id) as
    | { reference_count: number }
    | undefined
  return row?.reference_count ?? 0
}

export function deleteGlobalDoc(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM global_documents WHERE id = ?').run(id)
}

export function createSystemDoc(
  globalDocId: number,
  docType: string,
  category: string,
  localName: string
): number {
  const db = getDatabase()
  const result = db
    .prepare(
      `INSERT INTO system_documents (global_doc_id, doc_type, category, local_name, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(globalDocId, docType, category, localName, Date.now())
  return result.lastInsertRowid as number
}

export function getSystemDoc(id: number): SystemDocumentWithMeta | undefined {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT s.id, s.global_doc_id, s.doc_type, s.category, s.local_name, s.active, s.created_at,
              g.file_type, g.file_size, g.original_name
       FROM system_documents s
       JOIN global_documents g ON s.global_doc_id = g.id
       WHERE s.id = ?`
    )
    .get(id) as SystemDocumentWithMeta | undefined
}

export function getSystemDocWithFilePath(id: number):
  | {
      global_doc_id: number
      file_path: string
    }
  | undefined {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT s.global_doc_id, g.file_path
       FROM system_documents s
       JOIN global_documents g ON s.global_doc_id = g.id
       WHERE s.id = ?`
    )
    .get(id) as { global_doc_id: number; file_path: string } | undefined
}

export function listSystemDocs(): SystemDocumentWithMeta[] {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT s.id, s.global_doc_id, s.doc_type, s.category, s.local_name, s.active, s.created_at,
              g.file_type, g.file_size, g.original_name
       FROM system_documents s
       JOIN global_documents g ON s.global_doc_id = g.id
       ORDER BY s.created_at DESC`
    )
    .all() as SystemDocumentWithMeta[]
}

export function deleteSystemDoc(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM system_documents WHERE id = ?').run(id)
}

export function updateSystemDocActive(id: number, active: number): number {
  const db = getDatabase()
  const result = db.prepare('UPDATE system_documents SET active = ? WHERE id = ?').run(active, id)
  return result.changes
}

export function createUserDoc(
  userId: number,
  globalDocId: number,
  docType: string,
  category: string | null,
  localName: string
): number {
  const db = getDatabase()
  const result = db
    .prepare(
      `INSERT INTO user_documents (user_id, global_doc_id, doc_type, category, local_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, globalDocId, docType, category, localName, Date.now())
  return result.lastInsertRowid as number
}

export function listUserDocs(userId: number): UserDocumentWithMeta[] {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT u.id, u.user_id, u.global_doc_id, u.doc_type, u.category, u.local_name, u.active, u.created_at,
              g.file_type, g.file_size, g.original_name
       FROM user_documents u
       JOIN global_documents g ON u.global_doc_id = g.id
       WHERE u.user_id = ?
       ORDER BY u.created_at DESC`
    )
    .all(userId) as UserDocumentWithMeta[]
}

export function getUserDoc(
  id: number,
  userId: number
): { global_doc_id: number; file_path: string } | undefined {
  const db = getDatabase()
  return db
    .prepare(
      `SELECT u.global_doc_id, g.file_path
       FROM user_documents u
       JOIN global_documents g ON u.global_doc_id = g.id
       WHERE u.id = ? AND u.user_id = ?`
    )
    .get(id, userId) as { global_doc_id: number; file_path: string } | undefined
}

export function deleteUserDoc(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM user_documents WHERE id = ?').run(id)
}

export function updateUserDocActive(id: number, userId: number, active: number): number {
  const db = getDatabase()
  const result = db
    .prepare('UPDATE user_documents SET active = ? WHERE id = ? AND user_id = ?')
    .run(active, id, userId)
  return result.changes
}
