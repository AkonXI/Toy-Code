export interface CharMappingEntry {
  node: Text
  nodeIndex: number
  char: string
}

export interface FindErrorResult {
  start: number
  end: number
  original: string
  suggestions: string[]
}

export type ErrorDict = Record<string, string[]>

/** 在纯文本中查找所有匹配的错误词，倒序返回以便从后往前处理 DOM */
export function findErrors(plainText: string, errorDict: ErrorDict): FindErrorResult[] {
  const errors: FindErrorResult[] = []
  for (const [errorWord, suggestions] of Object.entries(errorDict)) {
    const errorChars = [...errorWord]
    const plainChars = [...plainText]

    for (let i = 0; i <= plainChars.length - errorChars.length; i++) {
      let match = true
      for (let j = 0; j < errorChars.length; j++) {
        if (plainChars[i + j] !== errorChars[j]) {
          match = false
          break
        }
      }
      if (match) {
        errors.push({ start: i, end: i + errorChars.length, original: errorWord, suggestions })
      }
    }
  }

  errors.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const deduped: FindErrorResult[] = []
  for (const err of errors) {
    if (deduped.length === 0 || err.start >= deduped[deduped.length - 1].end) {
      deduped.push(err)
    }
  }
  return deduped.sort((a, b) => b.start - a.start)
}

/** 将 DOM 树展平为纯文本字符串，用于后续错误匹配 */
export function buildCharacterMapping(rootNode: Node): string {
  const mapping: CharMappingEntry[] = []

  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).textContent || ''
      const chars = [...text]
      for (let i = 0; i < chars.length; i++) {
        mapping.push({ node: node as Text, nodeIndex: i, char: chars[i] })
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (let i = 0; i < (node as Element).childNodes.length; i++) {
        traverse((node as Element).childNodes[i])
      }
    }
  }

  traverse(rootNode)
  return mapping.map((m) => m.char).join('')
}

/** 将高亮错误文本替换为建议文本 */
export function replaceErrorText(
  rootNode: Node,
  clickedElement: HTMLElement,
  newText: string,
  _highlightClass: string
) {
  const errorId = clickedElement.dataset.errorId
  if (errorId) {
    const rootEl = rootNode as Element
    const spans = rootEl.querySelectorAll(`[data-error-id="${errorId}"]`)
    const remaining = [...newText]
    spans.forEach((span: Element, i: number) => {
      const p = span.parentNode as Element | null
      if (!p) return
      const origLen = [...(span.textContent || '')].length

      if (i === spans.length - 1) {
        if (remaining.length > 0) {
          p.replaceChild(document.createTextNode(remaining.join('')), span)
        } else {
          p.removeChild(span)
          if (p.childNodes.length === 0) p.remove()
        }
      } else {
        const take = Math.min(remaining.length, origLen)
        if (take > 0) {
          const chunk = remaining.splice(0, take)
          p.replaceChild(document.createTextNode(chunk.join('')), span)
        } else {
          p.removeChild(span)
          if (p.childNodes.length === 0) p.remove()
        }
      }
    })
  } else {
    const parent = clickedElement.parentNode
    if (parent) parent.replaceChild(document.createTextNode(newText), clickedElement)
  }

  mergeAdjacentTextNodes(rootNode)
}

/** 清除所有高亮标记，恢复为纯文本 */
export function clearHighlights(rootNode: Node, highlightClass: string) {
  const rootEl = rootNode as Element
  const errorSpans = rootEl.querySelectorAll(`.${highlightClass}`)
  errorSpans.forEach((span: Element) => {
    const parent = span.parentNode
    if (!parent) return
    const textNode = document.createTextNode((span as HTMLElement).textContent || '')
    parent.replaceChild(textNode, span)
  })
  mergeAdjacentTextNodes(rootNode)
}

/** 合并相邻的文本节点，保持 DOM 树整洁 */
function mergeAdjacentTextNodes(element: Node) {
  if (element.nodeType !== Node.ELEMENT_NODE) return
  const el = element as Element
  const childNodes = Array.from(el.childNodes)
  for (let i = 0; i < childNodes.length - 1; i++) {
    const current = childNodes[i]
    const next = childNodes[i + 1]
    if (current.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE) {
      const mergedText = (current.textContent || '') + (next.textContent || '')
      const mergedNode = document.createTextNode(mergedText)
      el.replaceChild(mergedNode, current)
      el.removeChild(next)
      childNodes.splice(i + 1, 1)
      childNodes[i] = mergedNode
      i--
    }
  }
  childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      mergeAdjacentTextNodes(child)
    }
  })
}
