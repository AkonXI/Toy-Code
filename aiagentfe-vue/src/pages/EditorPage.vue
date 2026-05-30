<template>
  <div v-if="loading" class="flex justify-center items-center h-screen bg-[#f5f5f5]">
    <el-skeleton :rows="8" animated style="width: 60%" />
  </div>
  <div v-else-if="error" class="flex justify-center items-center h-screen bg-[#f5f5f5]">
    <el-result icon="error" title="加载失败" :sub-title="error">
      <template #extra>
        <el-button type="primary" @click="retryLoad">重试</el-button>
      </template>
    </el-result>
  </div>
  <div v-else class="editor-page">
    <div class="left-panel">
      <PdfPreview
        :pdf-url
        :loading
        :error
        :versions="docVersions"
        :active-index="activeVersionIdx"
        :current-version="currentVersionLabel"
        :show-restore="docVersions.length > 1 && activeVersionIdx !== docVersions.length - 1"
        @download="downloadPdf"
        @select-version="switchVersion"
        @restore="handleRestore"
      />
    </div>

    <div class="right-panel">
      <ChatPanel
        ref="chatPanelRef"
        :messages
        :is-loading
        :chat-title
        :chat-error
        :reference-files
        :history-loading
        :has-more-history
        :request-queue
        :is-processing
        :is-search-processing
        :pending-count="pendingQueueCount"
        :disabled-opts
        :disabled-mods
        @send="onChatSend"
        @load-more-history="loadMoreHistory"
        @chat-scroll="onChatScroll"
        @retry-send="retrySend"
        @close-error="chatError = ''"
        @remove-reference-file="removeReferenceFile"
        @apply-optimization="onApplyOptimization"
        @accept-modification="
          (item, msgIndex, modIdx) => acceptModification(item, msgIndex, modIdx)
        "
        @supplement-modification="
          (item, msgIndex, modIdx) => supplementModification(item, msgIndex, modIdx)
        "
        @reject-modification="rejectModification"
        @submit-supplement="submitSupplement"
        @stop="handleStop"
        @toggle-drawer="drawerVisible = true"
        @go-back="goBack"
        @cancel-request="cancelRequest"
        @cancel-all-pending="cancelAllPending"
        @reorder-queue="onReorderQueue"
        @toggle-reasoning="onToggleReasoning"
      />
    </div>

    <ConversationDrawer v-model:visible="drawerVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import { ElMessage } from 'element-plus'
import { useResumeStore } from '@/stores/resume'
import {
  getReferenceFiles,
  deleteReferenceFile,
  getDocHistory,
  restoreDocVersion,
  renderResumePdf,
  api,
  type ReferenceDoc,
  type DocVersion
} from '@/api'
import { MultipartChatTransport } from '@/lib/multipart-chat-transport'
import ConversationDrawer from '@/components/ConversationDrawer.vue'
import PdfPreview from '@/components/PdfPreview.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import type { OptimizationItem, ModificationItem, Message } from '@/types/chat'

const router = useRouter()
const route = useRoute()
const resumeStore = useResumeStore()
const chatPanelRef = ref<InstanceType<typeof ChatPanel>>()
const pdfUrl = ref<string>('')
const conversationId = ref('')
const loading = ref(true)
const error = ref('')
const drawerVisible = ref(false)

function retryLoad() {
  error.value = ''
  loading.value = true
  window.location.reload()
}
const docVersions = ref<DocVersion[]>([])
const activeVersionIdx = ref(0)
const currentVersionLabel = computed(() => {
  const v = docVersions.value[activeVersionIdx.value]
  if (!v) return ''
  return v.type === 'original' ? '原始简历' : `修改版本 v${v.version}`
})

const messages = ref<Message[]>([])
const isLoading = ref(false)
const referenceFiles = ref<ReferenceDoc[]>([])
const historyLoading = ref(false)
const refFilesLoading = ref(false)
const messagesPage = ref(1)
const messagesTotal = ref(0)
const hasMoreHistory = ref(true)
const MESSAGES_PAGE_SIZE = 100

const chatTitle = computed(() => {
  return resumeStore.conversationTitle || '简历优化助手'
})

const pendingMods = ref<{ field: string; timestamp: number }[]>([])
const PENDING_MODS_TIMEOUT = 60000

