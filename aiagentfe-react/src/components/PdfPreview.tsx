import { Card, Button, Spin, Empty, Result } from 'antd'
import { memo } from 'react'
import type { DocVersion } from '@/api'

interface PdfPreviewProps {
  pdfUrl: string
  loading: boolean
  error: string
  onDownload: () => void
  versions?: DocVersion[]
  activeIndex?: number
  currentVersion?: string
  showRestore?: boolean
  onSelectVersion?: (index: number) => void
  onRestore?: (refId: number) => void
}

export default memo(PdfPreview)

function PdfPreview({
  pdfUrl,
  loading,
  error,
  onDownload,
  versions = [],
  activeIndex = -1,
  currentVersion,
  showRestore,
  onSelectVersion,
  onRestore
}: PdfPreviewProps) {
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-full">
          <Spin tip="加载中..." />
        </div>
      )
    }
    if (error) {
      return <Result status="error" title={error} />
    }
    if (pdfUrl) {
      return <iframe src={pdfUrl} className="w-full h-full border-none" title="简历预览" />
    }
    return <Empty description="暂无简历文件" />
  }

  return (
    <Card
      className="h-full"
      styles={{
        body: {
          height: 'calc(100% - 55px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
      title={
        <div className="flex justify-between items-center">
          <span>简历预览 {currentVersion ? `(${currentVersion})` : ''}</span>
          <Button onClick={onDownload}>下载 PDF</Button>
        </div>
      }
    >
      <div className="flex-1 min-h-0">{renderContent()}</div>
      {versions.length > 1 && (
        <div className="flex items-center gap-2 pt-3 border-t border-[#f0f0f0] mt-3">
          <div className="flex gap-1 items-center text-xs">
            {versions.map((v, i) => (
              <Button
                key={v.refId}
                size="small"
                type={i === activeIndex ? 'primary' : 'default'}
                onClick={() => onSelectVersion?.(i)}
              >
                {v.type === 'original' ? '原始' : `v${v.version}`}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          {showRestore && onRestore && (
            <Button danger size="small" onClick={() => onRestore(versions[activeIndex]!.refId)}>
              恢复到该版本
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
