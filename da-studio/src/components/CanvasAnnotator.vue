<template>
  <div class="da-annotator max-w-[1160px] mx-auto p-5 font-sans bg-[var(--da-annotator-bg)]">
    <div class="flex gap-3 items-start">
      <!-- Toolbar -->
      <div
        class="w-[88px] shrink-0 h-[600px] rounded-lg border px-[7px] py-[9px] flex flex-col gap-1.5 bg-[var(--da-annotator-panel-bg)] border-[var(--da-annotator-border)]"
      >
        <!-- Interaction Mode -->
        <div class="grid grid-cols-2 gap-1">
          <button
            class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:bg-[var(--da-annotator-tool-hover-bg)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
            :class="{
              '!bg-[var(--da-annotator-selected-bg)] !text-[var(--da-annotator-selected-fg)] !border-[var(--da-annotator-selected-border)]':
                currentInteractionMode === 'select'
            }"
            :disabled="props.readonly"
            :title="`选择模式 (Tab)`"
            @click="setInteractionMode('select')"
          >
            <ModeIcon type="select" />
          </button>
          <button
            class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:bg-[var(--da-annotator-tool-hover-bg)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
            :class="{
              '!bg-[var(--da-annotator-selected-bg)] !text-[var(--da-annotator-selected-fg)] !border-[var(--da-annotator-selected-border)]':
                currentInteractionMode === 'draw'
            }"
            :disabled="props.readonly"
            :title="`绘制模式 (Tab)`"
            @click="setInteractionMode('draw')"
          >
            <ModeIcon type="draw" />
          </button>
        </div>
        <div class="h-px mx-1 bg-[var(--da-annotator-divider)]"></div>
        <!-- Mode 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button
            v-for="m in MODE_LIST"
            :key="m.type"
            class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative disabled:opacity-40 disabled:cursor-default bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:bg-[var(--da-annotator-tool-hover-bg)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
            :class="{
              '!bg-[var(--da-annotator-mode-selected-bg)] !border-[var(--da-annotator-mode-selected-border)]':
                mode === m.type && currentInteractionMode === 'draw'
            }"
            :disabled="
              !isModeEnabled(m.type) || currentInteractionMode === 'select' || props.readonly
            "
            @click="setMode(m.type)"
            :title="`${m.label} (${m.key})`"
          >
            <ModeIcon :type="m.type" />
          </button>
        </div>
        <div class="h-px mx-1 bg-[var(--da-annotator-divider)]"></div>
        <!-- Group colors 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button
            v-for="(g, i) in groups"
            :key="g.name"
            class="aspect-square border-2 rounded-md cursor-pointer transition-all duration-[120ms] hover:opacity-85 disabled:opacity-30 disabled:cursor-default border-transparent"
            :class="{ '!border-[var(--da-annotator-group-selected-border)]': group === g.name }"
            :disabled="props.readonly"
            @click="setGroup(g.name)"
            :title="`${g.label} (Alt+${i + 1})`"
            :style="{ background: g.stroke }"
          ></button>
        </div>
        <div class="h-px mx-1 bg-[var(--da-annotator-divider)]"></div>
        <!-- Actions 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button
            class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative disabled:opacity-40 disabled:cursor-default bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:bg-[var(--da-annotator-tool-hover-bg)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
            @click="getEngine()?.zoom(-0.1)"
            title="缩小 (Ctrl+-)"
          >
            <ToolIcon type="zoom-out" />
          </button>
          <button
            class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative disabled:opacity-40 disabled:cursor-default bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:bg-[var(--da-annotator-tool-hover-bg)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
            @click="getEngine()?.zoom(0.1)"
            title="放大 (Ctrl+=)"
          >
            <ToolIcon type="zoom-in" />
          </button>
          <button
            class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative disabled:opacity-40 disabled:cursor-default bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:bg-[var(--da-annotator-tool-hover-bg)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
            @click="undo"
            :disabled="!canUndo || props.readonly"
            title="撤销 (Ctrl+Z)"
          >
            <ToolIcon type="undo" />
          </button>
          <button
            class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative disabled:opacity-40 disabled:cursor-default bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:bg-[var(--da-annotator-tool-hover-bg)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
            @click="redo"
            :disabled="!canRedo || props.readonly"
            title="重做 (Ctrl+Y)"
          >
            <ToolIcon type="redo" />
          </button>
        </div>
        <!-- Complete polygon/polyline -->
        <button
          v-show="(polygonActive || polylineActive) && !props.readonly"
          class="px-1.5 py-[5px] text-[10px] font-bold border rounded-md disabled:cursor-default text-[var(--da-annotator-action-fg)] bg-[var(--da-annotator-primary-bg)] border-[var(--da-annotator-primary-border)] hover:enabled:bg-[var(--da-annotator-primary-hover-bg)] disabled:bg-[var(--da-annotator-primary-disabled-bg)] disabled:border-[var(--da-annotator-primary-disabled-bg)]"
          :disabled="!canComplete"
          @click="completeCurrent"
          title="完成 (Enter)"
        >
          完成
        </button>
        <!-- Delete selected -->
        <button
          v-show="hasSelected && !props.readonly"
          class="px-1.5 py-[5px] text-[10px] font-bold border rounded-md text-[var(--da-annotator-action-fg)] bg-[var(--da-annotator-danger-bg)] border-[var(--da-annotator-danger-border)] hover:enabled:bg-[var(--da-annotator-danger-hover-bg)]"
          @click="deleteSelected"
          title="删除选中 (Backspace)"
        >
          删除
        </button>
        <button
          class="aspect-square border rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 relative disabled:opacity-40 disabled:cursor-default mt-auto bg-[var(--da-annotator-tool-bg)] text-[var(--da-annotator-tool-fg)] border-[var(--da-annotator-border-strong)] hover:enabled:!bg-[var(--da-annotator-danger-soft-bg)] hover:enabled:!text-[var(--da-annotator-danger-soft-fg)] hover:enabled:!border-[var(--da-annotator-danger-soft-border)] active:enabled:bg-[var(--da-annotator-tool-active-bg)]"
          :disabled="props.readonly"
          @click="clearAll"
          title="清空全部 (Delete)"
        >
          <ToolIcon type="trash" />
        </button>
      </div>

      <!-- Canvas -->
      <div
        class="w-[600px] h-[600px] shrink-0 relative rounded-lg border overflow-hidden bg-[var(--da-annotator-canvas-bg)] border-[var(--da-annotator-border)]"
      >
        <canvas class="absolute top-0 left-0 z-10" ref="bgCanvas" width="600" height="600"></canvas>
        <canvas
          class="absolute top-0 left-0 z-20 cursor-crosshair"
          ref="shapeCanvas"
          width="600"
          height="600"
        ></canvas>
        <slot name="canvas-overlay" />
      </div>

      <!-- Label panel -->
      <div
        class="w-[210px] shrink-0 rounded-lg border h-[600px] flex flex-col bg-[var(--da-annotator-panel-bg)] border-[var(--da-annotator-border)]"
      >
        <div
          class="text-sm font-semibold px-4 py-3 border-b text-[var(--da-annotator-list-title)] border-[var(--da-annotator-shape-border)]"
        >
          标注列表
        </div>
        <div class="flex-1 overflow-y-auto p-2" ref="listRef">
          <div
            v-if="shapes.length === 0"
            class="text-sm text-center mt-10 text-[var(--da-annotator-subtle)]"
          >
            暂无标注。<br />点击拖拽开始
          </div>
          <div
            v-for="(s, i) in shapes"
            :key="i"
            class="px-2.5 py-2 mb-1.5 border rounded-md text-xs leading-relaxed cursor-pointer border-[var(--da-annotator-shape-border)] hover:bg-[var(--da-annotator-shape-hover-bg)]"
            :class="{
              'font-bold [&_span]:!text-[var(--da-annotator-current-shape-color)]': s.current
            }"
            :data-current="s.current ? 'true' : undefined"
            :style="{
              borderLeftColor: colorMap(s.group),
              borderLeftWidth: '3px',
              '--da-annotator-current-shape-color': colorMap(s.group)
            }"
            @click="selectByIndex(i)"
          >
            <template v-if="s.type === 'rect'">
              <span class="font-semibold text-[var(--da-annotator-shape-title)]"
                >矩形 {{ i + 1 }}</span
              >
              <span v-if="s.rotation" class="text-[var(--da-annotator-shape-angle)]"
                >({{ formatAngle(s.rotation) }})</span
              ><br />
              <span class="font-mono text-[11px] text-[var(--da-annotator-muted)]"
                >中心: ({{ s.x.toFixed(1) }}, {{ s.y.toFixed(1) }})</span
              ><br />
              <span class="font-mono text-[11px] text-[var(--da-annotator-muted)]"
                >尺寸: {{ s.w.toFixed(0) }} × {{ s.h.toFixed(0) }}</span
              >
            </template>
            <template v-else-if="s.type === 'point'">
              <span class="font-semibold text-[var(--da-annotator-shape-title)]"
                >点 {{ i + 1 }}</span
              ><br />
              <span class="font-mono text-[11px] text-[var(--da-annotator-muted)]"
                >x: {{ s.x.toFixed(1) }}</span
              ><br />
              <span class="font-mono text-[11px] text-[var(--da-annotator-muted)]"
                >y: {{ s.y.toFixed(1) }}</span
              >
            </template>
            <template v-else-if="s.type === 'polyline'">
              <span class="font-semibold text-[var(--da-annotator-shape-title)]"
                >折线 {{ i + 1 }}</span
              >
              <span v-if="!s.complete" class="italic text-[var(--da-annotator-shape-editing)]"
                >(编辑中)</span
              ><br />
              <span class="font-mono text-[11px] text-[var(--da-annotator-muted)]"
                >顶点: {{ s.points.length }}</span
              >
            </template>
            <template v-else-if="s.type === 'polygon'">
              <span class="font-semibold text-[var(--da-annotator-shape-title)]"
                >多边形 {{ i + 1 }}</span
              >
              <span v-if="!s.complete" class="italic text-[var(--da-annotator-shape-editing)]"
                >(编辑中)</span
              ><br />
              <span class="font-mono text-[11px] text-[var(--da-annotator-muted)]"
                >顶点: {{ s.points.length }}</span
              >
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-4 mt-2.5 text-xs text-[var(--da-annotator-muted)]">
      <span
        >图形:
        <span class="font-semibold text-[var(--da-annotator-text)]">{{ shapes.length }}</span></span
      >
      <span
        >缩放:
        <span class="font-semibold text-[var(--da-annotator-text)]"
          >{{ scale.toFixed(1) }}×</span
        ></span
      >
      <span
        >分组:
        <span class="font-semibold" :style="{ color: colorMap(group) }">{{
          groupLabel(group)
        }}</span></span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import {
  AnnotationController,
  DEFAULT_GROUPS,
  type Shape,
  type Group,
  type Meta,
  type ModeType,
  type InteractionMode
} from '../engine'
import ModeIcon from './ModeIcon.vue'
import ToolIcon from './ToolIcon.vue'

interface Props {
  imageSrc?: string
  initialMode?: string
  interactionMode?: InteractionMode
  readonly?: boolean
  modelValue?: Shape[]
  groups?: Group[]
  enabledModes?: ModeType[]
}

const props = withDefaults(defineProps<Props>(), {
  imageSrc: '',
  initialMode: 'rect',
  interactionMode: 'draw',
  readonly: false,
  modelValue: () => [],
  groups: () => DEFAULT_GROUPS,
  enabledModes: () => ['rect', 'point', 'polyline', 'polygon']
})

interface ChangeEmits {
  (e: 'change', shapes: Shape[], meta: Meta): void
  (e: 'update:modelValue', shapes: Shape[]): void
  (e: 'error', error: Error): void
  (e: 'load'): void
}

const emit = defineEmits<ChangeEmits>()

const MODE_LIST: { type: ModeType; label: string; key: string }[] = [
  { type: 'rect', label: '矩形', key: '1' },
  { type: 'point', label: '点', key: '2' },
  { type: 'polyline', label: '折线', key: '3' },
  { type: 'polygon', label: '多边形', key: '4' }
]

const modeKeyMap = Object.fromEntries(MODE_LIST.map((m) => [m.key, m.type])) as Record<
  string,
  ModeType
>

const enabledSet = computed(() => new Set(props.enabledModes))
function isModeEnabled(t: ModeType) {
  return enabledSet.value.has(t)
}

const resolvedMode = ref(
  enabledSet.value.has(props.initialMode as ModeType)
    ? props.initialMode
    : props.enabledModes[0] || 'rect'
)

const bgCanvas = ref<HTMLCanvasElement | null>(null)
const shapeCanvas = ref<HTMLCanvasElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const shapes = ref<Shape[]>([])
const mode = ref(resolvedMode.value)
const currentInteractionMode = ref<InteractionMode>(props.interactionMode)
const group = ref('red')
const scale = ref(1)
const polygonActive = ref(false)
const polylineActive = ref(false)
const canComplete = ref(false)
const hasSelected = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)

let engine: AnnotationController | null = null

function getEngine(): AnnotationController | null {
  return engine
}

function refreshEngine(): void {
  if (!engine) return
  shapes.value = engine.getShapes()
  scale.value = engine.getMeta().scale
  mode.value = engine.mode
  currentInteractionMode.value = engine.interactionMode
  polygonActive.value = engine.isPolygonActive()
  polylineActive.value = engine.isPolylineActive()
  const last = engine.getLastShape()
  canComplete.value = !!(
    last &&
    ((polygonActive.value && 'points' in last && last.points.length >= 3) ||
      (polylineActive.value && 'points' in last && last.points.length >= 2))
  )
  const selected = engine.getSelectedShape()
  group.value = selected ? selected.group : engine.currentGroup
  hasSelected.value = selected !== null
  canUndo.value = engine.canUndo()
  canRedo.value = engine.canRedo()
  emit('change', shapes.value, engine.getMeta())
  emit('update:modelValue', shapes.value)
}

function colorMap(g: string): string {
  return engine?.getGroup(g)?.stroke || props.groups[0]?.stroke || '#e53935'
}

function groupLabel(g: string): string {
  return engine?.getGroup(g)?.label || g
}

function formatAngle(rad: number): string {
  return (((rad || 0) * 180) / Math.PI).toFixed(1) + '\u00B0'
}

function setInteractionMode(m: InteractionMode): void {
  if (!engine) return
  engine.setInteractionMode(m)
  currentInteractionMode.value = m
  refreshEngine()
}

function setMode(m: string): void {
  if (!engine) return
  engine.setMode(m)
  mode.value = m
  refreshEngine()
}

function setGroup(g: string): void {
  if (!engine) return
  if (engine.getSelectedShape()) {
    engine.setSelectedShapeGroup(g)
  } else {
    engine.setGroup(g)
  }
  refreshEngine()
}

function undo(): void {
  if (!engine) return
  engine.undo()
  refreshEngine()
}

function redo(): void {
  if (!engine) return
  engine.redo()
  refreshEngine()
}

function deleteSelected(): void {
  if (!engine) return
  engine.deleteSelected()
  refreshEngine()
}

function selectByIndex(i: number): void {
  if (!engine) return
  if (currentInteractionMode.value === 'draw') {
    setInteractionMode('select')
  }
  engine.selectShapeByIndex(i)
  engine.focusOnShape(i)
  refreshEngine()
}

function clearAll(): void {
  if (!engine) return
  engine.clear()
  refreshEngine()
}

function completeCurrent(): void {
  if (!engine) return
  if (polygonActive.value) engine.completePolygon()
  else if (polylineActive.value) engine.completePolyline()
  refreshEngine()
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.key === 'z' && !props.readonly) {
    e.preventDefault()
    undo()
    return
  }
  if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
    if (props.readonly) return
    e.preventDefault()
    redo()
    return
  }
  if (e.key === 'Enter' && (polygonActive.value || polylineActive.value)) {
    if (props.readonly) return
    e.preventDefault()
    completeCurrent()
    return
  }
  if (e.key === 'Backspace' && hasSelected.value) {
    if (props.readonly) return
    e.preventDefault()
    deleteSelected()
    return
  }
  if (e.key === 'Delete') {
    if (props.readonly) return
    e.preventDefault()
    clearAll()
    return
  }
  if (e.key === 'Tab') {
    if (props.readonly) return
    e.preventDefault()
    setInteractionMode(currentInteractionMode.value === 'select' ? 'draw' : 'select')
    return
  }
  if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    engine?.zoom(0.1)
    refreshEngine()
    return
  }
  if (e.ctrlKey && e.key === '-') {
    e.preventDefault()
    engine?.zoom(-0.1)
    refreshEngine()
    return
  }
  if (e.ctrlKey && e.key === '0') {
    e.preventDefault()
    engine?.resetZoom()
    refreshEngine()
    return
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      engine?.pan(0, -20)
      refreshEngine()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      engine?.pan(0, 20)
      refreshEngine()
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      engine?.pan(20, 0)
      refreshEngine()
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      engine?.pan(-20, 0)
      refreshEngine()
      return
    }
    const m = modeKeyMap[e.key]
    if (m && isModeEnabled(m) && !props.readonly) {
      setMode(m)
      return
    }
  }
  if (e.altKey && !props.readonly) {
    for (let i = 0; i < Math.min(props.groups.length, 4); i++) {
      if (e.key === String(i + 1)) {
        e.preventDefault()
        setGroup(props.groups[i].name)
      }
    }
  }
}

