import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai'
import fs from 'fs'
import { getChatModel } from '../lib/providers'
import { buildApplyPrompt, buildAcceptPrompt } from '../lib/prompts'
import {
  parseResumeSections,
  sectionsToContentArray,
  generateResumePDF
} from '../lib/resume-pdfmaker'
import { replaceText } from '../lib/resume-markdown'
import { DocumentLoader } from '../lib/document-loader'
import {
  addFileToConversation,
  cleanupOldVersions,
  getConversationDocsByType
} from '../storage/file-manager'
import {
  getConversationChunksWithTypes,
  setConversationChunksWithTypes,
  storeMessage
} from '../storage/repository'
import { mergeOverlappingChunks } from '../utils/text-utils'
import { PDFParse } from 'pdf-parse'
import type { Response } from 'express'

export async function applyModification(
  params: {
    conversationId: string
    optimization: any
    type?: string
    clientIds?: { user?: string; processing?: string }
    assistantMsgId?: string
  },
  res: Response
) {
  const { conversationId, optimization, type, clientIds, assistantMsgId } = params

  const typedChunks = await getConversationChunksWithTypes(conversationId)
  const cachedChunks = typedChunks.map((c) => ({
    pageContent: c.pageContent,
    metadata: c.metadata
  }))
  let fullText = ''

  if (cachedChunks.length > 0) {
    fullText = mergeOverlappingChunks(cachedChunks)
    console.log(
      '[apply-modification] using cached chunks:',
      cachedChunks.length,
      'total length:',
      fullText.length
    )
  } else {
    console.log('[apply-modification] no cached chunks, loading from PDF')
    const originals = await getConversationDocsByType(conversationId, 'original')
    if (originals.length === 0 || !originals[0].file_path) {
      throw new Error('Original resume PDF not found')
    }
    const pdfPath = originals[0].file_path

    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file not found on disk')
    }

    const pdfBuffer = fs.readFileSync(pdfPath)
    const pdfParser = new PDFParse({ data: pdfBuffer })
    const pdfData = await pdfParser.getText()
    await pdfParser.destroy()
    fullText = pdfData.text

    if (fullText.trim().length < 100) {
      throw new Error('无法从 PDF 提取文本内容，可能是图片型 PDF。请重新上传包含文本的 PDF 文件。')
    }
  }

  const { field, current, suggestion, reason } = optimization

  await storeMessage(conversationId, 'user', `采纳建议修改：${field}`, undefined, clientIds?.user)
  const perfStart = Date.now()

  const stream = createUIMessageStream({
    ...(assistantMsgId ? { generateId: () => assistantMsgId } : {}),
    async execute({ writer }) {
      const t0 = performance.now()
      const promptFn = (type || 'apply') === 'accept' ? buildAcceptPrompt : buildApplyPrompt
      const response = await getChatModel().invoke([
        {
          role: 'user',
          content: await promptFn({
            fullText,
            field,
            current,
            suggestion,
            reason: reason || ''
          })
        }
      ])
      const newContent = typeof response.content === 'string' ? response.content.trim() : ''
      console.log('[perf] AI generateText:', performance.now() - t0, 'ms')
      console.log('[DEBUG] newContent length:', newContent.length)

      const newFullText = replaceText(fullText, current.trim(), newContent)
      console.log('[DEBUG] newFullText length:', newFullText.length)
      console.log('[DEBUG] newFullText first 500:', newFullText.slice(0, 500))

      const sections = parseResumeSections(newFullText)
      const aiContent = sectionsToContentArray(sections)
      console.log('[DEBUG] content items:', aiContent.length)

      console.log('[perf] PDF generation')
      const pdfBuffer = await generateResumePDF(structuredClone(aiContent))
      console.log('[perf] PDF generation')
      console.log('[DEBUG] pdfBuffer.length:', pdfBuffer.length, 'content items:', aiContent.length)

      console.log('[perf] addFileToConversation')
      const fileName = `resume_${Date.now()}.pdf`
      const fileResult = await addFileToConversation(
        conversationId,
        Buffer.from(pdfBuffer),
        fileName,
        'pdf',
        'modified',
        undefined,
        newFullText
      )
      console.log('[perf] addFileToConversation')

      await cleanupOldVersions(conversationId, 'modified', 5)
      console.log('[perf] total (since handler):', Date.now() - perfStart, 'ms')

      const toolCallId = `tool-pdf-${Date.now()}`
      const toolStream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: 'tool-input-available',
            toolCallId,
            toolName: 'generateResumePDF',
            input: {},
            dynamic: true
          })
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output: {
              pdfUrl: `/rag/docs/${fileResult.refId}/download`,
              fileName,
              refId: fileResult.refId
            },
            dynamic: true
          })
          controller.close()
        }
      })
      writer.merge(toolStream)

      const updatedRAG = new DocumentLoader()
      await updatedRAG.loadDocumentsFromText([
        { text: newFullText, metadata: { source: 'updated' } }
      ])

      const updatedChunks = updatedRAG.chunks.map((chunk) => ({
        pageContent: chunk.pageContent,
        metadata: chunk.metadata,
        docType: 'resume' as const
      }))
      await setConversationChunksWithTypes(conversationId, updatedChunks)
      console.log('Updated', updatedRAG.chunks.length, 'chunks for conversation', conversationId)

      await storeMessage(
        conversationId,
        'assistant',
        `正在处理「${field}」...`,
        undefined,
        clientIds?.processing
      )
      await storeMessage(
        conversationId,
        'assistant',
        `已采纳建议并生成修改内容`,
        undefined,
        assistantMsgId
      )
    }
  })

  pipeUIMessageStreamToResponse({ response: res as any, stream })
}

export async function renderResumePdf(markdown: string): Promise<Uint8Array> {
  const sections = parseResumeSections(markdown)
  const contentArray = sectionsToContentArray(sections)
  return generateResumePDF(structuredClone(contentArray))
}