function clearStalePendingMods() {
  const now = Date.now()
  pendingMods.value = pendingMods.value.filter((p) => now - p.timestamp < PENDING_MODS_TIMEOUT)
}

const chatError = ref('')
const failedMessage = ref('')
const supplementCount = ref(0)
const currentSupplementField = ref('')
const currentSupplementOriginal = ref('')
const currentSupplementMsgIndex = ref(-1)
const currentSupplementModIdx = ref(-1)

const MAX_SUPPLEMENTS = 3

const showReasoningMap = new Map<string, boolean>()
const autoScroll = ref(true)
let chat!: Chat<any>
let transport!: MultipartChatTransport<any>
let chatWatchHandle: (() => void) | null = null
const sdkSyncedIds = new Set<string>()

// 消息队列
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

function getLabel(type: string, payload?: any): string {
  if (type === 'search') return `发送消息：${payload?.text?.slice(0, 20) || '...'}`
  return type === 'apply'
    ? `采纳建议：${payload?.field || ''}`
    : `确认修改：${payload?.field || ''}`
}

const requestQueue = ref<QueuedRequest[]>([])
const isProcessing = ref(false)
const isSearchProcessing = ref(false)

function enqueueRequest(
  req: { type: 'search' | 'apply' | 'accept'; execute: () => void; disabledKey?: string; wasSupplement?: boolean },
  payload?: any,
) {
  if (payload?.field) {
    const dupIdx = requestQueue.value.findIndex(
      (r) => r.status === 'pending' && r.type === req.type && r.label.includes(payload.field),
    )
    if (dupIdx !== -1) requestQueue.value.splice(dupIdx, 1)
  }
  const newReq: QueuedRequest = {
    ...req,
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: getLabel(req.type, payload),
    status: 'pending',
    canceled: false,
    timestamp: Date.now(),
  }
  requestQueue.value.push(newReq)
  setTimeout(() => processQueue(), 0)
}

function handleStop() {
  transport.stop()
  requestQueue.value = []
  isProcessing.value = false
  isSearchProcessing.value = false
}

function processQueue() {
  while (requestQueue.value.length > 0 && requestQueue.value[0].canceled) {
    requestQueue.value.shift()
  }
  if (requestQueue.value.length === 0) {
    isProcessing.value = false
    isSearchProcessing.value = false
    return
  }
  const current = requestQueue.value[0]
  if (current.status !== 'pending') return
  isProcessing.value = true
  isSearchProcessing.value = current.type === 'search'
  current.status = 'processing'
  isLoading.value = true
  try {
    current.execute()
  } catch (err) {
    console.error('Queue execute error:', err)
    current.status = 'failed'
    requestQueue.value.shift()
    processQueue()
  }
}

function dequeue() {
  if (requestQueue.value.length > 0) {
    requestQueue.value[0].status = 'completed'
    requestQueue.value.shift()
  }
  // 每次队列完成一个请求后刷新参考资料列表，确保与服务端同步
  loadReferenceFiles()
  processQueue()
}

function cancelRequest(id: string) {
  const req = requestQueue.value.find((r) => r.id === id)
  if (req) {
    req.canceled = true
    req.status = 'failed'
    if (req.disabledKey) {
      const newOpts = new Set(disabledOpts.value)
      const newMods = new Set(disabledMods.value)
      newOpts.delete(req.disabledKey)
      newMods.delete(req.disabledKey)
      disabledOpts.value = newOpts
      disabledMods.value = newMods
    }
    if (req.wasSupplement && supplementCount.value > 0) {
      supplementCount.value--
    }
  }
}

function cancelAllPending() {
  requestQueue.value.forEach((r) => {
    if (r.status === 'pending') {
      r.canceled = true
      r.status = 'failed'
      if (r.disabledKey) {
        const newOpts = new Set(disabledOpts.value)
        const newMods = new Set(disabledMods.value)
        newOpts.delete(r.disabledKey)
        newMods.delete(r.disabledKey)
        disabledOpts.value = newOpts
        disabledMods.value = newMods
      }
      if (r.wasSupplement && supplementCount.value > 0) {
        supplementCount.value--
      }
    }
  })
}

function onReorderQueue(newQueue: QueuedRequest[]) {
  requestQueue.value = newQueue
}

const pendingQueueCount = computed(
  () => requestQueue.value.filter((r) => r.status === 'pending').length
)

