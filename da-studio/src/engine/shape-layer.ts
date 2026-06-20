import { buildGroupMap, DEFAULT_GROUPS } from './utils'
import type {
  Point,
  Group,
  Shape,
  RectShape,
  PointShape,
  PolylineShape,
  PolygonShape,
  VertexHit,
  Handle,
  InteractionMode
} from './types'

/**
 * 十六进制颜色转 rgba 字符串
 * @param hex - 6 位十六进制颜色（如 #e53935）
 * @param alpha - 透明度 0-1
 * @returns rgba 字符串
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export class ShapeLayer {
  /** Canvas 元素引用 */
  canvas: HTMLCanvasElement
  /** Canvas 2D 渲染上下文 */
  ctx: CanvasRenderingContext2D
  /** 所有标注图形列表 */
  shapes: Shape[]
  /** 当前选中图形在 shapes 中的索引，-1 表示无选中 */
  current: number
  /** 视图缩放倍数 */
  scale: number
  /** 视图 X 方向平移量（图像坐标） */
  translateX: number
  /** 视图 Y 方向平移量（图像坐标） */
  translateY: number
  _groups: Record<string, Group>
  _defaultGroup: Group
  _group: string
  _mode: string
  /** 交互模式：'draw' 绘制 / 'select' 选择 / 'edit' 编辑 */
  interactionMode: InteractionMode
  _liveRect: RectShape | null

  /**
   * 初始化图形图层
   * @param canvas - 目标 Canvas 元素
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2d context')
    this.ctx = ctx
    this.shapes = []
    this.current = -1
    this.scale = 1
    this.translateX = 0
    this.translateY = 0
    this._groups = buildGroupMap(DEFAULT_GROUPS)
    this._defaultGroup = DEFAULT_GROUPS[0]
    this._group = DEFAULT_GROUPS[0].name
    this._mode = 'rect'
    this.interactionMode = 'draw'
    this._liveRect = null
  }

  /** 设置当前绘制图形类型（'rect' | 'point' | 'polyline' | 'polygon'） */
  set mode(v: string) {
    this._mode = v
  }
  /** 获取当前绘制图形类型 */
  get mode(): string {
    return this._mode
  }

  /* ---- Coordinate helpers ---- */

  /**
   * 将画布像素坐标转换为图像坐标（考虑缩放与平移）
   * @param px - 画布 X 坐标
   * @param py - 画布 Y 坐标
   * @returns 图像坐标系下的 Point
   */
  toImage(px: number, py: number): Point {
    return { x: px / this.scale + this.translateX, y: py / this.scale + this.translateY }
  }

  /**
   * 将图像坐标转换为画布像素坐标（考虑缩放与平移）
   * @param ix - 图像 X 坐标
   * @param iy - 图像 Y 坐标
   * @returns 画布像素坐标系下的 Point
   */
  toCanvas(ix: number, iy: number): Point {
    return { x: (ix - this.translateX) * this.scale, y: (iy - this.translateY) * this.scale }
  }

  /* ---- Viewport transforms ---- */

  /**
   * 设置缩放倍数并重绘
   * @param multi - 新的缩放倍数
   */
  zoom(multi: number): void {
    this.scale = multi
    this.drawHistory()
  }

  /**
   * 平移视图并重绘
   * @param dx - 画布像素 X 方向偏移量
   * @param dy - 画布像素 Y 方向偏移量
   */
  pan(dx: number, dy: number): void {
    this.translateX += dx / this.scale
    this.translateY += dy / this.scale
    this.drawHistory()
  }

  /* ---- Shape management ---- */

  /**
   * 向图层尾部添加一个图形
   * @param shape - 任意类型图形对象
   */
  addShape(shape: Shape): void {
    this.shapes.push(shape)
  }
  /** 移除最后一个图形 */
  popShape(): void {
    this.shapes.pop()
  }
  /** 清空所有图形，重置选中状态，并重绘 */
  clearAll(): void {
    this.shapes = []
    this.current = -1
    this.drawHistory()
  }

  /* ---- Local space helper for rotated rects ---- */

  /** 将图像坐标转换为矩形局部坐标（反向旋转） */
  _toLocal(ix: number, iy: number, shape: RectShape): Point {
    const dx = ix - shape.x
    const dy = iy - shape.y
    const cos = Math.cos(-shape.rotation)
    const sin = Math.sin(-shape.rotation)
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
  }

  /** 将矩形局部坐标转换回图像坐标（正向旋转） */
  _fromLocal(lx: number, ly: number, shape: RectShape): Point {
    const cos = Math.cos(shape.rotation)
    const sin = Math.sin(shape.rotation)
    return {
      x: shape.x + lx * cos - ly * sin,
      y: shape.y + lx * sin + ly * cos
    }
  }

  /* ---- Hit testing ---- */

  /**
   * 碰撞检测：根据画布像素坐标返回命中的图形索引，未命中返回 -1
   * 矩形用 AABB（局部旋转空间），点用距离阈值，折线/多边形用点线距离或射线法
   * @param pixelX - 画布 X 坐标
   * @param pixelY - 画布 Y 坐标
   * @returns 命中图形的下标，-1 表示未命中
   */
  hitTest(pixelX: number, pixelY: number): number {
    const img = this.toImage(pixelX, pixelY)
    const len = this.shapes.length
    for (let i = len - 1; i >= 0; i--) {
      const s = this.shapes[i]
      if (s.type === 'rect') {
        const local = this._toLocal(img.x, img.y, s)
        const hw = s.w / 2,
          hh = s.h / 2
        if (local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh) return i
      } else if (s.type === 'point') {
        const p = this.toCanvas(s.x, s.y)
        if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) return i
      } else if (s.type === 'polyline') {
        if (this._hitPolyline(pixelX, pixelY, s.points)) return i
      } else if (s.type === 'polygon') {
        if (s.complete && this._pointInPolygon(img.x, img.y, s.points)) return i
        if (!s.complete && this._hitPolyline(pixelX, pixelY, s.points)) return i
      }
    }
    return -1
  }

  /**
   * 顶点碰撞检测：仅在折线/多边形上检测，返回命中的形状索引和顶点索引
   * @param pixelX - 画布 X 坐标
   * @param pixelY - 画布 Y 坐标
   * @returns VertexHit 对象或 null
   */
  vertexHitTest(pixelX: number, pixelY: number): VertexHit | null {
    const len = this.shapes.length
    for (let i = len - 1; i >= 0; i--) {
      const s = this.shapes[i]
      if (s.type !== 'polyline' && s.type !== 'polygon') continue
      const pts = s.points
      for (let j = 0; j < pts.length; j++) {
        const p = this.toCanvas(pts[j].x, pts[j].y)
        if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) {
          return { shapeIdx: i, vertexIdx: j }
        }
      }
    }
    return null
  }

  /**
   * 查找鼠标命中线段时的插入位置（顶点索引折中处）
   * @param pixelX - 画布 X 坐标
   * @param pixelY - 画布 Y 坐标
   * @param shapeIdx - 目标图形索引
   * @returns 插入位置的顶点下标，无效返回 null
   */
  findEdgeInsertIndex(pixelX: number, pixelY: number, shapeIdx: number): number | null {
    const s = this.shapes[shapeIdx]
    if (!s || (s.type !== 'polygon' && s.type !== 'polyline')) return null
    const pts = s.points
    if (pts.length < 2) return null
    for (let j = 0; j < pts.length - 1; j++) {
      if (this._hitSegment(pixelX, pixelY, pts[j], pts[j + 1])) return j + 1
    }
    if (s.type === 'polygon' && pts.length >= 2) {
      if (this._hitSegment(pixelX, pixelY, pts[pts.length - 1], pts[0])) return pts.length
    }
    return null
  }

  /** 检测画布坐标是否命中折线/多边形的顶点或线段（距离阈值 6px） */
  _hitPolyline(pixelX: number, pixelY: number, points: Point[]): boolean {
    for (let j = 0; j < points.length; j++) {
      const p = this.toCanvas(points[j].x, points[j].y)
      if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) return true
    }
    for (let j = 0; j < points.length - 1; j++) {
      if (this._hitSegment(pixelX, pixelY, points[j], points[j + 1])) return true
    }
    return false
  }

  /** 检测画布坐标是否命中两点之间的线段（距离阈值 6px） */
  _hitSegment(px: number, py: number, a: Point, b: Point): boolean {
    const pa = this.toCanvas(a.x, a.y)
    const pb = this.toCanvas(b.x, b.y)
    const dx = pb.x - pa.x,
      dy = pb.y - pa.y
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return Math.hypot(px - pa.x, py - pa.y) <= 6
    let t = ((px - pa.x) * dx + (py - pa.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const nx = pa.x + t * dx,
      ny = pa.y + t * dy
    return Math.hypot(px - nx, py - ny) <= 6
  }

  /** 射线法判断图像坐标点是否在多边形内部 */
  _pointInPolygon(px: number, py: number, points: Point[]): boolean {
    let inside = false
    const n = points.length
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = points[i].y,
        yj = points[j].y
      if (
        yi > py !== yj > py &&
        px < ((points[j].x - points[i].x) * (py - yi)) / (yj - yi) + points[i].x
      ) {
        inside = !inside
      }
    }
    return inside
  }

  /**
   * 矩形手柄碰撞检测：返回命中的手柄类型，同时自动选中该图形
   * 手柄包括 4 角（TL/TR/BL/BR）、4 边中点（T/B/L/R）和旋转手柄（ROTATE）
   * @param pixelX - 画布 X 坐标
   * @param pixelY - 画布 Y 坐标
   * @param readOnly - 若为 true 不修改选中状态
   * @returns 手柄标识，未命中返回 'OUT'
   */
  handleHit(pixelX: number, pixelY: number, readOnly = false): Handle {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i] as RectShape
      if (s.type !== 'rect') continue

      const img = this.toImage(pixelX, pixelY)
      const local = this._toLocal(img.x, img.y, s)
      const hw = s.w / 2,
        hh = s.h / 2

      const cr = 7 / this.scale
      const er = 6 / this.scale
      const rr = 6 / this.scale

      let handle: Handle = 'OUT'

      if (Math.hypot(local.x + hw, local.y + hh) <= cr) handle = 'TL'
      else if (Math.hypot(local.x - hw, local.y + hh) <= cr) handle = 'TR'
      else if (Math.hypot(local.x + hw, local.y - hh) <= cr) handle = 'BL'
      else if (Math.hypot(local.x - hw, local.y - hh) <= cr) handle = 'BR'
      else if (Math.hypot(local.x, local.y + hh) <= er) handle = 'T'
      else if (Math.hypot(local.x, local.y - hh) <= er) handle = 'B'
      else if (Math.hypot(local.x + hw, local.y) <= er) handle = 'L'
      else if (Math.hypot(local.x - hw, local.y) <= er) handle = 'R'
      else {
        const rotHy = -hh - 22 / this.scale
        if (Math.hypot(local.x, local.y - rotHy) <= rr) handle = 'ROTATE'
      }

      if (handle !== 'OUT') {
        if (!readOnly) {
          this.shapes.forEach((shape) => {
            shape.current = false
          })
          s.current = true
          this.current = i
        }
        return handle
      }
    }
    return 'OUT'
  }

  /* ---- Viewport culling ---- */

  /** 获取当前视口边界（图像坐标，含 padding） */
  /**
   * 获取当前视口边界（图像坐标，含 padding）
   * @returns 视口四边（图像坐标），外扩 30/scale 避免边缘闪烁
   */
  _getViewportBounds(): { left: number; top: number; right: number; bottom: number } {
    const padding = 30 / this.scale
    return {
      left: this.translateX - padding,
      top: this.translateY - padding,
      right: this.translateX + this.canvas.width / this.scale + padding,
      bottom: this.translateY + this.canvas.height / this.scale + padding
    }
  }

  /**
   * 判断图形是否与视口相交
   * @param s - 图形对象
   * @param bounds - 视口边界（图像坐标）
   * @returns 是否可见（选中图形始终可见）
   */
  _isShapeVisible(
    s: Shape,
    bounds: { left: number; top: number; right: number; bottom: number }
  ): boolean {
    if (s.current) return true
    if (s.type === 'rect') {
      const hw = s.w / 2,
        hh = s.h / 2
      const cos = Math.cos(s.rotation || 0)
      const sin = Math.sin(s.rotation || 0)
      const cs = [
        { x: s.x - hw * cos - -hh * sin, y: s.y - hw * sin + -hh * cos },
        { x: s.x + hw * cos - -hh * sin, y: s.y + hw * sin + -hh * cos },
        { x: s.x + hw * cos - hh * sin, y: s.y + hw * sin + hh * cos },
        { x: s.x - hw * cos - hh * sin, y: s.y - hw * sin + hh * cos }
      ]
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity
      for (const c of cs) {
        if (c.x < minX) minX = c.x
        if (c.x > maxX) maxX = c.x
        if (c.y < minY) minY = c.y
        if (c.y > maxY) maxY = c.y
      }
      return !(
        maxX < bounds.left ||
        minX > bounds.right ||
        maxY < bounds.top ||
        minY > bounds.bottom
      )
    }
    if (s.type === 'point') {
      const r = 6 / this.scale
      return !(
        s.x + r < bounds.left ||
        s.x - r > bounds.right ||
        s.y + r < bounds.top ||
        s.y - r > bounds.bottom
      )
    }
    if (s.type === 'polyline' || s.type === 'polygon') {
      if (s.points.length === 0) return false
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity
      for (const p of s.points) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      return !(
        maxX < bounds.left ||
        minX > bounds.right ||
        maxY < bounds.top ||
        minY > bounds.bottom
      )
    }
    return true
  }

  /* ---- Drawing ---- */

  /**
   * 全量重绘：清空画布后按 z-order 逐图形绘制，叠加虚线预览框和标签
   * @param e - 可选鼠标事件（传人时对鼠标位置做 hover 高亮）
   */
  drawHistory(e?: MouseEvent): void {
    const hitIdx = e ? this.hitTest(e.offsetX, e.offsetY) : -1
    const bounds = this._getViewportBounds()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (let i = 0; i < this.shapes.length; i++) {
      if (this._isShapeVisible(this.shapes[i], bounds)) {
        this._paintShape(i, this.shapes[i], i === hitIdx)
      }
    }
    this._paintLiveRect()
    this._drawShapeLabels(bounds)
  }

  /**
   * 绘制可见图形的标签（仅 select 模式），超出视口的已裁剪
   * @param bounds - 视口边界（图像坐标）
   */
  _drawShapeLabels(bounds: { left: number; top: number; right: number; bottom: number }): void {
    if (this.interactionMode !== 'select') return
    const ctx = this.ctx
    this.shapes.forEach((s, i) => {
      if (!this._isShapeVisible(s, bounds)) return
      if ((s.type === 'polygon' || s.type === 'polyline') && !s.complete) return
      const c = this._groups[s.group] || this._defaultGroup
      const bg = s.current ? c.stroke : hexToRgba(c.stroke, 0.5)
      const label = this._getShapeLabel(s, i)
      const anchor = this._getShapeAnchor(s)
      const p = this.toCanvas(anchor.x, anchor.y)

      ctx.font = '10px monospace'
      const tw = ctx.measureText(label).width + 8
      const th = 16
      const rx = p.x + 4,
        ry = p.y - th - 4

      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.moveTo(rx + 3, ry)
      ctx.lineTo(rx + tw - 3, ry)
      ctx.quadraticCurveTo(rx + tw, ry, rx + tw, ry + 3)
      ctx.lineTo(rx + tw, ry + th - 3)
      ctx.quadraticCurveTo(rx + tw, ry + th, rx + tw - 3, ry + th)
      ctx.lineTo(rx + 3, ry + th)
      ctx.quadraticCurveTo(rx, ry + th, rx, ry + th - 3)
      ctx.lineTo(rx, ry + 3)
      ctx.quadraticCurveTo(rx, ry, rx + 3, ry)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, rx + 4, ry + th - 4)
    })
  }

  /**
   * 根据图形类型返回标签文字
   * @param s - 图形对象
   * @param i - 在 shapes 中的索引
   * @returns 标签文字（如"矩形 1"）
   */
  _getShapeLabel(s: Shape, i: number): string {
    switch (s.type) {
      case 'rect':
        return `矩形 ${i + 1}`
      case 'point':
        return `点 ${i + 1}`
      case 'polygon':
        return `多边形 ${i + 1}`
      case 'polyline':
        return `折线 ${i + 1}`
    }
  }

  /**
   * 获取标签锚点位置
   * @param s - 图形对象
   * @returns 图像坐标下的锚点（矩形左上角、点自身、折线/多边形第一个顶点）
   */
  _getShapeAnchor(s: Shape): Point {
    switch (s.type) {
      case 'rect': {
        const cos = Math.cos(s.rotation || 0)
        const sin = Math.sin(s.rotation || 0)
        return {
          x: s.x - (s.w / 2) * cos + (s.h / 2) * sin,
          y: s.y - (s.w / 2) * sin - (s.h / 2) * cos
        }
      }
      case 'point':
        return { x: s.x, y: s.y }
      case 'polygon':
      case 'polyline':
        return s.points[0]
    }
  }

  /**
   * 分发到对应类型的绘制方法
   * @param i - 图形索引
   * @param s - 图形对象
   * @param highlight - 是否高亮（hover 悬停）
   */
  _paintShape(i: number, s: Shape, highlight: boolean): void {
    if (s.type === 'rect') this._paintRect(s, highlight)
    else if (s.type === 'point') this._paintPoint(s, i, highlight)
    else if (s.type === 'polyline') this._paintPolyline(s, i, highlight)
    else if (s.type === 'polygon') this._paintPolygon(s, i, highlight)
  }

  /**
   * 绘制矩形（使用 save/translate/rotate 矩阵变换），选中时加手柄
   * @param s - 矩形图形
   * @param highlight - 是否高亮
   */
  _paintRect(s: RectShape, highlight: boolean): void {
    const cx = (s.x - this.translateX) * this.scale
    const cy = (s.y - this.translateY) * this.scale
    const cw = s.w * this.scale
    const ch = s.h * this.scale
    const c = this._groups[s.group] || this._defaultGroup

    this.ctx.save()
    this.ctx.translate(cx, cy)
    this.ctx.rotate(s.rotation || 0)

    if (highlight) {
      this.ctx.fillStyle = c.fillHover
      this.ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
    }
    if (s.current) {
      this.ctx.fillStyle = c.fill
      this.ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
    }
    this.ctx.strokeStyle = c.stroke
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(-cw / 2, -ch / 2, cw, ch)

    if (s.current) {
      this._paintHandles(cw, ch, c)
    }

    this.ctx.restore()
  }

  /**
   * 绘制矩形选中手柄：4 边中点圆点 + 4 角圆点 + 顶部旋转柄
   * @param cw - 画布像素宽度（已缩放）
   * @param ch - 画布像素高度（已缩放）
   * @param c - 分组颜色配置
   */
  _paintHandles(cw: number, ch: number, c: Group): void {
    const hw = cw / 2,
      hh = ch / 2

    const edges = [
      { x: 0, y: -hh },
      { x: 0, y: hh },
      { x: -hw, y: 0 },
      { x: hw, y: 0 }
    ]
    for (const e of edges) {
      this.ctx.beginPath()
      this.ctx.arc(e.x, e.y, 4, 0, Math.PI * 2)
      this.ctx.fillStyle = '#fff'
      this.ctx.fill()
      this.ctx.strokeStyle = c.stroke
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }

    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: -hw, y: hh },
      { x: hw, y: hh }
    ]
    for (const corner of corners) {
      this.ctx.beginPath()
      this.ctx.arc(corner.x, corner.y, 5, 0, Math.PI * 2)
      this.ctx.fillStyle = '#fff'
      this.ctx.fill()
      this.ctx.strokeStyle = c.stroke
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }

    const ry = -hh - 20
    this.ctx.beginPath()
    this.ctx.moveTo(0, -hh)
    this.ctx.lineTo(0, ry)
    this.ctx.strokeStyle = c.stroke
    this.ctx.lineWidth = 1
    this.ctx.stroke()

    this.ctx.beginPath()
    this.ctx.arc(0, ry, 5, 0, Math.PI * 2)
    this.ctx.fillStyle = '#fff'
    this.ctx.fill()
    this.ctx.strokeStyle = c.stroke
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }

  /**
   * 绘制点图形（圆形标记 + 编号 label）
   * @param s - 点图形
   * @param i - 图形索引
   * @param highlight - 是否高亮
   */
  _paintPoint(s: PointShape, i: number, highlight: boolean): void {
    const p = this.toCanvas(s.x, s.y)
    const c = this._groups[s.group] || this._defaultGroup
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, highlight || s.current ? 7 : 5, 0, Math.PI * 2)
    if (s.current) {
      this.ctx.fillStyle = c.fill
    } else {
      this.ctx.fillStyle = highlight ? c.fillHover : c.stroke
    }
    this.ctx.fill()
    this.ctx.strokeStyle = '#fff'
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    this.ctx.fillStyle = '#fff'
    this.ctx.font = 'bold 12px sans-serif'
    this.ctx.fillText(String(i + 1), p.x + 8, p.y - 8)
  }

  /**
   * 绘制折线：顶点圆点 + 编号 + 连接线段，未完成时虚线
   * @param s - 折线图形
   * @param _i - 图形索引（未使用）
   * @param highlight - 是否高亮
   */
  _paintPolyline(s: PolylineShape, _i: number, highlight: boolean): void {
    const pts = s.points
    const c = this._groups[s.group] || this._defaultGroup
    for (let j = 0; j < pts.length; j++) {
      const p = this.toCanvas(pts[j].x, pts[j].y)
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, highlight || s.current ? 7 : 5, 0, Math.PI * 2)
      if (s.current) {
        this.ctx.fillStyle = c.fill
      } else {
        this.ctx.fillStyle = highlight ? c.fillHover : c.stroke
      }
      this.ctx.fill()
      this.ctx.strokeStyle = '#fff'
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
      this.ctx.fillStyle = '#fff'
      this.ctx.font = 'bold 11px sans-serif'
      this.ctx.fillText(String(j + 1), p.x + 7, p.y - 7)
    }
    if (pts.length > 1) {
      this.ctx.beginPath()
      const p0 = this.toCanvas(pts[0].x, pts[0].y)
      this.ctx.moveTo(p0.x, p0.y)
      for (let j = 1; j < pts.length; j++) {
        const p = this.toCanvas(pts[j].x, pts[j].y)
        this.ctx.lineTo(p.x, p.y)
      }
      this.ctx.strokeStyle = c.stroke
      this.ctx.lineWidth = highlight ? 3 : 2
      if (s.complete === false) this.ctx.setLineDash([5, 5])
      this.ctx.stroke()
      this.ctx.setLineDash([])
    }
  }

  /**
   * 绘制多边形：填充 + 描边 + 顶点圆点 + 编号，未完成时虚线
   * @param s - 多边形图形
   * @param _i - 图形索引（未使用）
   * @param highlight - 是否高亮
   */
  _paintPolygon(s: PolygonShape, _i: number, highlight: boolean): void {
    const pts = s.points
    if (pts.length === 0) return
    const c = this._groups[s.group] || this._defaultGroup

    if (pts.length === 1) {
      const p = this.toCanvas(pts[0].x, pts[0].y)
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      this.ctx.fillStyle = s.current ? c.fill : c.stroke
      this.ctx.fill()
      return
    }

    this.ctx.beginPath()
    const p0 = this.toCanvas(pts[0].x, pts[0].y)
    this.ctx.moveTo(p0.x, p0.y)
    for (let j = 1; j < pts.length; j++) {
      const p = this.toCanvas(pts[j].x, pts[j].y)
      this.ctx.lineTo(p.x, p.y)
    }
    this.ctx.closePath()
    if (highlight) {
      this.ctx.fillStyle = c.fillHover
    } else if (s.current) {
      this.ctx.fillStyle = c.fill
    } else {
      this.ctx.fillStyle = 'rgba(0,0,0,0.04)'
    }
    this.ctx.fill()
    this.ctx.strokeStyle = c.stroke
    this.ctx.lineWidth = 2
    if (!s.complete) this.ctx.setLineDash([5, 5])
    this.ctx.stroke()
    this.ctx.setLineDash([])

    for (let j = 0; j < pts.length; j++) {
      const p = this.toCanvas(pts[j].x, pts[j].y)
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, highlight || s.current ? 7 : 5, 0, Math.PI * 2)
      if (s.current) {
        this.ctx.fillStyle = c.fill
      } else {
        this.ctx.fillStyle = highlight ? c.fillHover : c.stroke
      }
      this.ctx.fill()
      this.ctx.strokeStyle = highlight && !s.current ? c.stroke : '#fff'
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
      this.ctx.fillStyle = '#fff'
      this.ctx.font = 'bold 11px sans-serif'
      this.ctx.fillText(String(j + 1), p.x + 7, p.y - 7)
    }
  }

  /* ---- Live rect drawing ---- */

  /** 绘制实时矩形（拖拽过程中的虚线预览框） */
  _paintLiveRect(): void {
    if (!this._liveRect) return
    const s = this._liveRect
    const cx = (s.x - this.translateX) * this.scale
    const cy = (s.y - this.translateY) * this.scale
    const cw = s.w * this.scale
    const ch = s.h * this.scale

    this.ctx.save()
    this.ctx.translate(cx, cy)
    this.ctx.rotate(s.rotation || 0)
    this.ctx.strokeStyle = (this._groups[this._group] || this._defaultGroup).stroke
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([5, 5])
    this.ctx.strokeRect(-cw / 2, -ch / 2, cw, ch)
    this.ctx.setLineDash([])
    this.ctx.restore()
  }

  /**
   * 设置实时矩形（拖拽预览），根据起止点计算中心/宽高
   * @param sx - 起始点画布 X 坐标
   * @param sy - 起始点画布 Y 坐标
   * @param ex - 结束点画布 X 坐标
   * @param ey - 结束点画布 Y 坐标
   */
  drawLiveRect(sx: number, sy: number, ex: number, ey: number): void {
    this._liveRect = {
      type: 'rect',
      x: (sx + ex) / 2,
      y: (sy + ey) / 2,
      w: Math.abs(ex - sx),
      h: Math.abs(ey - sy),
      rotation: 0,
      group: this._group
    }
    this.drawHistory()
  }

  /** 清除实时矩形（拖拽结束） */
  clearLiveRect(): void {
    this._liveRect = null
  }
}
