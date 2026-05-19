import type { ErrorDict, FindErrorResult } from './errorMatcher'

export interface ErrorTrayItem {
  errorId: string
  word: string
  suggestions: string[]
}

let errIdCounter = 0

/** 收集 DOM 树中所有文本节点（按文档顺序） */
function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = []
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push(node as Text)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const child of (node as Element).childNodes) {
        walk(child)
      }
    }
  }
  walk(root)
  return nodes
}

/** 在纯文本中查找所有匹配的错误词 */
function findErrors(plainText: string, errorDict: ErrorDict): FindErrorResult[] {
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
  errors.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const deduped: FindErrorResult[] = []
  for (const err of errors) {
    if (deduped.length === 0 || err.start >= deduped[deduped.length - 1].end) {
      deduped.push(err)
    }
  }
  return deduped
}

/** 在单个文本节点中包裹指定区间的错误文本为高亮 span */
function highlightInNode(
  textNode: Text,
  start: number,
  end: number,
  suggestions: string[],
  errorId: string,
  highlightClass: string,
) {
  const parent = textNode.parentNode
  if (!parent) return

  const originalText = textNode.textContent || ''
  const nodeChars = [...originalText]
  const before = nodeChars.slice(0, start).join('')
  const errorText = nodeChars.slice(start, end).join('')
  const after = nodeChars.slice(end).join('')

  const fragment = document.createDocumentFragment()
  if (before) fragment.appendChild(document.createTextNode(before))

  const span = document.createElement('span')
  span.className = highlightClass
  span.textContent = errorText
  span.dataset.suggestions = JSON.stringify(suggestions)
  span.dataset.errorId = errorId
  span.style.cssText = 'background-color:rgba(255,0,0,0.2);border-bottom:2px dashed #f00;cursor:pointer;'

  fragment.appendChild(span)
  if (after) fragment.appendChild(document.createTextNode(after))
  parent.replaceChild(fragment, textNode)
}

/** 查找错误并高亮（节点位置索引方案，从后往前处理避免 DOM 引用失效） */
export default function spellCheck(
  rootNode: Node,
  errorDict: ErrorDict,
  highlightClass: string,
): ErrorTrayItem[] {
  const textNodes = collectTextNodes(rootNode)
  const plainText = textNodes.map((n) => n.textContent || '').join('')
  const errors = findErrors(plainText, errorDict)

  const result: ErrorTrayItem[] = []

  for (let i = errors.length - 1; i >= 0; i--) {
    const error = errors[i]
    errIdCounter++
    const errorId = `err_${Date.now()}_${errIdCounter++}_${Math.random().toString(36).slice(2, 6)}`
    result.push({ errorId, word: error.original, suggestions: error.suggestions })

    let pos = 0
    for (const textNode of textNodes) {
      const len = [...(textNode.textContent || '')].length
      const nodeStart = pos
      const nodeEnd = pos + len

      const overlapStart = Math.max(error.start, nodeStart)
      const overlapEnd = Math.min(error.end, nodeEnd)

      if (overlapStart < overlapEnd) {
        const localStart = overlapStart - nodeStart
        const localEnd = overlapEnd - nodeStart
        highlightInNode(textNode, localStart, localEnd, error.suggestions, errorId, highlightClass)
      }

      pos = nodeEnd
      if (pos >= error.end) break
    }
  }

  return result.reverse().reverse()
}