// 禁用跟踪（已点击的建议/修改卡片）
const disabledOpts = ref<Set<string>>(new Set())
const disabledMods = ref<Set<string>>(new Set())

function markOptDisabled(msgIndex: number, idx: number) {
  disabledOpts.value = new Set(disabledOpts.value).add(`${msgIndex}-${idx}`)
}

function markModDisabled(msgIndex: number, modIdx: number) {
  disabledMods.value = new Set(disabledMods.value).add(`${msgIndex}-${modIdx}`)
}

function extractMessageContent(sdkMsg: UIMessage): string {
  const textParts = sdkMsg.parts?.filter((p: any) => p.type === 'text')
  return (
    textParts
      ?.map((p: any) => p.text ?? p.content ?? '')
      .filter(Boolean)
      .join('\n') ?? ''
  )
}

function extractReasoning(sdkMsg: UIMessage): string {
  const reasoningParts = sdkMsg.parts?.filter((p: any) => p.type === 'reasoning')
  return (
    reasoningParts
      ?.map((p: any) => p.text ?? p.reasoning ?? '')
      .filter(Boolean)
      .join('\n') || ''
  )
}

function extractModifications(sdkMsg: UIMessage): ModificationItem[] {
  const modList: ModificationItem[] = []
  const toolParts = (sdkMsg.parts?.filter(
    (p: any) =>
      p.type === 'dynamic-tool' || p.type === 'tool-invocation' || p.type?.startsWith('tool-')
  ) ?? []) as any[]
  for (const part of toolParts) {
    const output = part.output ?? part.toolInvocation?.result ?? part.toolInvocation?.output
    if (output?.modification) {
      modList.push(output.modification)
    }
  }
  return modList
}

function extractOptimizations(sdkMsg: UIMessage): OptimizationItem[] {
  const optList: OptimizationItem[] = []
  const toolParts = (sdkMsg.parts?.filter(
    (p: any) =>
      p.type === 'dynamic-tool' || p.type === 'tool-invocation' || p.type?.startsWith('tool-')
  ) ?? []) as any[]
  for (const part of toolParts) {
    const output = part.output ?? part.toolInvocation?.result ?? part.toolInvocation?.output
    if (output?.optimization) {
      optList.push(output.optimization)
    }
    if (output?.optimizations) {
      optList.push(...output.optimizations)
    }
  }
  return optList
}

function mapSdkMessages(sdkMessages: UIMessage[]): Message[] {
  return sdkMessages.map((msg) => {
    const content = extractMessageContent(msg)
    return {
      id: msg.id ?? '',
      role: msg.role as 'user' | 'assistant',
      content,
      reasoning: extractReasoning(msg),
      showReasoning: showReasoningMap.get(msg.id ?? '') ?? false,
      optimizations: extractOptimizations(msg),
      modifications: extractModifications(msg)
    }
  })
}

function mapApiMessage(m: { role: string; content: string; reasoning?: string }): Message {
  return {
    id: '',
    role: m.role as 'user' | 'assistant',
    content: m.content,
    reasoning: m.reasoning || '',
    showReasoning: false,
    optimizations: []
  }
}

const fetchWithAuth: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers)
  const token = localStorage.getItem('auth_token')
  const phone = localStorage.getItem('login_phone')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (phone) headers.set('X-Phone', phone)
  return fetch(input, { ...init, headers })
}

async function loadReferenceFiles() {
  if (!conversationId.value) return
  refFilesLoading.value = true
  try {
    const result = await getReferenceFiles(conversationId.value)
    referenceFiles.value = result.docs || []
  } catch (e) {
    console.error('Failed to load reference files:', e)
  } finally {
    refFilesLoading.value = false
  }
}

async function loadDocHistory() {
  if (!conversationId.value) return
  try {
    const result = await getDocHistory(conversationId.value)
    docVersions.value = result.versions || []
    activeVersionIdx.value = docVersions.value.length - 1 // 默认最新
  } catch (e) {
    console.error('Failed to load doc history:', e)
  }
}

async function switchVersion(idx: number) {
  if (idx === activeVersionIdx.value) return
  const v = docVersions.value[idx]
  if (!v) return
  let blob: Blob
  if (v.type === 'original' && resumeStore.resumeContent) {
    blob = await renderResumePdf(resumeStore.resumeContent)
  } else {
    blob = (await api.get(`/rag/docs/${v.refId}/download`, { responseType: 'blob' })) as Blob
  }
  const newUrl = URL.createObjectURL(blob)
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = newUrl
  activeVersionIdx.value = idx
}

