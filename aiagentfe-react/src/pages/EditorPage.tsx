import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { message } from 'antd'
import { useChat } from '@ai-sdk/react'
import { useResumeStore } from '@/stores/resume'
import PdfPreview from '@/components/PdfPreview'
import ChatPanel from '@/components/ChatPanel'
import ConversationDrawer from '@/components/ConversationDrawer'
import { MultipartChatTransport } from '@/lib/multipart-chat-transport'
import {
  getReferenceFiles,
  deleteReferenceFile,
  api,
  type ReferenceDoc,
  type DocVersion,
  getDocHistory,
  restoreDocVersion,
  renderResumePdf
} from '@/api'
import type { OptimizationItem, ModificationItem, Message } from '@/types/chat'

interface QueuedRequest {
  id: string
  type: 'search' | 'apply' | 'accept'
  label: string
  execute: () => void
  canceled: boolean
  timestamp: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  disabledKey?: string
  wasSupplement?: boolean
}

const MESSAGES_PAGE_SIZE = 100
const MAX_SUPPLEMENTS = 3

function getLabel(type: string, payload?: any): string {
  if (type === 'search') return `发送消息：${payload?.text?.slice(0, 20) || '...'}`
  return type === 'apply'
    ? `采纳建议：${payload?.field || ''}`
    : `确认修改：${payload?.field || ''}`
}

const showReasoningMap = new Map<string, boolean>()

function extractPartsText(parts: any[]): string {
  return (
    parts
      ?.filter((p: any) => p.type === 'text' || p.type === 'text-delta')
      ?.map((p: any) => p.text ?? '')
      .filter(Boolean)
      .join('\n') ?? ''
  )
}

function extractPartsReasoning(parts: any[]): string {
  return (
    parts
      ?.filter((p: any) => p.type === 'reasoning' || p.type === 'reasoning-delta')
      ?.map((p: any) => p.text ?? '')
      .filter(Boolean)
      .join('\n') ?? ''
  )
}

function extractPartsOptimizations(parts: any[]): OptimizationItem[] {
  const list: OptimizationItem[] = []
  for (const part of parts?.filter(
    (p: any) => p.type === 'tool-invocation' || p.type?.startsWith('tool-')
  ) ?? []) {
    const output = part.output ?? part.result ?? part.toolInvocation?.result
    if (output?.optimization) list.push(output.optimization)
    if (output?.optimizations) list.push(...output.optimizations)
  }
  return list
}

function extractPartsModifications(parts: any[]): ModificationItem[] {
  const list: ModificationItem[] = []
  for (const part of parts?.filter(
    (p: any) => p.type === 'tool-invocation' || p.type?.startsWith('tool-')
  ) ?? []) {
    const output = part.output ?? part.result ?? part.toolInvocation?.result
    if (output?.modification) list.push(output.modification)
  }
  return list
}

function mapSdkMessages(sdkMessages: any[]): Message[] {
  return sdkMessages.map((msg) => {
    const parts = msg.parts ?? []
    return {
      id: msg.id ?? '',
      role: msg.role as 'user' | 'assistant',
      content: extractPartsText(parts),
      reasoning: extractPartsReasoning(parts),
      showReasoning: showReasoningMap.get(msg.id ?? '') ?? false,
      optimizations: extractPartsOptimizations(parts),
      modifications: extractPartsModifications(parts)
    }
  })
}

const mapApiMessage = (m: { role: string; content: string; reasoning?: string }): Message => ({
  id: '',
  role: m.role as 'user' | 'assistant',
  content: m.content,
  reasoning: m.reasoning || '',
  showReasoning: false,
  optimizations: []
})

