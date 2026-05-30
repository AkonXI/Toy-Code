import { Button } from 'antd'
import type { OptimizationItem } from '@/types/chat'
import RenderSuggestion from '@/lib/RenderSuggestion'

interface OptimizationCardProps {
  item: OptimizationItem
  disabled?: boolean
  onApply: (item: OptimizationItem) => void
}

export default function OptimizationCard({ item, disabled, onApply }: OptimizationCardProps) {
  return (
    <div className="text-xs text-[#666] bg-[#f9f9f9] rounded-md mb-2 p-2.5">
      <div className="flex justify-between items-center mb-1.5">
        <span>
          <strong>{item.field}</strong> ({item.priority})
        </span>
        <Button type="primary" size="small" disabled={disabled} onClick={() => onApply(item)}>
          采纳
        </Button>
      </div>
      {item.reason && <div className="text-[#999] text-[11px] mb-1.5">{item.reason}</div>}
      <div className="flex flex-col gap-1">
        <div className="text-[#999] text-[11px]">原文：</div>
        <div className="text-[#333] leading-[1.4] bg-[#fff7f0] p-2 rounded border border-[#ffd0c8] text-[12px] whitespace-pre-wrap">
          <RenderSuggestion text={item.current} />
        </div>
        <div className="text-[#999] text-[11px]">建议：</div>
        <div className="text-[#333] leading-[1.4] bg-[#e6f7ff] p-2 rounded border border-[#91d5ff] text-[12px] whitespace-pre-wrap">
          <RenderSuggestion text={item.suggestion} />
        </div>
      </div>
    </div>
  )
}
