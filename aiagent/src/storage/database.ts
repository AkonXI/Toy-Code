import path from 'path'

import fs from 'fs'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    const dbPath = path.join(dataDir, 'resume.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')
    db.exec(schema)

    try { db.exec('ALTER TABLE messages ADD COLUMN client_id TEXT') } catch {}
    try { db.exec('ALTER TABLE messages ADD COLUMN status TEXT DEFAULT \'completed\'') } catch {}
    try { db.exec('ALTER TABLE messages ADD COLUMN summarized INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE user_documents ADD COLUMN category TEXT') } catch {}
    try { db.exec('ALTER TABLE user_documents ADD COLUMN active INTEGER DEFAULT 1') } catch {}

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        global_doc_id INTEGER NOT NULL,
        doc_type TEXT NOT NULL CHECK(doc_type IN ('excellent_resume', 'reference_doc')),
        category TEXT,
        local_name TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (global_doc_id) REFERENCES global_documents(id)
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents(user_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_user_documents_global ON user_documents(global_doc_id)`)

    console.log('SQLite database initialized at:', dbPath)
  }
  return db
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
    console.log('SQLite database closed')
  }
}
