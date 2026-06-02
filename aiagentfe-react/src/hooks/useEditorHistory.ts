import { useState, useCallback, type MutableRefObject } from 'react'
import { getConversationMessages } from '@/api'
import type { Message } from '@/types/chat'
import { mapApiMessage } from '@/lib/editor-utils'

const MESSAGES_PAGE_SIZE = 100

export function useEditorHistory() {
  const [messagesPage, setMessagesPage] = useState(1)
  const [messagesTotal, setMessagesTotal] = useState(0)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadMoreHistory = useCallback(
    async (
      conversationId: string,
      messages: Message[],
      chatPanelRef: MutableRefObject<any>
    ): Promise<Message[] | null> => {
      if (historyLoading || !hasMoreHistory || !conversationId) return null
      setHistoryLoading(true)
      try {
        const nextPage = messagesPage + 1
        const result = await getConversationMessages(
          conversationId,
          nextPage,
          MESSAGES_PAGE_SIZE,
          'DESC'
        )
        const data = result.data ?? result
        const apiMessages = (data.messages ?? []).reverse()

        setHasMoreHistory(nextPage * MESSAGES_PAGE_SIZE < (result.pagination?.total ?? 0))
        setMessagesPage(nextPage)

        const prevHeight = chatPanelRef.current?.getScrollHeight?.() ?? 0
        const newMessages = [...apiMessages.map(mapApiMessage), ...messages]
        requestAnimationFrame(() => {
          const nh = chatPanelRef.current?.getScrollHeight?.() ?? 0
          chatPanelRef.current?.restoreScrollPosition?.(nh - prevHeight)
        })
        return newMessages
      } catch (e) {
        console.error('Failed to load more history:', e)
        setMessagesPage((prev) => Math.max(1, prev - 1))
        return null
      } finally {
        setHistoryLoading(false)
      }
    },
    [historyLoading, hasMoreHistory, messagesPage]
  )

  function resetHistory(totalMsgs: number, currentLen: number) {
    setMessagesPage(1)
    setMessagesTotal(totalMsgs)
    setHasMoreHistory(totalMsgs > currentLen)
  }

  return {
    historyLoading,
    messagesPage,
    messagesTotal,
    hasMoreHistory,
    loadMoreHistory,
    resetHistory
  }
}
