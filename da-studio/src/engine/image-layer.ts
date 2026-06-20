/** 图像渲染层，负责加载和绘制底图，支持缩放与平移 */
export class ImageLayer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  img: HTMLImageElement | null
  scale: number
  translateX: number
  translateY: number

  /**
   * @param canvas - 目标画布元素
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2d context')
    this.ctx = ctx
    this.img = null
    this.scale = 1
    this.translateX = 0
    this.translateY = 0
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

  /** 内部重绘：清空画布 → 按当前 translate + scale 绘制图片 */
  _draw(): void {
    this.clear()
    this.ctx.save()
    this.ctx.translate(-this.translateX * this.scale, -this.translateY * this.scale)
    this.ctx.scale(this.scale, this.scale)
    if (this.img) {
      this.ctx.drawImage(this.img, 0, 0)
    }
    this.ctx.restore()
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
    this.scale = multi
    this._draw()
  }

  /**
   * 平移视口
   * @param dx - 画布像素偏移量（水平）
   * @param dy - 画布像素偏移量（垂直）
   */
  pan(dx: number, dy: number): void {
    this.translateX += dx / this.scale
    this.translateY += dy / this.scale
    this._draw()
  }
}