async function handleRestore(refId: number) {
  try {
    const v = docVersions.value.find((d) => d.refId === refId)
    const ts = Date.now()
    messages.value.push({ id: `local-restore-${ts}`, role: 'assistant', content: `已恢复到版本 v${v?.version ?? ''}` })
    autoScroll.value = true
    chatPanelRef.value?.scrollToBottom()
    await restoreDocVersion(refId)
    ElMessage.success('已恢复')
    await loadDocHistory()
    await reloadPdfFromServer()
  } catch (e) {
    console.error('Failed to restore version:', e)
    ElMessage.error('恢复失败')
  }
}

function onChatScroll(payload: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  const isNearBottom = payload.scrollHeight - payload.scrollTop - payload.clientHeight < 80
  autoScroll.value = isNearBottom
  if (!isNearBottom && hasMoreHistory.value && payload.scrollTop < 30) {
    loadMoreHistory()
  }
}

function onChatSend(text: string, files: File[]) {
  if (!text.trim() && files.length === 0) return
  failedMessage.value = text
  autoScroll.value = true
  isLoading.value = true

  // 乐观更新：文件发出后立即插入临时项，dequeue 时会刷新真实数据
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
      ref_category: undefined
    }))
    referenceFiles.value = [...optimisticDocs, ...referenceFiles.value]
  }

  enqueueRequest(
    {
      type: 'search',
      execute: () => {
        supplementCount.value = 0
        chat.sendMessage(
          { text },
          {
            body: {
              type: 'search',
              conversationId: conversationId.value,
              query: text,
              files: files.length > 0 ? files : undefined
            }
          }
        )
      }
    },
    { text }
  )

  chatPanelRef.value?.scrollToBottom()
}

async function removeReferenceFile(refId: number) {
  if (!conversationId.value) return
  try {
    await deleteReferenceFile(conversationId.value, refId)
    referenceFiles.value = referenceFiles.value.filter((d) => d.id !== refId)
    ElMessage.success('参考资料已删除')
  } catch {
    ElMessage.error('删除失败')
  }
}

function retrySend() {
  chatError.value = ''
  const text = failedMessage.value
  failedMessage.value = ''
  if (text) {
    onChatSend(text, [])
  }
}

async function reloadPdfFromServer() {
  if (!conversationId.value) return
  console.log('[PDF] reloadPdfFromServer called for:', conversationId.value)
  console.log('[PDF] caller stack:', new Error().stack?.split('\n').slice(2, 5).join(' → '))
  try {
    const { getConversationMessages } = await import('@/api')
    const result = await getConversationMessages(conversationId.value, 1, 1, 'DESC')
    const docs = result.data?.documents ?? []
    console.log('[PDF] docs count:', docs.length, 'file_url:', docs[0]?.file_url)
    if (docs.length > 0) {
      const latestDoc = docs[0]
      const fileUrl = latestDoc.file_url.startsWith('/api')
        ? latestDoc.file_url
        : `/api${latestDoc.file_url}`
      console.log('[PDF] fetching:', fileUrl)
      const blob = (await api.get(fileUrl.replace('/api', ''), {
        responseType: 'blob'
      })) as Blob
      const newUrl = URL.createObjectURL(blob)
      if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
      pdfUrl.value = newUrl
      console.log('[PDF] updated blob URL:', pdfUrl.value.slice(0, 30))
    }
  } catch (e) {
    console.error('Failed to reload PDF from server:', e)
  }
}

function downloadPdf() {
  if (!pdfUrl.value) {
    ElMessage.warning('PDF 尚未生成')
    return
  }
  const a = document.createElement('a')
  a.href = pdfUrl.value
  a.download = 'resume.pdf'
  a.click()
}

function goBack() {
  router.push('/conversations')
}

function loadConversationToState(id: string, totalMsgs: number, resetPdf = true) {
  supplementCount.value = 0
  conversationId.value = id
  messagesPage.value = 1
  messagesTotal.value = totalMsgs
  hasMoreHistory.value = totalMsgs > messages.value.length
  if (resetPdf) {
    pdfUrl.value = resumeStore.fileBlobUrl
  } else if (resumeStore.fileBlobUrl) {
    pdfUrl.value = resumeStore.fileBlobUrl
  }
  activeVersionIdx.value = 0
  docVersions.value = []
  loadReferenceFiles()
  loadDocHistory()
}

