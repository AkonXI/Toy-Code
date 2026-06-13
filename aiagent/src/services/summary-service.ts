import { PromptTemplate } from '@langchain/core/prompts'
import { getChatModel } from '../lib/providers'
import { SUMMARY_TEMPLATE, COMPRESS_TEMPLATE, INCREMENTAL_SUMMARY_PROMPT } from '../lib/prompts'
import { getDatabase } from '../storage/database'
import { setAutoSummaryFn } from '../storage/summary-manager'

const SUMMARY_TRIGGER = 60
const SUMMARY_BATCH = 40
const MAX_UNCOMPRESSED = 5

const summaryTemplate = new PromptTemplate({
  template: SUMMARY_TEMPLATE,
  inputVariables: ['text']
})

const compressTemplate = new PromptTemplate({
  template: COMPRESS_TEMPLATE,
  inputVariables: ['text']
})

export async function triggerAutoSummary(conversationId: string): Promise<void> {
  const db = getDatabase()

  const unsummarized = db
    .prepare('SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND summarized = 0')
    .get(conversationId) as { cnt: number }

  if (unsummarized.cnt < SUMMARY_TRIGGER) return

  const lastSummary = db
    .prepare(
      'SELECT end_message_id FROM conversation_summaries WHERE conversation_id = ? ORDER BY end_message_id DESC LIMIT 1'
    )
    .get(conversationId) as { end_message_id: number } | undefined

  const messages = db
    .prepare(
      `SELECT id, role, content FROM messages
       WHERE conversation_id = ? AND summarized = 0 AND (? IS NULL OR id > ?)
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(
      conversationId,
      lastSummary?.end_message_id || null,
      lastSummary?.end_message_id || null,
      SUMMARY_BATCH
    ) as { id: number; role: string; content: string }[]

  if (messages.length < SUMMARY_BATCH) return

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const prevSummaryRow = db
    .prepare(
      'SELECT summary FROM conversation_summaries WHERE conversation_id = ? ORDER BY end_message_id DESC LIMIT 1'
    )
    .get(conversationId) as { summary: string } | undefined

  const summaryInput = prevSummaryRow
    ? INCREMENTAL_SUMMARY_PROMPT.replace('{prevSummary}', prevSummaryRow.summary).replace(
        '{text}',
        conversationText
      )
    : SUMMARY_TEMPLATE.replace('{text}', conversationText)

  try {
    const response = await getChatModel().invoke([{ role: 'user', content: summaryInput }])
    const summary = typeof response.content === 'string' ? response.content : ''

    const startId = messages[0].id
    const endId = messages[messages.length - 1].id

    db.prepare(
      `INSERT INTO conversation_summaries (conversation_id, summary, message_count, start_message_id, end_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(conversationId, summary.trim(), messages.length, startId, endId, Date.now())

    db.prepare(
      'UPDATE messages SET summarized = 1 WHERE conversation_id = ? AND id BETWEEN ? AND ?'
    ).run(conversationId, startId, endId)

    console.log(
      `[summary-manager] Generated summary for conversation ${conversationId}, messages ${startId}-${endId}`
    )

    await compressSummaries(conversationId)
  } catch (error) {
    console.error('[summary-manager] Failed to generate summary:', error)
  }
}

async function compressSummaries(conversationId: string): Promise<void> {
  const db = getDatabase()

  const summaries = db
    .prepare(
      `SELECT id, summary, message_count, start_message_id, end_message_id
       FROM conversation_summaries
       WHERE conversation_id = ?
       ORDER BY end_message_id ASC`
    )
    .all(conversationId) as {
    id: number
    summary: string
    message_count: number
    start_message_id: number
    end_message_id: number
  }[]

  if (summaries.length <= MAX_UNCOMPRESSED) return

  const toCompress = summaries.slice(0, summaries.length - MAX_UNCOMPRESSED)
  const combinedText = toCompress.map((s) => s.summary).join('\n\n')

  try {
    let compressed: string

    if (toCompress.length === 1) {
      compressed = stripTodoSection(toCompress[0].summary)
    } else {
      const response = await getChatModel().invoke([
        { role: 'user', content: await compressTemplate.format({ text: combinedText }) }
      ])
      compressed = typeof response.content === 'string' ? response.content : ''
    }

    const transaction = db.transaction((txnDb: any) => {
      for (const s of toCompress) {
        txnDb.prepare('DELETE FROM conversation_summaries WHERE id = ?').run(s.id)
      }
      txnDb
        .prepare(
          `INSERT INTO conversation_summaries (conversation_id, summary, message_count, start_message_id, end_message_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          conversationId,
          compressed.trim(),
          toCompress.reduce((sum, s) => sum + s.message_count, 0),
          toCompress[0].start_message_id,
          toCompress[toCompress.length - 1].end_message_id,
          Date.now()
        )
    })

    transaction(db)
    console.log(
      `[summary-manager] Compressed ${toCompress.length} summaries for conversation ${conversationId}`
    )
  } catch (error) {
    console.error('[summary-manager] Failed to compress summaries:', error)
  }
}

function stripTodoSection(text: string): string {
  const match = text.match(/\n待办事项|\n- \[ \]|待办：|待办:/)
  return match ? text.substring(0, match.index).trim() : text.trim()
}

setAutoSummaryFn(triggerAutoSummary)
