import type { Viewport } from './viewport'

/** 图像渲染层，负责加载和绘制底图，支持缩放与平移 */
export class ImageLayer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  img: HTMLImageElement | null
  _viewport: Viewport

  /**
   * @param canvas - 目标画布元素
   * @param viewport - 共享视口
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

  /** 内部重绘：清空画布 → 仅裁剪当前视口内的图像部分绘制 */
  _draw(): void {
    this.clear()
    if (!this.img) return
    const { scale, translateX, translateY } = this._viewport
    const imgW = this.img.width
    const imgH = this.img.height
    const vw = this.canvas.width / scale
    const vh = this.canvas.height / scale

    const sx = Math.max(0, translateX)
    const sy = Math.max(0, translateY)
    const sw = Math.min(imgW - sx, vw)
    const sh = Math.min(imgH - sy, vh)
    if (sw <= 0 || sh <= 0) return

    const dx = Math.max(0, -translateX * scale)
    const dy = Math.max(0, -translateY * scale)
    const dw = sw * scale
    const dh = sh * scale

    this.ctx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh)
  }

  /** 清空整个画布 */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
