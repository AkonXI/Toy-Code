import { useState, useRef, useCallback, useEffect, useMemo, useImperativeHandle, forwardRef, memo } from 'react'
import React from 'react'
import { Card, Button, Drawer, Tag, message } from 'antd'
import { MenuOutlined, LoadingOutlined } from '@ant-design/icons'
import OptimizationCard from './OptimizationCard'
import ModificationReview from './ModificationReview'
import type { OptimizationItem, ModificationItem, Message } from '@/types/chat'
import type { ReferenceDoc } from '@/api'

interface QueueItem {
  id: string
  label: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  canceled: boolean
}

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  chatTitle: string
  chatError: string
  referenceFiles: ReferenceDoc[]
  historyLoading: boolean
  hasMoreHistory: boolean
  requestQueue: QueueItem[]
  isProcessing: boolean
  pendingCount: number
  disabledOpts?: Set<string>
  disabledMods?: Set<string>
  onSend: (text: string, files: File[]) => void
  onLoadMoreHistory: () => void
  onChatScroll: (payload: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void
  onRetrySend: () => void
  onCloseError: () => void
  onRemoveReferenceFile: (id: number) => void
  onApplyOptimization: (item: OptimizationItem, idx: number, msgIndex: number, msg: Message) => void
  onAcceptModification: (item: ModificationItem, msgIndex: number, modIdx: number) => void
  onSupplementModification: (item: ModificationItem, msgIndex: number, modIdx: number) => void
  onRejectModification: (msgIndex: number, modIdx: number) => void
  onSubmitSupplement: (text: string) => void
  onToggleDrawer: () => void
  onGoBack: () => void
  onCancelRequest: (id: string) => void
  onCancelAllPending: () => void
  onReorderQueue: (newQueue: QueueItem[]) => void
  onToggleReasoning: (msgId: string) => void
}

