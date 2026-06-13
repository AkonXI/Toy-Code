import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { getChatModel } from '../lib/providers'
import { INTENT_CLASSIFICATION_PROMPT } from '../lib/prompts'

const intentParser = StructuredOutputParser.fromNamesAndDescriptions({
  intent: '建议、修改 或 追问'
})

export async function classifyIntent(query: string): Promise<'建议' | '修改' | '追问'> {
  try {
    const response = await getChatModel().invoke([
      {
        role: 'user',
        content: INTENT_CLASSIFICATION_PROMPT.replace(
          '{formatInstructions}',
          intentParser.getFormatInstructions()
        ).replace('{query}', query)
      }
    ])
    const parsed = await intentParser.parse(
      typeof response.content === 'string' ? response.content : ''
    )
    const intent = parsed.intent === '修改' ? '修改' : parsed.intent === '追问' ? '追问' : '建议'
    console.log('[DEBUG] intent classified:', intent, '| query:', query.slice(0, 50))
    return intent
  } catch (e) {
    console.error('Failed to classify intent, defaulting to 建议:', e)
    return '建议'
  }
}
