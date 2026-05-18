<template>
  <div class="max-w-[1160px] mx-auto p-5 font-sans text-gray-800">
    <div class="mb-4">
      <h1 class="text-xl font-semibold m-0">画布标注引擎</h1>
    </div>
    <div class="flex gap-3 items-start">
      <!-- Toolbar -->
      <div class="w-[88px] shrink-0 h-[600px] bg-white rounded-lg border border-gray-200 px-[7px] py-[9px] flex flex-col gap-1.5">
        <!-- Mode 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" :class="{ '!bg-gray-200 !border-gray-400': mode === 'rect' }" @click="setMode('rect')" title="矩形 (1)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" :class="{ '!bg-gray-200 !border-gray-400': mode === 'point' }" @click="setMode('point')" title="点 (2)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
          </button>
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" :class="{ '!bg-gray-200 !border-gray-400': mode === 'polyline' }" @click="setMode('polyline')" title="折线 (3)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><polyline points="3,21 9,7 15,15 21,3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" :class="{ '!bg-gray-200 !border-gray-400': mode === 'polygon' }" @click="setMode('polygon')" title="多边形 (4)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><polygon points="12,2 22,8 19,21 5,21 2,8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="h-px bg-gray-200 mx-1"></div>
        <!-- Group colors 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button
            v-for="(g, i) in groups"
            :key="g.name"
            class="aspect-square border-2 border-transparent rounded-md cursor-pointer transition-all duration-[120ms] hover:opacity-85"
            :class="{ '!border-gray-800': group === g.name }"
            @click="setGroup(g.name)"
            :title="`${g.label} (Alt+${i + 1})`"
            :style="{ background: g.stroke }"
          ></button>
        </div>
        <div class="h-px bg-gray-200 mx-1"></div>
        <!-- Actions 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" @click="engine?.zoom(-0.1)" title="缩小 (Ctrl+-)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8" y1="11" x2="14" y2="11" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" @click="engine?.zoom(0.1)" title="放大 (Ctrl+=)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" fill="none" stroke="currentColor" stroke-width="2"/><line x1="11" y1="8" x2="11" y2="14" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8" y1="11" x2="14" y2="11" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" @click="undo" :disabled="!canUndo" title="撤销 (Ctrl+Z)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><path d="M4 4v6h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 15.5a8 8 0 1 0 3-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default" @click="redo" :disabled="!canRedo" title="重做 (Ctrl+Y)">
            <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><path d="M20 4v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 15.5a8 8 0 1 1 3-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <!-- Complete polygon/polyline -->
        <button
          v-show="polygonActive || polylineActive"
          class="px-1.5 py-[5px] text-[10px] font-bold bg-blue-700 text-white border border-blue-800 rounded-md hover:bg-blue-800 disabled:bg-blue-300 disabled:border-blue-300 disabled:cursor-default"
          :disabled="!canComplete"
          @click="completeCurrent"
          title="完成 (Enter)"
        >完成</button>
        <!-- Delete selected -->
        <button
          v-show="hasSelected"
          class="px-1.5 py-[5px] text-[10px] font-bold bg-red-700 text-white border border-red-900 rounded-md hover:bg-red-800"
          @click="deleteSelected"
          title="删除选中 (Backspace)"
        >删除</button>
        <button class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 disabled:cursor-default mt-auto" @click="clearAll" title="清空全部 (Delete)">
          <svg class="size-[18px] fill-current pointer-events-none" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
      </div>

      <!-- Canvas -->
      <div class="w-[600px] h-[600px] shrink-0 relative bg-white rounded-lg border border-gray-200 overflow-hidden">
        <canvas class="absolute top-0 left-0 z-10" ref="bgCanvas" width="600" height="600"></canvas>
        <canvas class="absolute top-0 left-0 z-20 cursor-crosshair" ref="shapeCanvas" width="600" height="600"></canvas>
      </div>

      <!-- Label panel -->
      <div class="w-[210px] shrink-0 bg-white rounded-lg border border-gray-200 h-[600px] flex flex-col">
        <div class="text-sm font-semibold px-4 py-3 border-b border-gray-100">标注列表</div>
        <div class="flex-1 overflow-y-auto p-2" ref="listRef">
          <div v-if="shapes.length === 0" class="text-gray-300 text-sm text-center mt-10">暂无标注。<br>点击拖拽开始</div>
          <div
            v-for="(s, i) in shapes"
            :key="i"
            class="px-2.5 py-2 mb-1.5 border border-gray-100 rounded-md text-xs leading-relaxed cursor-pointer hover:bg-gray-50"
            :class="{ 'font-bold selected-item': s.current }"
            :style="{
              borderLeftColor: colorMap(s.group),
              borderLeftWidth: '3px',
              ...(s.current ? { color: colorMap(s.group) } : {})
            }"
            @click="selectByIndex(i)"
          >
            <template v-if="s.type === 'rect'">
              <span class="text-blue-700 font-semibold">矩形 {{ i + 1 }}</span>
              <span v-if="s.rotation" class="text-red-600">({{ formatAngle(s.rotation) }})</span><br>
              <span class="text-gray-500 font-mono text-[11px]">中心: ({{ s.x.toFixed(1) }}, {{ s.y.toFixed(1) }})</span><br>
              <span class="text-gray-500 font-mono text-[11px]">尺寸: {{ s.w.toFixed(0) }} × {{ s.h.toFixed(0) }}</span>
            </template>
            <template v-else-if="s.type === 'point'">
              <span class="text-blue-700 font-semibold">点 {{ i + 1 }}</span><br>
              <span class="text-gray-500 font-mono text-[11px]">x: {{ s.x.toFixed(1) }}</span><br>
              <span class="text-gray-500 font-mono text-[11px]">y: {{ s.y.toFixed(1) }}</span>
            </template>
            <template v-else-if="s.type === 'polyline'">
              <span class="text-blue-700 font-semibold">折线 {{ i + 1 }}</span>
              <span v-if="!s.complete" class="text-orange-500 italic">(编辑中)</span><br>
              <span class="text-gray-500 font-mono text-[11px]">顶点: {{ s.points.length }}</span>
            </template>
            <template v-else-if="s.type === 'polygon'">
              <span class="text-blue-700 font-semibold">多边形 {{ i + 1 }}</span>
              <span v-if="!s.complete" class="text-orange-500 italic">(编辑中)</span><br>
              <span class="text-gray-500 font-mono text-[11px]">顶点: {{ s.points.length }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-4 mt-2.5 text-xs text-gray-500">
      <span>图形: <span class="font-semibold text-gray-800">{{ shapes.length }}</span></span>
      <span>缩放: <span class="font-semibold text-gray-800">{{ scale.toFixed(1) }}×</span></span>
      <span>分组: <span class="font-semibold" :style="{ color: colorMap(group) }">{{ groupLabel(group) }}</span></span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { ImageLayer, ShapeLayer, AnnotationController, DEFAULT_GROUPS } from '../engine/engine.js';

const props = defineProps({
  imageSrc: { type: String, default: '' },
  initialMode: { type: String, default: 'rect' },
  groups: { type: Array, default: () => DEFAULT_GROUPS },
});

const emit = defineEmits(['change']);

const bgCanvas = ref(null);
const shapeCanvas = ref(null);
const listRef = ref(null);

const shapes = ref([]);
const mode = ref(props.initialMode);
const group = ref('red');
const scale = ref(1);
const polygonActive = ref(false);
const polylineActive = ref(false);
const canComplete = ref(false);
const hasSelected = ref(false);
const canUndo = ref(false);
const canRedo = ref(false);

let engine = null;

function refreshEngine() {
  shapes.value = engine.getShapes();
  scale.value = engine.getMeta().scale;
  mode.value = engine.mode;
  polygonActive.value = engine.isPolygonActive();
  polylineActive.value = engine.isPolylineActive();
  const last = engine._shapeLayer.shapes[engine._shapeLayer.shapes.length - 1];
  canComplete.value = (polygonActive.value && last?.points.length >= 3)
    || (polylineActive.value && last?.points.length >= 2);
  const selected = engine.getSelectedShape();
  group.value = selected ? selected.group : engine.currentGroup;
  hasSelected.value = selected !== null;
  canUndo.value = engine.canUndo();
  canRedo.value = engine.canRedo();
  emit('change', shapes.value, engine.getMeta());
}

function colorMap(g) {
  return engine?.getGroup(g)?.stroke || props.groups[0]?.stroke || '#e53935';
}

function groupLabel(g) {
  return engine?.getGroup(g)?.label || g;
}

function formatAngle(rad) {
  return ((rad || 0) * 180 / Math.PI).toFixed(1) + '\u00B0';
}

function setMode(m) {
  if (!engine) return;
  engine.setMode(m);
  mode.value = m;
  refreshEngine();
}

function setGroup(g) {
  if (!engine) return;
  if (engine.getSelectedShape()) {
    engine.setSelectedShapeGroup(g);
  } else {
    engine.setGroup(g);
  }
  refreshEngine();
}

function undo() {
  if (!engine) return;
  engine.undo();
  refreshEngine();
}

function redo() {
  if (!engine) return;
  engine.redo();
  refreshEngine();
}

function deleteSelected() {
  if (!engine) return;
  engine.deleteSelected();
  refreshEngine();
}

function selectByIndex(i) {
  if (!engine) return;
  engine.selectShapeByIndex(i);
  refreshEngine();
}

function clearAll() {
  if (!engine) return;
  engine.clear();
  refreshEngine();
}

function completeCurrent() {
  if (!engine) return;
  if (polygonActive.value) engine.completePolygon();
  else if (polylineActive.value) engine.completePolyline();
  refreshEngine();
}

function handleKeydown(e) {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) { e.preventDefault(); redo(); return; }
  if (e.key === 'Enter' && (polygonActive.value || polylineActive.value)) { e.preventDefault(); completeCurrent(); return; }
  if (e.key === 'Backspace' && hasSelected.value) { e.preventDefault(); deleteSelected(); return; }
  if (e.key === 'Delete') { e.preventDefault(); clearAll(); return; }
  if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); engine?.zoom(0.1); refreshEngine(); return; }
  if (e.ctrlKey && e.key === '-') { e.preventDefault(); engine?.zoom(-0.1); refreshEngine(); return; }
  if (e.ctrlKey && e.key === '0') { e.preventDefault(); engine?.resetZoom(); refreshEngine(); return; }
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === 'ArrowUp')    { e.preventDefault(); engine?.pan(0, -20); refreshEngine(); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); engine?.pan(0, 20); refreshEngine(); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); engine?.pan(20, 0); refreshEngine(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); engine?.pan(-20, 0); refreshEngine(); return; }
    if (e.key === '1') setMode('rect');
    if (e.key === '2') setMode('point');
    if (e.key === '3') setMode('polyline');
    if (e.key === '4') setMode('polygon');
  }
  if (e.altKey) {
    for (let i = 0; i < Math.min(props.groups.length, 4); i++) {
      if (e.key === String(i + 1)) {
        e.preventDefault();
        setGroup(props.groups[i].name);
      }
    }
  }
}

