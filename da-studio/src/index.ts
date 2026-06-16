export { default as CanvasAnnotator } from './components/CanvasAnnotator.vue'
export { default as ComparisonPanel } from './components/ComparisonPanel.vue'
export { default as ComparisonOverlay } from './components/ComparisonOverlay.vue'
export { default as ModeIcon } from './components/ModeIcon.vue'
export { default as ToolIcon } from './components/ToolIcon.vue'
export { useComparison, comparableShapes } from './composables/useComparison'
export { DEFAULT_GROUPS } from './engine/utils'
export type {
  ModeType,
  InteractionMode,
  Point,
  Group,
  RectShape,
  PointShape,
  PolylineShape,
  PolygonShape,
  Shape,
  Meta,
  VertexHit,
  Handle,
  DragCache,
  ControllerState,
  HandlerReturn,
  ControllerOpts
} from './engine/types'
export { matchTrajectory, resample, computeBBox, computeOBB, dist2, dist } from './matcher'
export type { BBox, OBB, MatchResult, MatcherOptions } from './matcher'
