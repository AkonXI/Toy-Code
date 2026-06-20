import { DEFAULT_GROUPS, deepCopy, normalizeAngle } from './utils'
import { ImageLayer } from './image-layer'
import { ShapeLayer } from './shape-layer'
import type {
  Shape,
  Group,
  Meta,
  RectShape,
  PolylineShape,
  PolygonShape,
  DragCache,
  ControllerState,
  HandlerReturn,
  ControllerOpts,
  InteractionMode
} from './types'

/**
 * 标注控制器 — 管理标注模式、撤销/重做、鼠标交互，协调 ImageLayer 与 ShapeLayer
 * @param opts - 初始化选项（mode / interactionMode / readonly / onChange / groups）
 */
export class AnnotationController {
  /** 当前绘制模式：rect / point / polyline / polygon */
  mode: string
  /** 当前交互模式：draw（绘制） | select（选择/编辑） */
  interactionMode: InteractionMode
  /** 是否只读（禁止编辑） */
  readonly: boolean
  /** 图形/元数据变更时的回调 */
  onChange: (_shapes: Shape[], _meta: Meta) => void
  _groupMap: Record<string, Group>
  /** 当前选中分组的 name */
  currentGroup: string
  _historyStack: { shapes: Shape[]; interactionMode: InteractionMode; mode: string }[]
  _historyIndex: number
  _state: ControllerState
  _scaleRate: number
  _minScale: number
  _maxScale: number
  _rafId: number | null
  _onPolygonComplete: ((_shape: PolygonShape) => void) | null
  _imageLayer: ImageLayer | null
  _shapeLayer: ShapeLayer | null
  _boundHandlers: HandlerReturn | null

  constructor(opts: ControllerOpts = {}) {
    this.mode = opts.mode || 'rect'
    this.interactionMode = opts.interactionMode || 'draw'
    this.readonly = opts.readonly || false
    this.onChange = opts.onChange || (() => {})
    const groups = opts.groups || DEFAULT_GROUPS
    this._groupMap = {}
    groups.forEach((g) => {
      this._groupMap[g.name] = g
    })
    this.currentGroup = groups[0].name

    this._historyStack = []
    this._historyIndex = -1
    this._state = {
      drawing: false,
      dragging: false,
      resizing: false,
      panning: false,
      rotating: false,
      dragIdx: -1,
      dragVertexIdx: -1,
      dragCache: null,
      dragStart: null,
      resizeDirection: 'OUT',
      resizeCache: null,
      resizeStartLocal: null,
      rotateCache: null,
      rotateStartAngle: null,
      offsetAngle: null,
      panStart: null,
      drawStart: null
    }

    this._scaleRate = 1
    this._minScale = 0.25
    this._maxScale = 3
    this._rafId = null

    this._onPolygonComplete = null
    this._imageLayer = null
    this._shapeLayer = null
    this._boundHandlers = null
  }

  /**
   * 挂载画布，绑定鼠标事件
   * @param imageCanvas - 底图画布
   * @param shapeCanvas - 图形画布
   * @param imageSrc - 可选图片 URL，缺省时生成示例渐变图
   */
  mount(
    imageCanvas: HTMLCanvasElement,
    shapeCanvas: HTMLCanvasElement,
    imageSrc?: string
  ): Promise<void> {
    this._imageLayer = new ImageLayer(imageCanvas)
    this._shapeLayer = new ShapeLayer(shapeCanvas)
    this._shapeLayer.mode = this.mode
    this._boundHandlers = this._bindHandlers()
    const h = this._boundHandlers
    shapeCanvas.addEventListener('mousedown', h.onMouseDown)
    shapeCanvas.addEventListener('mousemove', h.onMouseMove)
    shapeCanvas.addEventListener('mouseup', h.onMouseUp)
    shapeCanvas.addEventListener('mouseout', h.onMouseLeave)
    shapeCanvas.addEventListener('contextmenu', (e) => e.preventDefault())
    shapeCanvas.addEventListener('wheel', h.onWheel, { passive: false })

    const src = imageSrc || this._generateSampleImage()
    shapeCanvas.width = 600
    shapeCanvas.height = 600

    return this._imageLayer.loadImage(src).then(() => {
      this._shapeLayer!.drawHistory()
    })
  }