watch(() => shapes.value.find(s => s.current), () => {
  if (!listRef.value) return;
  nextTick(() => {
    const el = listRef.value.querySelector('.selected-item');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
});

function createSampleImage() {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 800;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 800, 800);
  g.addColorStop(0, '#e3f2fd');
  g.addColorStop(0.5, '#f3e5f5');
  g.addColorStop(1, '#e8f5e9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 800, 800);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 800; i += 50) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 800); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(800, i); ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(400, 400, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fill();
  return c.toDataURL();
}

onMounted(() => {
  const src = props.imageSrc || createSampleImage();

  engine = new AnnotationController({
    mode: props.initialMode,
    onChange: refreshEngine,
    groups: props.groups,
  });

  engine._imageLayer = new ImageLayer(bgCanvas.value);
  engine._shapeLayer = new ShapeLayer(shapeCanvas.value);
  engine._shapeLayer.mode = props.initialMode;

  const img = new Image();
  img.src = src;
  img.onload = () => {
    engine._imageLayer.img = img;
    engine._imageLayer._draw();
    shapeCanvas.value.width = 600;
    shapeCanvas.value.height = 600;
    engine._boundHandlers = engine._bindHandlers();
    const h = engine._boundHandlers;
    shapeCanvas.value.addEventListener('mousedown', h.onMouseDown);
    shapeCanvas.value.addEventListener('mousemove', h.onMouseMove);
    shapeCanvas.value.addEventListener('mouseup', h.onMouseUp);
    shapeCanvas.value.addEventListener('mouseout', h.onMouseLeave);
    shapeCanvas.value.addEventListener('contextmenu', e => e.preventDefault());
    shapeCanvas.value.addEventListener('wheel', h.onWheel, { passive: false });
    engine._shapeLayer.drawHistory();
    refreshEngine();
  };

  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (engine) engine.destroy();
  engine = null;
});

defineExpose({
  getShapes: () => engine?.getShapes() || [],
  getMeta: () => engine?.getMeta() || {},
  engine: () => engine,
});
</script>

<style scoped>
.selected-item :where(span) { color: inherit; }
</style>
