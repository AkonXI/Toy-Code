import { create } from 'zustand'
import {
  getConversations,
  getConversationMessages,
  getUserProfile,
  renderResumePdf,
  api,
  type Conversation,
  type DocumentRecord,
  type UserProfile,
  type MessageRecord
} from '@/api'
import type { Message } from '@/types/chat'
import { mapApiMessage } from '@/lib/editor-utils'

let _loadSeq = 0

interface ResumeState {
  fileName: string
  fileBlobUrl: string
  initialPrompt: string
  messages: Message[]
  conversationId: string
  userInfo: UserProfile | null
  conversations: Conversation[]
  conversationTitle: string
  documents: DocumentRecord[]
  conversationsLoading: boolean
  userLoading: boolean
  resumeContent: string
  originalRefId: number

  setFile: (name: string, type: string, content: string, blobUrl?: string) => void
  setPrompt: (prompt: string) => void
  setConversationId: (id: string) => void
  fetchUserProfile: (force?: boolean) => Promise<UserProfile | undefined>
  fetchConversations: (
    page?: number,
    pageSize?: number
  ) => Promise<{ data: Conversation[] } | undefined>
  loadConversation: (id: string) => Promise<{ totalMessages: number; initialPrompt: string }>
  clearConversation: () => void
}

export const useResumeStore = create<ResumeState>()((set, get) => ({
  fileName: '',
  fileBlobUrl: '',
  initialPrompt: '',
  messages: [],
  conversationId: '',
  userInfo: null,
  conversations: [],
  conversationTitle: '',
  documents: [],
  conversationsLoading: false,
  userLoading: false,
  resumeContent: '',
  originalRefId: 0,

  setFile: (name, _type, _content, blobUrl = '') => {
    set({ fileName: name, fileBlobUrl: blobUrl })
  },

  setPrompt: (prompt) => set({ initialPrompt: prompt }),

  setConversationId: (id) => set({ conversationId: id }),

  fetchUserProfile: async (force = false) => {
    const state = get()
    if (state.userInfo && !force) return state.userInfo
    set({ userLoading: true })
    try {
      const data = await getUserProfile()
      set({ userInfo: data })
      return data
    } finally {
      set({ userLoading: false })
    }
  },

  fetchConversations: async (page = 1, pageSize = 20) => {
    set({ conversationsLoading: true })
    try {
      const result = await getConversations(page, pageSize)
      set({ conversations: result.data })
      return result
    } finally {
      set({ conversationsLoading: false })
    }
  },

  loadConversation: (async (id: string) => {
    const seq = ++_loadSeq
    set({ conversationId: id })
    try {
      const result = await getConversationMessages(id, 1, 200, 'DESC')
      if (seq !== _loadSeq) return { totalMessages: 0, initialPrompt: '' }
      const data = result.data ?? result
      const apiMessages = (data.messages ?? []).reverse()
      const apiDocs = data.documents ?? []
      const totalMessages = result.pagination?.total ?? apiMessages.length
      const intPrompt = data.initialPrompt || ''

      set({
        messages: apiMessages.map((m: MessageRecord) => mapApiMessage(m)),
        documents: apiDocs,
        initialPrompt: intPrompt,
        resumeContent: data.resumeContent || '',
        originalRefId: data.originalRefId || 0,
        conversationTitle: data.title || get().conversations.find((c) => c.id === id)?.title || ''
      })

      const md = data.resumeContent || ''
      const latestDoc = apiDocs[0]
      if (md) {
        try {
          const blob = await renderResumePdf(md)
          const state = get()
          if (state.fileBlobUrl) URL.revokeObjectURL(state.fileBlobUrl)
          set({
            fileBlobUrl: URL.createObjectURL(blob),
            fileName: latestDoc?.original_name || 'resume.pdf'
          })
        } catch (e) {
          console.error('Failed to render resume PDF from markdown, falling back to original:', e)
          if (latestDoc) {
            try {
              const fileUrl = latestDoc.file_url.startsWith('/api')
                ? latestDoc.file_url
                : `/api${latestDoc.file_url}`
              const fallbackBlob = (await api.get(fileUrl.replace('/api', ''), {
                responseType: 'blob'
              })) as Blob
              const state = get()
              if (state.fileBlobUrl) URL.revokeObjectURL(state.fileBlobUrl)
              set({
                fileBlobUrl: URL.createObjectURL(fallbackBlob),
                fileName: latestDoc.original_name
              })
            } catch (e2) {
              console.error('Failed to load original PDF:', e2)
            }
          }
        }
      } else if (latestDoc) {
        try {
          const fileUrl = latestDoc.file_url.startsWith('/api')
            ? latestDoc.file_url
            : `/api${latestDoc.file_url}`
          const blob = (await api.get(fileUrl.replace('/api', ''), {
            responseType: 'blob'
          })) as Blob
          const state = get()
          if (state.fileBlobUrl) URL.revokeObjectURL(state.fileBlobUrl)
          set({ fileBlobUrl: URL.createObjectURL(blob), fileName: latestDoc.original_name })
        } catch (e) {
          console.error('Failed to load PDF:', e)
        }
      }
      return { totalMessages, initialPrompt: intPrompt }
    } catch (e) {
      console.error('loadConversation failed:', e)
      return { totalMessages: 0, initialPrompt: '' }
    }
  }) as (id: string) => Promise<{ totalMessages: number; initialPrompt: string }>,

  clearConversation: () => {
    const state = get()
    if (state.fileBlobUrl) URL.revokeObjectURL(state.fileBlobUrl)
    set({
      conversationId: '',
      messages: [],
      fileBlobUrl: '',
      fileName: '',
      documents: [],
      conversationTitle: ''
    })
  }
}))
