export type ModeType = 'rect' | 'point' | 'polyline' | 'polygon'
export type InteractionMode = 'select' | 'draw'

export interface Point {
  x: number
  y: number
}

export interface Group {
  name: string
  stroke: string
  fill: string
  fillHover: string
  label: string
}

export interface RectShape {
  type: 'rect'
  x: number
  y: number
  w: number
  h: number
  rotation: number
  group: string
  current?: boolean
}

export interface PointShape {
  type: 'point'
  x: number
  y: number
  group: string
  current?: boolean
}

export interface PolylineShape {
  type: 'polyline'
  points: Point[]
  complete: boolean
  group: string
  current?: boolean
}

export interface PolygonShape {
  type: 'polygon'
  points: Point[]
  complete: boolean
  group: string
  current?: boolean
}

export type Shape = RectShape | PointShape | PolylineShape | PolygonShape

export interface Meta {
  scale: number
  translateX: number
  translateY: number
  mode: string
  group: string
}

export interface VertexHit {
  shapeIdx: number
  vertexIdx: number
}

export type Handle = 'TL' | 'TR' | 'BL' | 'BR' | 'T' | 'B' | 'L' | 'R' | 'ROTATE' | 'OUT'

export interface DragCache {
  x: number
  y: number
  w?: number
  h?: number
  rotation?: number
  points?: Point[]
}

export interface ControllerState {
  drawing: boolean
  dragging: boolean
  resizing: boolean
  panning: boolean
  rotating: boolean
  dragIdx: number
  dragVertexIdx: number
  dragCache: DragCache | null
  dragStart: Point | null
  resizeDirection: Handle
  resizeCache: { x: number; y: number; w: number; h: number; rotation: number } | null
  resizeStartLocal: Point | null
  rotateCache: { rotation: number } | null
  rotateStartAngle: number | null
  offsetAngle: number | null
  panStart: Point | null
  drawStart: Point | null
}

export interface HandlerReturn {
  onMouseDown: (_e: MouseEvent) => void
  onMouseMove: (_e: MouseEvent) => void
  onMouseUp: (_e: MouseEvent) => void
  onMouseLeave: (_e: MouseEvent) => void
  onWheel: (_e: WheelEvent) => void
}

export interface ControllerOpts {
  mode?: string
  interactionMode?: InteractionMode
  readonly?: boolean
  onChange?: (_shapes: Shape[], _meta: Meta) => void
  groups?: Group[]
}
