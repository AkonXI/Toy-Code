import type { Point } from './types'

/**
 * 共享视口状态 — 统一管理 scale / translateX / translateY，
 * 通过 onChange 回调由 Controller 统一调度图层重绘
 */
export class Viewport {
  private _scale = 1
  private _translateX = 0
  private _translateY = 0

  /** 视口变更回调（由 Controller 注册，调度图层重绘） */
  onChange: (() => void) | null = null

  /** @returns 当前缩放倍数 */
  get scale(): number {
    return this._scale
  }
  /** @returns 当前 X 平移量（图像坐标） */
  get translateX(): number {
    return this._translateX
  }
  /** @returns 当前 Y 平移量（图像坐标） */
  get translateY(): number {
    return this._translateY
  }

  /**
   * 设置缩放倍数并通知
   * @param multi - 新的缩放倍数
   */
  zoom(multi: number): void {
    this._scale = multi
    this.onChange?.()
  }

  /**
   * 平移视口并通知
   * @param dx - 画布像素偏移（水平）
   * @param dy - 画布像素偏移（垂直）
   */
  pan(dx: number, dy: number): void {
    this._translateX += dx / this._scale
    this._translateY += dy / this._scale
    this.onChange?.()
  }

  /** 重置缩放为 1×，平移归零（通知只发一次） */
  reset(): void {
    this._batch(() => {
      this._scale = 1
      this._translateX = 0
      this._translateY = 0
    })
  }

  /**
   * 同时设置缩放和平移（通知只发一次，用于动画等场景）
   * @param scale - 新的缩放倍数
   * @param translateX - 新的 X 平移
   * @param translateY - 新的 Y 平移
   */
  setTransform(scale: number, translateX: number, translateY: number): void {
    this._batch(() => {
      this._scale = scale
      this._translateX = translateX
      this._translateY = translateY
    })
  }

  /**
   * 画布像素坐标 → 图像坐标
   * @param px - 画布 X
   * @param py - 画布 Y
   * @returns 图像坐标系下的 Point
   */
  toImage(px: number, py: number): Point {
    return { x: px / this._scale + this._translateX, y: py / this._scale + this._translateY }
  }

  /**
   * 图像坐标 → 画布像素坐标
   * @param ix - 图像 X
   * @param iy - 图像 Y
   * @returns 画布像素坐标系下的 Point
   */
  toCanvas(ix: number, iy: number): Point {
    return { x: (ix - this._translateX) * this._scale, y: (iy - this._translateY) * this._scale }
  }

  private _batch(fn: () => void): void {
    fn()
    this.onChange?.()
  }
}
