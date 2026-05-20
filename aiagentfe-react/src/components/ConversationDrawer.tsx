import { useEffect, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Empty, Spin } from 'antd'
import { useResumeStore } from '@/stores/resume'
import { formatTime } from '@/lib/format'

interface ConversationDrawerProps {
  visible: boolean
  onClose: () => void
}

export default memo(ConversationDrawer)

function ConversationDrawer({ visible, onClose }: ConversationDrawerProps) {
  const navigate = useNavigate()
  const conversations = useResumeStore((s) => s.conversations)
  const conversationsLoading = useResumeStore((s) => s.conversationsLoading)
  const conversationId = useResumeStore((s) => s.conversationId)
  const fetchConversations = useResumeStore((s) => s.fetchConversations)
  const lastFetchTime = useRef(0)

  useEffect(() => {
    if (visible && Date.now() - lastFetchTime.current > 30000) {
      lastFetchTime.current = Date.now()
      fetchConversations(1, 50)
    }
  }, [visible, fetchConversations])

  const selectConversation = (id: string) => {
    onClose()
    navigate(`/editor/${id}`)
  }

  return (
    <Drawer title="会话历史" placement="left" width={320} open={visible} onClose={onClose}>
      {conversationsLoading ? (
        <div className="flex flex-col items-center py-10 text-[#909399] gap-2">
          <Spin />
          <span>加载中...</span>
        </div>
      ) : conversations.length === 0 ? (
        <Empty description="暂无会话" />
      ) : (
        <div className="flex flex-col gap-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`py-3 px-3.5 rounded-lg cursor-pointer transition-colors border-l-[3px] ${
                conv.id === conversationId
                  ? 'bg-[#e6f4ff] border-l-[#1677ff]'
                  : 'border-l-transparent hover:bg-[#f5f7fa]'
              }`}
            >
              <div className="text-sm text-[#333] truncate">{conv.title || '无标题会话'}</div>
              <div className="text-xs text-[#999] mt-1">{formatTime(conv.updated_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}
