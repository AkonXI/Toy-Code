import type { Point } from './types'

export class Viewport {
  private _scale = 1
  private _translateX = 0
  private _translateY = 0

  onChange: (() => void) | null = null

  get scale(): number {
    return this._scale
  }
  get translateX(): number {
    return this._translateX
  }
  get translateY(): number {
    return this._translateY
  }

  zoom(multi: number): void {
    this._scale = multi
    this.onChange?.()
  }

  pan(dx: number, dy: number): void {
    this._translateX += dx / this._scale
    this._translateY += dy / this._scale
    this.onChange?.()
  }

  reset(): void {
    this._batch(() => {
      this._scale = 1
      this._translateX = 0
      this._translateY = 0
    })
  }

  setTransform(scale: number, translateX: number, translateY: number): void {
    this._batch(() => {
      this._scale = scale
      this._translateX = translateX
      this._translateY = translateY
    })
  }

  toImage(px: number, py: number): Point {
    return { x: px / this._scale + this._translateX, y: py / this._scale + this._translateY }
  }

  toCanvas(ix: number, iy: number): Point {
    return { x: (ix - this._translateX) * this._scale, y: (iy - this._translateY) * this._scale }
  }

  private _batch(fn: () => void): void {
    fn()
    this.onChange?.()
  }
}
