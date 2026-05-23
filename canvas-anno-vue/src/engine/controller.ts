import { DEFAULT_GROUPS, deepCopy, normalizeAngle } from './utils';
import { ImageLayer } from './image-layer';
import { ShapeLayer } from './shape-layer';
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
  InteractionMode,
} from './types';

export class AnnotationController {
  mode: string;
  interactionMode: InteractionMode;
  readonly: boolean;
  onChange: (shapes: Shape[], meta: Meta) => void;
  _groupMap: Record<string, Group>;
  currentGroup: string;
  _historyStack: { shapes: Shape[]; interactionMode: InteractionMode; mode: string }[];
  _historyIndex: number;
  _state: ControllerState;
  _scaleRate: number;
  _minScale: number;
  _maxScale: number;
  _rafId: number | null;
  _onPolygonComplete: ((shape: PolygonShape) => void) | null;
  _imageLayer: ImageLayer | null;
  _shapeLayer: ShapeLayer | null;
  _boundHandlers: HandlerReturn | null;

  constructor(opts: ControllerOpts = {}) {
    this.mode = opts.mode || 'rect';
    this.interactionMode = opts.interactionMode || 'draw';
    this.readonly = opts.readonly || false;
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
      rotateStartAngle: null,
      offsetAngle: null,
      panStart: null,
      drawStart: null,
    };

    this._scaleRate = 1;
    this._minScale = 0.25;
    this._maxScale = 3;
    this._rafId = null;