  /**
   * 生成示例渐变图片（无外部图片时的默认底图）
   * @returns data URL 格式的 1920×1080 渐变+网格图片
   */
  private _generateSampleImage(): string {
    const c = document.createElement('canvas')
    c.width = 1920
    c.height = 1080
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    const g = ctx.createLinearGradient(0, 0, 1920, 1080)
    g.addColorStop(0, '#e3f2fd')
    g.addColorStop(0.5, '#f3e5f5')
    g.addColorStop(1, '#e8f5e9')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1920, 1080)
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 1920; i += 50) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 1080)
      ctx.stroke()
    }
    for (let i = 0; i <= 1080; i += 50) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(1920, i)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(960, 540, 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fill()
    return c.toDataURL()
  }

  /**
   * 设置绘制模式
   * @param mode - 绘制模式：rect | point | polyline | polygon
   */
  setMode(mode: string): void {
    if (!this._shapeLayer) return
    const poly = this._activePolygon()
    if (poly && poly.points.length >= 3) {
      poly.complete = true
    } else if (poly) {
      poly.points = []
      this._shapeLayer.popShape()
    }
    const pl = this._activePolyline()
    if (pl && pl.points.length >= 2) {
      pl.complete = true
    } else if (pl) {
      pl.points = []
      this._shapeLayer.popShape()
    }
    this.mode = mode
    this._shapeLayer.mode = mode
    this._saveSnapshot()
    this._shapeLayer.drawHistory()
    this._notify()
  }

  /**
   * 设置交互模式
   * @param mode - draw（绘制）| select（选择/编辑）
   */
  setInteractionMode(mode: InteractionMode): void {
    if (mode === 'select' && this.interactionMode === 'draw' && this._shapeLayer) {
      this.completePolygon()
      this.completePolyline()
      const poly = this._activePolygon()
      if (poly && !poly.complete) {
        poly.points = []
        this._shapeLayer.popShape()
      }
      const pl = this._activePolyline()
      if (pl && !pl.complete) {
        pl.points = []
        this._shapeLayer.popShape()
      }
      if (poly || pl) this._shapeLayer.drawHistory()
    }
    this.interactionMode = mode
    if (this._shapeLayer) this._shapeLayer.interactionMode = mode
    if (this._shapeLayer && this._shapeLayer.current >= 0) {
      const s = this._shapeLayer.shapes[this._shapeLayer.current]
      if (s) s.current = false
      this._shapeLayer.current = -1
      this._shapeLayer.drawHistory()
    }
    this._notify()
  }

  /**
   * 设置只读状态
   * @param v - true 为只读，自动切换 select 模式
   */
  setReadonly(v: boolean): void {
    this.readonly = v
    if (v) this.setInteractionMode('select')
  }

  /**
   * 设置当前绘图分组
   * @param color - 分组 name（如 'red'、'blue'）
   */
  setGroup(color: string): void {
    if (!this._shapeLayer) return
    if (!this._groupMap[color]) return
    this.currentGroup = color
    this._shapeLayer._group = color
  }

  /**
   * 缩放视口
   * @param delta - 增量步长（>0 放大, <0 缩小），受 _minScale/_maxScale 限制
   */
  zoom(delta: number): void {
    if (!this._imageLayer || !this._shapeLayer) return
    const newRate = this._scaleRate + delta
    if (newRate < this._minScale || newRate > this._maxScale) return
    this._scaleRate = newRate
    this._imageLayer.zoom(this._scaleRate)
    this._shapeLayer.zoom(this._scaleRate)
    this._notify()
  }

  /**
   * 平移视口
   * @param dx - 画布像素偏移（水平）
   * @param dy - 画布像素偏移（垂直）
   */
  pan(dx: number, dy: number): void {
    if (!this._imageLayer || !this._shapeLayer) return
    this._imageLayer.pan(dx, dy)
    this._shapeLayer.pan(dx, dy)
    this._notify()
  }

  /** 重置缩放为 1×，平移恢复 0，同时同步到 ImageLayer 和 ShapeLayer */
  resetZoom(): void {
    if (!this._imageLayer || !this._shapeLayer) return
    this._scaleRate = 1
    this._imageLayer.zoom(1)
    this._shapeLayer.zoom(1)
    this._notify()
  }

  /** 取消正在执行的聚焦动画 */
  private _cancelAnim(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }

  /**
   * 平滑聚焦到指定图形
   * @param shapeIdx - 图形在 shapes 中的索引
   */
  focusOnShape(shapeIdx: number): void {
    if (!this._shapeLayer || !this._imageLayer) return
    const shapeLayer = this._shapeLayer
    const imageLayer = this._imageLayer
    const shape = shapeLayer.shapes[shapeIdx]
    if (!shape) return

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    if (shape.type === 'rect') {
      const hw = shape.w / 2,
        hh = shape.h / 2
      const cos = Math.cos(shape.rotation || 0),
        sin = Math.sin(shape.rotation || 0)
      for (const [dx, dy] of [
        [-hw, -hh],
        [hw, -hh],
        [-hw, hh],
        [hw, hh]
      ]) {
        const x = shape.x + dx * cos - dy * sin
        const y = shape.y + dx * sin + dy * cos
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    } else if (shape.type === 'point') {
      minX = maxX = shape.x
      minY = maxY = shape.y
    } else {
      for (const p of shape.points) {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      }
    }

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const bw = maxX - minX || 10
    const bh = maxY - minY || 10
    const pad = 1.2

    const cw = shapeLayer.canvas.width
    const ch = shapeLayer.canvas.height
    const fitScale = Math.min(cw / (bw * pad), ch / (bh * pad))
    const targetScale = Math.max(this._minScale, Math.min(this._maxScale, fitScale))
    const targetTx = cx - cw / (2 * targetScale)
    const targetTy = cy - ch / (2 * targetScale)

    const startScale = this._scaleRate
    const startTx = shapeLayer.translateX
    const startTy = shapeLayer.translateY

    this._cancelAnim()
    const duration = 400
    const start = performance.now()

    const step = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

      const s = startScale + (targetScale - startScale) * ease
      const tx = startTx + (targetTx - startTx) * ease
      const ty = startTy + (targetTy - startTy) * ease

      imageLayer.translateX = tx
      imageLayer.translateY = ty
      shapeLayer.translateX = tx
      shapeLayer.translateY = ty
      this._scaleRate = s
      imageLayer.zoom(s)
      shapeLayer.zoom(s)
      imageLayer._draw()
      shapeLayer.drawHistory()

      if (t < 1) {
        this._rafId = requestAnimationFrame(step)
      } else {
        this._rafId = null
        this._notify()
      }
    }

    this._rafId = requestAnimationFrame(step)
  }

  /** 撤销到上一个快照（越界时无操作，用 canUndo 预先判断） */
  undo(): void {
    if (this._historyIndex < 1) return
    this._historyIndex--
    this._restoreSnapshot()
  }

  /** 重做到下一个快照（越界时无操作，用 canRedo 预先判断） */
  redo(): void {
    if (this._historyIndex >= this._historyStack.length - 1) return
    this._historyIndex++
    this._restoreSnapshot()
  }

  /** 从历史栈当前索引恢复图形和交互模式快照 */
  _restoreSnapshot(): void {
    if (!this._shapeLayer) return
    const entry = this._historyStack[this._historyIndex]
    this._shapeLayer.shapes = deepCopy(entry.shapes)
    this._shapeLayer.current = this._shapeLayer.shapes.findIndex((s) => s.current)

    const incomplete = this._shapeLayer.shapes.find(
      (s) => (s.type === 'polygon' || s.type === 'polyline') && !s.complete
    )
    if (incomplete) {
      this.interactionMode = 'draw'
      this.mode = incomplete.type
      this._shapeLayer.mode = incomplete.type
    } else {
      this.interactionMode = entry.interactionMode
      this.mode = entry.mode
      this._shapeLayer.mode = entry.mode
    }
    this._shapeLayer.interactionMode = this.interactionMode
    this._shapeLayer.drawHistory()
    this._notify()
  }

  /** 清空所有图形（保存当前快照到历史栈，可撤销） */
  clear(): void {
    if (!this._shapeLayer) return
    this._shapeLayer.clearAll()
    this._saveSnapshot()
    this._shapeLayer.drawHistory()
    this._notify()
  }

  /**
   * 是否可撤销
   * @returns historyIndex > 0 时 true
   */
  canUndo(): boolean {
    return this._historyIndex > 0
  }

  /**
   * 是否可重做
   * @returns historyIndex < 栈顶时 true
   */
  canRedo(): boolean {
    return this._historyIndex < this._historyStack.length - 1
  }

  /** 完成绘制中的多边形（>=3 个点），触发 _onPolygonComplete 回调 */
  completePolygon(): void {
    if (!this._shapeLayer) return
    const idx = this._shapeLayer.shapes.length - 1
    if (idx < 0) return
    const poly = this._shapeLayer.shapes[idx]
    if (poly.type !== 'polygon' || poly.complete) return
    if (poly.points.length < 3) return
    poly.complete = true
    this._saveSnapshot()
    this._shapeLayer.drawHistory()
    this._notify()
    if (this._onPolygonComplete) this._onPolygonComplete(poly)
  }

  /**
   * 当前是否正在绘制多边形
   * @returns 有未 complete 的多边形时 true
   */
  isPolygonActive(): boolean {
    if (!this._shapeLayer) return false
    if (this.mode !== 'polygon') return false
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1]
    return last && last.type === 'polygon' && !last.complete
  }

  /** 完成绘制中的折线（>=2 个点） */
  completePolyline(): void {
    if (!this._shapeLayer) return
    const idx = this._shapeLayer.shapes.length - 1
    if (idx < 0) return
    const pl = this._shapeLayer.shapes[idx]
    if (pl.type !== 'polyline' || pl.complete) return
    if (pl.points.length < 2) return
    pl.complete = true
    this._saveSnapshot()
    this._shapeLayer.drawHistory()
    this._notify()
  }

  /**
   * 当前是否正在绘制折线
   * @returns 有未 complete 的折线时 true
   */
  isPolylineActive(): boolean {
    if (!this._shapeLayer) return false
    if (this.mode !== 'polyline') return false
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1]
    return last && last.type === 'polyline' && !last.complete
  }

  /**
   * 获取当前选中的图形
   * @returns shapes 中 current 指向的图形浅引用，无选中时 null
   */
  getSelectedShape(): Shape | null {
    if (!this._shapeLayer) return null
    const idx = this._shapeLayer.current
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      return this._shapeLayer.shapes[idx]
    }
    return null
  }

  /**
   * 根据 name 获取分组配置
   * @param name - 分组名称
   * @returns 分组配置，不存在则 undefined
   */
  getGroup(name: string): Group | undefined {
    return this._groupMap[name]
  }

  /**
   * 修改当前选中图形的分组
   * @param color - 目标分组 name
   */
  setSelectedShapeGroup(color: string): void {
    if (!this._shapeLayer) return
    if (!this._groupMap[color]) return
    const idx = this._shapeLayer.current
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      this._shapeLayer.shapes[idx].group = color
      this._saveSnapshot()
      this._shapeLayer.drawHistory()
      this._notify()
    }
  }

  /** 删除当前选中的图形（保存快照，可撤销） */
  deleteSelected(): void {
    if (!this._shapeLayer) return
    const idx = this._shapeLayer.current
    if (idx < 0 || idx >= this._shapeLayer.shapes.length) return
    this._shapeLayer.shapes.splice(idx, 1)
    this._saveSnapshot()
    this._shapeLayer.current = -1
    this._shapeLayer.drawHistory()
    this._notify()
  }

  /**
   * 按索引选中图形（取消其他图形的选中状态）
   * @param idx - 图形索引，超出范围则取消所有选中
   */
  selectShapeByIndex(idx: number): void {
    if (!this._shapeLayer) return
    this._shapeLayer.shapes.forEach((s) => {
      s.current = false
    })
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      this._shapeLayer.shapes[idx].current = true
      this._shapeLayer.current = idx
    } else {
      this._shapeLayer.current = -1
    }
    this._shapeLayer.drawHistory()
    this._notify()
  }

  /**
   * 通过画布像素坐标选中图形
   * @param pixelX - 画布 X 坐标
   * @param pixelY - 画布 Y 坐标
   */
  selectShape(pixelX: number, pixelY: number): void {
    if (!this._shapeLayer) return
    this._shapeLayer.shapes.forEach((s) => {
      s.current = false
    })
    const idx = this._shapeLayer.hitTest(pixelX, pixelY)
    if (idx >= 0) {
      this._shapeLayer.shapes[idx].current = true
      this._shapeLayer.current = idx
    } else {
      this._shapeLayer.current = -1
    }
    this._shapeLayer.drawHistory()
    this._saveSnapshot()
  }

  /**
   * 获取所有图形的深拷贝
   * @returns 全部图形的深拷贝数组
   */
  getShapes(): Shape[] {
    if (!this._shapeLayer) return []
    return this._shapeLayer.shapes.map((s) => deepCopy(s))
  }

  /**
   * 获取当前视图元数据
   * @returns { scale, translateX, translateY, mode, group }
   */
  getMeta(): Meta {
    if (!this._shapeLayer) {
      return { scale: 1, translateX: 0, translateY: 0, mode: this.mode, group: this.currentGroup }
    }
    return {
      scale: this._shapeLayer.scale,
      translateX: this._shapeLayer.translateX,
      translateY: this._shapeLayer.translateY,
      mode: this.mode,
      group: this.currentGroup
    }
  }

  /**
   * 获取 shapes 末尾的最后一个图形（绘制中的折线/多边形）
   * @returns 末尾图形，空时 undefined
   */
  getLastShape(): Shape | undefined {
    if (!this._shapeLayer) return undefined
    return this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1]
  }

  /**
   * 替换全部图形（深拷贝），重置历史栈为仅当前状态
   * @param shapes - 新的图形数组
   */
  setShapes(shapes: Shape[]): void {
    if (!this._shapeLayer) return
    this._shapeLayer.shapes = deepCopy(shapes)
    this._shapeLayer.current = this._shapeLayer.shapes.findIndex((s) => s.current)
    this._shapeLayer.drawHistory()
    this._resetHistoryToCurrent()
  }

  /** 确保历史栈不为空（供外部初始化无操作时调用，避免 undo/redo 异常） */
  seedHistory(): void {
    this._seedHistory()
  }

  /* ---- Internal ---- */

  /** 触发 onChange 回调（同步，立即执行） */
  _notify(): void {
    this.onChange(this.getShapes(), this.getMeta())
  }

  /** 触发 onChange 回调（通过 rAF 去抖，用于高频调用场景如拖拽中） */
  _liveNotify(): void {
    if (this._rafId !== null) return
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null
      this.onChange(this.getShapes(), this.getMeta())
    })
  }

  /** 保存当前图形快照到历史栈（上限 100） */
  _saveSnapshot(): void {
    if (!this._shapeLayer) return
    if (this._historyIndex < this._historyStack.length - 1) {
      this._historyStack.length = this._historyIndex + 1
    }
    this._historyStack.push({
      shapes: deepCopy(this._shapeLayer.shapes),
      interactionMode: this.interactionMode,
      mode: this.mode
    })
    if (this._historyStack.length > 100) this._historyStack.shift()
    this._historyIndex = this._historyStack.length - 1
  }

  /** 确保初始快照存在（历史栈为空时写入） */
  _seedHistory(): void {
    if (!this._shapeLayer) return
    if (this._historyStack.length === 0) {
      this._historyStack.push({
        shapes: deepCopy(this._shapeLayer.shapes),
        interactionMode: this.interactionMode,
        mode: this.mode
      })
      this._historyIndex = 0
    }
  }

  /** 重置历史栈为仅包含当前状态（清空 undo/redo 历史） */
  _resetHistoryToCurrent(): void {
    if (!this._shapeLayer) return
    this._historyStack = [
      {
        shapes: deepCopy(this._shapeLayer.shapes),
        interactionMode: this.interactionMode,
        mode: this.mode
      }
    ]
    this._historyIndex = 0
  }

  /**
   * 根据鼠标位置和交互状态更新画布光标样式
   * draw 模式：crosshair；矩形手柄：resize/grab；图形上方：move/pointer
   * @param e - 鼠标事件
   */
  _setCursor(e: MouseEvent): void {
    if (!this._shapeLayer) return
    const canvas = this._shapeLayer.canvas
    if (this.interactionMode === 'draw') {
      canvas.style.cursor = 'crosshair'
      return
    }
    const s =
      this._shapeLayer.current >= 0 ? this._shapeLayer.shapes[this._shapeLayer.current] : null
    if (s && s.type === 'rect') {
      const h = this._shapeLayer.handleHit(e.offsetX, e.offsetY, true)
      const cursors: Record<string, string> = {
        TL: 'nwse-resize',
        BR: 'nwse-resize',
        TR: 'nesw-resize',
        BL: 'nesw-resize',
        T: 'ns-resize',
        B: 'ns-resize',
        L: 'ew-resize',
        R: 'ew-resize',
        ROTATE: 'grab'
      }
      if (cursors[h]) {
        canvas.style.cursor = cursors[h]
        return
      }
      if (this._shapeLayer.hitTest(e.offsetX, e.offsetY) >= 0) {
        canvas.style.cursor = 'move'
        return
      }
    }
    if (this._shapeLayer.hitTest(e.offsetX, e.offsetY) >= 0) {
      canvas.style.cursor = 'pointer'
      return
    }
    canvas.style.cursor = 'crosshair'
  }

  /* ---- Polygon helpers ---- */

  /**
   * 获取当前绘制中的多边形
   * @returns 最后一个未 complete 的 polygon，无则 null
   */
  _activePolygon(): PolygonShape | null {
    if (!this._shapeLayer) return null
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1]
    if (last && last.type === 'polygon' && !last.complete) return last as PolygonShape
    return null
  }

  /**
   * 获取当前绘制中的折线
   * @returns 最后一个未 complete 的 polyline，无则 null
   */
  _activePolyline(): PolylineShape | null {
    if (!this._shapeLayer) return null
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1]
    if (last && last.type === 'polyline' && !last.complete) return last as PolylineShape
    return null
  }

  /* ---- Event handlers ---- */

  /** 绑定鼠标事件处理器（返回解绑所需的引用），注册 mousedown/mousemove/mouseup/mouseout/wheel */
  _bindHandlers(): HandlerReturn {
    this._seedHistory()
    if (!this._shapeLayer) throw new Error('ShapeLayer not initialized')
    this._shapeLayer._groups = this._groupMap
    const self = this

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button === 2) {
        self._state.panning = true
        self._state.panStart = { x: e.offsetX, y: e.offsetY }
        return
      }
      if (e.button !== 0) return

      const handle = self._shapeLayer!.handleHit(e.offsetX, e.offsetY)

      if (self.readonly) {
        if (handle === 'OUT') {
          let hitIdx2 = self._shapeLayer!.hitTest(e.offsetX, e.offsetY)
          self._shapeLayer!.shapes.forEach((s) => {
            s.current = false
          })
          if (hitIdx2 >= 0) {
            self._shapeLayer!.shapes[hitIdx2].current = true
            self._shapeLayer!.current = hitIdx2
          } else {
            self._shapeLayer!.current = -1
          }
          self._shapeLayer!.drawHistory()
          self._notify()
        }
        return
      }

      if (handle === 'ROTATE') {
        self._state.rotating = true
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY)
        const handleAngle = s.rotation - Math.PI / 2
        const clickAngle = Math.atan2(img.y - s.y, img.x - s.x)
        self._state.rotateStartAngle = clickAngle
        self._state.rotateCache = { rotation: s.rotation }
        self._state.offsetAngle = normalizeAngle(clickAngle - handleAngle)
        return
      }
      if (handle !== 'OUT' && !self._state.drawing && !self._state.dragging) {
        self._state.resizing = true
        self._state.resizeDirection = handle
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape
        self._state.resizeCache = { x: s.x, y: s.y, w: s.w, h: s.h, rotation: s.rotation }
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY)
        self._state.resizeStartLocal = self._shapeLayer!._toLocal(img.x, img.y, s)
        return
      }

      let hitIdx = -1
      let vertexIdx = -1

      if (self.interactionMode === 'draw') {
        const poly = self._activePolygon() || self._activePolyline()
        if (poly && poly.points.length > 0) {
          const pts = poly.points
          for (let j = 0; j < pts.length; j++) {
            const p = self._shapeLayer!.toCanvas(pts[j].x, pts[j].y)
            if (Math.hypot(e.offsetX - p.x, e.offsetY - p.y) <= 6) {
              hitIdx = self._shapeLayer!.shapes.length - 1
              vertexIdx = j
              break
            }
          }
        }
      } else {
        const vhit = self._shapeLayer!.vertexHitTest(e.offsetX, e.offsetY)
        if (vhit) {
          hitIdx = vhit.shapeIdx
          vertexIdx = vhit.vertexIdx
        } else {
          hitIdx = self._shapeLayer!.hitTest(e.offsetX, e.offsetY)
        }
      }
      if (e.ctrlKey && self.interactionMode === 'select') {
        const shapeHit = self._shapeLayer!.hitTest(e.offsetX, e.offsetY)
        if (shapeHit >= 0) {
          const insertIdx = self._shapeLayer!.findEdgeInsertIndex(e.offsetX, e.offsetY, shapeHit)
          if (insertIdx !== null) {
            const s = self._shapeLayer!.shapes[shapeHit]
            if (s.type === 'polygon' || s.type === 'polyline') {
              const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY)
              s.points.splice(insertIdx, 0, { x: imgPt.x, y: imgPt.y })
              self._saveSnapshot()
              self._shapeLayer!.drawHistory()
              self._notify()
              return
            }
          }
        }
      }
      if (hitIdx >= 0) {
        self._shapeLayer!.shapes.forEach((s) => {
          s.current = false
        })
        self._shapeLayer!.shapes[hitIdx].current = true
        self._shapeLayer!.current = hitIdx

        self._state.dragging = true
        self._state.dragIdx = hitIdx
        self._state.dragVertexIdx = vertexIdx
        self._state.dragStart = { x: e.offsetX, y: e.offsetY }
        self._state.dragCache = deepCopy(self._shapeLayer!.shapes[hitIdx]) as DragCache
        self._shapeLayer!.drawHistory()
        self._notify()
        return
      }

      if (self.interactionMode !== 'draw' && self._shapeLayer!.current >= 0) {
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current]
        if (s) s.current = false
        self._shapeLayer!.current = -1
        self._shapeLayer!.drawHistory()
        self._notify()
        return
      }

      if (self.interactionMode !== 'draw') return

      self._state.drawing = true
      const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY)

      if (self.mode === 'rect') {
        self._state.drawStart = imgPt
      } else if (self.mode === 'point') {
        self._shapeLayer!.addShape({
          type: 'point',
          x: imgPt.x,
          y: imgPt.y,
          group: self.currentGroup
        })
        self._shapeLayer!.drawHistory()
        self._saveSnapshot()
        self._notify()
      } else if (self.mode === 'polyline') {
        const pl = self._activePolyline()
        if (!pl) {
          self._shapeLayer!.addShape({
            type: 'polyline',
            points: [{ x: imgPt.x, y: imgPt.y }],
            complete: false,
            group: self.currentGroup
          })
        } else {
          pl.points.push({ x: imgPt.x, y: imgPt.y })
        }
        self._shapeLayer!.drawHistory()
        self._saveSnapshot()
        self._notify()
      } else if (self.mode === 'polygon') {
        const poly = self._activePolygon()
        if (!poly) {
          self._shapeLayer!.addShape({
            type: 'polygon',
            points: [{ x: imgPt.x, y: imgPt.y }],
            complete: false,
            group: self.currentGroup
          })
        } else {
          poly.points.push({ x: imgPt.x, y: imgPt.y })
        }
        self._shapeLayer!.drawHistory()
        self._saveSnapshot()
        self._notify()
      }
    }

    const onMouseMove = (e: MouseEvent): void => {
      if (self._state.panning) {
        const dx = self._state.panStart!.x - e.offsetX
        const dy = self._state.panStart!.y - e.offsetY
        self._imageLayer!.pan(dx, dy)
        self._shapeLayer!.pan(dx, dy)
        self._state.panStart = { x: e.offsetX, y: e.offsetY }
        return
      }

      if (self.readonly) return

      if (self._state.rotating) {
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY)
        const currentAngle = Math.atan2(img.y - s.y, img.x - s.x)
        const rawDelta = currentAngle - self._state.rotateStartAngle!
        const delta = normalizeAngle(rawDelta)
        s.rotation = normalizeAngle(
          self._state.rotateCache!.rotation + delta - self._state.offsetAngle!
        )
        self._shapeLayer!.drawHistory(e)
        self._setCursor(e)
        self._liveNotify()
        return
      }

      if (self._state.resizing) {
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape
        const c = self._state.resizeCache!
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY)
        // _toLocal 必须基于缓存的原始中心计算，避免每帧用被修改后的 s 做原点导致累积偏移
        const cos_n = Math.cos(-c.rotation),
          sin_n = Math.sin(-c.rotation)
        const dx_img = img.x - c.x,
          dy_img = img.y - c.y
        const local = { x: dx_img * cos_n - dy_img * sin_n, y: dx_img * sin_n + dy_img * cos_n }
        const dX = local.x - self._state.resizeStartLocal!.x
        const dY = local.y - self._state.resizeStartLocal!.y
        const r = self._state.resizeDirection

        let dcx = 0,
          dcy = 0,
          newW = c.w,
          newH = c.h
        if (r.indexOf('L') >= 0) {
          newW = c.w - dX
          dcx = dX / 2
        }
        if (r.indexOf('R') >= 0) {
          newW = c.w + dX
          dcx = dX / 2
        }
        if (r.indexOf('T') >= 0) {
          newH = c.h - dY
          dcy = dY / 2
        }
        if (r.indexOf('B') >= 0) {
          newH = c.h + dY
          dcy = dY / 2
        }

        if (newW < 5 || newH < 5) return

        const cos = Math.cos(s.rotation),
          sin = Math.sin(s.rotation)
        s.x = c.x + dcx * cos - dcy * sin
        s.y = c.y + dcx * sin + dcy * cos
        s.w = newW
        s.h = newH
        self._shapeLayer!.drawHistory(e)
        self._setCursor(e)
        self._liveNotify()
        return
      }

      if (self._state.dragging) {
        const dImgX = (self._state.dragStart!.x - e.offsetX) / self._shapeLayer!.scale
        const dImgY = (self._state.dragStart!.y - e.offsetY) / self._shapeLayer!.scale
        const s = self._shapeLayer!.shapes[self._state.dragIdx]
        const c = self._state.dragCache!
        if (s.type === 'rect') {
          s.x = c.x - dImgX
          s.y = c.y - dImgY
        } else if (s.type === 'point') {
          s.x = c.x - dImgX
          s.y = c.y - dImgY
        } else if (s.type === 'polyline' || s.type === 'polygon') {
          if (self._state.dragVertexIdx >= 0) {
            s.points[self._state.dragVertexIdx].x = c.points![self._state.dragVertexIdx].x - dImgX
            s.points[self._state.dragVertexIdx].y = c.points![self._state.dragVertexIdx].y - dImgY
          } else {
            for (let j = 0; j < s.points.length; j++) {
              s.points[j].x = c.points![j].x - dImgX
              s.points[j].y = c.points![j].y - dImgY
            }
          }
        }
        self._shapeLayer!.drawHistory(e)
        self._liveNotify()
        return
      }

      if (self._state.drawing && self.mode === 'rect') {
        const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY)
        self._shapeLayer!.drawLiveRect(
          self._state.drawStart!.x,
          self._state.drawStart!.y,
          imgPt.x,
          imgPt.y
        )
        return
      }

      self._shapeLayer!.drawHistory(e)
      self._setCursor(e)
    }

    const onMouseUp = (e: MouseEvent): void => {
      if (self._state.panning) {
        self._state.panning = false
        self._state.panStart = null
        self._notify()
        return
      }

      if (self._state.rotating) {
        self._state.rotating = false
        self._state.rotateCache = null
        self._state.rotateStartAngle = null
        self._state.offsetAngle = null
        self._shapeLayer!.drawHistory()
        self._saveSnapshot()
        self._notify()
        return
      }

      if (self._state.resizing) {
        self._state.resizing = false
        self._state.resizeDirection = 'OUT'
        self._state.resizeCache = null
        self._state.resizeStartLocal = null
        self._shapeLayer!.drawHistory()
        self._saveSnapshot()
        self._notify()
        return
      }

      if (self._state.dragging) {
        self._state.dragging = false
        self._state.dragIdx = -1
        self._state.dragVertexIdx = -1
        self._state.dragCache = null
        self._state.dragStart = null
        self._shapeLayer!.drawHistory()
        self._saveSnapshot()
        self._notify()
        return
      }

      if (self._state.drawing && self.mode === 'rect') {
        const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY)
        const start = self._state.drawStart!
        const end = imgPt
        if (Math.abs(start.x - end.x) > 2 && Math.abs(start.y - end.y) > 2) {
          self._shapeLayer!.addShape({
            type: 'rect',
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
            w: Math.abs(end.x - start.x),
            h: Math.abs(end.y - start.y),
            rotation: 0,
            group: self.currentGroup
          })
          self._saveSnapshot()
          self._notify()
        }
        self._shapeLayer!.clearLiveRect()
        self._state.drawing = false
        self._state.drawStart = null
        self._shapeLayer!.drawHistory()
        return
      }

      if (self._state.drawing) {
        self._state.drawing = false
      }
    }

    const onMouseLeave = (e: MouseEvent): void => {
      onMouseUp(e)
    }

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      self.zoom(e.deltaY < 0 ? 0.1 : -0.1)
    }

    return { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onWheel }
  }

  /**
   * 加载新图片到底图层
   * @param src - 图片 URL
   * @returns 加载完成时 resolve
   */
  loadImage(src: string): Promise<void> {
    return this._imageLayer!.loadImage(src).then(() => this.resetView())
  }

  /**
   * 加载图形和视图状态（loadAnnotationState 的别名）
   * @param shapes - 图形数组
   * @param meta - 视图元数据
   */
  loadShapes(shapes: Shape[], meta: Meta): void {
    this.loadAnnotationState(shapes, meta)
  }

  /**
   * 加载标注状态（图形 + 视图），重置历史
   * @param shapes - 图形数组
   * @param meta - 视图元数据（scale / translate / mode / group）
   */
  loadAnnotationState(shapes: Shape[], meta: Meta): void {
    if (this._shapeLayer) {
      this._shapeLayer.shapes = deepCopy(shapes)
      this._shapeLayer.current = this._shapeLayer.shapes.findIndex((s) => s.current)
      // 注释掉以保持当前视口不变，避免缩放/平移后加载数据时背景图错位
      // this._shapeLayer.scale = meta.scale
      // this._shapeLayer.translateX = meta.translateX
      // this._shapeLayer.translateY = meta.translateY
      this.mode = meta.mode || this.mode
      this._shapeLayer.mode = this.mode
      if (meta.group && this._groupMap[meta.group]) {
        this.currentGroup = meta.group
        this._shapeLayer._group = meta.group
      }
      this._shapeLayer.drawHistory()
      this._resetHistoryToCurrent()
    }
  }

  /** 重置缩放为 1× 并归零平移（同时恢复 ImageLayer 和 ShapeLayer 的视口） */
  resetView(): void {
    this._imageLayer?.zoom(1)
    this._imageLayer?.pan(0, 0)
    if (this._shapeLayer) {
      this._shapeLayer.scale = 1
      this._shapeLayer.translateX = 0
      this._shapeLayer.translateY = 0
      this._shapeLayer.drawHistory()
    }
  }

  /** 解绑所有鼠标事件监听，销毁控制器（用于组件卸载前清理） */
  destroy(): void {
    if (!this._shapeLayer || !this._boundHandlers) return
    const c = this._shapeLayer.canvas
    const h = this._boundHandlers
    c.removeEventListener('mousedown', h.onMouseDown)
    c.removeEventListener('mousemove', h.onMouseMove)
    c.removeEventListener('mouseup', h.onMouseUp)
    c.removeEventListener('mouseout', h.onMouseLeave)
    c.removeEventListener('wheel', h.onWheel)
  }
}