function autoTriggerSearch(query: string, id: string) {
  isLoading.value = true
  enqueueRequest(
    {
      type: 'search',
      execute: () => {
        chat.sendMessage({ text: query }, { body: { conversationId: id, query } })
      }
    },
    { text: query }
  )
}

function triggerSearchIfNeeded() {
  const msgs = resumeStore.messages
  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') {
    const sdkMsgs = chat.messages ?? []
    const hasAssistantReply = sdkMsgs.some((m) => m.role === 'assistant')
    if (hasAssistantReply) return
    autoTriggerSearch(msgs[msgs.length - 1].content, conversationId.value)
  }
}

async function loadMoreHistory() {
  if (!hasMoreHistory.value || historyLoading.value || !conversationId.value) return
  historyLoading.value = true
  const prevScrollHeight = chatPanelRef.value?.getScrollHeight() ?? 0

  try {
    messagesPage.value++
    const { getConversationMessages } = await import('@/api')
    const result = await getConversationMessages(
      conversationId.value,
      messagesPage.value,
      MESSAGES_PAGE_SIZE,
      'DESC'
    )
    const apiMessages = (result.data?.messages ?? []).reverse()
    if (apiMessages.length === 0) {
      hasMoreHistory.value = false
      return
    }

    const loadedCount = result.pagination?.total ?? messagesTotal.value
    messagesTotal.value = loadedCount
    hasMoreHistory.value = messages.value.length + apiMessages.length < loadedCount

    messages.value = [...apiMessages.map(mapApiMessage), ...messages.value]

    await nextTick()
    chatPanelRef.value?.restoreScrollPosition(prevScrollHeight)
  } catch (e) {
    console.error('Failed to load more history:', e)
    messagesPage.value--
  } finally {
    historyLoading.value = false
  }
}

