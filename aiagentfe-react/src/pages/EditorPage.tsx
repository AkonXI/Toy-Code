import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
  type Dispatch,
  type SetStateAction
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Skeleton, Result, Button, message } from 'antd'
import { generateId } from 'ai'
import { useResumeStore } from '@/stores/resume'
import PdfPreview from '@/components/PdfPreview'
import ChatPanel from '@/components/ChatPanel'
import ConversationDrawer from '@/components/ConversationDrawer'
import { useRequestQueue } from '@/hooks/useRequestQueue'
import { useEditorPdf } from '@/hooks/useEditorPdf'
import { useEditorHistory } from '@/hooks/useEditorHistory'
import { useEditorChat, showReasoningMap } from '@/hooks/useEditorChat'
import { useEditorModifications } from '@/hooks/useEditorModifications'
import {
  extractPartsText,
  extractPartsReasoning,
  extractPartsOptimizations,
  extractPartsModifications
} from '@/lib/editor-utils'
import { deleteReferenceFile } from '@/api'
import type { Message } from '@/types/chat'

export default function EditorPage() {
  const navigate = useNavigate()
  const { id: routeId } = useParams()
  const resumeStore = useResumeStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [chatError, setChatError] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const autoScroll = useRef(true)
  const chatPanelRef = useRef<any>(null)

  const loadReferenceFilesRef = useRef<() => void>(() => {})
  const {
    requestQueue,
    setRequestQueue,
    isProcessing,
    setIsProcessing,
    isSearchProcessing,
    setIsSearchProcessing,
    pendingQueueCount,
    enqueueRequest,
    cancelRequest,
    cancelAllPending,
    dequeue
  } = useRequestQueue({ loadReferenceFilesRef })

  const {
    pdfUrl,
    setPdfUrl,
    referenceFiles,
    setReferenceFiles,
    docVersions,
    setDocVersions,
    activeVersionIdx,
    setActiveVersionIdx,
    currentVersionLabel,
    loadReferenceFiles,
    loadDocHistory,
    handleSelectVersion,
    handleRestore: pdfHandleRestore,
    handleDownload
  } = useEditorPdf()

  const { historyLoading, hasMoreHistory, loadMoreHistory, resetHistory } = useEditorHistory()

  const {
    isStreaming,
    chatRef,
    conversationIdRef,
    requestQueueRef: chatQueueRef,
    autoScrollRef,
    initChat,
    handleStop: chatHandleStop
  } = useEditorChat()

  const {
    disabledOpts,
    disabledMods,
    setSupplementCount,
    onApplyOptimization,
    acceptModification,
    supplementModification,
    submitSupplement: modSubmitSupplement,
    rejectModification,
    cleanupDisabledKeys,
    resetSupplement
  } = useEditorModifications()

  const chatTitle = useMemo(
    () => resumeStore.conversationTitle || '简历优化助手',
    [resumeStore.conversationTitle]
  )

  const scrollToBottom = useCallback(() => chatPanelRef.current?.scrollToBottom(), [])
  const conversationIdStr = conversationId

  const onMessages = useCallback(
    (sdkMsgs: any[], setMsgs: Dispatch<SetStateAction<Message[]>>, autoScrollEnabled: boolean) => {
      setMsgs((prev) => {
        const result = [...prev]
        for (const sdkMsg of sdkMsgs) {
          const content = extractPartsText(sdkMsg.parts ?? [])

          if (!content && sdkMsg.role === 'assistant') {
            const allTool = (sdkMsg.parts ?? []).every(
              (p: any) => p.type.startsWith('tool-') || p.type === 'dynamic-tool'
            )
            if (allTool) continue
          }

          const idx = result.findIndex((m) => m.id === sdkMsg.id)
          const mapped = {
            id: sdkMsg.id,
            role: sdkMsg.role as 'user' | 'assistant',
            content,
            reasoning: extractPartsReasoning(sdkMsg.parts ?? []),
            showReasoning: showReasoningMap.get(sdkMsg.id ?? '') ?? false,
            optimizations: extractPartsOptimizations(sdkMsg.parts ?? []),
            modifications: extractPartsModifications(sdkMsg.parts ?? [])
          }
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...mapped }
          } else {
            result.push(mapped)
          }
        }
        return result
      })

      if (autoScrollEnabled) scrollToBottom()
    },
    [scrollToBottom]
  )

  // ═══ ref sync ═══
  useEffect(() => {
    conversationIdRef.current = conversationId
    chatQueueRef.current = requestQueue
    autoScrollRef.current = autoScroll.current
  }, [conversationId, requestQueue, autoScrollRef, conversationIdRef, chatQueueRef])

  useEffect(() => {
    loadReferenceFilesRef.current = () => loadReferenceFiles(conversationId)
  }, [loadReferenceFiles, conversationId])

  const handleStop = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant' && last.status !== 'interrupted') {
        return [...prev.slice(0, -1), { ...last, status: 'interrupted' as const }]
      }
      return prev
    })
    chatHandleStop(setRequestQueue)
    setIsProcessing(false)
    setIsSearchProcessing(false)
  }, [chatHandleStop, setRequestQueue, setIsProcessing, setIsSearchProcessing])

  const handleCancelRequest = useCallback(
    (id: string) => {
      const { disabledKey, wasSupplement } = cancelRequest(id)
      if (disabledKey) cleanupDisabledKeys([disabledKey])
      if (wasSupplement) setSupplementCount((prev) => Math.max(0, prev - 1))
    },
    [cancelRequest, cleanupDisabledKeys, setSupplementCount]
  )

  const handleCancelAllPending = useCallback(() => {
    const { keys, drops } = cancelAllPending()
    if (keys.length > 0) cleanupDisabledKeys(keys)
    if (drops > 0) setSupplementCount((prev) => Math.max(0, prev - drops))
  }, [cancelAllPending, cleanupDisabledKeys, setSupplementCount])

  const onChatSend = useCallback(
    (text: string, files: File[]) => {
      if (!text.trim() && files.length === 0) return
      setFailedMessage(text)
      autoScroll.current = true
      scrollToBottom()

      if (files.length > 0) {
        const optimisticDocs = files.map((f) => ({
          id: 0,
          original_name: f.name,
          file_type: f.name.split('.').pop()?.toLowerCase() || '',
          file_size: f.size,
          file_path: '',
          doc_type: 'reference' as const,
          version: 0,
          created_at: Date.now(),
          ref_category: undefined as any
        }))
        setReferenceFiles((prev) => [...optimisticDocs, ...prev])
      }

      const userMsgId = generateId()
      const assistantMsgId = generateId()
      enqueueRequest(
        {
          type: 'search',
          execute: () => {
            setSupplementCount(0)
            setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: text }])
            const chat = chatRef.current!
            chat.messages.push({ id: userMsgId, role: 'user', parts: [{ type: 'text', text }] })
            chat.sendMessage(
              { messageId: userMsgId, parts: [{ type: 'text', text }] },
              {
                body: {
                  type: 'search',
                  conversationId: conversationIdStr,
                  query: text,
                  userMsgId,
                  assistantMsgId,
                  files: files.length > 0 ? files : undefined
                }
              }
            )
          }
        },
        { text }
      )
    },
    [enqueueRequest, conversationIdStr, scrollToBottom, chatRef, setReferenceFiles]
  )

  const handleRetrySend = useCallback(() => {
    setChatError('')
    const t = failedMessage
    setFailedMessage('')
    if (t) onChatSend(t, [])
  }, [failedMessage, onChatSend])

  const handleToggleReasoning = useCallback((msgId: string) => {
    const cur = showReasoningMap.get(msgId) ?? false
    showReasoningMap.set(msgId, !cur)
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, showReasoning: !cur } : m)))
  }, [])

  const handleApplyOptimization = useCallback(
    (item: any, idx: number, msgIndex: number, msg: Message) => {
      onApplyOptimization(item, idx, msgIndex, msg, {
        chatRef,
        conversationId: conversationIdStr,
        enqueueRequest,
        dequeue,
        autoScrollRef: autoScroll,
        setMessages,
        scrollToBottom
      })
    },
    [onApplyOptimization, chatRef, conversationIdStr, enqueueRequest, dequeue, scrollToBottom]
  )

  const handleAcceptModification = useCallback(
    (item: any, msgIndex: number, modIdx: number) => {
      acceptModification(item, msgIndex, modIdx, {
        chatRef,
        conversationId: conversationIdStr,
        enqueueRequest,
        dequeue,
        setMessages
      })
    },
    [acceptModification, chatRef, conversationIdStr, enqueueRequest, dequeue]
  )

  const handleSupplementModification = useCallback(
    (item: any, msgIdx: number, modIdx: number) => {
      supplementModification(item, msgIdx, modIdx, chatPanelRef)
    },
    [supplementModification]
  )

  const handleSubmitSupplement = useCallback(
    (text: string) => {
      modSubmitSupplement(text, {
        chatRef,
        conversationId: conversationIdStr,
        enqueueRequest,
        chatPanelRef
      })
    },
    [modSubmitSupplement, chatRef, conversationIdStr, enqueueRequest]
  )

  const handleRestore = useCallback(async () => {
    const versionStr = await pdfHandleRestore(conversationId)
    if (versionStr !== null) {
      const ts = Date.now()
      setMessages((prev) => [
        ...prev,
        { id: `local-restore-${ts}`, role: 'assistant', content: `已恢复到版本 v${versionStr}` }
      ])
      autoScroll.current = true
      scrollToBottom()
    }
  }, [pdfHandleRestore, conversationId, scrollToBottom])

  // ═══ 历史加载 ═══
  const handleLoadMoreHistory = useCallback(async () => {
    const result = await loadMoreHistory(conversationId, messages, chatPanelRef)
    if (result) setMessages(result)
  }, [loadMoreHistory, conversationId, messages])

  const onChatScroll = useCallback(
    (payload: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
      autoScroll.current = payload.scrollHeight - payload.scrollTop - payload.clientHeight < 80
      if (!autoScroll.current && hasMoreHistory && payload.scrollTop < 30) handleLoadMoreHistory()
    },
    [hasMoreHistory, handleLoadMoreHistory]
  )

  const removeReferenceFile = useCallback(
    async (id: number) => {
      if (id === 0) {
        setReferenceFiles((prev) => prev.filter((f) => f.id !== 0))
        return
      }
      try {
        await deleteReferenceFile(conversationId, id)
        setReferenceFiles((prev) => prev.filter((f) => f.id !== id))
        message.success('已删除')
      } catch {
        message.error('删除失败')
      }
    },
    [conversationId, setReferenceFiles]
  )

  function loadConversationToState(id: string, totalMsgs: number, resetPdf = true) {
    resetSupplement()
    setConversationId(id)
    resetHistory(totalMsgs, resumeStore.messages.length)
    const state = useResumeStore.getState()
    if (resetPdf) setPdfUrl(state.fileBlobUrl)
    else if (state.fileBlobUrl) setPdfUrl(state.fileBlobUrl)
    loadReferenceFiles(id)
    loadDocHistory(id)
  }

  function autoTriggerSearch(query: string, id: string) {
    const userMsgId = generateId()
    const assistantMsgId = generateId()
    enqueueRequest(
      {
        type: 'search',
        execute: () => {
          const chat = chatRef.current!
          chat.messages.push({
            id: userMsgId,
            role: 'user',
            parts: [{ type: 'text', text: query }]
          })
          chat.sendMessage(
            { messageId: userMsgId, parts: [{ type: 'text', text: query }] },
            { body: { conversationId: id, query, userMsgId, assistantMsgId } }
          )
        }
      },
      { text: query }
    )
  }

  function triggerSearchIfNeeded() {
    const storeMsgs = resumeStore.messages
    if (storeMsgs.length > 0 && storeMsgs[storeMsgs.length - 1].role === 'user') {
      if (chatRef.current?.messages?.some((m: any) => m.role === 'assistant')) return
      autoTriggerSearch(storeMsgs[storeMsgs.length - 1].content, routeId!)
    }
  }

  // ═══ 初始加载 + 路由切换 ═══
  useEffect(() => {
    if (!routeId) {
      navigate('/editor', { replace: true })
      return
    }
    startTransition(() => {
      setMessages([])
      setPdfUrl('')
      setDocVersions([])
      setActiveVersionIdx(0)
      setError('')
    })
    const init = async () => {
      try {
        setLoading(true)
        const { totalMessages } = await resumeStore.loadConversation(routeId)
        const state = useResumeStore.getState()
        const storeMsgs = state.messages
        setMessages(storeMsgs)
        loadConversationToState(routeId, totalMessages)

        const historyMessages = storeMsgs.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text', text: m.content }]
        }))
        initChat({
          historyMessages,
          onFinishActions: {
            setMessages,
            setPdfUrl,
            setDocVersions,
            setActiveVersionIdx,
            dequeue,
            scrollToBottom
          },
          onErrorActions: {
            setChatError,
            setFailedMessage,
            dequeue
          },
          onMessages
        })

        if (storeMsgs.length === 0 && state.initialPrompt) {
          autoTriggerSearch(state.initialPrompt, routeId)
        } else {
          triggerSearchIfNeeded()
        }
        scrollToBottom()
      } catch (e) {
        console.error(e)
        setError('加载会话失败')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [routeId])

  // ═══ 清理 ═══
  useEffect(() => {
    return () => {
      const state = useResumeStore.getState()
      if (state.fileBlobUrl) URL.revokeObjectURL(state.fileBlobUrl)
    }
  }, [])

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen bg-[#f5f5f5]">
        <Skeleton active paragraph={{ rows: 8 }} style={{ width: '60%' }} />
      </div>
    )
  if (error)
    return (
      <div className="flex justify-center items-center h-screen bg-[#f5f5f5]">
        <Result
          status="error"
          title="加载失败"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              重试
            </Button>
          }
        />
      </div>
    )

  return (
    <div className="flex h-[calc(100vh-50px)]">
      <div className="flex-1 min-w-0 p-5 bg-[#f5f5f5] overflow-hidden">
        <PdfPreview
          pdfUrl={pdfUrl}
          loading={loading}
          error={error}
          onDownload={handleDownload}
          versions={docVersions}
          activeIndex={activeVersionIdx}
          currentVersion={currentVersionLabel}
          showRestore={docVersions.length > 1 && activeVersionIdx !== docVersions.length - 1}
          onSelectVersion={handleSelectVersion}
          onRestore={handleRestore}
        />
      </div>
      <div className="w-[400px] shrink-0 p-5">
        <ChatPanel
          ref={chatPanelRef}
          messages={messages}
          isLoading={isStreaming}
          chatTitle={chatTitle}
          chatError={chatError}
          referenceFiles={referenceFiles}
          historyLoading={historyLoading}
          hasMoreHistory={hasMoreHistory}
          requestQueue={requestQueue as any}
          isProcessing={isProcessing}
          isSearchProcessing={isSearchProcessing}
          pendingCount={pendingQueueCount}
          disabledOpts={disabledOpts}
          disabledMods={disabledMods}
          onSend={onChatSend}
          onLoadMoreHistory={handleLoadMoreHistory}
          onChatScroll={onChatScroll}
          onStop={handleStop}
          onRetrySend={handleRetrySend}
          onCloseError={() => setChatError('')}
          onRemoveReferenceFile={removeReferenceFile}
          onApplyOptimization={handleApplyOptimization}
          onAcceptModification={handleAcceptModification}
          onSupplementModification={handleSupplementModification}
          onRejectModification={rejectModification}
          onSubmitSupplement={handleSubmitSupplement}
          onToggleDrawer={() => setDrawerVisible(true)}
          onGoBack={() => navigate('/conversations')}
          onCancelRequest={handleCancelRequest}
          onCancelAllPending={handleCancelAllPending}
          onReorderQueue={(q: any[]) => setRequestQueue(q)}
          onToggleReasoning={handleToggleReasoning}
        />
      </div>
      <ConversationDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
    </div>
  )
}