export default function EditorPage() {
  const navigate = useNavigate()
  const { id: routeId } = useParams()
  const resumeStore = useResumeStore()

  const [pdfUrl, setPdfUrl] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [messagesPage, setMessagesPage] = useState(1)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [referenceFiles, setReferenceFiles] = useState<ReferenceDoc[]>([])
  const [chatError, setChatError] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const [pendingMods, setPendingMods] = useState<{ field: string; timestamp: number }[]>([])
  const [_refFilesLoading, setRefFilesLoading] = useState(false)
  const [supplementCount, setSupplementCount] = useState(0)
  const [currentSupplementField, setCurrentSupplementField] = useState('')
  const [currentSupplementOriginal, setCurrentSupplementOriginal] = useState('')
  const [currentSupplementMsgIndex, setCurrentSupplementMsgIndex] = useState(-1)
  const [currentSupplementModIdx, setCurrentSupplementModIdx] = useState(-1)
  const [requestQueue, setRequestQueue] = useState<QueuedRequest[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [disabledOpts, setDisabledOpts] = useState<Set<string>>(new Set())
  const [disabledMods, setDisabledMods] = useState<Set<string>>(new Set())
  const [docVersions, setDocVersions] = useState<DocVersion[]>([])
  const [activeVersionIdx, setActiveVersionIdx] = useState(0)

  const autoScroll = useRef(true)
  const chatPanelRef = useRef<any>(null)
  const sdkSyncedIds = useRef(new Set<string>())
  const onFinishRef = useRef<any>(null)

  const chatTitle = useMemo(
    () => resumeStore.conversationTitle || '简历优化助手',
    [resumeStore.conversationTitle]
  )

  const historyMsgs = resumeStore.messages.map((m: any) => ({
    id: String(m.id || ''),
    role: m.role,
    content: m.content,
    parts: [],
  }))
  const chat = useChat({
    ...(historyMsgs.length > 0 ? { initialMessages: historyMsgs } as any : {}),
    transport: new MultipartChatTransport({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        const token = localStorage.getItem('auth_token')
        if (token) headers.set('Authorization', `Bearer ${token}`)
        const phone = localStorage.getItem('login_phone')
        if (phone) headers.set('X-Phone', phone)
        return fetch(input, { ...init, headers })
      }
    }),
    onFinish: (args) => onFinishRef.current?.(args),
    onError: (err) => {
      console.error('Chat error:', err)
      if (err.message?.includes('reasoning-delta for missing reasoning part')) {
        dequeue()
        return
      }
      setPendingMods([])
      setChatError(err.message || '操作失败')
      setFailedMessage('')
      dequeue()
    }
  })

  onFinishRef.current = ({ messages: sdkMessages }: any) => {
    sdkMessages.forEach((msg: any) => {
      if (msg.id && !showReasoningMap.has(msg.id)) showReasoningMap.set(msg.id, false)
    })

    if (pendingMods.length > 0) {
      const pending = pendingMods[0]
      setPendingMods((prev) => {
        if (prev.length === 0) return prev
        return prev.slice(1)
      })
      setMessages((prev) => {
        const filtered = prev.filter((m) => {
          if (m.id?.startsWith('temp-')) return false
          if (
            m.role === 'assistant' &&
            !m.content &&
            !m.optimizations?.length &&
            !m.modifications?.length
          )
            return false
          return true
        })
        return [
          ...filtered,
          { id: `result-user-${Date.now()}`, role: 'user', content: `确认修改：${pending.field}` },
          {
            id: `result-status-${Date.now()}`,
            role: 'assistant',
            content: `正在处理「${pending.field}」...`
          },
          {
            id: `result-done-${Date.now()}`,
            role: 'assistant',
            content: '已采纳建议并生成修改内容'
          }
        ]
      })
      sdkMessages.forEach((m: any) => {
        if (m.id) sdkSyncedIds.current.add(m.id)
      })
      if (conversationId) {
        reloadPdfFromServer()
        loadDocHistory(conversationId)
      }
    }

    const newStoreMessages = sdkMessages.map((m: any) => {
      const existing = resumeStore.messages.find((sm: any) => sm.id === m.id)
      return {
        id: m.id ?? '',
        role: m.role as 'user' | 'assistant',
        content: extractPartsText(m.parts),
        reasoning: existing?.reasoning || extractPartsReasoning(m.parts) || '',
        optimizations: (existing as any)?.optimizations || extractPartsOptimizations(m.parts) || [],
        modifications: (existing as any)?.modifications || extractPartsModifications(m.parts) || []
      }
    })
    useResumeStore.setState({ messages: newStoreMessages })

    scrollToBottom()
    dequeue()
  }

  useEffect(() => {
    const sdkMsgs = chat.messages ?? []
    if (!sdkMsgs.length) return
    setPendingMods((prev) => prev.filter((p) => Date.now() - p.timestamp < 60000))
    if (pendingMods.length > 0) return

    const newMsgs = sdkMsgs.filter((m: any) => m.id && !sdkSyncedIds.current.has(m.id))
    if (newMsgs.length > 0) {
      setMessages((prev) => [...prev, ...mapSdkMessages(newMsgs)])
      newMsgs.forEach((m: any) => {
        if (m.id) sdkSyncedIds.current.add(m.id)
      })
    }

    const lastSdk = sdkMsgs[sdkMsgs.length - 1]
    if (lastSdk?.id) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== lastSdk.id) return m
          const parts = lastSdk.parts ?? []
          const newContent = extractPartsText(parts)
          const result = { ...m }
          if (newContent) {
            result.content = newContent
          }
          result.optimizations = extractPartsOptimizations(parts)
          result.reasoning = extractPartsReasoning(parts)
          result.modifications = extractPartsModifications(parts)
          return result
        })
      )
    }

    if (autoScroll.current) scrollToBottom()
  }, [chat.messages, chat.status])

  const processQueue = useCallback(() => {
    setRequestQueue((prev) => {
      const trimmed = prev.filter((r) => !r.canceled)
      if (trimmed.length === 0 || trimmed[0].status !== 'pending') {
        setIsProcessing(false)
        return trimmed
      }
      setIsProcessing(true)
      const execute = trimmed[0].execute
      const updated = trimmed.map((r) =>
        r.id === trimmed[0].id ? { ...r, status: 'processing' as const } : r
      )
      setTimeout(() => {
        try {
          execute()
        } catch (err) {
          console.error('Queue execute error:', err)
          processQueue()
        }
      }, 0)
      return updated
    })
  }, [])

  const enqueueRequest = useCallback(
    (
      req: Omit<QueuedRequest, 'id' | 'timestamp' | 'status' | 'label' | 'canceled'>,
      payload?: any
    ) => {
      if (payload?.field) {
        setRequestQueue((prev) => {
          const dupIdx = prev.findIndex(
            (r) => r.status === 'pending' && r.type === req.type && r.label.includes(payload.field)
          )
          if (dupIdx === -1) return prev
          const filtered = [...prev]
          filtered.splice(dupIdx, 1)
          return filtered
        })
      }
      const newReq: QueuedRequest = {
        ...req,
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: getLabel(req.type, payload),
        status: 'pending',
        canceled: false,
        timestamp: Date.now()
      }
      setRequestQueue((prev) => [...prev, newReq])
      setTimeout(() => processQueue(), 0)
    },
    [processQueue]
  )

  const loadReferenceFiles = useCallback(
    async (id?: string) => {
      const cid = id ?? conversationId
      if (!cid) return
      setRefFilesLoading(true)
      try {
        const result = await getReferenceFiles(cid)
        setReferenceFiles(result.docs || [])
      } catch (e) {
        console.error('Failed to load reference files:', e)
      } finally {
        setRefFilesLoading(false)
      }
    },
    [conversationId]
  )

  const dequeue = useCallback(() => {
    loadReferenceFiles()
    setRequestQueue((prev) => {
      if (prev.length > 0) {
        const updated = prev.map((r, i) => (i === 0 ? { ...r, status: 'completed' as const } : r))
        const [, ...rest] = updated
        setTimeout(() => processQueue(), 0)
        return rest
      }
      setTimeout(() => processQueue(), 0)
      return prev
    })
  }, [processQueue, loadReferenceFiles])

  const cancelRequest = useCallback((id: string) => {
    let targetDisabledKey: string | undefined
    let targetWasSupplement: boolean | undefined

    setRequestQueue((prev) => {
      const req = prev.find((r) => r.id === id)
      if (req) {
        targetDisabledKey = req.disabledKey
        targetWasSupplement = req.wasSupplement
      }
      return prev.map((r) =>
        r.id === id ? { ...r, canceled: true, status: 'failed' as const } : r
      )
    })

    if (targetDisabledKey) {
      setDisabledOpts((prev) => {
        const n = new Set(prev)
        n.delete(targetDisabledKey!)
        return n
      })
      setDisabledMods((prev) => {
        const n = new Set(prev)
        n.delete(targetDisabledKey!)
        return n
      })
    }
    if (targetWasSupplement) {
      setSupplementCount((prev) => Math.max(0, prev - 1))
    }
  }, [])

  const cancelAllPending = useCallback(() => {
    let restoredKeys: string[] = []
    let supplementDrops = 0

    setRequestQueue((prev) => {
      restoredKeys = prev
        .filter((r) => r.status === 'pending')
        .map((r) => r.disabledKey)
        .filter(Boolean) as string[]
      supplementDrops = prev.filter((r) => r.status === 'pending' && r.wasSupplement).length
      return prev.map((r) =>
        r.status === 'pending' ? { ...r, canceled: true, status: 'failed' as const } : r
      )
    })

    restoredKeys.forEach((key) => {
      setDisabledOpts((prev) => {
        const n = new Set(prev)
        n.delete(key)
        return n
      })
      setDisabledMods((prev) => {
        const n = new Set(prev)
        n.delete(key)
        return n
      })
    })
    if (supplementDrops > 0) {
      setSupplementCount((prev) => Math.max(0, prev - supplementDrops))
    }
  }, [])
  const pendingQueueCount = useMemo(
    () => requestQueue.filter((r) => r.status === 'pending').length,
    [requestQueue]
  )

  const scrollToBottom = useCallback(
    () => requestAnimationFrame(() => chatPanelRef.current?.scrollToBottom()),
    []
  )

  const pushStatusMessages = useCallback(
    (field: string) => {
      const ts = Date.now()
      setMessages((prev) => [
        ...prev,
        { id: `temp-user-${ts}`, role: 'user', content: `确认修改：${field}` },
        {
          id: `temp-status-${ts}`,
          role: 'assistant',
          content: `正在处理「${field}」...`,
          isProcessing: true
        }
      ])
      setPendingMods((prev) => [...prev, { field, timestamp: Date.now() }])
      autoScroll.current = true
      scrollToBottom()
    },
    [scrollToBottom]
  )

  const onChatSend = useCallback(
    (text: string, files: File[]) => {
      if (!text.trim() && files.length === 0) return
      setFailedMessage(text)
      autoScroll.current = true
      if (files.length > 0) {
        const optimisticDocs: ReferenceDoc[] = files.map((f) => ({
          id: 0,
          original_name: f.name,
          file_type: f.name.split('.').pop()?.toLowerCase() || '',
          file_size: f.size,
          file_path: '',
          doc_type: 'reference',
          version: 0,
          created_at: Date.now(),
          ref_category: undefined
        }))
        setReferenceFiles((prev) => [...optimisticDocs, ...prev])
      }
      enqueueRequest(
        {
          type: 'search',
          execute: () => {
            setSupplementCount(0)
            chat.sendMessage(
              { text },
              {
                body: {
                  type: 'search',
                  conversationId,
                  query: text,
                  files: files.length > 0 ? files : undefined
                }
              }
            )
          }
        },
        { text }
      )
      scrollToBottom()
    },
    [enqueueRequest, conversationId, chat, scrollToBottom]
  )

  const onApplyOptimization = useCallback(
    (item: OptimizationItem, _idx: number, _msgIndex: number, _msg: Message) => {
      setDisabledOpts((prev) => new Set(prev).add(`${_msgIndex}-${_idx}`))
      enqueueRequest(
        {
          type: 'apply',
          disabledKey: `${_msgIndex}-${_idx}`,
          execute: () => {
            try {
              pushStatusMessages(item.field)
              chat.sendMessage(
                {
                  text: `采纳优化建议：\n字段：${item.field}\n当前内容：${item.current}\n建议内容：${item.suggestion}`
                },
                {
                  body: {
                    type: 'apply',
                    conversationId,
                    optimization: {
                      field: item.field,
                      current: item.current,
                      suggestion: item.suggestion,
                      reason: item.reason || '',
                    }
                  }
                }
              )
            } catch (err) {
              console.error('Apply optimization error:', err)
              message.error('采纳失败')
              dequeue()
            }
          }
        },
        { field: item.field }
      )
    },
    [enqueueRequest, chat, conversationId, pushStatusMessages, setDisabledOpts]
  )

  const acceptModification = useCallback(
    (item: ModificationItem, _msgIndex: number, _modIdx: number) => {
      setSupplementCount(0)
      setDisabledMods((prev) => new Set(prev).add(`${_msgIndex}-${_modIdx}`))
      enqueueRequest(
        {
          type: 'accept',
          disabledKey: `${_msgIndex}-${_modIdx}`,
          execute: () => {
            try {
              pushStatusMessages(item.field)
              chat.sendMessage(
                { text: `确认修改：${item.field}` },
                {
                  body: {
                    type: 'accept',
                    conversationId,
                    optimization: {
                      field: item.field,
                      current: item.current,
                      suggestion: item.suggestion,
                      reason: item.reason || '',
                    }
                  }
                }
              )
            } catch (err) {
              console.error('Accept modification error:', err)
              message.error('确认修改失败')
              dequeue()
            }
          }
        },
        { field: item.field }
      )
    },
    [enqueueRequest, chat, conversationId, pushStatusMessages]
  )

  const supplementModification = useCallback(
    (item: ModificationItem, _msgIndex: number, _modIdx: number) => {
      if (supplementCount >= MAX_SUPPLEMENTS) {
        message.warning(`最多补充${MAX_SUPPLEMENTS}次`)
        return
      }
      setDisabledMods((prev) => new Set(prev).add(`${_msgIndex}-${_modIdx}`))
      setCurrentSupplementField(item.field)
      setCurrentSupplementOriginal(item.suggestion)
      setCurrentSupplementMsgIndex(_msgIndex)
      setCurrentSupplementModIdx(_modIdx)
      chatPanelRef.current?.openSupplementDialog()
    },
    [
      supplementCount,
      setCurrentSupplementField,
      setCurrentSupplementOriginal,
      setCurrentSupplementMsgIndex,
      setCurrentSupplementModIdx,
      setDisabledMods
    ]
  )

  const submitSupplement = useCallback(
    (text: string) => {
      if (!text.trim()) return
      const query = currentSupplementField
        ? `之前要求修改「${currentSupplementField}」：${currentSupplementOriginal}\n现补充：${text}`
        : `补充修改要求：${text}`
      setSupplementCount((prev) => prev + 1)
      enqueueRequest(
        {
          type: 'search',
          wasSupplement: true,
          disabledKey: `${currentSupplementMsgIndex}-${currentSupplementModIdx}`,
          execute: () => {
            chat.sendMessage(
              { text: `补充修改要求：${text}` },
              {
                body: {
                  type: 'search',
                  conversationId,
                  query
                }
              }
            )
            chatPanelRef.current?.setInput?.('')
          }
        },
        { text }
      )
    },
    [
      enqueueRequest,
      chat,
      conversationId,
      currentSupplementField,
      currentSupplementOriginal,
      currentSupplementMsgIndex,
      currentSupplementModIdx
    ]
  )

  const rejectModification = useCallback((_msgIndex: number, _modIdx: number) => {
    setSupplementCount(0)
    setDisabledMods((prev) => new Set(prev).add(`${_msgIndex}-${_modIdx}`))
  }, [])

  const reloadPdfFromServer = useCallback(
    async (id?: string) => {
      const cid = id ?? conversationId
      if (!cid) return
      try {
        const { getConversationMessages } = await import('@/api')
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
          setPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return URL.createObjectURL(blob)
          })
        }
      } catch (e) {
        console.error('Failed to reload PDF from server:', e)
      }
    },
    [conversationId]
  )

  const downloadPdf = useCallback(() => {
    if (!pdfUrl) {
      message.warning('PDF 尚未生成')
      return
    }
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = 'resume.pdf'
    a.click()
  }, [pdfUrl])

  const goBack = useCallback(() => navigate('/conversations'), [navigate])

  const removeReferenceFile = useCallback(
    async (refId: number) => {
      if (!conversationId) return
      try {
        await deleteReferenceFile(conversationId, refId)
        setReferenceFiles((prev) => prev.filter((d) => d.id !== refId))
        message.success('参考资料已删除')
      } catch {
        message.error('删除失败')
      }
    },
    [conversationId]
  )

  const toggleReasoning = useCallback(
    (msgId: string) => {
      const current = showReasoningMap.get(msgId) ?? false
      showReasoningMap.set(msgId, !current)
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, showReasoning: !current } : m))
      )
    },
    [setMessages]
  )

  const loadMoreHistory = useCallback(async () => {
    if (historyLoading || !hasMoreHistory) return
    setHistoryLoading(true)
    try {
      const nextPage = messagesPage + 1
      const result = await (
        await import('@/api')
      ).getConversationMessages(conversationId, nextPage, MESSAGES_PAGE_SIZE, 'DESC')
      const data = result.data ?? result
      const apiMessages = (data.messages ?? []).reverse()
      const total = result.pagination?.total ?? 0
      if (apiMessages.length === 0 || messagesPage * MESSAGES_PAGE_SIZE >= total) {
        setHasMoreHistory(false)
      } else {
        const prevHeight = chatPanelRef.current?.getScrollHeight?.() ?? 0
        setMessages((prev) => [...apiMessages.map(mapApiMessage), ...prev])
        setMessagesPage(nextPage)
        setHasMoreHistory(nextPage * MESSAGES_PAGE_SIZE < total)
        requestAnimationFrame(() => {
          const newHeight = chatPanelRef.current?.getScrollHeight?.() ?? 0
          chatPanelRef.current?.restoreScrollPosition?.(newHeight - prevHeight)
        })
      }
    } catch (e) {
      console.error('Failed to load more history:', e)
      setMessagesPage((prev) => Math.max(1, prev - 1))
    } finally {
      setHistoryLoading(false)
    }
  }, [historyLoading, hasMoreHistory, messagesPage, conversationId])

  const onChatScroll = useCallback(
    (payload: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
      const isNearBottom = payload.scrollHeight - payload.scrollTop - payload.clientHeight < 80
      autoScroll.current = isNearBottom
      if (!isNearBottom && hasMoreHistory && payload.scrollTop < 30) loadMoreHistory()
    },
    [hasMoreHistory, loadMoreHistory]
  )

  const loadConversationToState = (id: string, totalMsgs: number, resetPdf = true) => {
    const state = useResumeStore.getState()
    setSupplementCount(0)
    setConversationId(id)
    setMessagesPage(1)
    setHasMoreHistory(totalMsgs > state.messages.length)
    if (resetPdf) setPdfUrl(state.fileBlobUrl)
    else if (state.fileBlobUrl) setPdfUrl(state.fileBlobUrl)
    loadReferenceFiles(id)
    loadDocHistory(id)
  }

  const loadDocHistory = useCallback(
    async (id?: string) => {
      const cid = id ?? conversationId
      if (!cid) return
      try {
        const result = await getDocHistory(cid)
        setDocVersions(result.versions || [])
        setActiveVersionIdx(result.versions.length - 1)
      } catch (e) {
        console.error('Failed to load doc history:', e)
      }
    },
    [conversationId]
  )

