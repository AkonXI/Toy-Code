import { replaceErrorText, clearHighlights, type ErrorDict } from './errorMatcher'
import spellCheck, { type ErrorTrayItem } from './spellCheck'

export interface SpellCheckAPI {
  replaceById: (errorId: string, newText: string) => void
  setSelectedError: (errorId: string) => void
}

export function setupTinyMCESpellCheck(
  editor: any,
  getErrorMap: () => ErrorDict,
  onErrorsFound?: (list: ErrorTrayItem[]) => void,
  onErrorReplaced?: (errorId: string) => void,
  onErrorClick?: (errorId: string) => void
): SpellCheckAPI {
  function replaceById(errorId: string, newText: string) {
    const span = editor
      .getBody()
      .querySelector(`[data-error-id="${errorId}"]`) as HTMLElement | null
    if (span) {
      replaceErrorText(editor.getBody(), span, newText, 'spell-error')
      if (onErrorReplaced) onErrorReplaced(errorId)
    }
  }

  function setSelectedError(errorId: string) {
    const body = editor.getBody()
    body.querySelectorAll('.spell-error.selected').forEach((el: Element) => {
      el.classList.remove('selected')
    })
    if (errorId) {
      body.querySelectorAll(`[data-error-id="${errorId}"]`).forEach((el: Element) => {
        el.classList.add('selected')
      })
    }
  }

  function doSpellCheck() {
    const body = editor.getBody()
    const errorMap = getErrorMap()
    clearHighlights(body, 'spell-error')
    const list = spellCheck(body, errorMap, 'spell-error')
    if (list.length === 0) {
      editor.notificationManager.open({ text: '未发现错误', type: 'info', timeout: 2000 })
      if (onErrorsFound) onErrorsFound([])
      return
    }
    if (onErrorsFound) onErrorsFound(list)
  }

  editor.ui.registry.addButton('spellcheck', {
    text: '纠错定位',
    onAction: doSpellCheck
  })

  editor.ui.registry.addButton('clearspell', {
    text: '清除纠错',
    onAction: () => {
      clearHighlights(editor.getBody(), 'spell-error')
      if (onErrorsFound) onErrorsFound([])
    }
  })

  if (onErrorClick) {
    editor.on('click', (e: any) => {
      const target = e.target as HTMLElement
      if (target.classList && target.classList.contains('spell-error')) {
        const errorId = target.dataset.errorId
        if (errorId) {
          onErrorClick(errorId)
        }
      }
    })
  }

  return { replaceById, setSelectedError }
}
