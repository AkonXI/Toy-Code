import { ref } from 'vue'
import type { Shape, Point } from '../engine/types'
import type { MatchResult } from '../matcher/types'
import { matchTrajectory } from '../matcher'

function shapeToPoints(shape: Shape): Point[] | null {
  if (shape.type === 'polygon' || shape.type === 'polyline') {
    return shape.points
  }
  if (shape.type === 'rect') {
    const { x, y, w, h, rotation } = shape
    const hw = w / 2
    const hh = h / 2
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ]
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    return corners.map(c => ({
      x: x + c.x * cos - c.y * sin,
      y: y + c.x * sin + c.y * cos,
    }))
  }
  return null
}

function isClosedShape(shape: Shape): boolean {
  return shape.type === 'polygon' || shape.type === 'rect'
}

export function comparableShapes(shapes: Shape[]): { label: string; idx: number }[] {
  return shapes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.type !== 'point')
    .filter(({ s }) => 'complete' in s ? s.complete : true)
    .map(({ s, i }) => {
      let detail = ''
      if (s.type === 'rect') {
        detail = `${s.w.toFixed(0)}x${s.h.toFixed(0)}`
      } else if ('points' in s) {
        detail = `${s.points.length}顶点`
      }
      return {
        idx: i,
        label: `${shapeTypeLabel(s)} ${i + 1} (${detail})`,
      }
    })
}

function shapeTypeLabel(s: Shape): string {
  const map: Record<string, string> = { rect: '矩形', point: '点', polyline: '折线', polygon: '多边形' }
  return map[s.type] || s.type
}

export function useComparison() {
  const templateIdx = ref<number | null>(null)
  const testIdx = ref<number | null>(null)
  const result = ref<MatchResult | null>(null)
  const loading = ref(false)

  function compare(shapes: Shape[]) {
    if (templateIdx.value == null || testIdx.value == null) return
    // 图形删除后索引可能越界，对无效索引清空结果
    if (templateIdx.value >= shapes.length || testIdx.value >= shapes.length) {
      result.value = null
      return
    }
    const a = shapeToPoints(shapes[templateIdx.value])
    const b = shapeToPoints(shapes[testIdx.value])
    if (!a || !b) {
      result.value = null
      return
    }
    const closed = isClosedShape(shapes[templateIdx.value])

    loading.value = true
    result.value = matchTrajectory(a, b, { spacing: 2, delta: 3, pct: 0.03, closed })
    loading.value = false
  }

  function clear() {
    templateIdx.value = null
    testIdx.value = null
    result.value = null
    loading.value = false
  }

  return { templateIdx, testIdx, result, loading, compare, clear }
}