const switchVersion = useCallback(
  async (idx: number) => {
    if (idx === activeVersionIdx) return
    const v = docVersions[idx]
    if (!v) return
    try {
      let blob: Blob
      if (v.type === 'original' && resumeStore.resumeContent) {
        blob = await renderResumePdf(resumeStore.resumeContent)
      } else {
        const fileUrl = `/api/rag/docs/${v.refId}/download`
        blob = (await api.get(fileUrl.replace('/api', ''), { responseType: 'blob' })) as Blob
      }
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      setActiveVersionIdx(idx)
    } catch (e) {
      console.error('Failed to load version PDF:', e)
    }
  },
  [docVersions, activeVersionIdx]
)

  const handleRestore = useCallback(
    async (refId: number) => {
      try {
        await restoreDocVersion(refId)
        message.success('已恢复到该版本')
        const cid = conversationId
        if (cid) {
          reloadPdfFromServer(cid)
          loadDocHistory(cid)
        }
      } catch (e) {
        console.error('Failed to restore version:', e)
        message.error('恢复失败')
      }
    },
    [conversationId, reloadPdfFromServer, loadDocHistory]
  )

  // Init
  useEffect(() => {
    if (!routeId) {
      navigate('/editor', { replace: true })
      return
    }

    // 重置状态（路由切换时）
    sdkSyncedIds.current.clear()
    setMessages([])
    setPdfUrl('')
    setDocVersions([])
    setActiveVersionIdx(0)
    setError('')

    const init = async () => {
      try {
        setLoading(true)
        const { totalMessages } = await resumeStore.loadConversation(routeId)
        const state = useResumeStore.getState()
        const storeMsgs = state.messages

        setMessages(storeMsgs)
        loadConversationToState(routeId, totalMessages)

        const initialMsgs = chat.messages ?? []
        initialMsgs.forEach((m: any) => {
          if (m.id) sdkSyncedIds.current.add(m.id)
        })

        if (resumeStore.messages.length > 0) {
          setMessages((prev) =>
            prev.map((m, i) => {
              const storeMsg = resumeStore.messages[i] as any
              if (storeMsg?.reasoning) return { ...m, reasoning: storeMsg.reasoning }
              return m
            })
          )
        }

        if (storeMsgs.length === 0 && state.initialPrompt) {
          autoTriggerSearch(state.initialPrompt, routeId)
        } else {
          triggerSearchIfNeeded()
        }
        scrollToBottom()
      } catch (e) {
        console.error('Failed to load conversation:', e)
        setError('加载会话失败')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [routeId])

  function triggerSearchIfNeeded() {
    const storeMsgs = resumeStore.messages
    if (storeMsgs.length > 0 && storeMsgs[storeMsgs.length - 1].role === 'user') {
      const hasAssistantReply = chat.messages?.some((m: any) => m.role === 'assistant')
      if (hasAssistantReply) return
      autoTriggerSearch(storeMsgs[storeMsgs.length - 1].content, routeId!)
    }
  }

  const autoTriggerSearch = useCallback(
    (query: string, id: string) =>
      enqueueRequest(
        {
          type: 'search',
          execute: () => chat.sendMessage({ text: query }, { body: { conversationId: id, query } })
        },
        { text: query }
      ),
    [enqueueRequest, chat]
  )

  // onUnmounted 清理
  useEffect(() => {
    return () => {
      const state = useResumeStore.getState()
      if (state.fileBlobUrl) URL.revokeObjectURL(state.fileBlobUrl)
      setPendingMods([])
      sdkSyncedIds.current.clear()
    }
  }, [])

  if (loading)
    return <div className="flex justify-center items-center h-screen text-[#999]">加载中...</div>
  if (error)
    return <div className="flex justify-center items-center h-screen text-[#dc2626]">{error}</div>

  return (
    <div className="flex h-[calc(100vh-50px)]">
      <div className="flex-1 min-w-0 p-5 bg-[#f5f5f5] overflow-hidden">
        <PdfPreview
          pdfUrl={pdfUrl}
          loading={loading}
          error={error}
          onDownload={downloadPdf}
          versions={docVersions}
          activeIndex={activeVersionIdx}
          currentVersion={
            activeVersionIdx >= 0 && docVersions[activeVersionIdx]
              ? docVersions[activeVersionIdx].type === 'original'
                ? '原始简历'
                : `修改版本 v${docVersions[activeVersionIdx].version || ''}`
              : undefined
          }
          showRestore={
            docVersions.length > 1 && activeVersionIdx !== docVersions.length - 1
          }
          onSelectVersion={switchVersion}
          onRestore={handleRestore}
        />
      </div>
      <div className="w-[400px] shrink-0 p-5">
        <ChatPanel
          ref={chatPanelRef}
          messages={messages}
          isLoading={chat.status === 'streaming'}
          chatTitle={chatTitle}
          chatError={chatError}
          referenceFiles={referenceFiles}
          historyLoading={historyLoading}
          hasMoreHistory={hasMoreHistory}
          requestQueue={requestQueue as any}
          isProcessing={isProcessing}
          pendingCount={pendingQueueCount}
          disabledOpts={disabledOpts}
          disabledMods={disabledMods}
          onSend={onChatSend}
          onLoadMoreHistory={loadMoreHistory}
          onChatScroll={onChatScroll}
          onRetrySend={() => {
            setChatError('')
            const text = failedMessage
            setFailedMessage('')
            if (text) onChatSend(text, [])
          }}
          onCloseError={() => setChatError('')}
          onRemoveReferenceFile={removeReferenceFile}
          onApplyOptimization={onApplyOptimization}
          onAcceptModification={acceptModification}
          onSupplementModification={supplementModification}
          onRejectModification={rejectModification}
          onSubmitSupplement={submitSupplement}
          onToggleDrawer={() => setDrawerVisible(true)}
          onGoBack={goBack}
          onCancelRequest={cancelRequest}
          onCancelAllPending={cancelAllPending}
          onReorderQueue={(newQueue) => setRequestQueue(newQueue as any)}
          onToggleReasoning={toggleReasoning}
        />
      </div>
      <ConversationDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
    </div>
  )
}
