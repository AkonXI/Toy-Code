export class ImageLayer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  img: HTMLImageElement | null
  scale: number
  translateX: number
  translateY: number

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

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  zoom(multi: number): void {
    this.scale = multi
    this._draw()
  }

  pan(dx: number, dy: number): void {
    this.translateX += dx / this.scale
    this.translateY += dy / this.scale
    this._draw()
  }
}
