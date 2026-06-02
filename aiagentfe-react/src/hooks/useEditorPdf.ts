import { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'
import { useResumeStore } from '@/stores/resume'
import {
  getReferenceFiles,
  getDocHistory,
  getConversationMessages,
  restoreDocVersion,
  renderResumePdf,
  api,
  type ReferenceDoc,
  type DocVersion
} from '@/api'
import type { Message } from '@/types/chat'
import { mapApiMessage } from '@/lib/editor-utils'

export function useEditorPdf() {
  const resumeStore = useResumeStore()
  const [pdfUrl, setPdfUrl] = useState('')
  const [docVersions, setDocVersions] = useState<DocVersion[]>([])
  const [activeVersionIdx, setActiveVersionIdx] = useState(0)
  const [referenceFiles, setReferenceFiles] = useState<ReferenceDoc[]>([])
  const pdfUrlRef = useRef('')

  useEffect(() => {
    pdfUrlRef.current = pdfUrl
  }, [pdfUrl])

  const loadReferenceFiles = useCallback(async (convId?: string) => {
    if (!convId) return
    try {
      const r = await getReferenceFiles(convId)
      setReferenceFiles(r.docs || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadDocHistory = useCallback(async (convId?: string) => {
    if (!convId) return
    try {
      const r = await getDocHistory(convId)
      setDocVersions(r.versions ?? [])
      setActiveVersionIdx(Math.max(0, (r.versions ?? []).length - 1))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadPdfFromDocs = useCallback(async (convId: string): Promise<Message[]> => {
    try {
      const result = await getConversationMessages(convId, 1, 1, 'DESC')
      const docs = result.data?.documents ?? []
      if (docs.length > 0) {
        const latestDoc = docs[0]
        const fileUrl = latestDoc.file_url.startsWith('/api')
          ? latestDoc.file_url
          : `/api${latestDoc.file_url}`
        const blob = (await api.get(fileUrl.replace('/api', ''), {
          responseType: 'blob'
        })) as Blob
        const newUrl = URL.createObjectURL(blob)
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
        setPdfUrl(newUrl)
      }
      return (result.data?.messages ?? []).map(mapApiMessage)
    } catch (e) {
      console.error(e)
      return []
    }
  }, [])

  const handleSelectVersion = useCallback(
    async (idx: number) => {
      if (idx === activeVersionIdx) return
      const v = docVersions[idx]
      if (!v) return
      try {
        let blob: Blob
        if (v.type === 'original' && resumeStore.resumeContent) {
          blob = await renderResumePdf(resumeStore.resumeContent)
        } else {
          const result = await api.get(`/rag/docs/${v.refId}/download`, { responseType: 'blob' })
          blob = result as unknown as Blob
        }
        const url = URL.createObjectURL(blob)
        setPdfUrl((prev) => {
          if (prev && prev !== resumeStore.fileBlobUrl) URL.revokeObjectURL(prev)
          return url
        })
        setActiveVersionIdx(idx)
      } catch {
        message.error('加载版本失败')
      }
    },
    [activeVersionIdx, docVersions, resumeStore]
  )

  const handleRestore = useCallback(
    async (convId: string): Promise<string | null> => {
      const v = docVersions[activeVersionIdx]
      if (!v) return null
      try {
        await restoreDocVersion(v.refId)
        message.success('已恢复')
        await loadDocHistory(convId)
        await loadPdfFromDocs(convId)
        return v.version?.toString() ?? ''
      } catch {
        message.error('恢复失败')
        return null
      }
    },
    [activeVersionIdx, docVersions, loadDocHistory, loadPdfFromDocs]
  )

  const handleDownload = useCallback(async () => {
    try {
      const blob = await renderResumePdf(resumeStore.resumeContent)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'resume.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('下载失败')
    }
  }, [resumeStore])

  const currentVersionLabel = docVersions[activeVersionIdx]
    ? docVersions[activeVersionIdx].type === 'original'
      ? '原始简历'
      : `修改版本 v${docVersions[activeVersionIdx].version || ''}`
    : undefined

  return {
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
    loadPdfFromDocs,
    handleSelectVersion,
    handleRestore,
    handleDownload
  }
}
