import fs from 'fs'
import { PDFParse } from 'pdf-parse'
import { DocumentLoader } from '../lib/document-loader'
import {
  parseAIContent,
  parseResumeSections,
  sectionsToContentArray,
  generateResumePDF
} from '../lib/resume-pdfmaker'
import { addFileToConversation, cleanupOldVersions } from '../storage/file-manager'
import { setConversationChunksWithTypes, storeMessage } from '../storage/repository'
import { getDatabase } from '../storage/database'

export async function restoreDocument(refId: number): Promise<{
  conversationId: string
  downloadUrl: string
  newRefId: number
}> {
  const db = getDatabase()

  const ref = db
    .prepare(
      'SELECT r.conversation_id, g.file_path, r.content_snapshot, r.version FROM conversation_document_refs r JOIN global_documents g ON r.global_doc_id = g.id WHERE r.id = ?'
    )
    .get(refId) as
    | {
        conversation_id: string
        file_path: string
        content_snapshot: string | null
        version: number
      }
    | undefined

  if (!ref) {
    throw new Error('Document not found')
  }

  let fullText: string

  if (ref.content_snapshot) {
    fullText = ref.content_snapshot
  } else {
    if (!fs.existsSync(ref.file_path)) {
      throw new Error('File not found on disk')
    }
    const pdfBuffer = fs.readFileSync(ref.file_path)
    const pdfParser = new PDFParse({ data: pdfBuffer })
    const pdfData = await pdfParser.getText()
    await pdfParser.destroy()
    fullText = pdfData.text
      .replace(/--\s*\d+\s*of\s*\d+\s*--/g, '')
      .replace(/(?:Page|第)\s*\d+\s*(?:of|\/)\s*\d+/gi, '')
      .replace(/^\s*\d+\s*\/\s*\d+\s*$/gm, '')
      .trim()
  }

  if (fullText.length < 100) {
    throw new Error('该版本 PDF 不包含可恢复的文本内容')
  }

  const updatedRAG = new DocumentLoader()
  await updatedRAG.loadDocumentsFromText([{ text: fullText, metadata: { source: 'restored' } }])
  const updatedChunks = updatedRAG.chunks.map((chunk) => ({
    pageContent: chunk.pageContent,
    metadata: chunk.metadata,
    docType: 'resume' as const
  }))
  await setConversationChunksWithTypes(ref.conversation_id, updatedChunks)

  await storeMessage(ref.conversation_id, 'assistant', `已恢复到版本 v${ref.version}`)

  const aiContent = parseAIContent(fullText)
  const newPdf = await generateResumePDF(structuredClone(aiContent))
  const fileName = `resume_restored_${Date.now()}.pdf`
  const fileResult = await addFileToConversation(
    ref.conversation_id,
    Buffer.from(newPdf),
    fileName,
    'pdf',
    'modified',
    undefined,
    fullText
  )
  await cleanupOldVersions(ref.conversation_id, 'modified', 5)

  return {
    conversationId: ref.conversation_id,
    downloadUrl: `/rag/docs/${fileResult.refId}/download`,
    newRefId: fileResult.refId
  }
}
