import { Button } from 'antd'
import type { ModificationItem } from '@/types/chat'
import RenderSuggestion from '@/components/RenderSuggestion'

interface ModificationReviewProps {
  item: ModificationItem
  msgIndex: number
  modIdx: number
  disabled?: boolean
  onAccept: (item: ModificationItem, msgIndex: number, modIdx: number) => void
  onSupplement: (item: ModificationItem, msgIndex: number, modIdx: number) => void
  onReject: (msgIndex: number, modIdx: number) => void
}

export default function ModificationReview({
  item,
  msgIndex,
  modIdx,
  disabled,
  onAccept,
  onSupplement,
  onReject
}: ModificationReviewProps) {
  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#e5e5e5]">
      <div className="text-xs text-[#999] mb-2">修改预览</div>
      <div className="text-xs text-[#666] bg-[#f9f9f9] rounded-md mb-2 p-2.5">
        <div className="mb-1.5">
          <strong>{item.field}</strong>
          {item.reason && <div className="text-[#999] text-[11px] mt-0.5">{item.reason}</div>}
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[#999] text-[11px]">修改前：</div>
          <div className="text-[#333] leading-[1.4] bg-[#fff7f0] p-2 rounded border border-[#ffd0c8] text-[12px]">
            <RenderSuggestion text={item.current} />
          </div>
          <div className="text-[#999] text-[11px]">修改后：</div>
          <div className="text-[#333] leading-[1.4] bg-[#f0f7ff] p-2 rounded border border-[#d0e3ff] text-[12px]">
            <RenderSuggestion text={item.suggestion} />
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            type="primary"
            size="small"
            disabled={disabled}
            onClick={() => onAccept(item, msgIndex, modIdx)}
          >
            接受
          </Button>
          <Button
            size="small"
            disabled={disabled}
            onClick={() => onSupplement(item, msgIndex, modIdx)}
          >
            补充
          </Button>
          <Button size="small" disabled={disabled} onClick={() => onReject(msgIndex, modIdx)}>
            拒绝
          </Button>
        </div>
      </div>
    </div>
  )
}