export interface ChatPanelHandle {
  scrollToBottom: () => void
  openSupplementDialog: () => void
}

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>((props, ref) => {
  const [input, setInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [showRefDrawer, setShowRefDrawer] = useState(false)
  const [showQueuePanel, setShowQueuePanel] = useState(false)
  const [showSupplementInput, setShowSupplementInput] = useState(false)
  const [supplementInput, setSupplementInput] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)
  const reasoningBoxRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const reasoningAutoScroll = useRef<Map<string, boolean>>(new Map())
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      requestAnimationFrame(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
      })
    },
    openSupplementDialog: () => {
      setSupplementInput('')
      setShowSupplementInput(true)
    }
  }))

  // reasoning 框自动滚动
  const onReasoningScroll = useCallback((msgId: string, e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    reasoningAutoScroll.current.set(msgId, el.scrollHeight - el.scrollTop - el.clientHeight < 40)
  }, [])

  const scrollReasoningToBottom = useCallback((msgId: string) => {
    requestAnimationFrame(() => {
      reasoningBoxRefs.current.get(msgId)?.scrollTo({ top: 99999, behavior: 'instant' as ScrollBehavior })
    })
  }, [])

  const msgReasonings = useMemo(
    () => props.messages.map(m => `${m.id}|${m.reasoning}|${m.showReasoning}`).join(','),
    [props.messages]
  )

  useEffect(() => {
    for (const msg of props.messages) {
      if (!msg.id || !msg.showReasoning || !msg.reasoning) continue
      if (!reasoningAutoScroll.current.has(String(msg.id))) {
        reasoningAutoScroll.current.set(String(msg.id), true)
      }
      if (reasoningAutoScroll.current.get(String(msg.id)) !== false) {
        scrollReasoningToBottom(String(msg.id))
      }
    }
  }, [msgReasonings, scrollReasoningToBottom])

  const sendMsg = useCallback(() => {
    if (!input.trim() && selectedFiles.length === 0) return
    props.onSend(input.trim(), [...selectedFiles])
    setInput('')
    setSelectedFiles([])
  }, [input, selectedFiles, props.onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMsg()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        if (!['pdf', 'docx', 'txt'].includes(ext)) {
          message.warning(`不支持的文件格式: ${file.name}`)
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          message.warning(`${file.name} 超过 10MB 限制`)
          continue
        }
        const extToMime: Record<string, string> = {
          pdf: 'application/pdf',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          txt: 'text/plain'
        }
        const expectedMime = extToMime[ext]
        if (expectedMime && file.type && file.type !== expectedMime) {
          message.warning(`文件类型不匹配: ${file.name}`)
          continue
        }
        setSelectedFiles((prev) => [...prev, file])
      }
      e.target.value = ''
    }
  }

  const autoResizeInput = () => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }

  const submitSupplement = () => {
    if (!supplementInput.trim()) return
    const text = supplementInput
    setSupplementInput('')
    setShowSupplementInput(false)
    props.onSubmitSupplement(text)
  }

  const msgBubbleStyle = (role: string) =>
    role === 'user'
      ? 'bg-[#1677ff] text-white ml-auto w-fit max-w-[85%]'
      : 'bg-[#f0f0f0] text-[#333] w-fit max-w-[85%]'

  return (
    <Card
      className="h-full flex flex-col!"
      styles={{
        body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }
      }}
      title={
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button size="small" icon={<MenuOutlined />} onClick={props.onToggleDrawer} />
            <span className="font-medium">{props.chatTitle}</span>
          </div>
          <Button size="small" onClick={props.onGoBack}>
            返回
          </Button>
        </div>
      }
    >
      <div
        ref={chatRef}
        onScroll={(e) => {
          const el = e.currentTarget
          props.onChatScroll({
            scrollTop: el.scrollTop,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight
          })
        }}
        className="flex-1 overflow-y-auto px-3.5 py-2.5 min-h-0"
      >
        {props.historyLoading && (
          <div className="flex items-center justify-center gap-2 p-3 text-[#999] text-xs">
            <LoadingOutlined />
            <span>加载历史消息...</span>
          </div>
        )}
        {props.messages.map((msg, msgIndex) => (
          <div key={msg.id ?? msgIndex} className="mb-3">
            <div
              className={`p-2 rounded-lg text-[13px] leading-[1.6] whitespace-pre-wrap break-words ${msgBubbleStyle(msg.role)}`}
            >
              {msg.role === 'assistant' ? (
                <>
                  {msg.content ? (
                    <span>{msg.content}</span>
                  ) : props.isLoading ? (
                    <span className="text-[#999] text-sm">
                      <LoadingOutlined /> 正在思考...
                    </span>
                  ) : null}
                  {!!msg.isProcessing && <span className="animate-pulse">▊</span>}
                </>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>

            {!!msg.reasoning && (
              <div className="mt-1">
                <button
                  onClick={() => props.onToggleReasoning(msg.id)}
                  className="inline-flex items-center gap-1 bg-transparent border-none text-[#909399] text-xs cursor-pointer px-2 py-1 rounded hover:bg-[#f0f0f0]"
                  aria-label="查看思考过程"
                >
                  <span className="text-[10px]">{msg.showReasoning ? '▼' : '▶'}</span>
                  <span>{msg.showReasoning ? '收起思考过程' : '查看思考过程'}</span>
                </button>
              </div>
            )}
            {msg.showReasoning && !!msg.reasoning && (
              <div
                ref={(el) => { if (el) reasoningBoxRefs.current.set(String(msg.id), el) }}
                className="mt-1.5 px-3.5 py-2.5 bg-[#f9f9f9] border-l-[3px] border-l-[#d0d0d0] rounded text-xs text-[#888] leading-[1.6] whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto"
                onScroll={(e) => onReasoningScroll(String(msg.id), e)}
              >
                {msg.reasoning}
              </div>
            )}

            {(msg.optimizations?.length ?? 0) + (msg.modifications?.length ?? 0) > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#e5e5e5]">
                {msg.optimizations && msg.optimizations.length > 0 && (
                  <>
                    <div className="text-xs text-[#999] mb-2">优化建议</div>
                    {msg.optimizations.map((item, idx) => (
                      <OptimizationCard
                        key={idx}
                        item={item}
                        disabled={props.disabledOpts?.has(msgIndex + '-' + idx)}
                        onApply={() => props.onApplyOptimization(item, idx, msgIndex, msg)}
                      />
                    ))}
                  </>
                )}
                {msg.modifications && msg.modifications.length > 0 && (
                  <>
                    <div className="text-xs text-[#999] mb-2">修改建议</div>
                    {msg.modifications.map((mod, modIdx) => (
                      <ModificationReview
                        key={'mod-' + modIdx}
                        item={mod}
                        msgIndex={msgIndex}
                        modIdx={modIdx}
                        disabled={props.disabledMods?.has(msgIndex + '-' + modIdx)}
                        onAccept={(item, mIdx, mModIdx) =>
                          props.onAcceptModification(item, mIdx, mModIdx)
                        }
                        onSupplement={(item, mIdx, mModIdx) =>
                          props.onSupplementModification(item, mIdx, mModIdx)
                        }
                        onReject={(mIdx, mModIdx) => props.onRejectModification(mIdx, mModIdx)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {props.chatError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded-lg mx-3.5 mb-1">
          <span className="flex-1 text-xs text-[#dc2626]">发送失败: {props.chatError}</span>
          <Button size="small" danger onClick={props.onRetrySend}>
            重试
          </Button>
          <Button size="small" onClick={props.onCloseError}>
            关闭
          </Button>
        </div>
      )}

      {props.requestQueue.length > 1 && (
        <div className="flex-shrink-0 border-t border-[#eee] bg-[#fafafa]">
          {showQueuePanel && (
            <div className="border-b border-[#e5e5e5] max-h-60 overflow-y-auto">
              <div className="flex justify-between items-center px-2.5 py-2 border-b border-[#f0f0f0] text-xs font-medium text-[#333]">
                <span>消息队列</span>
                {props.pendingCount > 0 && (
                  <Button size="small" type="link" onClick={props.onCancelAllPending}>
                    全部取消
                  </Button>
                )}
              </div>
              {props.requestQueue.map((req, idx) => (
                <div
                  key={req.id}
                  draggable={req.status === 'pending'}
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    const pi = props.requestQueue.findIndex((r) => r.status === 'processing')
                    setDragOverIndex(pi !== -1 && idx <= pi ? null : idx)
                  }}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === idx) {
                      setDragIndex(null)
                      setDragOverIndex(null)
                      return
                    }
                    const pi = props.requestQueue.findIndex((r) => r.status === 'processing')
                    if (pi !== -1 && idx <= pi) {
                      setDragIndex(null)
                      setDragOverIndex(null)
                      return
                    }
                    const nq = [...props.requestQueue]
                    const [m] = nq.splice(dragIndex, 1)
                    nq.splice(idx, 0, m)
                    props.onReorderQueue(nq)
                    setDragIndex(null)
                    setDragOverIndex(null)
                  }}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setDragOverIndex(null)
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#666] ${
                    req.canceled ? 'opacity-40 line-through' : ''
                  } ${dragOverIndex === idx ? 'border-t-2 border-t-[#1677ff]' : ''} ${
                    dragIndex === idx ? 'opacity-50' : ''
                  }`}
                >
                  {req.status === 'pending' && (
                    <span className="cursor-grab text-[#ccc] text-sm select-none">⠿</span>
                  )}
                  <span className="w-[18px] text-center text-xs">
                    {req.status === 'processing' ? '🔄' : '⏳'}
                  </span>
                  <span className="flex-1 truncate">{req.label}</span>
                  {req.status === 'pending' && (
                    <button
                      onClick={() => props.onCancelRequest(req.id)}
                      className="w-[18px] h-[18px] border-none bg-[#f0f0f0] text-[#999] rounded-full cursor-pointer flex items-center justify-center text-[11px] hover:bg-[#e0e0e0] hover:text-[#e74c3c]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowQueuePanel(!showQueuePanel)}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 border-none bg-[#fafafa] cursor-pointer text-xs text-[#666]"
            aria-label="切换队列面板"
          >
            <span className="flex-1 text-left">📋 待处理 ({props.pendingCount})</span>
            <span>{showQueuePanel ? '▼' : '▶'}</span>
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-2.5 border-t border-[#e5e5e5]">
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-1 p-1.5 bg-[#fafafa] rounded-lg max-h-30 overflow-y-auto">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-xs text-[#666] bg-white px-2 py-1 rounded"
              >
                <span className="truncate max-w-[200px]">{file.name}</span>
                <button
                  onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="w-5 h-5 border-none bg-[#f0f0f0] text-[#999] rounded-full cursor-pointer text-sm leading-none hover:bg-[#e0e0e0] hover:text-[#666]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          aria-label="上传文件"
        />
        <div className="border border-[#d9d9d9] rounded-lg px-3 py-2 bg-white">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoResizeInput()
            }}
            onKeyDown={handleKeyDown}
            placeholder="请输入修改要求... (Enter 发送, Shift+Enter 换行)"
            className="w-full min-h-[20px] max-h-30 border-none outline-none resize-none text-sm leading-[1.5] bg-transparent text-[#333] font-inherit"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="上传参考资料"
              className="w-10 h-10 border border-[#d9d9d9] rounded-lg bg-white text-[#666] cursor-pointer flex items-center justify-center shrink-0 hover:border-[#1677ff] hover:text-[#1677ff] hover:bg-[#f0f7ff] transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button
              onClick={() => setShowRefDrawer(true)}
              title="参考资料"
              className="h-10 border border-[#d9d9d9] rounded-lg bg-white text-[#666] cursor-pointer flex items-center gap-1 px-3 shrink-0 text-[13px] hover:border-[#1677ff] hover:text-[#1677ff] hover:bg-[#f0f7ff] transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>参考资料</span>
            </button>
          </div>
          <button
            onClick={sendMsg}
            disabled={!input.trim() && selectedFiles.length === 0}
            className={`w-10 h-10 border-none rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              !input.trim() && selectedFiles.length === 0
                ? 'bg-[#ccc] cursor-not-allowed'
                : 'bg-[#1677ff] text-white cursor-pointer hover:bg-[#3a8ee6] active:scale-95'
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </div>

      <Drawer
        title="参考资料"
        placement="right"
        width={300}
        open={showRefDrawer}
        onClose={() => setShowRefDrawer(false)}
      >
        {props.referenceFiles.length === 0 ? (
          <div className="text-center text-[#999] text-sm py-10">暂无参考资料</div>
        ) : (
          props.referenceFiles.map((doc) => (
            <div
              key={doc.id}
              className="flex justify-between items-center py-2.5 border-b border-[#f0f0f0] text-[13px]"
            >
              <div className="flex-1 mr-3 min-w-0">
                <span className="truncate block text-[#333]">{doc.original_name}</span>
                {doc.ref_category && (
                  <Tag color={refCategoryColor(doc.ref_category)} className="mt-1 text-[11px]">
                    {refCategoryLabel(doc.ref_category)}
                  </Tag>
                )}
              </div>
              <Button
                type="link"
                danger
                size="small"
                onClick={() => props.onRemoveReferenceFile(doc.id)}
              >
                删除
              </Button>
            </div>
          ))
        )}
      </Drawer>

      {showSupplementInput && (
        <div
          className="fixed inset-0 bg-[rgba(0,0,0,0.45)] z-[1050] flex items-center justify-center"
          onClick={() => setShowSupplementInput(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-[500px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 mb-4 text-base text-[#333]">补充修改要求</h3>
            <textarea
              value={supplementInput}
              onChange={(e) => setSupplementInput(e.target.value)}
              rows={3}
              placeholder="请输入补充的修改要求..."
              className="w-full border border-[#d9d9d9] rounded-md p-2 text-sm resize-y font-inherit"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => setShowSupplementInput(false)}>取消</Button>
              <Button type="primary" onClick={submitSupplement}>
                提交
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
})

function refCategoryColor(category: string): string {
  return category === 'excellent_resume'
    ? 'success'
    : category === 'recruitment_guideline'
      ? 'warning'
      : category === 'job_description'
        ? 'primary'
        : 'default'
}

function refCategoryLabel(category: string): string {
  return category === 'excellent_resume'
    ? '优秀简历'
    : category === 'recruitment_guideline'
      ? '招聘准则'
      : category === 'job_description'
        ? '职位简介'
        : category
}

ChatPanel.displayName = 'ChatPanel'
export default memo(ChatPanel)
