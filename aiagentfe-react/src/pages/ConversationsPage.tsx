import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Empty, message, Modal, Upload } from 'antd'
import { LoadingOutlined, PlusOutlined, InboxOutlined, DeleteOutlined } from '@ant-design/icons'
import { useResumeStore } from '@/stores/resume'
import { deleteConversation, api } from '@/api'
import { formatTime } from '@/lib/format'

const { Dragger } = Upload
const { TextArea } = Input

export default function ConversationsPage() {
  const navigate = useNavigate()
  const store = useResumeStore()
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatusText, setUploadStatusText] = useState('')
  const uploadTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')

  const conversations = useResumeStore((s) => s.conversations)
  const conversationsLoading = useResumeStore((s) => s.conversationsLoading)
  const fetchConversations = useResumeStore((s) => s.fetchConversations)
  const setFile = useResumeStore((s) => s.setFile)
  const setPromptStore = useResumeStore((s) => s.setPrompt)
  const setConversationId = useResumeStore((s) => s.setConversationId)

  useEffect(() => {
    fetchConversations(1, 50)
  }, [fetchConversations])

  const handleUpload = async () => {
    if (!selectedFile) return
    store.clearConversation()
    setUploading(true)
    setUploadProgress(0)
    setUploadStatusText('正在上传文件...')

    const startTime = Date.now()
    const phases = [
      { max: 15, text: '正在上传文件...' },
      { max: 30, text: '正在提取文件内容...' },
      { max: 55, text: '正在解析为结构化格式...' },
      { max: 80, text: '正在构建索引...' },
      { max: 93, text: '即将完成...' },
      { max: 99.5, text: '最后处理中...' }
    ]

    uploadTimer.current = setInterval(() => {
      const t = (Date.now() - startTime) / 1000
      const max = 99.5 - 99.5 / Math.exp(t * 0.12)
      setUploadProgress(Math.floor(max * 10) / 10)
      setUploadStatusText((prev) => {
        const p = phases.find((ph) => Math.floor(max * 10) / 10 <= ph.max)
        return p ? p.text : prev
      })
    }, 150)

    try {
      const formData = new FormData()
      formData.append('files', selectedFile)
      formData.append('query', prompt.trim() || '请分析这份简历')
      const result = (await api.post('/rag/start', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 240000
      })) as unknown as { conversationId: string; initialPrompt: string }
      const { conversationId } = result

      if (uploadTimer.current) clearInterval(uploadTimer.current)
      setUploadStatusText('解析完成')
      const animateTo100 = () => {
        setUploadProgress((prev) => {
          if (prev >= 99.9) return 100
          const next = prev + Math.max(0.5, (100 - prev) / 8)
          requestAnimationFrame(animateTo100)
          return Math.min(next, 100)
        })
      }
      animateTo100()

      const fileBlobUrl = URL.createObjectURL(selectedFile)
      setConversationId(conversationId)
      setPromptStore(prompt.trim() || '请分析这份简历')
      setFile(selectedFile.name, selectedFile.type, '', fileBlobUrl)
      setTimeout(() => navigate(`/editor/${conversationId}`), 600)
    } catch (e) {
      console.error('Upload failed:', e)
      message.error('上传失败，请重试')
      setUploading(false)
      setUploadProgress(0)
    } finally {
      if (uploadTimer.current) clearInterval(uploadTimer.current)
    }
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个会话吗？删除后可在回收站恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteConversation(id)
          store.fetchConversations(1, 50)
          message.success('已删除')
        } catch (e) {
          console.error('Delete failed:', e)
          message.error('删除失败')
        }
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* 上传遮罩 */}
      {uploading && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl px-12 py-10 text-center min-w-[320px] shadow-2xl">
            <LoadingOutlined className="text-4xl text-[#409eff]" />
            <p className="text-base text-[#333] mt-4 mb-5 font-medium">正在预解析文件...</p>
            <div className="w-[240px] h-1.5 bg-[#e8eaed] rounded mx-auto overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#409eff] to-[#66b1ff] rounded transition-[width] duration-300 ease"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-[#909399] mt-3">{uploadStatusText}</p>
          </div>
        </div>
      )}

      <div className="max-w-[800px] mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="m-0 text-xl text-[#333]">会话历史</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowUpload(true)}>
            新建对话
          </Button>
        </div>

        {showUpload && (
          <Card
            size="small"
            title={
              <div className="flex justify-between items-center">
                <span>上传简历</span>
                <Button size="small" onClick={() => setShowUpload(false)}>
                  取消
                </Button>
              </div>
            }
            className="mb-6"
          >
            <Dragger
              accept=".pdf,.doc,.docx"
              beforeUpload={(file) => {
                setSelectedFile(file)
                return false
              }}
              onRemove={() => setSelectedFile(null)}
              maxCount={1}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽上传 PDF / Word 文件</p>
            </Dragger>
            {selectedFile && (
              <div className="flex items-center gap-3 mt-3 text-[#333]">
                <span>{selectedFile.name}</span>
                <Button size="small" onClick={() => setSelectedFile(null)}>
                  重新选择
                </Button>
              </div>
            )}
            <div className="mt-4">
              <TextArea
                rows={3}
                placeholder="请分析这份简历..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            <Button
              type="primary"
              disabled={!selectedFile || uploading}
              loading={uploading}
              onClick={handleUpload}
              className="mt-3"
            >
              {uploading ? '上传中...' : '开始对话'}
            </Button>
          </Card>
        )}

        {conversationsLoading ? (
          <div className="flex justify-center py-15 text-[#909399]">加载会话中...</div>
        ) : conversations.length === 0 ? (
          <Empty description="还没有会话，点击上方按钮创建一个" />
        ) : (
          <div className="flex flex-col gap-3">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                size="small"
                hoverable
                className="cursor-pointer"
                onClick={() => navigate(`/editor/${conv.id}`)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-base font-medium text-[#333] mb-1.5">
                      {conv.title || '无标题会话'}
                    </div>
                    <div className="flex gap-4 text-xs text-[#999]">
                      <span>{formatTime(conv.updated_at)}</span>
                      <span>{conv.id.length > 12 ? conv.id.slice(0, 12) + '...' : conv.id}</span>
                    </div>
                  </div>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(conv.id)
                    }}
                  >
                    删除
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
