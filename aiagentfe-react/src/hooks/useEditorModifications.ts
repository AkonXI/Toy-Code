import {
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject
} from 'react'
import { generateId } from 'ai'
import { message } from 'antd'
import type { OptimizationItem, ModificationItem, Message } from '@/types/chat'

const MAX_SUPPLEMENTS = 3

export function useEditorModifications() {
  const [disabledOpts, setDisabledOpts] = useState<Set<string>>(new Set())
  const [disabledMods, setDisabledMods] = useState<Set<string>>(new Set())
  const [supplementCount, setSupplementCount] = useState(0)
  const [currentSupplementField, setCurrentSupplementField] = useState('')
  const [currentSupplementOriginal, setCurrentSupplementOriginal] = useState('')
  const [currentSupplementMsgIndex, setCurrentSupplementMsgIndex] = useState(-1)
  const [currentSupplementModIdx, setCurrentSupplementModIdx] = useState(-1)

  const markOptDisabled = useCallback((msgIndex: number, idx: number) => {
    setDisabledOpts((prev) => new Set(prev).add(`${msgIndex}-${idx}`))
  }, [])

  const markModDisabled = useCallback((msgIndex: number, modIdx: number) => {
    setDisabledMods((prev) => new Set(prev).add(`${msgIndex}-${modIdx}`))
  }, [])

  function onApplyOptimization(
    item: OptimizationItem,
    idx: number,
    msgIndex: number,
    _msg: Message,
    deps: {
      chatRef: MutableRefObject<any>
      conversationId: string
      enqueueRequest: (...args: any[]) => void
      dequeue: () => void
      autoScrollRef: MutableRefObject<boolean>
      setMessages: Dispatch<SetStateAction<Message[]>>
      scrollToBottom: () => void
    }
  ) {
    markOptDisabled(msgIndex, idx)
    const userMsgId = generateId()
    const assistantMsgId = generateId()
    const processingId = generateId()
    deps.autoScrollRef.current = true
    deps.scrollToBottom()

    deps.enqueueRequest(
      {
        type: 'apply',
        disabledKey: `${msgIndex}-${idx}`,
        execute: () => {
          try {
            const chat = deps.chatRef.current!
            chat.messages.push(
              {
                id: userMsgId,
                role: 'user',
                parts: [{ type: 'text', text: `采纳建议：${item.field}` }]
              },
              {
                id: processingId,
                role: 'assistant',
                parts: [{ type: 'text', text: `正在处理「${item.field}」...` }]
              }
            )
            deps.setMessages((prev: Message[]) => [
              ...prev,
              { id: userMsgId, role: 'user', content: `采纳建议：${item.field}` },
              { id: processingId, role: 'assistant', content: `正在处理「${item.field}」...` }
            ])
            chat.sendMessage(
              { messageId: userMsgId, parts: [{ type: 'text', text: `采纳建议：${item.field}` }] },
              {
                body: {
                  type: 'apply',
                  conversationId: deps.conversationId,
                  assistantMsgId,
                  clientIds: { user: userMsgId, processing: processingId },
                  optimization: {
                    field: item.field,
                    current: item.current,
                    suggestion: item.suggestion,
                    reason: item.reason || ''
                  }
                }
              }
            )
          } catch (err) {
            console.error('Apply error:', err)
            message.error('采纳建议失败')
            deps.dequeue()
          }
        }
      },
      { field: item.field }
    )
  }

  function acceptModification(
    item: ModificationItem,
    msgIndex: number,
    modIdx: number,
    deps: {
      chatRef: MutableRefObject<any>
      conversationId: string
      enqueueRequest: (...args: any[]) => void
      dequeue: () => void
      setMessages: Dispatch<SetStateAction<Message[]>>
    }
  ) {
    markModDisabled(msgIndex, modIdx)
    const userMsgId = generateId()
    const assistantMsgId = generateId()
    const processingId = generateId()
    deps.enqueueRequest(
      {
        type: 'accept',
        disabledKey: `${msgIndex}-${modIdx}`,
        execute: () => {
          try {
            const chat = deps.chatRef.current!
            chat.messages.push(
              {
                id: userMsgId,
                role: 'user',
                parts: [{ type: 'text', text: `确认修改：${item.field}` }]
              },
              {
                id: processingId,
                role: 'assistant',
                parts: [{ type: 'text', text: `正在处理「${item.field}」...` }]
              }
            )
            deps.setMessages((prev: Message[]) => [
              ...prev,
              { id: userMsgId, role: 'user', content: `确认修改：${item.field}` },
              { id: processingId, role: 'assistant', content: `正在处理「${item.field}」...` }
            ])
            chat.sendMessage(
              { messageId: userMsgId, parts: [{ type: 'text', text: `确认修改：${item.field}` }] },
              {
                body: {
                  type: 'accept',
                  conversationId: deps.conversationId,
                  assistantMsgId,
                  clientIds: { user: userMsgId, processing: processingId },
                  optimization: {
                    field: item.field,
                    current: item.current,
                    suggestion: item.suggestion,
                    reason: item.reason || ''
                  }
                }
              }
            )
          } catch (err) {
            console.error('Accept error:', err)
            message.error('确认修改失败')
            deps.dequeue()
          }
        }
      },
      { field: item.field }
    )
  }

  function supplementModification(
    item: OptimizationItem | ModificationItem,
    msgIdx: number,
    modIdx: number,
    chatPanelRef: MutableRefObject<any>
  ) {
    setSupplementCount((prev) => {
      if (prev >= MAX_SUPPLEMENTS) {
        message.warning(`最多补充${MAX_SUPPLEMENTS}次`)
        return prev
      }
      markModDisabled(msgIdx, modIdx)
      setCurrentSupplementField(item.field)
      setCurrentSupplementOriginal(item.suggestion)
      setCurrentSupplementMsgIndex(msgIdx)
      setCurrentSupplementModIdx(modIdx)
      chatPanelRef.current?.openSupplementDialog()
      return prev + 1
    })
  }

  function submitSupplement(
    text: string,
    deps: {
      chatRef: MutableRefObject<any>
      conversationId: string
      enqueueRequest: (...args: any[]) => void
      chatPanelRef: MutableRefObject<any>
    }
  ) {
    if (!text.trim()) return
    const context = currentSupplementField
      ? `之前要求修改「${currentSupplementField}」：${currentSupplementOriginal}\n现补充：${text}`
      : `补充修改要求：${text}`
    const userMsgId = generateId()
    const assistantMsgId = generateId()
    deps.enqueueRequest(
      {
        type: 'search',
        wasSupplement: true,
        disabledKey: `${currentSupplementMsgIndex}-${currentSupplementModIdx}`,
        execute: () => {
          const chat = deps.chatRef.current!
          chat.messages.push({
            id: userMsgId,
            role: 'user',
            parts: [{ type: 'text', text: `补充修改要求：${text}` }]
          })
          chat.sendMessage(
            { messageId: userMsgId, parts: [{ type: 'text', text: `补充修改要求：${text}` }] },
            {
              body: {
                type: 'search',
                conversationId: deps.conversationId,
                query: context,
                userMsgId,
                assistantMsgId
              }
            }
          )
          deps.chatPanelRef.current?.setInput?.('')
        }
      },
      { text }
    )
  }

  function rejectModification(msgIndex: number, modIdx: number) {
    setDisabledMods((prev) => new Set(prev).add(`${msgIndex}-${modIdx}`))
    setSupplementCount(0)
  }

  function cleanupDisabledKeys(keys: string[]) {
    if (keys.length === 0) return
    setDisabledOpts((prev) => {
      const n = new Set(prev)
      keys.forEach((k) => n.delete(k))
      return n
    })
    setDisabledMods((prev) => {
      const n = new Set(prev)
      keys.forEach((k) => n.delete(k))
      return n
    })
  }

  function resetSupplement() {
    setSupplementCount(0)
    setCurrentSupplementField('')
    setCurrentSupplementOriginal('')
    setCurrentSupplementMsgIndex(-1)
    setCurrentSupplementModIdx(-1)
  }

  return {
    disabledOpts,
    setDisabledOpts,
    disabledMods,
    setDisabledMods,
    supplementCount,
    setSupplementCount,
    currentSupplementField,
    currentSupplementOriginal,
    currentSupplementMsgIndex,
    currentSupplementModIdx,
    markOptDisabled,
    markModDisabled,
    onApplyOptimization,
    acceptModification,
    supplementModification,
    submitSupplement,
    rejectModification,
    cleanupDisabledKeys,
    resetSupplement
  }
}
