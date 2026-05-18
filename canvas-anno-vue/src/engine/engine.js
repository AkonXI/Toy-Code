/**
 * Canvas Annotation Engine v2
 * Pure JavaScript, no framework dependencies.
 *
 * Modes: rect (with rotation handles), point, polyline, polygon
 * Features: zoom, pan, draw, drag, resize, rotate,
 *           undo/redo (snapshot-based single stack), delete selected,
 *           configurable color groups (1-4 groups)
 */

const DEFAULT_GROUPS = [
  { name: 'red',    stroke: '#e53935', fill: 'rgba(229,57,53,0.12)', fillHover: 'rgba(229,57,53,0.04)', label: '红' },
  { name: 'yellow', stroke: '#f9a825', fill: 'rgba(249,168,37,0.12)', fillHover: 'rgba(249,168,37,0.04)', label: '黄' },
  { name: 'blue',   stroke: '#1e88e5', fill: 'rgba(30,136,229,0.12)', fillHover: 'rgba(30,136,229,0.04)', label: '蓝' },
  { name: 'green',  stroke: '#43a047', fill: 'rgba(67,160,71,0.12)', fillHover: 'rgba(67,160,71,0.04)', label: '绿' },
];

function buildGroupMap(groups) {
  const map = {};
  groups.forEach(g => { map[g.name] = g; });
  return map;
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ========================================================================
 *  ImageLayer — renders the background image with zoom/pan support
 * ======================================================================== */
class ImageLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.img = null;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.img = img;
        this.canvas.width = 600;
        this.canvas.height = 600;
        this._draw();
        resolve(img);
      };
      img.onerror = reject;
    });
  }

  _draw() {
    this.clear();
    this.ctx.save();
    this.ctx.translate(-this.translateX * this.scale, -this.translateY * this.scale);
    this.ctx.scale(this.scale, this.scale);
    if (this.img) {
      this.ctx.drawImage(this.img, 0, 0);
    }
    this.ctx.restore();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  zoom(multi) {
    this.scale = multi;
    this._draw();
  }

  pan(dx, dy) {
    this.translateX += dx / this.scale;
    this.translateY += dy / this.scale;
    this._draw();
  }
}

/* ========================================================================
 *  ShapeLayer — renders annotations on a transparent overlay canvas
 * ======================================================================== */
class ShapeLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.shapes = [];
    this.current = -1;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this._groups = buildGroupMap(DEFAULT_GROUPS);
    this._defaultGroup = DEFAULT_GROUPS[0];
    this._group = DEFAULT_GROUPS[0].name;
    this._mode = 'rect';
  }

  set mode(v) { this._mode = v; }
  get mode() { return this._mode; }

  /* ---- Coordinate helpers ---- */

  /** Canvas pixel → image (world) space */
  toImage(px, py) {
    return { x: px / this.scale + this.translateX, y: py / this.scale + this.translateY };
  }

  /** Image (world) space → Canvas pixel */
  toCanvas(ix, iy) {
    return { x: (ix - this.translateX) * this.scale, y: (iy - this.translateY) * this.scale };
  }

  /* ---- Viewport transforms ---- */

  zoom(multi) { this.scale = multi; this.drawHistory(); }
  pan(dx, dy) {
    this.translateX += dx / this.scale;
    this.translateY += dy / this.scale;
    this.drawHistory();
  }

  /* ---- Shape management ---- */

  addShape(shape) { this.shapes.push(shape); }
  popShape() { this.shapes.pop(); }
  clearAll() {
    this.shapes = [];
    this.current = -1;
    this.drawHistory();
  }

  /* ---- Local space helper for rotated rects ---- */

  /** Convert image-space point to rect's local (axis-aligned) space */
  _toLocal(ix, iy, shape) {
    const dx = ix - shape.x;
    const dy = iy - shape.y;
    const cos = Math.cos(-shape.rotation);
    const sin = Math.sin(-shape.rotation);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  /** Convert rect local offset to image-space point */
  _fromLocal(lx, ly, shape) {
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    return {
      x: shape.x + lx * cos - ly * sin,
      y: shape.y + lx * sin + ly * cos,
    };
  }

  /* ---- Hit testing ---- */

  hitTest(pixelX, pixelY) {
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

  /** Hit-test vertices of polylines/polygons only. Returns {shapeIdx, vertexIdx} or null. */
  vertexHitTest(pixelX, pixelY) {
    const len = this.shapes.length;
    for (let i = len - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (s.type !== 'polyline' && s.type !== 'polygon') continue;
      for (let j = 0; j < s.points.length; j++) {
        const p = this.toCanvas(s.points[j].x, s.points[j].y);
        if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) {
          return { shapeIdx: i, vertexIdx: j };
        }
      }
    }
    return null;
  }

  /** Hit test against polyline vertices & segments */
  _hitPolyline(pixelX, pixelY, points) {
    for (let j = 0; j < points.length; j++) {
      const p = this.toCanvas(points[j].x, points[j].y);
      if (Math.hypot(pixelX - p.x, pixelY - p.y) <= 6) return true;
    }
    for (let j = 0; j < points.length - 1; j++) {
      if (this._hitSegment(pixelX, pixelY, points[j], points[j + 1])) return true;
    }
    return false;
  }

  /** Distance from point to line segment (in canvas pixel space) */
  _hitSegment(px, py, a, b) {
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

  /** Ray-casting point-in-polygon test (image space) */
  _pointInPolygon(px, py, points) {
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

  /** Handle hit-test for all rects (top to bottom), auto-selects if hit */
  handleHit(pixelX, pixelY, readOnly = false) {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (s.type !== 'rect') continue;

      const img = this.toImage(pixelX, pixelY);
      const local = this._toLocal(img.x, img.y, s);
      const hw = s.w / 2, hh = s.h / 2;

      const cr = 7 / this.scale;
      const er = 6 / this.scale;
      const rr = 6 / this.scale;

      let handle = 'OUT';

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
          this.shapes.forEach(s => { s.current = false; });
          s.current = true;
          this.current = i;
        }
        return handle;
      }
    }
    return 'OUT';
  }

  /* ---- Drawing ---- */

  drawHistory(e) {
    const hitIdx = e ? this.hitTest(e.offsetX, e.offsetY) : -1;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = 0; i < this.shapes.length; i++) {
      this._paintShape(i, this.shapes[i], i === hitIdx);
    }
    this._paintLiveRect();
  }

  _paintShape(i, s, highlight) {
    if (s.type === 'rect') this._paintRect(s, highlight);
    else if (s.type === 'point') this._paintPoint(s, i, highlight);
    else if (s.type === 'polyline') this._paintPolyline(s, i, highlight);
    else if (s.type === 'polygon') this._paintPolygon(s, i, highlight);
  }

  _paintRect(s, highlight) {
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

  _paintHandles(cw, ch, c) {
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
    for (const c of corners) {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
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

  _paintPoint(s, i, highlight) {
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
    this.ctx.fillText(i + 1, p.x + 8, p.y - 8);
  }

  _paintPolyline(s, i, highlight) {
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
      this.ctx.fillText(j + 1, p.x + 7, p.y - 7);
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

  _paintPolygon(s, i, highlight) {
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
      this.ctx.fillText(j + 1, p.x + 7, p.y - 7);
    }
  }

  /* ---- Live rect drawing ---- */

  _paintLiveRect() {
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

  drawLiveRect(sx, sy, ex, ey) {
    this._liveRect = {
      type: 'rect',
      x: (sx + ex) / 2,
      y: (sy + ey) / 2,
      w: Math.abs(ex - sx),
      h: Math.abs(ey - sy),
      rotation: 0,
    };
    this.drawHistory();
  }

  clearLiveRect() {
    this._liveRect = null;
  }
}

/* ========================================================================
 *  AnnotationController — orchestrates everything
 * ======================================================================== */
class AnnotationController {
  constructor(opts) {
    this.mode = opts.mode || 'rect';
    this.onChange = opts.onChange || (() => {});
    const groups = opts.groups || DEFAULT_GROUPS;
    this._groupMap = {};
    groups.forEach(g => { this._groupMap[g.name] = g; });
    this.currentGroup = groups[0].name;

    this._historyStack = [];
    this._historyIndex = -1;
    this._state = {
      drawing: false, dragging: false, resizing: false, panning: false, rotating: false,
      dragIdx: -1, dragVertexIdx: -1, dragCache: null, dragStart: null,
      resizeDirection: 'OUT', resizeCache: null, resizeStartLocal: null,
      rotateCache: null,
      panStart: null,
      drawStart: null,
    };

    this._scaleRate = 1;
    this._minScale = 0.25;
    this._maxScale = 3;
    this._rafId = null;

    this._onPolygonComplete = null;
  }

  mount(imageCanvas, shapeCanvas, imageSrc) {
    this._imageLayer = new ImageLayer(imageCanvas);
    this._shapeLayer = new ShapeLayer(shapeCanvas);
    this._shapeLayer.mode = this.mode;
    this._boundHandlers = this._bindHandlers();
    shapeCanvas.addEventListener('mousedown', this._boundHandlers.onMouseDown);
    shapeCanvas.addEventListener('mousemove', this._boundHandlers.onMouseMove);
    shapeCanvas.addEventListener('mouseup', this._boundHandlers.onMouseUp);
    shapeCanvas.addEventListener('mouseout', this._boundHandlers.onMouseLeave);
    shapeCanvas.addEventListener('contextmenu', e => e.preventDefault());
    shapeCanvas.addEventListener('wheel', this._boundHandlers.onWheel, { passive: false });
    const src = imageSrc || imageCanvas.dataset.src;
    return this._imageLayer.loadImage(src);
  }

  setMode(mode) {
    const poly = this._activePolygon();
    if (poly && poly.points.length >= 3) {
      poly.complete = true;
    } else if (poly) {
      poly.points = [];
      this._shapeLayer.popShape();
    }
    const pl = this._activePolyline();
    if (pl && pl.points.length >= 2) {
      pl.complete = true;
    } else if (pl) {
      pl.points = [];
      this._shapeLayer.popShape();
    }
    this.mode = mode;
    this._shapeLayer.mode = mode;
    this._saveSnapshot();
    this._shapeLayer.drawHistory();
    this._notify();
  }

  setGroup(color) {
    if (!this._groupMap[color]) return;
    this.currentGroup = color;
    this._shapeLayer._group = color;
  }

  zoom(delta) {
    const newRate = this._scaleRate + delta;
    if (newRate < this._minScale || newRate > this._maxScale) return;
    this._scaleRate = newRate;
    this._imageLayer.zoom(this._scaleRate);
    this._shapeLayer.zoom(this._scaleRate);
    this._notify();
  }

  pan(dx, dy) {
    this._imageLayer.pan(dx, dy);
    this._shapeLayer.pan(dx, dy);
    this._notify();
  }

  resetZoom() {
    this._scaleRate = 1;
    this._imageLayer.zoom(1);
    this._shapeLayer.zoom(1);
    this._notify();
  }

  undo() {
    if (this._historyIndex < 1) return;
    this._historyIndex--;
    this._restoreSnapshot();
  }

  redo() {
    if (this._historyIndex >= this._historyStack.length - 1) return;
    this._historyIndex++;
    this._restoreSnapshot();
  }

  _restoreSnapshot() {
    this._shapeLayer.shapes = deepCopy(this._historyStack[this._historyIndex]);
    this._shapeLayer.current = this._shapeLayer.shapes.findIndex(s => s.current);
    this._shapeLayer.drawHistory();
    this._notify();
  }

  clear() {
    this._shapeLayer.clearAll();
    this._saveSnapshot();
    this._shapeLayer.drawHistory();
    this._notify();
  }

  canUndo() {
    return this._historyIndex > 0;
  }

  canRedo() {
    return this._historyIndex < this._historyStack.length - 1;
  }
  completePolygon() {
    if (this.mode !== 'polygon') return;
    const idx = this._shapeLayer.shapes.length - 1;
    if (idx < 0) return;
    const poly = this._shapeLayer.shapes[idx];
    if (poly.type !== 'polygon' || poly.complete) return;
    if (poly.points.length < 3) return;
    poly.complete = true;
    this._saveSnapshot();
    this._shapeLayer.drawHistory();
    this._notify();
    if (this._onPolygonComplete) this._onPolygonComplete(poly);
  }

  isPolygonActive() {
    if (this.mode !== 'polygon') return false;
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    return last && last.type === 'polygon' && !last.complete;
  }

  /** Complete the current in-progress polyline */
  completePolyline() {
    if (this.mode !== 'polyline') return;
    const idx = this._shapeLayer.shapes.length - 1;
    if (idx < 0) return;
    const pl = this._shapeLayer.shapes[idx];
    if (pl.type !== 'polyline' || pl.complete) return;
    if (pl.points.length < 2) return;
    pl.complete = true;
    this._saveSnapshot();
    this._shapeLayer.drawHistory();
    this._notify();
  }

  isPolylineActive() {
    if (this.mode !== 'polyline') return false;
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    return last && last.type === 'polyline' && !last.complete;
  }

  getSelectedShape() {
    const idx = this._shapeLayer.current;
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      return this._shapeLayer.shapes[idx];
    }
    return null;
  }

  getGroup(name) {
    return this._groupMap[name];
  }

  setSelectedShapeGroup(color) {
    if (!this._groupMap[color]) return;
    const idx = this._shapeLayer.current;
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      this._shapeLayer.shapes[idx].group = color;
      this._saveSnapshot();
      this._shapeLayer.drawHistory();
      this._notify();
    }
  }

  deleteSelected() {
    const idx = this._shapeLayer.current;
    if (idx < 0 || idx >= this._shapeLayer.shapes.length) return;
    this._shapeLayer.shapes.splice(idx, 1);
    this._saveSnapshot();
    this._shapeLayer.current = -1;
    this._shapeLayer.drawHistory();
    this._notify();
  }

  selectShapeByIndex(idx) {
    this._shapeLayer.shapes.forEach(s => { s.current = false; });
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      this._shapeLayer.shapes[idx].current = true;
      this._shapeLayer.current = idx;
    } else {
      this._shapeLayer.current = -1;
    }
    this._shapeLayer.drawHistory();
    this._notify();
  }

  selectShape(pixelX, pixelY) {
    this._shapeLayer.shapes.forEach(s => { s.current = false; });
    const idx = this._shapeLayer.hitTest(pixelX, pixelY);
    if (idx >= 0) {
      this._shapeLayer.shapes[idx].current = true;
      this._shapeLayer.current = idx;
    } else {
      this._shapeLayer.current = -1;
    }
    this._shapeLayer.drawHistory();
  }

  getShapes() {
    return this._shapeLayer.shapes.map(s => deepCopy(s));
  }

  getMeta() {
    return {
      scale: this._shapeLayer.scale,
      translateX: this._shapeLayer.translateX,
      translateY: this._shapeLayer.translateY,
      mode: this.mode,
      group: this.currentGroup,
    };
  }

  /* ---- Internal ---- */

  _notify() {
    this.onChange(this.getShapes(), this.getMeta());
  }

  _liveNotify() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this.onChange(this.getShapes(), this.getMeta());
    });
  }

  _saveSnapshot() {
    if (this._historyIndex < this._historyStack.length - 1) {
      this._historyStack.length = this._historyIndex + 1;
    }
    this._historyStack.push(deepCopy(this._shapeLayer.shapes));
    this._historyIndex = this._historyStack.length - 1;
  }

  _seedHistory() {
    if (this._historyStack.length === 0) {
      this._historyStack.push(deepCopy(this._shapeLayer.shapes));
      this._historyIndex = 0;
    }
  }

  _setCursor(e) {
    const canvas = this._shapeLayer.canvas;
    const s = this._shapeLayer.current >= 0 ? this._shapeLayer.shapes[this._shapeLayer.current] : null;
    if (s && s.type === 'rect') {
      const h = this._shapeLayer.handleHit(e.offsetX, e.offsetY, true);
      const cursors = {
        TL: 'nwse-resize', BR: 'nwse-resize',
        TR: 'nesw-resize', BL: 'nesw-resize',
        T: 'ns-resize', B: 'ns-resize',
        L: 'ew-resize', R: 'ew-resize',
        ROTATE: 'grab',
      };
      if (cursors[h]) { canvas.style.cursor = cursors[h]; return; }
      if (this._shapeLayer.hitTest(e.offsetX, e.offsetY) >= 0) { canvas.style.cursor = 'move'; return; }
    }
    if (this._shapeLayer.hitTest(e.offsetX, e.offsetY) >= 0) { canvas.style.cursor = 'pointer'; return; }
    canvas.style.cursor = 'crosshair';
  }

  /* ---- Polygon helpers ---- */

  _activePolygon() {
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    if (last && last.type === 'polygon' && !last.complete) return last;
    return null;
  }

  _activePolyline() {
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    if (last && last.type === 'polyline' && !last.complete) return last;
    return null;
  }

  /* ---- Event handlers ---- */

  _bindHandlers() {
    this._seedHistory();
    this._shapeLayer._groups = this._groupMap;
    const self = this;

    const onMouseDown = e => {
      if (e.button === 2) {
        self._state.panning = true;
        self._state.panStart = { x: e.offsetX, y: e.offsetY };
        return;
      }
      if (e.button !== 0) return;

      // --- Handle hit on rects ---
      const handle = self._shapeLayer.handleHit(e.offsetX, e.offsetY);
      if (handle === 'ROTATE') {
        self._state.rotating = true;
        self._state.rotateCache = deepCopy(self._shapeLayer.shapes[self._shapeLayer.current]);
        return;
      }
      if (handle !== 'OUT' && !self._state.drawing && !self._state.dragging) {
        self._state.resizing = true;
        self._state.resizeDirection = handle;
        const s = self._shapeLayer.shapes[self._shapeLayer.current];
        self._state.resizeCache = { x: s.x, y: s.y, w: s.w, h: s.h, rotation: s.rotation };
        const img = self._shapeLayer.toImage(e.offsetX, e.offsetY);
        self._state.resizeStartLocal = self._shapeLayer._toLocal(img.x, img.y, s);
        return;
      }

      // --- Hit test shapes (vertex hit takes priority for polyline/polygon) ---
      let hitIdx = -1;
      let vertexIdx = -1;
      const vhit = self._shapeLayer.vertexHitTest(e.offsetX, e.offsetY);
      if (vhit) {
        hitIdx = vhit.shapeIdx;
        vertexIdx = vhit.vertexIdx;
      } else {
        hitIdx = self._shapeLayer.hitTest(e.offsetX, e.offsetY);
      }
      if (hitIdx >= 0) {
        self._shapeLayer.shapes.forEach(s => { s.current = false; });
        self._shapeLayer.shapes[hitIdx].current = true;
        self._shapeLayer.current = hitIdx;

        self._state.dragging = true;
        self._state.dragIdx = hitIdx;
        self._state.dragVertexIdx = vertexIdx;
        self._state.dragStart = { x: e.offsetX, y: e.offsetY };
        self._state.dragCache = deepCopy(self._shapeLayer.shapes[hitIdx]);
        self._shapeLayer.drawHistory();
        self._notify();
        return;
      }

      // --- Deselect on empty click ---
      if (self._shapeLayer.current >= 0) {
        const s = self._shapeLayer.shapes[self._shapeLayer.current];
        if (s) s.current = false;
        self._shapeLayer.current = -1;
        self._shapeLayer.drawHistory();
        self._notify();
        return;
      }

      // --- Start drawing ---
      self._state.drawing = true;
      const imgPt = self._shapeLayer.toImage(e.offsetX, e.offsetY);

      if (self.mode === 'rect') {
        self._state.drawStart = imgPt;
      } else if (self.mode === 'point') {
        self._shapeLayer.addShape({ type: 'point', x: imgPt.x, y: imgPt.y, group: self.currentGroup });
        self._shapeLayer.drawHistory();
        self._saveSnapshot();
        self._notify();
      } else if (self.mode === 'polyline') {
        const pl = self._activePolyline();
        if (!pl) {
          self._shapeLayer.addShape({ type: 'polyline', points: [{ x: imgPt.x, y: imgPt.y }], complete: false, group: self.currentGroup });
        } else {
          pl.points.push({ x: imgPt.x, y: imgPt.y });
        }
        self._shapeLayer.drawHistory();
        self._saveSnapshot();
        self._notify();
      } else if (self.mode === 'polygon') {
        const poly = self._activePolygon();
        if (!poly) {
          self._shapeLayer.addShape({
            type: 'polygon',
            points: [{ x: imgPt.x, y: imgPt.y }],
            complete: false,
            group: self.currentGroup,
          });
        } else {
          poly.points.push({ x: imgPt.x, y: imgPt.y });
        }
        self._shapeLayer.drawHistory();
        self._saveSnapshot();
        self._notify();
      }
    };

    const onMouseMove = e => {
      if (self._state.panning) {
        const dx = self._state.panStart.x - e.offsetX;
        const dy = self._state.panStart.y - e.offsetY;
        self._imageLayer.pan(dx, dy);
        self._shapeLayer.pan(dx, dy);
        self._state.panStart = { x: e.offsetX, y: e.offsetY };
        return;
      }

      if (self._state.rotating) {
        const s = self._shapeLayer.shapes[self._shapeLayer.current];
        const img = self._shapeLayer.toImage(e.offsetX, e.offsetY);
        const angle = Math.atan2(img.y - s.y, img.x - s.x) + Math.PI / 2;
        s.rotation = angle;
        self._shapeLayer.drawHistory(e);
        self._setCursor(e);
        self._liveNotify();
        return;
      }

      if (self._state.resizing) {
        const s = self._shapeLayer.shapes[self._shapeLayer.current];
        const c = self._state.resizeCache;
        const img = self._shapeLayer.toImage(e.offsetX, e.offsetY);
        const local = self._shapeLayer._toLocal(img.x, img.y, s);
        const dX = local.x - self._state.resizeStartLocal.x;
        const dY = local.y - self._state.resizeStartLocal.y;
        const r = self._state.resizeDirection;

        let dcx = 0, dcy = 0, newW = c.w, newH = c.h;
        if (r.indexOf('L') >= 0) { newW = c.w - dX; dcx = dX / 2; }
        if (r.indexOf('R') >= 0) { newW = c.w + dX; dcx = dX / 2; }
        if (r.indexOf('T') >= 0) { newH = c.h - dY; dcy = dY / 2; }
        if (r.indexOf('B') >= 0) { newH = c.h + dY; dcy = dY / 2; }

        if (newW < 5 || newH < 5) return;

        const cos = Math.cos(s.rotation), sin = Math.sin(s.rotation);
        s.x = c.x + dcx * cos - dcy * sin;
        s.y = c.y + dcx * sin + dcy * cos;
        s.w = newW;
        s.h = newH;
        self._shapeLayer.drawHistory(e);
        self._setCursor(e);
        self._liveNotify();
        return;
      }

      if (self._state.dragging) {
        const dImgX = (self._state.dragStart.x - e.offsetX) / self._shapeLayer.scale;
        const dImgY = (self._state.dragStart.y - e.offsetY) / self._shapeLayer.scale;
        const s = self._shapeLayer.shapes[self._state.dragIdx];
        const c = self._state.dragCache;
        if (s.type === 'rect') {
          s.x = c.x - dImgX;
          s.y = c.y - dImgY;
        } else if (s.type === 'point') {
          s.x = c.x - dImgX;
          s.y = c.y - dImgY;
        } else if (s.type === 'polyline' || s.type === 'polygon') {
          if (self._state.dragVertexIdx >= 0) {
            s.points[self._state.dragVertexIdx].x = c.points[self._state.dragVertexIdx].x - dImgX;
            s.points[self._state.dragVertexIdx].y = c.points[self._state.dragVertexIdx].y - dImgY;
          } else {
            for (let j = 0; j < s.points.length; j++) {
              s.points[j].x = c.points[j].x - dImgX;
              s.points[j].y = c.points[j].y - dImgY;
            }
          }
        }
        self._shapeLayer.drawHistory(e);
        self._liveNotify();
        return;
      }

      if (self._state.drawing && self.mode === 'rect') {
        const imgPt = self._shapeLayer.toImage(e.offsetX, e.offsetY);
        self._shapeLayer.drawLiveRect(
          self._state.drawStart.x, self._state.drawStart.y,
          imgPt.x, imgPt.y
        );
        return;
      }

      self._shapeLayer.drawHistory(e);
      self._setCursor(e);
    };

    const onMouseUp = e => {
      if (self._state.panning) {
        self._state.panning = false;
        self._state.panStart = null;
        self._notify();
        return;
      }

      if (self._state.rotating) {
        self._state.rotating = false;
        self._state.rotateCache = null;
        self._shapeLayer.drawHistory();
        self._saveSnapshot();
        self._notify();
        return;
      }

      if (self._state.resizing) {
        self._state.resizing = false;
        self._state.resizeDirection = 'OUT';
        self._state.resizeCache = null;
        self._state.resizeStartLocal = null;
        self._shapeLayer.drawHistory();
        self._saveSnapshot();
        self._notify();
        return;
      }

      if (self._state.dragging) {
        self._state.dragging = false;
        self._state.dragIdx = -1;
        self._state.dragVertexIdx = -1;
        self._state.dragCache = null;
        self._state.dragStart = null;
        self._shapeLayer.drawHistory();
        self._saveSnapshot();
        self._notify();
        return;
      }

      if (self._state.drawing && self.mode === 'rect') {
        const imgPt = self._shapeLayer.toImage(e.offsetX, e.offsetY);
        const start = self._state.drawStart;
        const end = imgPt;
        if (Math.abs(start.x - end.x) > 2 && Math.abs(start.y - end.y) > 2) {
          self._shapeLayer.addShape({
            type: 'rect',
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
            w: Math.abs(end.x - start.x),
            h: Math.abs(end.y - start.y),
            rotation: 0,
            group: self.currentGroup,
          });
          self._saveSnapshot();
          self._notify();
        }
        self._shapeLayer.clearLiveRect();
        self._state.drawing = false;
        self._state.drawStart = null;
        self._shapeLayer.drawHistory();
        return;
      }

      if (self._state.drawing) {
        self._state.drawing = false;
      }
    };

    const onMouseLeave = e => {
      onMouseUp(e);
    };

    const onWheel = e => {
      e.preventDefault();
      self.zoom(e.deltaY < 0 ? 0.1 : -0.1);
    };

    return { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onWheel };
  }

  destroy() {
    const c = this._shapeLayer.canvas;
    if (c) {
      const h = this._boundHandlers;
      c.removeEventListener('mousedown', h.onMouseDown);
      c.removeEventListener('mousemove', h.onMouseMove);
      c.removeEventListener('mouseup', h.onMouseUp);
      c.removeEventListener('mouseout', h.onMouseLeave);
      c.removeEventListener('contextmenu', this._boundHandlers.onContextMenu);
      c.removeEventListener('wheel', h.onWheel);
    }
  }
}

export { DEFAULT_GROUPS, buildGroupMap, ImageLayer, ShapeLayer, AnnotationController };