function initChat(historyMessages?: any[]) {
  if (chatWatchHandle) {
    chatWatchHandle()
    chatWatchHandle = null
  }

  transport = new MultipartChatTransport({
    fetch: fetchWithAuth
  })

  chat = new Chat({
    transport,
    messages: historyMessages,
    onError: (err: Error) => {
      if (err.message?.includes('reasoning-delta for missing reasoning part')) {
        isLoading.value = false
        dequeue()
        return
      }
      pendingMods.value.splice(0)
      console.error('Chat error:', err)
      chatError.value = err.message || '操作失败'
      failedMessage.value = ''
      isLoading.value = false
      dequeue()
    },
    onFinish: async ({ messages: sdkMessages }) => {
      isLoading.value = false

      sdkMessages.forEach((msg) => {
        if (msg.id && !showReasoningMap.has(msg.id)) showReasoningMap.set(msg.id, false)
      })

      if (pendingMods.value.length > 0) {
        const pending = pendingMods.value[0]
        pendingMods.value.splice(0)

        function clearManualAndEmpty() {
          messages.value = messages.value.filter((m) => {
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
        }

        clearManualAndEmpty()

        messages.value.push(
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
        )

        // 标记本次 accept 的 SDK 消息为已同步，防止 watch 重复推送
        sdkMessages.forEach((m) => {
          if (m.id) sdkSyncedIds.add(m.id)
        })

        if (conversationId.value) {
          reloadPdfFromServer()
          loadDocHistory()
        }
      }

      const newStoreMessages = sdkMessages.map((m) => {
        const existing = resumeStore.messages.find((sm) => sm.id === m.id)
        return {
          id: m.id ?? '',
          role: m.role as 'user' | 'assistant',
          content: extractMessageContent(m),
          reasoning: existing?.reasoning || extractReasoning(m) || '',
          optimizations: existing?.optimizations || extractOptimizations(m) || [],
          modifications: existing?.modifications || extractModifications(m) || []
        }
      })
      resumeStore.messages = newStoreMessages

      chatPanelRef.value?.scrollToBottom()
      dequeue()
    }
  })

  const initialMsgs = chat.messages ?? []
  initialMsgs.forEach((m) => {
    if (m.id) sdkSyncedIds.add(m.id)
  })

  chatWatchHandle = watch(
    () => chat.messages,
    (sdkMessages) => {
      if (!sdkMessages || sdkMessages.length === 0) return
      if (pendingMods.value.length > 0) return

      clearStalePendingMods()
      if (pendingMods.value.length > 0) return

      const newSdkMessages = sdkMessages.filter((m) => m.id && !sdkSyncedIds.has(m.id))
      if (newSdkMessages.length > 0) {
        const newLocalMessages = mapSdkMessages(newSdkMessages)
        for (const msg of newLocalMessages) {
          const localIdx = messages.value.findIndex((m) => m.role === 'user' && m.id?.startsWith('local-restore-'))
          if (localIdx !== -1) {
            messages.value[localIdx] = msg
          } else {
            messages.value.push(msg)
          }
        }
        newSdkMessages.forEach((m) => {
          if (m.id) sdkSyncedIds.add(m.id)
        })
      }

      const lastSdk = sdkMessages[sdkMessages.length - 1]
      if (lastSdk?.id) {
        const localIdx = messages.value.findIndex((m) => m.id === lastSdk.id)
        if (localIdx !== -1) {
          const newContent = extractMessageContent(lastSdk)
          if (newContent) {
            messages.value[localIdx].content = newContent
            messages.value[localIdx].optimizations = extractOptimizations(lastSdk)
          }
          messages.value[localIdx].reasoning = extractReasoning(lastSdk)
          messages.value[localIdx].modifications = extractModifications(lastSdk)
        }
      }

      if (autoScroll.value) {
        chatPanelRef.value?.scrollToBottom()
      }
    },
    { deep: true }
  )

  messages.value = mapSdkMessages(chat.messages ?? [])

  // 合并 store 中的 reasoning（历史消息的 parts 不含 reasoning）
  if (resumeStore.messages.length > 0) {
    resumeStore.messages.forEach((storeMsg, i) => {
      if ((storeMsg as any).reasoning && messages.value[i]) {
        messages.value[i].reasoning = (storeMsg as any).reasoning
      }
    })
  }
}

function pushStatusMessages(field: string) {
  const ts = Date.now()
  messages.value.push({
    id: `temp-user-${ts}`,
    role: 'user',
    content: `确认修改：${field}`
  })
  messages.value.push({
    id: `temp-status-${ts}`,
    role: 'assistant',
    content: `正在处理「${field}」...`,
    isProcessing: true
  })
  pendingMods.value.push({ field, timestamp: Date.now() })
  autoScroll.value = true
  chatPanelRef.value?.scrollToBottom()
}

async function onApplyOptimization(
  item: OptimizationItem,
  idx: number,
  msgIndex: number,
  _msg: Message
) {
  markOptDisabled(msgIndex, idx)

  enqueueRequest(
    {
      type: 'apply',
      disabledKey: `${msgIndex}-${idx}`,
      execute: () => {
        pushStatusMessages(item.field)
        try {
          chat.sendMessage(
            {
              text: `采纳优化建议：\n字段：${item.field}\n当前内容：${item.current}\n建议内容：${item.suggestion}`
            },
            { body: { type: 'apply', conversationId: conversationId.value, optimization: item } }
          )
        } catch (err) {
          console.error('采纳失败:', err)
          ElMessage.error('采纳失败')
          isLoading.value = false
          dequeue()
        }
      }
    },
    { field: item.field }
  )
}

async function acceptModification(item: ModificationItem, msgIndex: number, modIdx: number) {
  supplementCount.value = 0
  markModDisabled(msgIndex, modIdx)
  enqueueRequest(
    {
      type: 'accept',
      disabledKey: `${msgIndex}-${modIdx}`,
      execute: () => {
        pushStatusMessages(item.field)
        try {
          chat.sendMessage(
            { text: `确认修改：${item.field}` },
            {
              body: {
                type: 'accept',
                conversationId: conversationId.value,
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
          console.error('确认修改失败:', err)
          ElMessage.error('确认修改失败')
          isLoading.value = false
          dequeue()
        }
      }
    },
    { field: item.field }
  )
}

function supplementModification(item: ModificationItem, msgIndex: number, modIdx: number) {
  if (supplementCount.value >= MAX_SUPPLEMENTS) {
    ElMessage.warning(`最多补充${MAX_SUPPLEMENTS}次`)
    return
  }
  markModDisabled(msgIndex, modIdx)
  currentSupplementField.value = item.field
  currentSupplementOriginal.value = item.suggestion
  currentSupplementMsgIndex.value = msgIndex
  currentSupplementModIdx.value = modIdx
  chatPanelRef.value?.openSupplementDialog()
}

async function submitSupplement(text: string) {
  const context = currentSupplementField.value
    ? `之前要求修改「${currentSupplementField.value}」：${currentSupplementOriginal.value}\n现补充：${text}`
    : `补充修改要求：${text}`
  supplementCount.value++
  chatPanelRef.value?.setInput('')
  isLoading.value = true
  enqueueRequest(
    {
      type: 'search',
      wasSupplement: true,
      disabledKey: `${currentSupplementMsgIndex.value}-${currentSupplementModIdx.value}`,
      execute: () => {
        chat.sendMessage(
          { text: `补充修改要求：${text}` },
          {
            body: {
              conversationId: conversationId.value,
              query: context,
              displayText: `补充修改要求：${text}`
            }
          }
        )
      }
    },
    { text: context }
  )
}

function onToggleReasoning(msgId: string) {
  const current = showReasoningMap.get(msgId) ?? false
  showReasoningMap.set(msgId, !current)
  const msg = messages.value.find((m) => m.id === msgId)
  if (msg) msg.showReasoning = !current
}

function rejectModification(msgIndex: number, modIdx: number) {
  supplementCount.value = 0
  markModDisabled(msgIndex, modIdx)
}

onUnmounted(() => {
  if (pdfUrl.value && pdfUrl.value !== resumeStore.fileBlobUrl) {
    URL.revokeObjectURL(pdfUrl.value)
  }
  pdfUrl.value = ''
  pendingMods.value = []
  sdkSyncedIds.clear()
})

onMounted(async () => {
  const routeId = route.params.id as string
  if (!routeId) {
    router.push('/conversations')
    return
  }

  try {
    const { totalMessages, initialPrompt: loadedInitialPrompt } =
      await resumeStore.loadConversation(routeId)
    conversationId.value = routeId
    loadConversationToState(routeId, totalMessages)

    const historyMessages = resumeStore.messages.map((m) => ({
      id: `msg-${crypto.randomUUID()}`,
      role: m.role,
      parts: [{ type: 'text', text: m.content }]
    }))

    initChat(historyMessages)

    if (resumeStore.fileBlobUrl) {
      pdfUrl.value = resumeStore.fileBlobUrl
    }

    if (resumeStore.messages.length === 0 && loadedInitialPrompt) {
      autoTriggerSearch(loadedInitialPrompt, routeId)
    } else {
      triggerSearchIfNeeded()
    }

    loading.value = false

    await nextTick()
    chatPanelRef.value?.scrollToBottom()
  } catch (e) {
    console.error('Failed to load conversation:', e)
    error.value = '加载会话失败'
    loading.value = false
  }
})

watch(
  () => route.params.id,
  async (newId) => {
    if (newId && newId !== conversationId.value) {
      loading.value = true
      messages.value = []
      showReasoningMap.clear()
      try {
        const { totalMessages, initialPrompt: newInitialPrompt } =
          await resumeStore.loadConversation(newId as string)
        conversationId.value = newId as string
        loadConversationToState(newId as string, totalMessages, false)

        const historyMessages = resumeStore.messages.map((m) => ({
          id: `msg-${crypto.randomUUID()}`,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text', text: m.content }]
        }))

        initChat(historyMessages)

        if (resumeStore.fileBlobUrl) {
          pdfUrl.value = resumeStore.fileBlobUrl
        }

        if (resumeStore.messages.length === 0 && newInitialPrompt) {
          autoTriggerSearch(newInitialPrompt, newId as string)
        } else {
          triggerSearchIfNeeded()
        }

        loading.value = false

        await nextTick()
        chatPanelRef.value?.scrollToBottom()
      } catch {
        error.value = '切换会话失败'
        loading.value = false
      }
    }
  }
)
</script>

<style scoped>
.editor-page {
  display: flex;
  height: calc(100vh - 50px);
}

.left-panel {
  flex: 1;
  padding: 20px;
  background: #f5f5f5;
  overflow: hidden;
}

.right-panel {
  width: 400px;
  padding: 20px;
  background: white;
}
</style>
