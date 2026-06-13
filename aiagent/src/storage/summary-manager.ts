import { getDatabase } from './database'

type AutoSummaryFn = (conversationId: string) => Promise<void>
let _autoSummaryFn: AutoSummaryFn | null = null

export function setAutoSummaryFn(fn: AutoSummaryFn) {
  _autoSummaryFn = fn
}

export async function maybeTriggerAutoSummary(conversationId: string): Promise<void> {
  if (_autoSummaryFn) {
    await _autoSummaryFn(conversationId)
  }
}

export async function getConversationSummaries(
  conversationId: string
): Promise<{ summary: string; message_count: number; created_at: number }[]> {
  const db = getDatabase()
  return db
    .prepare(
      'SELECT summary, message_count, created_at FROM conversation_summaries WHERE conversation_id = ? ORDER BY end_message_id ASC'
    )
    .all(conversationId) as { summary: string; message_count: number; created_at: number }[]
}

export async function generateConversationSummary(conversationId: string): Promise<string> {
  const db = getDatabase()

  const messages = db
    .prepare(
      'SELECT id, role, content FROM messages WHERE conversation_id = ? AND summarized = 0 ORDER BY created_at ASC'
    )
    .all(conversationId) as { id: number; role: string; content: string }[]

  if (messages.length === 0) {
    return 'No unsummarized messages'
  }

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  if (!_autoSummaryFn) return 'No summary service registered'

  await _autoSummaryFn(conversationId)

  const db2 = getDatabase()
  const newRow = db2
    .prepare(
      'SELECT summary FROM conversation_summaries WHERE conversation_id = ? ORDER BY end_message_id DESC LIMIT 1'
    )
    .get(conversationId) as { summary: string } | undefined
  return newRow?.summary || 'Summary generated'
}
