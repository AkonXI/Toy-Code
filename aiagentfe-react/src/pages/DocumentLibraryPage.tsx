import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, Radio, Input, Switch, message, Modal, Tag, Empty, Spin } from 'antd'
import { PlusOutlined, UploadOutlined, FileTextOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  getUserDocuments,
  uploadUserDocument,
  deleteUserDocument,
  toggleUserDocument,
  type UserDocument
} from '@/api'
import { formatTime } from '@/lib/format'

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export default function DocumentLibraryPage() {
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('reference_doc')
  const [category, setCategory] = useState('')
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const result = await getUserDocuments()
      setDocuments(result.data)
    } catch (e) {
      console.error('Failed to fetch documents:', e)
      message.error('加载文档列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocuments()
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer?.files[0]
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.txt'))) {
      setSelectedFile(file)
    } else {
      message.warning('请上传 PDF 或 TXT 文件')
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      await uploadUserDocument(selectedFile, docType, category || undefined)
      message.success('文档上传成功，已开始索引')
      setShowUpload(false)
      clearFile()
      setDocType('reference_doc')
      setCategory('')
      await fetchDocuments()
    } catch (e: any) {
      console.error('Upload failed:', e)
      message.error(e?.response?.data?.error || '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await toggleUserDocument(id, active ? 1 : 0)
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, active: active ? 1 : 0 } : d)))
      message.success(active ? '已启用' : '已禁用')
    } catch (e) {
      console.error('Toggle failed:', e)
      message.error('操作失败')
    }
  }

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个文档吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUserDocument(id)
          setDocuments((prev) => prev.filter((d) => d.id !== id))
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
      <div className="max-w-[800px] mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-5">
          <h2 className="m-0 text-xl text-[#333]">我的知识库</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowUpload(true)}>
            上传文档
          </Button>
        </div>

        {showUpload && (
          <div className="mb-6">
            <Card
              title={
                <div className="flex justify-between items-center">
                  <span>上传文档到知识库</span>
                  <Button size="small" onClick={() => setShowUpload(false)}>
                    取消
                  </Button>
                </div>
              }
            >
              <div
                className="border-2 border-dashed border-[#dcdfe6] rounded-lg py-10 px-5 text-center cursor-pointer hover:border-[#1677ff] transition-colors mb-4"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {!selectedFile ? (
                  <div className="text-[#909399]">
                    <UploadOutlined className="text-5xl mb-2" />
                    <p>点击或拖拽上传 PDF / TXT 文件</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3 text-[#333]">
                    <FileTextOutlined className="text-3xl" />
                    <span>{selectedFile.name}</span>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        clearFile()
                      }}
                    >
                      重新选择
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="w-20">文档类型</span>
                  <Radio.Group value={docType} onChange={(e) => setDocType(e.target.value)}>
                    <Radio value="reference_doc">参考资料</Radio>
                    <Radio value="excellent_resume">优秀简历</Radio>
                  </Radio.Group>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-20">分类</span>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="可选，如：前端开发、产品经理"
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-20" />
                  <Button
                    type="primary"
                    disabled={!selectedFile || uploading}
                    loading={uploading}
                    onClick={handleUpload}
                  >
                    {uploading ? '上传中...' : '上传并索引'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center py-16 text-[#909399] gap-3">
            <Spin size="large" />
            <p>加载中...</p>
          </div>
        ) : documents.length === 0 ? (
          <Empty description="知识库为空，点击上方按钮上传文档" />
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[15px] font-medium text-[#333]">
                    <FileTextOutlined />
                    {doc.original_name}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#999]">
                    <Tag color={doc.doc_type === 'excellent_resume' ? 'success' : 'default'}>
                      {doc.doc_type === 'excellent_resume' ? '优秀简历' : '参考资料'}
                    </Tag>
                    {doc.category && (
                      <span className="px-2 py-0.5 bg-[#f0f2f5] rounded">{doc.category}</span>
                    )}
                    <span>{formatSize(doc.file_size)}</span>
                    <span>{formatTime(doc.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#f0f0f0]">
                  <Switch
                    checked={doc.active === 1}
                    size="small"
                    onChange={(val) => handleToggle(doc.id, val)}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(doc.id)}
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