    this._onPolygonComplete = null;
    this._imageLayer = null;
    this._shapeLayer = null;
    this._boundHandlers = null;
  }

  mount(imageCanvas: HTMLCanvasElement, shapeCanvas: HTMLCanvasElement, imageSrc?: string): Promise<HTMLImageElement> {
    this._imageLayer = new ImageLayer(imageCanvas);
    this._shapeLayer = new ShapeLayer(shapeCanvas);
    this._shapeLayer.mode = this.mode;
    this._boundHandlers = this._bindHandlers();
    const h = this._boundHandlers;
    shapeCanvas.addEventListener('mousedown', h.onMouseDown);
    shapeCanvas.addEventListener('mousemove', h.onMouseMove);
    shapeCanvas.addEventListener('mouseup', h.onMouseUp);
    shapeCanvas.addEventListener('mouseout', h.onMouseLeave);
    shapeCanvas.addEventListener('contextmenu', e => e.preventDefault());
    shapeCanvas.addEventListener('wheel', h.onWheel, { passive: false });
    const src = imageSrc || imageCanvas.dataset.src;
    if (!src) throw new Error('No image source provided');
    return this._imageLayer.loadImage(src);
  }

  setMode(mode: string): void {
    if (!this._shapeLayer) return;
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

  setInteractionMode(mode: InteractionMode): void {
    if (mode === 'select' && this.interactionMode === 'draw' && this._shapeLayer) {
      this.completePolygon();
      this.completePolyline();
      const poly = this._activePolygon();
      if (poly && !poly.complete) { poly.points = []; this._shapeLayer.popShape(); }
      const pl = this._activePolyline();
      if (pl && !pl.complete) { pl.points = []; this._shapeLayer.popShape(); }
      if (poly || pl) this._shapeLayer.drawHistory();
    }
    this.interactionMode = mode;
    if (this._shapeLayer) this._shapeLayer.interactionMode = mode;
    if (this._shapeLayer && this._shapeLayer.current >= 0) {
      const s = this._shapeLayer.shapes[this._shapeLayer.current];
      if (s) s.current = false;
      this._shapeLayer.current = -1;
      this._shapeLayer.drawHistory();
    }
    this._notify();
  }

  setReadonly(v: boolean): void {
    this.readonly = v;
    if (v) this.setInteractionMode('select');
  }

  setGroup(color: string): void {
    if (!this._shapeLayer) return;
    if (!this._groupMap[color]) return;
    this.currentGroup = color;
    this._shapeLayer._group = color;
  }

  zoom(delta: number): void {
    if (!this._imageLayer || !this._shapeLayer) return;
    const newRate = this._scaleRate + delta;
    if (newRate < this._minScale || newRate > this._maxScale) return;
    this._scaleRate = newRate;
    this._imageLayer.zoom(this._scaleRate);
    this._shapeLayer.zoom(this._scaleRate);
    this._notify();
  }

  pan(dx: number, dy: number): void {
    if (!this._imageLayer || !this._shapeLayer) return;
    this._imageLayer.pan(dx, dy);
    this._shapeLayer.pan(dx, dy);
    this._notify();
  }

  resetZoom(): void {
    if (!this._imageLayer || !this._shapeLayer) return;
    this._scaleRate = 1;
    this._imageLayer.zoom(1);
    this._shapeLayer.zoom(1);
    this._notify();
  }

  private _cancelAnim(): void {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  focusOnShape(shapeIdx: number): void {
    if (!this._shapeLayer || !this._imageLayer) return;
    const shape = this._shapeLayer.shapes[shapeIdx];
    if (!shape) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (shape.type === 'rect') {
      const hw = shape.w / 2, hh = shape.h / 2;
      const cos = Math.cos(shape.rotation || 0), sin = Math.sin(shape.rotation || 0);
      for (const [dx, dy] of [[-hw,-hh],[hw,-hh],[-hw,hh],[hw,hh]]) {
        const x = shape.x + dx * cos - dy * sin;
        const y = shape.y + dx * sin + dy * cos;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    } else if (shape.type === 'point') {
      minX = maxX = shape.x; minY = maxY = shape.y;
    } else {
      for (const p of shape.points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const bw = (maxX - minX) || 10;
    const bh = (maxY - minY) || 10;
    const pad = 1.2;

    const cw = this._shapeLayer.canvas.width;
    const ch = this._shapeLayer.canvas.height;
    const fitScale = Math.min(cw / (bw * pad), ch / (bh * pad));
    const targetScale = Math.max(this._minScale, Math.min(this._maxScale, fitScale));
    const targetTx = cx - cw / (2 * targetScale);
    const targetTy = cy - ch / (2 * targetScale);

    const startScale = this._scaleRate;
    const startTx = this._shapeLayer.translateX;
    const startTy = this._shapeLayer.translateY;

    this._cancelAnim();
    const duration = 400;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const s = startScale + (targetScale - startScale) * ease;
      const tx = startTx + (targetTx - startTx) * ease;
      const ty = startTy + (targetTy - startTy) * ease;

      this._imageLayer.translateX = tx;
      this._imageLayer.translateY = ty;
      this._shapeLayer.translateX = tx;
      this._shapeLayer.translateY = ty;
      this._scaleRate = s;
      this._imageLayer.zoom(s);
      this._shapeLayer.zoom(s);
      this._imageLayer._draw();
      this._shapeLayer.drawHistory();

      if (t < 1) {
        this._rafId = requestAnimationFrame(step);
      } else {
        this._rafId = null;
        this._notify();
      }
    };

    this._rafId = requestAnimationFrame(step);
  }

  undo(): void {
    if (this._historyIndex < 1) return;
    this._historyIndex--;
    this._restoreSnapshot();
  }

  redo(): void {
    if (this._historyIndex >= this._historyStack.length - 1) return;
    this._historyIndex++;
    this._restoreSnapshot();
  }

  _restoreSnapshot(): void {
    if (!this._shapeLayer) return;
    const entry = this._historyStack[this._historyIndex];
    this._shapeLayer.shapes = deepCopy(entry.shapes);
    this._shapeLayer.current = this._shapeLayer.shapes.findIndex(s => s.current);

    const incomplete = this._shapeLayer.shapes.find(s =>
      (s.type === 'polygon' || s.type === 'polyline') && !s.complete
    );
    if (incomplete) {
      this.interactionMode = 'draw';
      this.mode = incomplete.type;
      this._shapeLayer.mode = incomplete.type;
    } else {
      this.interactionMode = entry.interactionMode;
      this.mode = entry.mode;
      this._shapeLayer.mode = entry.mode;
    }
    this._shapeLayer.interactionMode = this.interactionMode;
    this._shapeLayer.drawHistory();
    this._notify();
  }

  clear(): void {
    if (!this._shapeLayer) return;
    this._shapeLayer.clearAll();
    this._saveSnapshot();
    this._shapeLayer.drawHistory();
    this._notify();
  }

  canUndo(): boolean {
    return this._historyIndex > 0;
  }

  canRedo(): boolean {
    return this._historyIndex < this._historyStack.length - 1;
  }

  completePolygon(): void {
    if (!this._shapeLayer) return;
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

  isPolygonActive(): boolean {
    if (!this._shapeLayer) return false;
    if (this.mode !== 'polygon') return false;
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    return last && last.type === 'polygon' && !last.complete;
  }

  completePolyline(): void {
    if (!this._shapeLayer) return;
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

  isPolylineActive(): boolean {
    if (!this._shapeLayer) return false;
    if (this.mode !== 'polyline') return false;
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    return last && last.type === 'polyline' && !last.complete;
  }

  getSelectedShape(): Shape | null {
    if (!this._shapeLayer) return null;
    const idx = this._shapeLayer.current;
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      return this._shapeLayer.shapes[idx];
    }
    return null;
  }

  getGroup(name: string): Group | undefined {
    return this._groupMap[name];
  }

  setSelectedShapeGroup(color: string): void {
    if (!this._shapeLayer) return;
    if (!this._groupMap[color]) return;
    const idx = this._shapeLayer.current;
    if (idx >= 0 && idx < this._shapeLayer.shapes.length) {
      this._shapeLayer.shapes[idx].group = color;
      this._saveSnapshot();
      this._shapeLayer.drawHistory();
      this._notify();
    }
  }

  deleteSelected(): void {
    if (!this._shapeLayer) return;
    const idx = this._shapeLayer.current;
    if (idx < 0 || idx >= this._shapeLayer.shapes.length) return;
    this._shapeLayer.shapes.splice(idx, 1);
    this._saveSnapshot();
    this._shapeLayer.current = -1;
    this._shapeLayer.drawHistory();
    this._notify();
  }

  selectShapeByIndex(idx: number): void {
    if (!this._shapeLayer) return;
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

  selectShape(pixelX: number, pixelY: number): void {
    if (!this._shapeLayer) return;
    this._shapeLayer.shapes.forEach(s => { s.current = false; });
    const idx = this._shapeLayer.hitTest(pixelX, pixelY);
    if (idx >= 0) {
      this._shapeLayer.shapes[idx].current = true;
      this._shapeLayer.current = idx;
    } else {
      this._shapeLayer.current = -1;
    }
      this._shapeLayer.drawHistory();
      this._saveSnapshot();
    }

  getShapes(): Shape[] {
    if (!this._shapeLayer) return [];
    return this._shapeLayer.shapes.map(s => deepCopy(s));
  }

  getMeta(): Meta {
    if (!this._shapeLayer) {
      return { scale: 1, translateX: 0, translateY: 0, mode: this.mode, group: this.currentGroup };
    }
    return {
      scale: this._shapeLayer.scale,
      translateX: this._shapeLayer.translateX,
      translateY: this._shapeLayer.translateY,
      mode: this.mode,
      group: this.currentGroup,
    };
  }

  /* ---- Internal ---- */

  _notify(): void {
    this.onChange(this.getShapes(), this.getMeta());
  }

  _liveNotify(): void {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this.onChange(this.getShapes(), this.getMeta());
    });
  }

  _saveSnapshot(): void {
    if (!this._shapeLayer) return;
    if (this._historyIndex < this._historyStack.length - 1) {
      this._historyStack.length = this._historyIndex + 1;
    }
    this._historyStack.push({
      shapes: deepCopy(this._shapeLayer.shapes),
      interactionMode: this.interactionMode,
      mode: this.mode,
    });
    this._historyIndex = this._historyStack.length - 1;
  }

  _seedHistory(): void {
    if (!this._shapeLayer) return;
    if (this._historyStack.length === 0) {
      this._historyStack.push({
        shapes: deepCopy(this._shapeLayer.shapes),
        interactionMode: this.interactionMode,
        mode: this.mode,
      });
      this._historyIndex = 0;
    }
  }

  _setCursor(e: MouseEvent): void {
    if (!this._shapeLayer) return;
    const canvas = this._shapeLayer.canvas;
    if (this.interactionMode === 'draw') { canvas.style.cursor = 'crosshair'; return; }
    const s = this._shapeLayer.current >= 0 ? this._shapeLayer.shapes[this._shapeLayer.current] : null;
    if (s && s.type === 'rect') {
      const h = this._shapeLayer.handleHit(e.offsetX, e.offsetY, true);
      const cursors: Record<string, string> = {
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

  _activePolygon(): PolygonShape | null {
    if (!this._shapeLayer) return null;
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    if (last && last.type === 'polygon' && !last.complete) return last as PolygonShape;
    return null;
  }

  _activePolyline(): PolylineShape | null {
    if (!this._shapeLayer) return null;
    const last = this._shapeLayer.shapes[this._shapeLayer.shapes.length - 1];
    if (last && last.type === 'polyline' && !last.complete) return last as PolylineShape;
    return null;
  }

  /* ---- Event handlers ---- */

  _bindHandlers(): HandlerReturn {
    this._seedHistory();
    if (!this._shapeLayer) throw new Error('ShapeLayer not initialized');
    this._shapeLayer._groups = this._groupMap;
    const self = this;

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button === 2) {
        self._state.panning = true;
        self._state.panStart = { x: e.offsetX, y: e.offsetY };
        return;
      }
      if (e.button !== 0) return;

      const handle = self._shapeLayer!.handleHit(e.offsetX, e.offsetY);

      if (self.readonly) {
        if (handle === 'OUT') {
          let hitIdx2 = self._shapeLayer!.hitTest(e.offsetX, e.offsetY);
          self._shapeLayer!.shapes.forEach(s => { s.current = false; });
          if (hitIdx2 >= 0) {
            self._shapeLayer!.shapes[hitIdx2].current = true;
            self._shapeLayer!.current = hitIdx2;
          } else {
            self._shapeLayer!.current = -1;
          }
          self._shapeLayer!.drawHistory();
          self._notify();
        }
        return;
      }

      if (handle === 'ROTATE') {
        self._state.rotating = true;
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape;
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY);
        const handleAngle = s.rotation - Math.PI / 2;
        const clickAngle = Math.atan2(img.y - s.y, img.x - s.x);
        self._state.rotateStartAngle = clickAngle;
        self._state.rotateCache = { rotation: s.rotation };
        self._state.offsetAngle = normalizeAngle(clickAngle - handleAngle);
        return;
      }
      if (handle !== 'OUT' && !self._state.drawing && !self._state.dragging) {
        self._state.resizing = true;
        self._state.resizeDirection = handle;
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape;
        self._state.resizeCache = { x: s.x, y: s.y, w: s.w, h: s.h, rotation: s.rotation };
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY);
        self._state.resizeStartLocal = self._shapeLayer!._toLocal(img.x, img.y, s);
        return;
      }

      let hitIdx = -1;
      let vertexIdx = -1;

      if (self.interactionMode === 'draw') {
        const poly = self._activePolygon() || self._activePolyline();
        if (poly && poly.points.length > 0) {
          const pts = poly.points;
          for (let j = 0; j < pts.length; j++) {
            const p = self._shapeLayer!.toCanvas(pts[j].x, pts[j].y);
            if (Math.hypot(e.offsetX - p.x, e.offsetY - p.y) <= 6) {
              hitIdx = self._shapeLayer!.shapes.length - 1;
              vertexIdx = j;
              break;
            }
          }
        }
      } else {
        const vhit = self._shapeLayer!.vertexHitTest(e.offsetX, e.offsetY);
        if (vhit) {
          hitIdx = vhit.shapeIdx;
          vertexIdx = vhit.vertexIdx;
        } else {
          hitIdx = self._shapeLayer!.hitTest(e.offsetX, e.offsetY);
        }
      }
      if (e.ctrlKey && self.interactionMode === 'select') {
        const shapeHit = self._shapeLayer!.hitTest(e.offsetX, e.offsetY);
        if (shapeHit >= 0) {
          const insertIdx = self._shapeLayer!.findEdgeInsertIndex(e.offsetX, e.offsetY, shapeHit);
          if (insertIdx !== null) {
            const s = self._shapeLayer!.shapes[shapeHit];
            if (s.type === 'polygon' || s.type === 'polyline') {
              const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY);
              s.points.splice(insertIdx, 0, { x: imgPt.x, y: imgPt.y });
              self._saveSnapshot();
              self._shapeLayer!.drawHistory();
              self._notify();
              return;
            }
          }
        }
      }
      if (hitIdx >= 0) {
        self._shapeLayer!.shapes.forEach(s => { s.current = false; });
        self._shapeLayer!.shapes[hitIdx].current = true;
        self._shapeLayer!.current = hitIdx;

        self._state.dragging = true;
        self._state.dragIdx = hitIdx;
        self._state.dragVertexIdx = vertexIdx;
        self._state.dragStart = { x: e.offsetX, y: e.offsetY };
        self._state.dragCache = deepCopy(self._shapeLayer!.shapes[hitIdx]) as DragCache;
        self._shapeLayer!.drawHistory();
        self._notify();
        return;
      }

      if (self.interactionMode !== 'draw' && self._shapeLayer!.current >= 0) {
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current];
        if (s) s.current = false;
        self._shapeLayer!.current = -1;
        self._shapeLayer!.drawHistory();
        self._notify();
        return;
      }

      if (self.interactionMode !== 'draw') return;

      self._state.drawing = true;
      const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY);

      if (self.mode === 'rect') {
        self._state.drawStart = imgPt;
      } else if (self.mode === 'point') {
        self._shapeLayer!.addShape({ type: 'point', x: imgPt.x, y: imgPt.y, group: self.currentGroup });
        self._shapeLayer!.drawHistory();
        self._saveSnapshot();
        self._notify();
      } else if (self.mode === 'polyline') {
        const pl = self._activePolyline();
        if (!pl) {
          self._shapeLayer!.addShape({ type: 'polyline', points: [{ x: imgPt.x, y: imgPt.y }], complete: false, group: self.currentGroup });
        } else {
          pl.points.push({ x: imgPt.x, y: imgPt.y });
        }
        self._shapeLayer!.drawHistory();
        self._saveSnapshot();
        self._notify();
      } else if (self.mode === 'polygon') {
        const poly = self._activePolygon();
        if (!poly) {
          self._shapeLayer!.addShape({
            type: 'polygon',
            points: [{ x: imgPt.x, y: imgPt.y }],
            complete: false,
            group: self.currentGroup,
          });
        } else {
          poly.points.push({ x: imgPt.x, y: imgPt.y });
        }
        self._shapeLayer!.drawHistory();
        self._saveSnapshot();
        self._notify();
      }
    };

    const onMouseMove = (e: MouseEvent): void => {
      if (self._state.panning) {
        const dx = self._state.panStart!.x - e.offsetX;
        const dy = self._state.panStart!.y - e.offsetY;
        self._imageLayer!.pan(dx, dy);
        self._shapeLayer!.pan(dx, dy);
        self._state.panStart = { x: e.offsetX, y: e.offsetY };
        return;
      }

      if (self.readonly) return;

      if (self._state.rotating) {
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape;
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY);
        const currentAngle = Math.atan2(img.y - s.y, img.x - s.x);
        const rawDelta = currentAngle - self._state.rotateStartAngle!;
        const delta = normalizeAngle(rawDelta);
        s.rotation = normalizeAngle(self._state.rotateCache!.rotation + delta - self._state.offsetAngle!);
        self._shapeLayer!.drawHistory(e);
        self._setCursor(e);
        self._liveNotify();
        return;
      }

      if (self._state.resizing) {
        const s = self._shapeLayer!.shapes[self._shapeLayer!.current] as RectShape;
        const c = self._state.resizeCache!;
        const img = self._shapeLayer!.toImage(e.offsetX, e.offsetY);
        const local = self._shapeLayer!._toLocal(img.x, img.y, s);
        const dX = local.x - self._state.resizeStartLocal!.x;
        const dY = local.y - self._state.resizeStartLocal!.y;
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
        self._shapeLayer!.drawHistory(e);
        self._setCursor(e);
        self._liveNotify();
        return;
      }

      if (self._state.dragging) {
        const dImgX = (self._state.dragStart!.x - e.offsetX) / self._shapeLayer!.scale;
        const dImgY = (self._state.dragStart!.y - e.offsetY) / self._shapeLayer!.scale;
        const s = self._shapeLayer!.shapes[self._state.dragIdx];
        const c = self._state.dragCache!;
        if (s.type === 'rect') {
          s.x = c.x - dImgX;
          s.y = c.y - dImgY;
        } else if (s.type === 'point') {
          s.x = c.x - dImgX;
          s.y = c.y - dImgY;
        } else if (s.type === 'polyline' || s.type === 'polygon') {
          if (self._state.dragVertexIdx >= 0) {
            s.points[self._state.dragVertexIdx].x = c.points![self._state.dragVertexIdx].x - dImgX;
            s.points[self._state.dragVertexIdx].y = c.points![self._state.dragVertexIdx].y - dImgY;
          } else {
            for (let j = 0; j < s.points.length; j++) {
              s.points[j].x = c.points![j].x - dImgX;
              s.points[j].y = c.points![j].y - dImgY;
            }
          }
        }
        self._shapeLayer!.drawHistory(e);
        self._liveNotify();
        return;
      }

      if (self._state.drawing && self.mode === 'rect') {
        const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY);
        self._shapeLayer!.drawLiveRect(
          self._state.drawStart!.x, self._state.drawStart!.y,
          imgPt.x, imgPt.y
        );
        return;
      }

      self._shapeLayer!.drawHistory(e);
      self._setCursor(e);
    };

    const onMouseUp = (e: MouseEvent): void => {
      if (self._state.panning) {
        self._state.panning = false;
        self._state.panStart = null;
        self._notify();
        return;
      }

      if (self._state.rotating) {
        self._state.rotating = false;
        self._state.rotateCache = null;
        self._state.rotateStartAngle = null;
        self._state.offsetAngle = null;
        self._shapeLayer!.drawHistory();
        self._saveSnapshot();
        self._notify();
        return;
      }

      if (self._state.resizing) {
        self._state.resizing = false;
        self._state.resizeDirection = 'OUT';
        self._state.resizeCache = null;
        self._state.resizeStartLocal = null;
        self._shapeLayer!.drawHistory();
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
        self._shapeLayer!.drawHistory();
        self._saveSnapshot();
        self._notify();
        return;
      }

      if (self._state.drawing && self.mode === 'rect') {
        const imgPt = self._shapeLayer!.toImage(e.offsetX, e.offsetY);
        const start = self._state.drawStart!;
        const end = imgPt;
        if (Math.abs(start.x - end.x) > 2 && Math.abs(start.y - end.y) > 2) {
          self._shapeLayer!.addShape({
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
        self._shapeLayer!.clearLiveRect();
        self._state.drawing = false;
        self._state.drawStart = null;
        self._shapeLayer!.drawHistory();
        return;
      }

      if (self._state.drawing) {
        self._state.drawing = false;
      }
    };

    const onMouseLeave = (e: MouseEvent): void => {
      onMouseUp(e);
    };

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      self.zoom(e.deltaY < 0 ? 0.1 : -0.1);
    };

    return { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onWheel };
  }

  destroy(): void {
    if (!this._shapeLayer || !this._boundHandlers) return;
    const c = this._shapeLayer.canvas;
    const h = this._boundHandlers;
    c.removeEventListener('mousedown', h.onMouseDown);
    c.removeEventListener('mousemove', h.onMouseMove);
    c.removeEventListener('mouseup', h.onMouseUp);
    c.removeEventListener('mouseout', h.onMouseLeave);
    c.removeEventListener('wheel', h.onWheel);
  }
}
