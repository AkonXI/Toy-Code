import { app } from 'electron'; import { join } from 'path'; import { existsSync, readFileSync } from 'fs'
import { createHash } from 'crypto'; import { getDb, queryAll, run } from './connection'

const DEFAULT_TOOLS = JSON.stringify(['rect', 'point', 'polyline', 'polygon'])
const DEFAULT_GROUPS = JSON.stringify([
  { id: '1', name: 'red', stroke: '#e53935', fill: 'rgba(229,57,53,0.12)', fillHover: 'rgba(229,57,53,0.04)', label: '红' },
  { id: '2', name: 'yellow', stroke: '#f9a825', fill: 'rgba(249,168,37,0.12)', fillHover: 'rgba(249,168,37,0.04)', label: '黄' },
  { id: '3', name: 'blue', stroke: '#1e88e5', fill: 'rgba(30,136,229,0.12)', fillHover: 'rgba(30,136,229,0.04)', label: '蓝' },
  { id: '4', name: 'green', stroke: '#43a047', fill: 'rgba(67,160,71,0.12)', fillHover: 'rgba(67,160,71,0.04)', label: '绿' }
])

export function migrateDatabase(): void {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS datasets (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,description TEXT DEFAULT '',tools TEXT DEFAULT '${DEFAULT_TOOLS}',groups TEXT DEFAULT '${DEFAULT_GROUPS}',created_at TEXT DEFAULT (datetime('now')))`)
  const dc = tableColumns('datasets')
  if (!dc.includes('tools')) db.exec(`ALTER TABLE datasets ADD COLUMN tools TEXT DEFAULT '${DEFAULT_TOOLS}'`)
  if (!dc.includes('groups')) db.exec(`ALTER TABLE datasets ADD COLUMN groups TEXT DEFAULT '${DEFAULT_GROUPS}'`)
  db.exec(`CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT,dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,filename TEXT NOT NULL,original_name TEXT NOT NULL,md5 TEXT DEFAULT '',width INTEGER DEFAULT 0,height INTEGER DEFAULT 0,created_at TEXT DEFAULT (datetime('now')))`)
  if (!tableColumns('images').includes('md5')) db.exec("ALTER TABLE images ADD COLUMN md5 TEXT DEFAULT ''")
  backfillImageMd5()
  db.exec(`CREATE TABLE IF NOT EXISTS annotations (id INTEGER PRIMARY KEY AUTOINCREMENT,image_id INTEGER NOT NULL UNIQUE REFERENCES images(id) ON DELETE CASCADE,shapes TEXT DEFAULT '[]',meta TEXT DEFAULT '{}',updated_at TEXT DEFAULT (datetime('now')))`)
}
function tableColumns(t: string): string[] { return queryAll<{ name: string }>(`PRAGMA table_info(${t})`).map(c => c.name) }
function storedFileMd5(f: string): string { const p = join(app.getPath('userData'), 'uploads', f); return existsSync(p) ? createHash('md5').update(readFileSync(p)).digest('hex') : '' }
function backfillImageMd5(): void { for (const r of queryAll<{ id: number; filename: string }>("SELECT id, filename FROM images WHERE md5 IS NULL OR md5 = ''")) { const md5 = storedFileMd5(r.filename); if (md5) run('UPDATE images SET md5 = ? WHERE id = ?', [md5, r.id]) } }
