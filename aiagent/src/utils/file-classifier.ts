import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { getChatModel } from '../lib/providers'
import { CLASSIFY_REFERENCE_FILE_PROMPT } from '../lib/prompts'

const refParser = StructuredOutputParser.fromNamesAndDescriptions({
  category: 'excellent_resume | reference_doc | unknown'
})

export async function classifyReferenceFile(content: string): Promise<string | null> {
  try {
    const response = await getChatModel().invoke([
      {
        role: 'user',
        content: CLASSIFY_REFERENCE_FILE_PROMPT.replace(
          '{formatInstructions}',
          refParser.getFormatInstructions()
        ).replace('{content}', content.slice(0, 300))
      }
    ])
    const parsed = await refParser.parse(
      typeof response.content === 'string' ? response.content : ''
    )
    return parsed.category === 'unknown' ? null : parsed.category
  } catch (e) {
    console.error('Failed to classify reference file:', e)
    return null
  }
}

export function refCategoryLabel(category: string | null): string {
  return category === 'excellent_resume'
    ? '优秀简历'
    : category === 'reference_doc'
      ? '参考资料'
      : '参考资料'
}
