function parseInlineStyle(styleStr: string): Record<string, any> {
  const result: Record<string, any> = {}
  for (const rule of styleStr.split(';')) {
    const [k, v] = rule.split(':').map((s) => s.trim())
    if (!k || !v) continue
    if (k === 'font-size') {
      const n = parseFloat(v)
      result.fontSize = v.endsWith('em') ? Math.round(n * 10) : n
    }
    else if (k === 'color') result.color = v
    else if (k === 'font-weight' && v === 'bold') result.fontWeight = 'bold'
    else if (k === 'background-color') result.backgroundColor = v
    else if (k === 'text-decoration') result.textDecoration = v === 'underline' ? 'underline' : v
  }
  return result
}

function renderInline(text: string): { t: string; b?: boolean; s?: Record<string, any> }[] {
  const segments: { t: string; b?: boolean; s?: Record<string, any> }[] = []
  // 归一化 LLM 常见的标签格式错误
  text = text.replace(/<\/%(span)>/g, '</%span%>')
  const spanRe = /<%(span)(?:\s+style="([^"]*)")?\s*%>([\s\S]*?)<\/%\1%>/g
  let last = 0
  let m: RegExpExecArray | null

  let matchCount = 0
  while ((m = spanRe.exec(text)) !== null) {
    matchCount++
    if (m.index > last) pushBold(segments, text.slice(last, m.index))
    segments.push({ t: m[3], s: m[2] ? parseInlineStyle(m[2]) : undefined })
    last = m.index + m[0].length
  }
  if (last < text.length) pushBold(segments, text.slice(last))
  if (segments.length === 0) segments.push({ t: text })
  return segments
}

function pushBold(segments: { t: string; b?: boolean; s?: Record<string, any> }[], text: string) {
  let last = 0
  const re = /\*\*(.+?)\*\*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ t: text.slice(last, m.index) })
    segments.push({ t: m[1], b: true })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ t: text.slice(last) })
}

export default function RenderSuggestion({ text }: { text: string }) {
  const blocks: { type: 'para' | 'list'; segs: { t: string; b?: boolean; s?: Record<string, any> }[] }[] = []
  let bKey = 0

  for (const block of text.split('\n\n')) {
    const trimmed = block.trim()
    if (!trimmed) continue
    for (const line of trimmed.split('\n')) {
      const listMatch = line.match(/^[-*+]\s+(.+)$/)
      if (listMatch) {
        blocks.push({ type: 'list', segs: renderInline(listMatch[1]) })
      } else {
        blocks.push({ type: 'para', segs: renderInline(line) })
      }
    }
  }

  return (
    <>
      {blocks.map((block) => {
        const key = `b-${bKey++}`
        if (block.type === 'list') {
          return (
            <div key={key} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
              <span style={{ flexShrink: 0 }}>•</span>
              <span>{block.segs.map((seg, i) => seg.b ? <strong key={i}>{seg.t}</strong> : <span key={i} style={seg.s}>{seg.t}</span>)}</span>
            </div>
          )
        }
        return (
          <div key={key} style={{ marginBottom: 6, lineHeight: 1.6 }}>
            {block.segs.map((seg, i) => seg.b ? <strong key={i}>{seg.t}</strong> : <span key={i} style={seg.s}>{seg.t}</span>)}
          </div>
        )
      })}
    </>
  )
}
