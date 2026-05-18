import { buildGroupMap, DEFAULT_GROUPS } from './utils';
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
} from './types';

export class ShapeLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  shapes: Shape[];
  current: number;
  scale: number;
  translateX: number;
  translateY: number;
  _groups: Record<string, Group>;
  _defaultGroup: Group;
  _group: string;
  _mode: string;
  _liveRect: RectShape | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');
    this.ctx = ctx;
    this.shapes = [];
    this.current = -1;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this._groups = buildGroupMap(DEFAULT_GROUPS);
    this._defaultGroup = DEFAULT_GROUPS[0];
    this._group = DEFAULT_GROUPS[0].name;
    this._mode = 'rect';
    this._liveRect = null;
  }

  set mode(v: string) { this._mode = v; }
  get mode(): string { return this._mode; }

  /* ---- Coordinate helpers ---- */

  toImage(px: number, py: number): Point {
    return { x: px / this.scale + this.translateX, y: py / this.scale + this.translateY };
  }

  toCanvas(ix: number, iy: number): Point {
    return { x: (ix - this.translateX) * this.scale, y: (iy - this.translateY) * this.scale };
  }

  /* ---- Viewport transforms ---- */

  zoom(multi: number): void { this.scale = multi; this.drawHistory(); }

  pan(dx: number, dy: number): void {
    this.translateX += dx / this.scale;
    this.translateY += dy / this.scale;
    this.drawHistory();
  }

  /* ---- Shape management ---- */

  addShape(shape: Shape): void { this.shapes.push(shape); }
  popShape(): void { this.shapes.pop(); }
  clearAll(): void {
    this.shapes = [];
    this.current = -1;
    this.drawHistory();
  }

  /* ---- Local space helper for rotated rects ---- */

  _toLocal(ix: number, iy: number, shape: RectShape): Point {
    const dx = ix - shape.x;
    const dy = iy - shape.y;
    const cos = Math.cos(-shape.rotation);
    const sin = Math.sin(-shape.rotation);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  _fromLocal(lx: number, ly: number, shape: RectShape): Point {
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    return {
      x: shape.x + lx * cos - ly * sin,
      y: shape.y + lx * sin + ly * cos,
    };
  }

  /* ---- Hit testing ---- */

  hitTest(pixelX: number, pixelY: number): number {
    const img = this.toImage(pixelX, pixelY);
    const len = this.shapes.length;
    for (let i = len - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (s.type === 'rect') {
        const local = this._toLocal(img.x, img.y, s);
        const hw = s.w / 2, hh = s.h / 2;
        if (local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh) return i;
      } else if (s.type === 'point') {
        const p = this.toCanvas(s.x, s.y);
        if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) return i;
      } else if (s.type === 'polyline') {
        if (this._hitPolyline(pixelX, pixelY, s.points)) return i;
      } else if (s.type === 'polygon') {
        if (s.complete && this._pointInPolygon(img.x, img.y, s.points)) return i;
        if (!s.complete && this._hitPolyline(pixelX, pixelY, s.points)) return i;
      }
    }
    return -1;
  }

  vertexHitTest(pixelX: number, pixelY: number): VertexHit | null {
    const len = this.shapes.length;
    for (let i = len - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (s.type !== 'polyline' && s.type !== 'polygon') continue;
      const pts = s.points;
      for (let j = 0; j < pts.length; j++) {
        const p = this.toCanvas(pts[j].x, pts[j].y);
        if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) {
          return { shapeIdx: i, vertexIdx: j };
        }
      }
    }
    return null;
  }

  _hitPolyline(pixelX: number, pixelY: number, points: Point[]): boolean {
    for (let j = 0; j < points.length; j++) {
      const p = this.toCanvas(points[j].x, points[j].y);
      if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) return true;
    }
    for (let j = 0; j < points.length - 1; j++) {
      if (this._hitSegment(pixelX, pixelY, points[j], points[j + 1])) return true;
    }
    return false;
  }

  _hitSegment(px: number, py: number, a: Point, b: Point): boolean {
    const pa = this.toCanvas(a.x, a.y);
    const pb = this.toCanvas(b.x, b.y);
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - pa.x, py - pa.y) <= 6;
    let t = ((px - pa.x) * dx + (py - pa.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const nx = pa.x + t * dx, ny = pa.y + t * dy;
    return Math.hypot(px - nx, py - ny) <= 6;
  }

  _pointInPolygon(px: number, py: number, points: Point[]): boolean {
    let inside = false;
    const n = points.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = points[i].y, yj = points[j].y;
      if ((yi > py) !== (yj > py) &&
          px < (points[j].x - points[i].x) * (py - yi) / (yj - yi) + points[i].x) {
        inside = !inside;
      }
    }
    return inside;
  }

  handleHit(pixelX: number, pixelY: number, readOnly = false): Handle {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i] as RectShape;
      if (s.type !== 'rect') continue;

      const img = this.toImage(pixelX, pixelY);
      const local = this._toLocal(img.x, img.y, s);
      const hw = s.w / 2, hh = s.h / 2;

      const cr = 7 / this.scale;
      const er = 6 / this.scale;
      const rr = 6 / this.scale;

      let handle: Handle = 'OUT';

      if (Math.hypot(local.x + hw, local.y + hh) <= cr) handle = 'TL';
      else if (Math.hypot(local.x - hw, local.y + hh) <= cr) handle = 'TR';
      else if (Math.hypot(local.x + hw, local.y - hh) <= cr) handle = 'BL';
      else if (Math.hypot(local.x - hw, local.y - hh) <= cr) handle = 'BR';
      else if (Math.hypot(local.x, local.y + hh) <= er) handle = 'T';
      else if (Math.hypot(local.x, local.y - hh) <= er) handle = 'B';
      else if (Math.hypot(local.x + hw, local.y) <= er) handle = 'L';
      else if (Math.hypot(local.x - hw, local.y) <= er) handle = 'R';
      else {
        const rotHy = -hh - 22 / this.scale;
        if (Math.hypot(local.x, local.y - rotHy) <= rr) handle = 'ROTATE';
      }

      if (handle !== 'OUT') {
        if (!readOnly) {
          this.shapes.forEach(shape => { shape.current = false; });
          s.current = true;
          this.current = i;
        }
        return handle;
      }
    }
    return 'OUT';
  }

  /* ---- Drawing ---- */

  drawHistory(e?: MouseEvent): void {
    const hitIdx = e ? this.hitTest(e.offsetX, e.offsetY) : -1;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = 0; i < this.shapes.length; i++) {
      this._paintShape(i, this.shapes[i], i === hitIdx);
    }
    this._paintLiveRect();
  }

  _paintShape(i: number, s: Shape, highlight: boolean): void {
    if (s.type === 'rect') this._paintRect(s, highlight);
    else if (s.type === 'point') this._paintPoint(s, i, highlight);
    else if (s.type === 'polyline') this._paintPolyline(s, i, highlight);
    else if (s.type === 'polygon') this._paintPolygon(s, i, highlight);
  }

  _paintRect(s: RectShape, highlight: boolean): void {
    const cx = (s.x - this.translateX) * this.scale;
    const cy = (s.y - this.translateY) * this.scale;
    const cw = s.w * this.scale;
    const ch = s.h * this.scale;
    const c = this._groups[s.group] || this._defaultGroup;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(s.rotation || 0);

    if (highlight) {
      this.ctx.fillStyle = c.fillHover;
      this.ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    }
    if (s.current) {
      this.ctx.fillStyle = c.fill;
      this.ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    }
    this.ctx.strokeStyle = c.stroke;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);

    if (s.current) {
      this._paintHandles(cw, ch, c);
    }

    this.ctx.restore();
  }

  _paintHandles(cw: number, ch: number, c: Group): void {
    const hw = cw / 2, hh = ch / 2;

    const edges = [{ x: 0, y: -hh }, { x: 0, y: hh }, { x: -hw, y: 0 }, { x: hw, y: 0 }];
    for (const e of edges) {
      this.ctx.beginPath();
      this.ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fff';
      this.ctx.fill();
      this.ctx.strokeStyle = c.stroke;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    const corners = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: -hw, y: hh }, { x: hw, y: hh }];
    for (const corner of corners) {
      this.ctx.beginPath();
      this.ctx.arc(corner.x, corner.y, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fff';
      this.ctx.fill();
      this.ctx.strokeStyle = c.stroke;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    const ry = -hh - 20;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -hh);
    this.ctx.lineTo(0, ry);
    this.ctx.strokeStyle = c.stroke;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, ry, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#fff';
    this.ctx.fill();
    this.ctx.strokeStyle = c.stroke;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
  }

  _paintPoint(s: PointShape, i: number, highlight: boolean): void {
    const p = this.toCanvas(s.x, s.y);
    const c = this._groups[s.group] || this._defaultGroup;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, (highlight || s.current) ? 7 : 5, 0, Math.PI * 2);
    if (s.current) {
      this.ctx.fillStyle = c.fill;
    } else {
      this.ctx.fillStyle = highlight ? c.fillHover : c.stroke;
    }
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.fillText(String(i + 1), p.x + 8, p.y - 8);
  }

  _paintPolyline(s: PolylineShape, _i: number, highlight: boolean): void {
    const pts = s.points;
    const c = this._groups[s.group] || this._defaultGroup;
    for (let j = 0; j < pts.length; j++) {
      const p = this.toCanvas(pts[j].x, pts[j].y);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, (highlight || s.current) ? 7 : 5, 0, Math.PI * 2);
      if (s.current) {
        this.ctx.fillStyle = c.fill;
      } else {
        this.ctx.fillStyle = highlight ? c.fillHover : c.stroke;
      }
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.fillText(String(j + 1), p.x + 7, p.y - 7);
    }
    if (pts.length > 1) {
      this.ctx.beginPath();
      const p0 = this.toCanvas(pts[0].x, pts[0].y);
      this.ctx.moveTo(p0.x, p0.y);
      for (let j = 1; j < pts.length; j++) {
        const p = this.toCanvas(pts[j].x, pts[j].y);
        this.ctx.lineTo(p.x, p.y);
      }
      this.ctx.strokeStyle = c.stroke;
      this.ctx.lineWidth = highlight ? 3 : 2;
      if (s.complete === false) this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  _paintPolygon(s: PolygonShape, _i: number, highlight: boolean): void {
    const pts = s.points;
    if (pts.length < 2) return;
    const c = this._groups[s.group] || this._defaultGroup;

    this.ctx.beginPath();
    const p0 = this.toCanvas(pts[0].x, pts[0].y);
    this.ctx.moveTo(p0.x, p0.y);
    for (let j = 1; j < pts.length; j++) {
      const p = this.toCanvas(pts[j].x, pts[j].y);
      this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.closePath();
    if (highlight) {
      this.ctx.fillStyle = c.fillHover;
    } else if (s.current) {
      this.ctx.fillStyle = c.fill;
    } else {
      this.ctx.fillStyle = 'rgba(0,0,0,0.04)';
    }
    this.ctx.fill();
    this.ctx.strokeStyle = c.stroke;
    this.ctx.lineWidth = 2;
    if (!s.complete) this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    for (let j = 0; j < pts.length; j++) {
      const p = this.toCanvas(pts[j].x, pts[j].y);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, (highlight || s.current) ? 7 : 5, 0, Math.PI * 2);
      if (s.current) {
        this.ctx.fillStyle = c.fill;
      } else {
        this.ctx.fillStyle = highlight ? c.fillHover : c.stroke;
      }
      this.ctx.fill();
      this.ctx.strokeStyle = highlight && !s.current ? c.stroke : '#fff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.fillText(String(j + 1), p.x + 7, p.y - 7);
    }
  }

  /* ---- Live rect drawing ---- */

  _paintLiveRect(): void {
    if (!this._liveRect) return;
    const s = this._liveRect;
    const cx = (s.x - this.translateX) * this.scale;
    const cy = (s.y - this.translateY) * this.scale;
    const cw = s.w * this.scale;
    const ch = s.h * this.scale;

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(s.rotation || 0);
    this.ctx.strokeStyle = (this._groups[this._group] || this._defaultGroup).stroke;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  drawLiveRect(sx: number, sy: number, ex: number, ey: number): void {
    this._liveRect = {
      type: 'rect',
      x: (sx + ex) / 2,
      y: (sy + ey) / 2,
      w: Math.abs(ex - sx),
      h: Math.abs(ey - sy),
      rotation: 0,
      group: this._group,
    };
    this.drawHistory();
  }

  clearLiveRect(): void {
    this._liveRect = null;
  }
}
