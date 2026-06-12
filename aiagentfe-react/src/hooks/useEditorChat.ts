import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react'
import { Chat } from '@ai-sdk/react'
import { useResumeStore } from '@/stores/resume'
import { getConversationMessages, getDocHistory, api } from '@/api'
import { MultipartChatTransport } from '@/lib/multipart-chat-transport'
import {
  extractPartsText,
  extractPartsReasoning,
  extractPartsOptimizations,
  extractPartsModifications,
  mapApiMessage
} from '@/lib/editor-utils'
import type { Message } from '@/types/chat'

export const showReasoningMap = new Map<string, boolean>()

export function useEditorChat() {
  const [isStreaming, setIsStreaming] = useState(false)
  const chatRef = useRef<Chat<any> | null>(null)
  const transportRef = useRef<MultipartChatTransport<any> | null>(null)
  const unregRef = useRef<(() => void) | null>(null)
  const conversationIdRef = useRef('')
  const requestQueueRef = useRef<any[]>([])
  const autoScrollRef = useRef(true)

  useEffect(() => {
    transportRef.current = new MultipartChatTransport({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        const token = localStorage.getItem('auth_token')
        if (token) headers.set('Authorization', `Bearer ${token}`)
        const phone = localStorage.getItem('login_phone')
        if (phone) headers.set('X-Phone', phone)
        return fetch(input, { ...init, headers })
      }
    })
    return () => {
      transportRef.current = null
    }
  }, [])

  const initChat = useCallback(
    (params: {
      historyMessages?: any[]
      onFinishActions: {
        setMessages: Dispatch<SetStateAction<Message[]>>
        setPdfUrl: Dispatch<SetStateAction<string>>
        setDocVersions: Dispatch<SetStateAction<any[]>>
        setActiveVersionIdx: Dispatch<SetStateAction<number>>
        dequeue: () => void
        scrollToBottom: () => void
      }
      onErrorActions: {
        setChatError: Dispatch<SetStateAction<string>>
        setFailedMessage: Dispatch<SetStateAction<string>>
        dequeue: () => void
      }
      onMessages: (
        sdkMsgs: any[],
        setMsgs: Dispatch<SetStateAction<Message[]>>,
        autoScroll: boolean
      ) => void
    }) => {
      unregRef.current?.()
      const { historyMessages, onFinishActions, onErrorActions, onMessages } = params

      chatRef.current = new Chat({
        transport: transportRef.current!,
        messages: historyMessages,
        onError: (err: Error) => {
          console.error('Chat error:', err)
          setIsStreaming(false)
          if (err.message?.includes('reasoning-delta for missing reasoning part')) {
            onErrorActions.dequeue()
            return
          }
          onErrorActions.setChatError(err.message || '操作失败')
          onErrorActions.setFailedMessage('')
          onErrorActions.dequeue()
        },
        onFinish: async ({ messages: sdkMessages }: any) => {
          setIsStreaming(false)
          sdkMessages.forEach((msg: any) => {
            if (msg.id && !showReasoningMap.has(msg.id)) showReasoningMap.set(msg.id, false)
          })

          const newStoreMessages = sdkMessages.map((m: any) => {
            const existing = useResumeStore.getState().messages.find((sm: any) => sm.id === m.id)
            return {
              id: m.id ?? '',
              role: m.role as 'user' | 'assistant',
              content: extractPartsText(m.parts),
              reasoning: existing?.reasoning || extractPartsReasoning(m.parts) || '',
              optimizations:
                (existing as any)?.optimizations || extractPartsOptimizations(m.parts) || [],
              modifications:
                (existing as any)?.modifications || extractPartsModifications(m.parts) || []
            }
          })
          useResumeStore.setState((prev: any) => {
            const existingIds = new Set(prev.messages.map((m: any) => m.id))
            const toAdd = newStoreMessages.filter((m: any) => {
              if (existingIds.has(m.id)) return false
              if (!m.content && m.role === 'assistant') {
                const sdkMsg = sdkMessages.find((sm: any) => sm.id === m.id)
                if (
                  sdkMsg &&
                  sdkMsg.parts?.every(
                    (p: any) => p.type.startsWith('tool-') || p.type === 'dynamic-tool'
                  )
                )
                  return false
              }
              return true
            })
            if (toAdd.length === 0) return prev
            return { messages: [...prev.messages, ...toAdd] }
          })

          const cid = conversationIdRef.current
          const queueType = requestQueueRef.current[0]?.type
          if (cid && (queueType === 'apply' || queueType === 'accept')) {
            try {
              const result = await getConversationMessages(cid, 1, 1, 'DESC')
              const docs = result.data?.documents ?? []
              if (docs.length > 0) {
                const latestDoc = docs[0]
                const fileUrl = latestDoc.file_url.startsWith('/api')
                  ? latestDoc.file_url
                  : `/api${latestDoc.file_url}`
                const blob = (await api.get(fileUrl.replace('/api', ''), {
                  responseType: 'blob'
                })) as Blob
                const newUrl = URL.createObjectURL(blob)
                onFinishActions.setPdfUrl((prev: string) => {
                  if (prev) URL.revokeObjectURL(prev)
                  return newUrl
                })
              }

              const newDbMsg = (result.data?.messages ?? []).map(mapApiMessage)[0]
              if (newDbMsg?.role === 'assistant') {
                onFinishActions.setMessages((prev: Message[]) => [...prev, newDbMsg])
                useResumeStore.setState((prev: any) => ({
                  messages: [...prev.messages, newDbMsg]
                }))
              }

              const docHistory = await getDocHistory(cid)
              if (docHistory?.versions) {
                onFinishActions.setDocVersions(docHistory.versions)
                onFinishActions.setActiveVersionIdx(Math.max(0, docHistory.versions.length - 1))
              }
            } catch (e) {
              console.error(e)
            }
          }

          if (cid && queueType === 'search' && !useResumeStore.getState().conversationTitle) {
            try {
              const result = await getConversationMessages(cid, 1, 1, 'DESC')
              if (result.data?.title) {
                useResumeStore.setState({ conversationTitle: result.data.title })
              }
            } catch (e) {
              console.error('Failed to refresh conversation title:', e)
            }
          }

          onFinishActions.scrollToBottom()
          Promise.resolve().then(() => onFinishActions.dequeue())
        }
      })

      unregRef.current = (chatRef.current as any)['~registerMessagesCallback'](() => {
        const c = chatRef.current
        if (!c) return
        setIsStreaming(c.status === 'submitted' || c.status === 'streaming')
        const sdkMsgs = c.messages ?? []
        if (!sdkMsgs.length) return
        onMessages(sdkMsgs, onFinishActions.setMessages, autoScrollRef.current)
      }, 0)
    },
    []
  )

  const handleStop = useCallback((setRequestQueue: Dispatch<SetStateAction<any[]>>) => {
    transportRef.current?.stop()
    setRequestQueue([])
  }, [])

  return {
    isStreaming,
    setIsStreaming,
    chatRef,
    transportRef,
    unregRef,
    conversationIdRef,
    requestQueueRef,
    autoScrollRef,
    initChat,
    handleStop
  }
}
