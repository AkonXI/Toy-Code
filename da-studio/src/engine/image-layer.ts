import { Viewport } from './viewport'

/** 图像渲染层，负责加载和绘制底图，支持缩放与平移 */
export class ImageLayer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  img: HTMLImageElement | null
  _viewport: Viewport

  /**
   * @param canvas - 目标画布元素
   * @param viewport - 视口状态
   */
  constructor(canvas: HTMLCanvasElement, viewport: Viewport) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2d context')
    this.ctx = ctx
    this.img = null
    this._viewport = viewport
  }

  /**
   * 加载图片并初始化画布尺寸
   * @param src - 图片 URL
   * @returns 加载完成的 Image 元素
   */
  loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        this.img = img
        this.canvas.width = 600
        this.canvas.height = 600
        this._draw()
        resolve(img)
      }
      img.onerror = reject
    })
  }

  /** 内部重绘：清空画布 → 按 transform 绘制整张图片（不裁剪） */
  _draw(): void {
    this.clear()
    if (!this.img) return
    this.ctx.save()
    this.ctx.translate(
      -this._viewport.translateX * this._viewport.scale,
      -this._viewport.translateY * this._viewport.scale
    )
    this.ctx.scale(this._viewport.scale, this._viewport.scale)
    this.ctx.drawImage(this.img, 0, 0)
    this.ctx.restore()
  }

  /** 触发视口重绘（由 Viewport.onChange 回调调用） */
  redraw(): void {
    this._draw()
  }

  /** 清空整个画布 */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * 设置缩放倍率并重绘
   * @param multi - 缩放倍数（1 = 原始大小）
   */
  zoom(multi: number): void {
    this._viewport.zoom(multi)
  }

  /**
   * 平移视口
   * @param dx - 画布像素偏移量（水平）
   * @param dy - 画布像素偏移量（垂直）
   */
  pan(dx: number, dy: number): void {
    this._viewport.pan(dx, dy)
  }
}
