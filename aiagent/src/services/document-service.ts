import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import { DocumentLoader } from '../lib/document-loader'
import {
  getGlobalDocByHash,
  createGlobalDoc,
  incrementGlobalDocRefCount
} from '../storage/repository'
import { parseFileContent, MulterFile } from '../utils/file-parser'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents', 'by_hash')
if (!fsSync.existsSync(UPLOADS_DIR)) {
  fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })
}

export interface ProcessedDocument {
  fileContent: string
  fileHash: string
  filePath: string
  ext: string
  fileSize: number
  globalDocId: number
}

export async function processDocumentUpload(
  file: MulterFile,
  originalName: string
): Promise<ProcessedDocument> {
  const fileContent = await parseFileContent({
    buffer: file.buffer,
    originalname: originalName,
    mimetype: file.mimetype,
    size: file.size
  })

  if (fileContent.trim().length < 100) {
    throw new Error('File content too short')
  }

  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const ext = originalName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt'
  const fileName = `${fileHash}.${ext}`
  const filePath = path.join(UPLOADS_DIR, fileName)

  if (!fsSync.existsSync(filePath)) {
    await fs.writeFile(filePath, file.buffer)
  }

  const existingGlobal = getGlobalDocByHash(fileHash)
  let globalDocId: number
  if (existingGlobal) {
    globalDocId = existingGlobal.id
    incrementGlobalDocRefCount(globalDocId)
  } else {
    globalDocId = createGlobalDoc(fileHash, filePath, originalName, ext, file.buffer.length)
  }

  return { fileContent, fileHash, filePath, ext, fileSize: file.buffer.length, globalDocId }
}

export async function indexDocumentChunks(
  text: string,
  source: string,
  globalDocId: number,
  docType: string,
  category: string | undefined | null,
  scope: 'system' | 'user',
  userId?: number
): Promise<number> {
  const rag = new DocumentLoader()
  await rag.loadDocumentsFromText([{ text, metadata: { source, file_type: scope } }])

  if (rag.chunks.length > 0) {
    const { indexSystemDocumentChunks, indexUserDocumentChunks } = await import('../lib/vector-db')
    if (scope === 'system') {
      await indexSystemDocumentChunks(
        globalDocId,
        rag.chunks.map((c, i) => ({ pageContent: c.pageContent, chunkIndex: i })),
        docType,
        category || ''
      )
    } else if (userId) {
      await indexUserDocumentChunks(
        userId,
        globalDocId,
        rag.chunks.map((c, i) => ({ pageContent: c.pageContent, chunkIndex: i })),
        docType,
        category || undefined
      )
    }
  }

  return rag.chunks.length
}
