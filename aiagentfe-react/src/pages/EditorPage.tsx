import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { message, Skeleton, Result, Button } from 'antd'
import { Chat } from '@ai-sdk/react'
import { useResumeStore } from '@/stores/resume'
import PdfPreview from '@/components/PdfPreview'
import ChatPanel from '@/components/ChatPanel'
import ConversationDrawer from '@/components/ConversationDrawer'
import { MultipartChatTransport } from '@/lib/multipart-chat-transport'
import {
  getReferenceFiles, deleteReferenceFile, api, type ReferenceDoc, type DocVersion,
  getDocHistory, restoreDocVersion, getConversationMessages, renderResumePdf
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

function getLabel(type: string, payload?: any): string {
  if (type === 'search') return `发送消息：${payload?.text?.slice(0, 20) || '...'}`
  return type === 'apply' ? `采纳建议：${payload?.field || ''}` : `确认修改：${payload?.field || ''}`
}

const showReasoningMap = new Map<string, boolean>()

function extractPartsText(parts: any[]): string {
  return parts?.filter((p: any) => p.type === 'text' || p.type === 'text-delta')?.map((p: any) => p.text ?? '').filter(Boolean).join('\n') ?? ''
}

function extractPartsReasoning(parts: any[]): string {
  return parts?.filter((p: any) => p.type === 'reasoning' || p.type === 'reasoning-delta')?.map((p: any) => p.text ?? '').filter(Boolean).join('\n') ?? ''
}

function extractPartsOptimizations(parts: any[]): OptimizationItem[] {
  const list: OptimizationItem[] = []
  for (const part of parts?.filter((p: any) => p.type === 'tool-invocation' || p.type?.startsWith('tool-')) ?? []) {
    const output = part.output ?? part.result ?? part.toolInvocation?.result
    if (output?.optimization) list.push(output.optimization)
    if (output?.optimizations) list.push(...output.optimizations)
  }
  return list
}

function extractPartsModifications(parts: any[]): ModificationItem[] {
  const list: ModificationItem[] = []
  for (const part of parts?.filter((p: any) => p.type === 'tool-invocation' || p.type?.startsWith('tool-')) ?? []) {
    const output = part.output ?? part.result ?? part.toolInvocation?.result
    if (output?.modification) list.push(output.modification)
  }
  return list
}

function mapApiMessage(m: { id?: number | string; role: string; content: string; reasoning?: string }): Message {
  return {
    id: String(m.id ?? ''), role: m.role as 'user' | 'assistant', content: m.content,
    reasoning: m.reasoning || '', showReasoning: false, optimizations: [],
  }
}

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
  const [isStreaming, setIsStreaming] = useState(false)
  const [_pendingMods, setPendingMods] = useState<{ field: string; timestamp: number }[]>([])
  const [_refFilesLoading, setRefFilesLoading] = useState(false)
  const [_supplementCount, setSupplementCount] = useState(0)
  const [currentSupplementField, setCurrentSupplementField] = useState('')
  const [currentSupplementOriginal, setCurrentSupplementOriginal] = useState('')
  const [currentSupplementMsgIndex, setCurrentSupplementMsgIndex] = useState(-1)
  const [currentSupplementModIdx, setCurrentSupplementModIdx] = useState(-1)
  const [requestQueue, setRequestQueue] = useState<QueuedRequest[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSearchProcessing, setIsSearchProcessing] = useState(false)
  const [disabledOpts, setDisabledOpts] = useState<Set<string>>(new Set())
  const [disabledMods, setDisabledMods] = useState<Set<string>>(new Set())
  const [docVersions, setDocVersions] = useState<DocVersion[]>([])
  const [activeVersionIdx, setActiveVersionIdx] = useState(0)

  const autoScroll = useRef(true)
  const chatPanelRef = useRef<any>(null)
  const sdkSyncedIds = useRef(new Set<string>())
  const pendingModsRef = useRef<{ field: string; timestamp: number }[]>([])
  const chatRef = useRef<Chat<any> | null>(null)
  const unregRef = useRef<(() => void) | null>(null)
  const conversationIdRef = useRef(conversationId)
  useEffect(() => { conversationIdRef.current = conversationId }, [conversationId])

  const chatTitle = useMemo(() => resumeStore.conversationTitle || '简历优化助手', [resumeStore.conversationTitle])

  const transportRef = useRef<MultipartChatTransport<any> | null>(null)
  if (!transportRef.current) {
    transportRef.current = new MultipartChatTransport({
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        const token = localStorage.getItem('auth_token')
        if (token) headers.set('Authorization', `Bearer ${token}`)
        const phone = localStorage.getItem('login_phone')
        if (phone) headers.set('X-Phone', phone)
        return fetch(input, { ...init, headers })
      },
    })
  }

  const handleStop = useCallback(() => {
    transportRef.current?.stop()
    setRequestQueue([])
    setIsProcessing(false)
    setIsSearchProcessing(false)
  }, [])

  // ═══ initChat — 与 Vue line 651-801 对齐 ═══
  function initChat(historyMessages?: any[]) {
    unregRef.current?.()
    chatRef.current = new Chat({
      transport: transportRef.current!,
      ...(historyMessages?.length ? { messages: historyMessages } : {}),
      onError: (err: Error) => {
        console.error('Chat error:', err)
        if (err.message?.includes('reasoning-delta for missing reasoning part')) { dequeue(); return }
        pendingModsRef.current = []
        setPendingMods([])
        setChatError(err.message || '操作失败')
        setFailedMessage('')
        setIsStreaming(false)
        dequeue()
      },
      onFinish: async ({ messages: sdkMessages }: any) => {
        setIsStreaming(false)
        sdkMessages.forEach((msg: any) => { if (msg.id && !showReasoningMap.has(msg.id)) showReasoningMap.set(msg.id, false) })

        if (pendingModsRef.current.length > 0) {
          const pending = pendingModsRef.current[0]
          pendingModsRef.current = pendingModsRef.current.slice(1)
          setPendingMods((prev) => { if (prev.length === 0) return prev; return prev.slice(1) })
          setMessages((prev) => {
            const filtered = prev.filter((m) => {
              if (m.id?.startsWith('temp-')) return false
              if (m.role === 'assistant' && !m.content && !m.optimizations?.length && !m.modifications?.length) return false
              return true
            })
            return [...filtered,
              { id: `result-user-${Date.now()}`, role: 'user', content: `确认修改：${pending.field}` },
              { id: `result-status-${Date.now()}`, role: 'assistant', content: `正在处理「${pending.field}」...` },
              { id: `result-done-${Date.now()}`, role: 'assistant', content: '已采纳建议并生成修改内容' },
            ]
          })
          sdkMessages.forEach((m: any) => { if (m.id) sdkSyncedIds.current.add(m.id) })
          if (conversationIdRef.current) { reloadPdfFromServer(conversationIdRef.current); loadDocHistory(conversationIdRef.current) }
        }

        const newStoreMessages = sdkMessages.map((m: any) => {
          const existing = resumeStore.messages.find((sm: any) => sm.id === m.id)
          return {
            id: m.id ?? '', role: m.role as 'user' | 'assistant',
            content: extractPartsText(m.parts),
            reasoning: existing?.reasoning || extractPartsReasoning(m.parts) || '',
            optimizations: (existing as any)?.optimizations || extractPartsOptimizations(m.parts) || [],
            modifications: (existing as any)?.modifications || extractPartsModifications(m.parts) || [],
          }
        })
        useResumeStore.setState({ messages: newStoreMessages })
        scrollToBottom()
        dequeue()
      },
    })

    // 播种初始 SDK 消息 ID（Vue line 747-749）
    const im = chatRef.current?.messages ?? []
    im.forEach((m: any) => { if (m.id) sdkSyncedIds.current.add(m.id) })

    // ~registerMessagesCallback — 与 Vue watch(line 752-789) 对齐
    unregRef.current = (chatRef.current as any)['~registerMessagesCallback'](() => {
      const c = chatRef.current
      if (!c) return
      setIsStreaming(c.status === 'streaming')
      const sdkMsgs = c.messages ?? []
      if (!sdkMsgs.length) return

      // ① 清理过期 pendingMods
      if (pendingModsRef.current.length > 0) {
        setPendingMods((prev) => {
          const filtered = prev.filter((p) => Date.now() - p.timestamp < 60000)
          pendingModsRef.current = filtered
          return filtered
        })
        if (pendingModsRef.current.length > 0) return
      }

      // ② 新消息：sdkSyncedIds 去重 filter + map + append + mark
      const newSdk = sdkMsgs.filter((m: any) => m.id && !sdkSyncedIds.current.has(m.id))
      if (newSdk.length > 0) {
        const mapped = newSdk.map((m: any) => ({
          id: m.id, role: m.role as 'user' | 'assistant',
          content: extractPartsText(m.parts ?? []),
          reasoning: extractPartsReasoning(m.parts ?? []),
          showReasoning: showReasoningMap.get(m.id ?? '') ?? false,
          optimizations: extractPartsOptimizations(m.parts ?? []),
          modifications: extractPartsModifications(m.parts ?? []),
        }))
        newSdk.forEach((m: any) => { if (m.id) sdkSyncedIds.current.add(m.id) })
        setMessages((prev) => {
          const result = [...prev]
          for (const msg of mapped) {
            const localIdx = result.findIndex((m) => m.role === 'user' && m.id?.startsWith('local-restore-'))
            if (localIdx !== -1) { result[localIdx] = msg; continue }
            result.push(msg)
          }
          return result
        })
      }

      // ③ 最后一条消息：增量更新
      const lastSdk = sdkMsgs[sdkMsgs.length - 1]
      if (lastSdk?.id) {
        setMessages((prev) => prev.map((m) => {
            if (m.id !== lastSdk.id) return m
            const p = lastSdk.parts ?? []
            const cc = extractPartsText(p)
            const rr = extractPartsReasoning(p)
            const oo = extractPartsOptimizations(p)
            const mm = extractPartsModifications(p)
            return {
              ...m,
              ...(cc ? { content: cc } : {}),
              ...(rr ? { reasoning: rr } : {}),
              ...(oo.length ? { optimizations: oo } : {}),
              ...(mm.length ? { modifications: mm } : {}),
            }
          }))
      }

      if (autoScroll.current) scrollToBottom()
    }, 0)
  }

  // ═══ 队列系统 — 与 Vue 对齐 ═══
  const processQueue = useCallback(() => {
    setRequestQueue((prev) => {
      const trimmed = prev.filter((r) => !r.canceled)
      if (trimmed.length === 0) { setIsProcessing(false); setIsSearchProcessing(false); return trimmed }
      if (trimmed[0].status !== 'pending') return trimmed
      setIsProcessing(true)
      setIsSearchProcessing(trimmed[0].type === 'search')
      const execute = trimmed[0].execute
      const updated = trimmed.map((r) => r.id === trimmed[0].id ? { ...r, status: 'processing' as const } : r)
      setTimeout(() => { try { execute() } catch (err) { console.error('Queue execute error:', err); processQueue() } }, 0)
      return updated
    })
  }, [])

  const enqueueRequest = useCallback(
    (req: Omit<QueuedRequest, 'id' | 'timestamp' | 'status' | 'label' | 'canceled'>, payload?: any) => {
      if (payload?.field) {
        setRequestQueue((prev) => {
          const dupIdx = prev.findIndex((r) => r.status === 'pending' && r.type === req.type && r.label.includes(payload.field))
          if (dupIdx === -1) return prev
          const filtered = [...prev]; filtered.splice(dupIdx, 1); return filtered
        })
      }
      const newReq: QueuedRequest = {
        ...req, id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: getLabel(req.type, payload), status: 'pending', canceled: false, timestamp: Date.now(),
      }
      setRequestQueue((prev) => [...prev, newReq])
      setTimeout(() => processQueue(), 0)
    },
    [processQueue]
  )

  // ═══ 辅助函数 ═══
  const loadReferenceFiles = useCallback(async (id?: string) => { const cid = id ?? conversationId; if (!cid) return; setRefFilesLoading(true); try { const r = await getReferenceFiles(cid); setReferenceFiles(r.docs || []) } catch (e) { console.error(e) } finally { setRefFilesLoading(false) } }, [conversationId])

  const loadDocHistory = useCallback(async (convId?: string) => {
    const cid = convId ?? conversationId; if (!cid) return
    try { const r = await getDocHistory(cid); setDocVersions(r.versions ?? []); setActiveVersionIdx(Math.max(0, (r.versions ?? []).length - 1)) } catch (e) { console.error(e) }
  }, [conversationId])

  const reloadPdfFromServer = useCallback(async (convId?: string) => {
    const cid = convId ?? conversationId
    if (!cid) return
    try {
      const result = await getConversationMessages(cid, 1, 1, 'DESC')
      const docs = result.data?.documents ?? []
      if (docs.length > 0) {
        const latestDoc = docs[0]
        const fileUrl = latestDoc.file_url.startsWith('/api')
          ? latestDoc.file_url
          : `/api${latestDoc.file_url}`
        const blob = (await api.get(fileUrl.replace('/api', ''), { responseType: 'blob' })) as Blob
        const newUrl = URL.createObjectURL(blob)
        if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        setPdfUrl(newUrl)
      }
    } catch (e) { console.error(e) }
  }, [conversationId, pdfUrl])

  const loadConversationToState = useCallback((id: string, totalMsgs: number, resetPdf = true) => {
    const state = useResumeStore.getState(); setSupplementCount(0); setConversationId(id); setMessagesPage(1)
    setHasMoreHistory(totalMsgs > state.messages.length); if (resetPdf) setPdfUrl(state.fileBlobUrl); else if (state.fileBlobUrl) setPdfUrl(state.fileBlobUrl)
    loadReferenceFiles(id); loadDocHistory(id)
  }, [loadReferenceFiles, loadDocHistory])

  const removeReferenceFile = useCallback(async (id: number) => {
    if (id === 0) { setReferenceFiles((prev) => prev.filter((f) => f.id !== 0)); return }
    try { await deleteReferenceFile(conversationId, id); setReferenceFiles((prev) => prev.filter((f) => f.id !== id)); message.success('已删除') } catch (e) { message.error('删除失败') }
  }, [conversationId])

  const dequeue = useCallback(() => {
    loadReferenceFiles()
    setRequestQueue((prev) => {
      if (prev.length > 0) {
        const updated = prev.map((r, i) => (i === 0 ? { ...r, status: 'completed' as const } : r))
        const [, ...rest] = updated; setTimeout(() => processQueue(), 0); return rest
      }
      setTimeout(() => processQueue(), 0); return prev
    })
  }, [processQueue, loadReferenceFiles])

  const cancelRequest = useCallback((id: string) => {
    let key: string | undefined, wasSupp: boolean | undefined
    setRequestQueue((prev) => {
      const req = prev.find((r) => r.id === id)
      if (req) { key = req.disabledKey; wasSupp = req.wasSupplement }
      return prev.map((r) => r.id === id ? { ...r, canceled: true, status: 'failed' as const } : r)
    })
    if (key) { setDisabledOpts((prev) => { const n = new Set(prev); n.delete(key!); return n }); setDisabledMods((prev) => { const n = new Set(prev); n.delete(key!); return n }) }
    if (wasSupp) setSupplementCount((prev) => Math.max(0, prev - 1))
  }, [])

  const cancelAllPending = useCallback(() => {
    let keys: string[] = []; let drops = 0
    setRequestQueue((prev) => {
      keys = prev.filter((r) => r.status === 'pending').map((r) => r.disabledKey).filter(Boolean) as string[]
      drops = prev.filter((r) => r.status === 'pending' && r.wasSupplement).length
      return prev.map((r) => r.status === 'pending' ? { ...r, canceled: true, status: 'failed' as const } : r)
    })
    keys.forEach((k) => { setDisabledOpts((p) => { const n = new Set(p); n.delete(k); return n }); setDisabledMods((p) => { const n = new Set(p); n.delete(k); return n }) })
    if (drops) setSupplementCount((prev) => Math.max(0, prev - drops))
  }, [])

  const pendingQueueCount = useMemo(() => requestQueue.filter((r) => r.status === 'pending').length, [requestQueue])

  // ═══ 滚动 ═══
  const scrollToBottom = useCallback(() => chatPanelRef.current?.scrollToBottom(), [])

  const pushStatusMessages = useCallback((field: string) => {
    const ts = Date.now()
    setMessages((prev) => [...prev, { id: `temp-user-${ts}`, role: 'user', content: `确认修改：${field}` }, { id: `temp-status-${ts}`, role: 'assistant', content: `正在处理「${field}」...`, isProcessing: true }])
    const item = { field, timestamp: Date.now() }; pendingModsRef.current = [...pendingModsRef.current, item]; setPendingMods((prev) => [...prev, item])
    autoScroll.current = true; scrollToBottom()
  }, [scrollToBottom])

  const onChatSend = useCallback((text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return
    setFailedMessage(text)
    autoScroll.current = true; scrollToBottom()
    if (files.length > 0) {
      const optimisticDocs: ReferenceDoc[] = files.map((f) => ({ id: 0, original_name: f.name, file_type: f.name.split('.').pop()?.toLowerCase() || '', file_size: f.size, file_path: '', doc_type: 'reference', version: 0, created_at: Date.now(), ref_category: undefined }))
      setReferenceFiles((prev) => [...optimisticDocs, ...prev])
    }
    enqueueRequest({ type: 'search', execute: () => { setSupplementCount(0); chatRef.current?.sendMessage({ text }, { body: { type: 'search', conversationId, query: text, files: files.length > 0 ? files : undefined } }) } }, { text })
  }, [enqueueRequest, conversationId, scrollToBottom])

  const onApplyOptimization = useCallback((item: OptimizationItem, _idx: number, _msgIndex: number, _msg: Message) => {
    setDisabledOpts((prev) => new Set(prev).add(`${_msgIndex}-${_idx}`))
    enqueueRequest({ type: 'apply', disabledKey: `${_msgIndex}-${_idx}`, execute: () => {
      pushStatusMessages(item.field)
      try { chatRef.current?.sendMessage({ text: `采纳建议：${item.field}` }, { body: { type: 'apply', conversationId, displayText: `采纳优化建议：\n字段：${item.field}\n当前内容：${item.current}\n建议内容：${item.suggestion}`, optimization: { field: item.field, current: item.current, suggestion: item.suggestion, reason: item.reason || '' } } }) }
      catch (err) { console.error('Apply error:', err); message.error('采纳失败'); dequeue() }
    } }, { field: item.field })
  }, [enqueueRequest, conversationId, pushStatusMessages, dequeue])

  const acceptModification = useCallback((item: ModificationItem, _msgIndex: number, _modIdx: number) => {
    setSupplementCount(0)
    setDisabledMods((prev) => new Set(prev).add(`${_msgIndex}-${_modIdx}`))
    enqueueRequest({ type: 'accept', disabledKey: `${_msgIndex}-${_modIdx}`, execute: () => {
      pushStatusMessages(item.field)
      try { chatRef.current?.sendMessage({ text: `确认修改：${item.field}` }, { body: { type: 'accept', conversationId, optimization: { field: item.field, current: item.current, suggestion: item.suggestion, reason: item.reason || '' } } }) }
      catch (err) { console.error('Accept error:', err); message.error('确认修改失败'); dequeue() }
    } }, { field: item.field })
  }, [enqueueRequest, conversationId, pushStatusMessages, dequeue])

  const submitSupplement = useCallback((text: string) => {
    if (!text.trim()) return
    const query = currentSupplementField ? `之前要求修改「${currentSupplementField}」：${currentSupplementOriginal}\n现补充：${text}` : `补充修改要求：${text}`
    setSupplementCount((prev) => prev + 1)
    enqueueRequest({ type: 'search', wasSupplement: true, disabledKey: `${currentSupplementMsgIndex}-${currentSupplementModIdx}`, execute: () => { chatRef.current?.sendMessage({ text: `补充修改要求：${text}` }, { body: { type: 'search', conversationId, query, displayText: `补充修改要求：${text}` } }); chatPanelRef.current?.setInput?.('') } }, { text })
  }, [enqueueRequest, conversationId, currentSupplementField, currentSupplementOriginal, currentSupplementMsgIndex, currentSupplementModIdx])

  // ═══ 历史加载 ═══
  const loadMoreHistory = useCallback(async () => {
    if (historyLoading || !hasMoreHistory) return
    setHistoryLoading(true)
    try {
      const nextPage = messagesPage + 1
      const { getConversationMessages } = await import('@/api')
      const result = await getConversationMessages(conversationId, nextPage, MESSAGES_PAGE_SIZE, 'DESC')
      const data = result.data ?? result
      const apiMessages = (data.messages ?? []).reverse()
      if (apiMessages.length === 0 || messagesPage * MESSAGES_PAGE_SIZE >= (result.pagination?.total ?? 0)) { setHasMoreHistory(false) }
      else {
        const prevHeight = chatPanelRef.current?.getScrollHeight?.() ?? 0
        setMessages((prev) => [...apiMessages.map(mapApiMessage), ...prev])
        setMessagesPage(nextPage)
        setHasMoreHistory(nextPage * MESSAGES_PAGE_SIZE < (result.pagination?.total ?? 0))
        requestAnimationFrame(() => { const nh = chatPanelRef.current?.getScrollHeight?.() ?? 0; chatPanelRef.current?.restoreScrollPosition?.(nh - prevHeight) })
      }
    } catch (e) { console.error('Failed to load more history:', e); setMessagesPage((prev) => Math.max(1, prev - 1)) }
    finally { setHistoryLoading(false) }
  }, [historyLoading, hasMoreHistory, messagesPage, conversationId])

  const onChatScroll = useCallback((payload: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
    autoScroll.current = payload.scrollHeight - payload.scrollTop - payload.clientHeight < 80
    if (!autoScroll.current && hasMoreHistory && payload.scrollTop < 30) loadMoreHistory()
  }, [hasMoreHistory, loadMoreHistory])



  function autoTriggerSearch(query: string, id: string) { enqueueRequest({ type: 'search', execute: () => chatRef.current?.sendMessage({ text: query }, { body: { conversationId: id, query } }) }, { text: query }) }

  function triggerSearchIfNeeded() {
    const storeMsgs = resumeStore.messages
    if (storeMsgs.length > 0 && storeMsgs[storeMsgs.length - 1].role === 'user') {
      if (chatRef.current?.messages?.some((m: any) => m.role === 'assistant')) return
      autoTriggerSearch(storeMsgs[storeMsgs.length - 1].content, routeId!)
    }
  }

  // ═══ 初始加载 + 路由切换 ═══
  useEffect(() => {
    if (!routeId) { navigate('/editor', { replace: true }); return }
    sdkSyncedIds.current.clear(); setMessages([]); setPdfUrl(''); setDocVersions([]); setActiveVersionIdx(0); setError('')
    const init = async () => {
      try {
        setLoading(true)
        const { totalMessages } = await resumeStore.loadConversation(routeId)
        const state = useResumeStore.getState()
        const storeMsgs = state.messages
        setMessages(storeMsgs)
        loadConversationToState(routeId, totalMessages)
        const historyMessages = storeMsgs.map((m: any) => ({ id: String(m.id ?? ''), role: m.role, content: m.content, parts: m.parts ?? [{ type: 'text', text: m.content }] }))
        initChat(historyMessages)
        if (resumeStore.messages.length > 0) {
          setMessages((prev) => prev.map((m, i) => { const storeMsg = resumeStore.messages[i] as any; if (storeMsg?.reasoning) return { ...m, reasoning: storeMsg.reasoning }; return m }))
        }
        if (storeMsgs.length === 0 && state.initialPrompt) { autoTriggerSearch(state.initialPrompt, routeId) } else { triggerSearchIfNeeded() }
        scrollToBottom()
      } catch (e) { console.error(e); setError('加载会话失败') } finally { setLoading(false) }
    }
    init()
  }, [routeId])

  // ═══ 清理 ═══
  useEffect(() => { return () => { const state = useResumeStore.getState(); if (state.fileBlobUrl) URL.revokeObjectURL(state.fileBlobUrl); setPendingMods([]); sdkSyncedIds.current.clear() } }, [])

  if (loading) return <div className="flex justify-center items-center h-screen bg-[#f5f5f5]"><Skeleton active paragraph={{ rows: 8 }} style={{ width: '60%' }} /></div>
  if (error) return <div className="flex justify-center items-center h-screen bg-[#f5f5f5]"><Result status="error" title="加载失败" subTitle={error} extra={<Button type="primary" onClick={() => window.location.reload()}>重试</Button>} /></div>

  return (
    <div className="flex h-[calc(100vh-50px)]">
      <div className="flex-1 min-w-0 p-5 bg-[#f5f5f5] overflow-hidden">
        <PdfPreview pdfUrl={pdfUrl} loading={loading} error={error} onDownload={async () => { try { const blob = await renderResumePdf(resumeStore.resumeContent); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'resume.pdf'; a.click(); URL.revokeObjectURL(url) } catch (e) { message.error('下载失败') } }}
          versions={docVersions} activeIndex={activeVersionIdx}
          currentVersion={activeVersionIdx >= 0 && docVersions[activeVersionIdx] ? docVersions[activeVersionIdx].type === 'original' ? '原始简历' : `修改版本 v${docVersions[activeVersionIdx].version || ''}` : undefined}
          showRestore={docVersions.length > 1 && activeVersionIdx !== docVersions.length - 1}
          onSelectVersion={async (idx: number) => { if (idx === activeVersionIdx) return; const v = docVersions[idx]; if (!v) return; try { let blob: Blob; if (v.type === 'original' && resumeStore.resumeContent) blob = await renderResumePdf(resumeStore.resumeContent); else { const result = await api.get(`/rag/docs/${v.refId}/download`, { responseType: 'blob' }); blob = result as unknown as Blob } const url = URL.createObjectURL(blob); setPdfUrl((prev) => { if (prev && prev !== resumeStore.fileBlobUrl) URL.revokeObjectURL(prev); return url }); setActiveVersionIdx(idx) } catch (e) { message.error('加载版本失败') } }}
          onRestore={async () => { const v = docVersions[activeVersionIdx]; if (!v) return; try { const ts = Date.now(); setMessages((prev) => [...prev, { id: `local-restore-${ts}`, role: 'assistant', content: `已恢复到版本 v${v.version}` }]); autoScroll.current = true; scrollToBottom(); await restoreDocVersion(v.refId); message.success('已恢复'); loadDocHistory(); reloadPdfFromServer() } catch (e) { message.error('恢复失败') } }} />
      </div>
      <div className="w-[400px] shrink-0 p-5">
        <ChatPanel ref={chatPanelRef} messages={messages} isLoading={isStreaming} chatTitle={chatTitle} chatError={chatError}
          referenceFiles={referenceFiles} historyLoading={historyLoading} hasMoreHistory={hasMoreHistory} requestQueue={requestQueue as any}
          isProcessing={isProcessing} isSearchProcessing={isSearchProcessing} pendingCount={pendingQueueCount} disabledOpts={disabledOpts} disabledMods={disabledMods}
          onSend={onChatSend} onLoadMoreHistory={loadMoreHistory} onChatScroll={onChatScroll} onStop={handleStop}
          onRetrySend={() => { setChatError(''); const t = failedMessage; setFailedMessage(''); if (t) onChatSend(t, []) }}
          onCloseError={() => setChatError('')} onRemoveReferenceFile={removeReferenceFile}
          onApplyOptimization={onApplyOptimization} onAcceptModification={acceptModification} onSupplementModification={(item, msgIdx, modIdx) => { setCurrentSupplementField(item.field); setCurrentSupplementOriginal(item.current); setCurrentSupplementMsgIndex(msgIdx); setCurrentSupplementModIdx(modIdx); chatPanelRef.current?.openSupplementDialog() }}
          onRejectModification={(msgIdx, modIdx) => setDisabledMods((prev) => new Set(prev).add(`${msgIdx}-${modIdx}`))}
          onSubmitSupplement={submitSupplement} onToggleDrawer={() => setDrawerVisible(true)} onGoBack={() => navigate('/conversations')}
          onCancelRequest={cancelRequest} onCancelAllPending={cancelAllPending} onReorderQueue={(q: any[]) => setRequestQueue(q)}
          onToggleReasoning={(msgId: string) => { const cur = showReasoningMap.get(msgId) ?? false; showReasoningMap.set(msgId, !cur); setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, showReasoning: !cur } : m)) }} />
      </div>
      <ConversationDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
    </div>
  )
}