watch(
  () => shapes.value.find((s) => s.current),
  () => {
    if (!listRef.value) return
    nextTick(() => {
      const el = listRef.value!.querySelector('[data-current="true"]')
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
)

watch(
  () => props.readonly,
  (v) => {
    if (engine) engine.setReadonly(v)
  }
)

watch(
  () => props.modelValue,
  (shapes) => {
    if (engine) {
      engine.setShapes(shapes)
      refreshEngine()
    }
  },
  { deep: true }
)

onMounted(() => {
  engine = new AnnotationController({
    mode: resolvedMode.value,
    interactionMode: props.interactionMode,
    readonly: props.readonly,
    onChange: refreshEngine,
    groups: props.groups
  })

  engine
    .mount(bgCanvas.value!, shapeCanvas.value!, props.imageSrc)
    .then(() => {
      refreshEngine()
      emit('load')
    })
    .catch((err) => emit('error', err as Error))

  document.addEventListener('keydown', handleKeydown)
})

watch(
  () => props.imageSrc,
  (src) => {
    if (src && engine) engine.loadImage(src).then(() => emit('load'))
  }
)

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (engine) engine.destroy()
  engine = null
})

defineExpose({
  getShapes: (): Shape[] => engine?.getShapes() || [],
  getMeta: (): Meta =>
    engine?.getMeta() || {
      scale: 1,
      translateX: 0,
      translateY: 0,
      mode: '',
      group: ''
    },
  completeCurrent,
  loadShapes: (shapes: Shape[], meta: Meta) => engine?.loadShapes(shapes, meta),
  loadAnnotationState: (shapes: Shape[], meta: Meta) => engine?.loadAnnotationState(shapes, meta),
  getShortcutState: () => ({
    canUndo: canUndo.value,
    canRedo: canRedo.value,
    hasSelected: hasSelected.value,
    canComplete: canComplete.value,
    canClear: shapes.value.length > 0
  }),
  engine: (): AnnotationController | null => engine
})
</script>

<style scoped>
:global(:root) {
  --da-annotator-bg: transparent;
  --da-annotator-text: #1f2937;
  --da-annotator-muted: #6b7280;
  --da-annotator-subtle: #d1d5db;
  --da-annotator-panel-bg: #ffffff;
  --da-annotator-canvas-bg: #ffffff;
  --da-annotator-border: #e5e7eb;
  --da-annotator-border-strong: #d1d5db;
  --da-annotator-divider: #e5e7eb;
  --da-annotator-tool-bg: #f9fafb;
  --da-annotator-tool-fg: #6b7280;
  --da-annotator-tool-hover-bg: #e5e7eb;
  --da-annotator-tool-active-bg: #d1d5db;
  --da-annotator-selected-bg: #dbeafe;
  --da-annotator-selected-border: #60a5fa;
  --da-annotator-selected-fg: #1d4ed8;
  --da-annotator-mode-selected-bg: #e5e7eb;
  --da-annotator-mode-selected-border: #9ca3af;
  --da-annotator-group-selected-border: #1f2937;
  --da-annotator-action-fg: #ffffff;
  --da-annotator-primary-bg: #1d4ed8;
  --da-annotator-primary-hover-bg: #1e40af;
  --da-annotator-primary-border: #1e40af;
  --da-annotator-primary-disabled-bg: #93c5fd;
  --da-annotator-danger-bg: #b91c1c;
  --da-annotator-danger-hover-bg: #991b1b;
  --da-annotator-danger-border: #7f1d1d;
  --da-annotator-danger-soft-bg: #fef2f2;
  --da-annotator-danger-soft-fg: #b91c1c;
  --da-annotator-danger-soft-border: #fecaca;
  --da-annotator-list-title: #111827;
  --da-annotator-shape-title: #1d4ed8;
  --da-annotator-shape-angle: #dc2626;
  --da-annotator-shape-editing: #f97316;
  --da-annotator-shape-border: #f3f4f6;
  --da-annotator-shape-hover-bg: #f9fafb;
}

.da-annotator {
  color: var(--da-annotator-text);
}
</style>
