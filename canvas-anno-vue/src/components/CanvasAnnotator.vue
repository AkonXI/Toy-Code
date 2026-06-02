<template>
  <div class="max-w-[1160px] mx-auto p-5 font-sans text-gray-800">
    <div class="mb-4">
      <h1 class="text-xl font-semibold m-0">画布标注引擎</h1>
    </div>
    <div class="flex gap-3 items-start">
      <!-- Toolbar -->
      <div
        class="w-[88px] shrink-0 h-[600px] bg-white rounded-lg border border-gray-200 px-[7px] py-[9px] flex flex-col gap-1.5"
      >
        <!-- Interaction Mode -->
        <div class="grid grid-cols-2 gap-1">
          <button
            class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 relative hover:bg-gray-200"
            :class="{
              '!bg-blue-100 !border-blue-400 !text-blue-700': currentInteractionMode === 'select'
            }"
            :disabled="props.readonly"
            :title="`选择模式 (Tab)`"
            @click="setInteractionMode('select')"
          >
            <ModeIcon type="select" />
          </button>
          <button
            class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 relative hover:bg-gray-200"
            :class="{
              '!bg-blue-100 !border-blue-400 !text-blue-700': currentInteractionMode === 'draw'
            }"
            :disabled="props.readonly"
            :title="`绘制模式 (Tab)`"
            @click="setInteractionMode('draw')"
          >
            <ModeIcon type="draw" />
          </button>
        </div>
        <div class="h-px bg-gray-200 mx-1"></div>
        <!-- Mode 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button
            v-for="m in MODE_LIST"
            :key="m.type"
            class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default"
            :class="{
              '!bg-gray-200 !border-gray-400': mode === m.type && interactionMode === 'draw'
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
        <div class="h-px bg-gray-200 mx-1"></div>
        <!-- Group colors 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button
            v-for="(g, i) in groups"
            :key="g.name"
            class="aspect-square border-2 border-transparent rounded-md cursor-pointer transition-all duration-[120ms] hover:opacity-85 disabled:opacity-30 disabled:cursor-default"
            :class="{ '!border-gray-800': group === g.name }"
            :disabled="props.readonly"
            @click="setGroup(g.name)"
            :title="`${g.label} (Alt+${i + 1})`"
            :style="{ background: g.stroke }"
          ></button>
        </div>
        <div class="h-px bg-gray-200 mx-1"></div>
        <!-- Actions 2x2 -->
        <div class="grid grid-cols-2 gap-1">
          <button
            class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default"
            @click="getEngine()?.zoom(-0.1)"
            title="缩小 (Ctrl+-)"
          >
            <ToolIcon type="zoom-out" />
          </button>
          <button
            class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default"
            @click="getEngine()?.zoom(0.1)"
            title="放大 (Ctrl+=)"
          >
            <ToolIcon type="zoom-in" />
          </button>
          <button
            class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default"
            @click="undo"
            :disabled="!canUndo || props.readonly"
            title="撤销 (Ctrl+Z)"
          >
            <ToolIcon type="undo" />
          </button>
          <button
            class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-default"
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
          class="px-1.5 py-[5px] text-[10px] font-bold bg-blue-700 text-white border border-blue-800 rounded-md hover:bg-blue-800 disabled:bg-blue-300 disabled:border-blue-300 disabled:cursor-default"
          :disabled="!canComplete"
          @click="completeCurrent"
          title="完成 (Enter)"
        >
          完成
        </button>
        <!-- Delete selected -->
        <button
          v-show="hasSelected && !props.readonly"
          class="px-1.5 py-[5px] text-[10px] font-bold bg-red-700 text-white border border-red-900 rounded-md hover:bg-red-800"
          @click="deleteSelected"
          title="删除选中 (Backspace)"
        >
          删除
        </button>
        <button
          class="aspect-square border border-gray-300 rounded-md bg-gray-50 cursor-pointer flex items-center justify-center transition-all duration-150 text-gray-500 relative hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 disabled:cursor-default mt-auto"
          :disabled="props.readonly"
          @click="clearAll"
          title="清空全部 (Delete)"
        >
          <ToolIcon type="trash" />
        </button>
      </div>

      <!-- Canvas -->
      <div
        class="w-[600px] h-[600px] shrink-0 relative bg-white rounded-lg border border-gray-200 overflow-hidden"
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
        class="w-[210px] shrink-0 bg-white rounded-lg border border-gray-200 h-[600px] flex flex-col"
      >
        <div class="text-sm font-semibold px-4 py-3 border-b border-gray-100">标注列表</div>
        <div class="flex-1 overflow-y-auto p-2" ref="listRef">
          <div v-if="shapes.length === 0" class="text-gray-300 text-sm text-center mt-10">
            暂无标注。<br />点击拖拽开始
          </div>
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
              <span v-if="s.rotation" class="text-red-600">({{ formatAngle(s.rotation) }})</span
              ><br />
              <span class="text-gray-500 font-mono text-[11px]"
                >中心: ({{ s.x.toFixed(1) }}, {{ s.y.toFixed(1) }})</span
              ><br />
              <span class="text-gray-500 font-mono text-[11px]"
                >尺寸: {{ s.w.toFixed(0) }} × {{ s.h.toFixed(0) }}</span
              >
            </template>
            <template v-else-if="s.type === 'point'">
              <span class="text-blue-700 font-semibold">点 {{ i + 1 }}</span
              ><br />
              <span class="text-gray-500 font-mono text-[11px]">x: {{ s.x.toFixed(1) }}</span
              ><br />
              <span class="text-gray-500 font-mono text-[11px]">y: {{ s.y.toFixed(1) }}</span>
            </template>
            <template v-else-if="s.type === 'polyline'">
              <span class="text-blue-700 font-semibold">折线 {{ i + 1 }}</span>
              <span v-if="!s.complete" class="text-orange-500 italic">(编辑中)</span><br />
              <span class="text-gray-500 font-mono text-[11px]">顶点: {{ s.points.length }}</span>
            </template>
            <template v-else-if="s.type === 'polygon'">
              <span class="text-blue-700 font-semibold">多边形 {{ i + 1 }}</span>
              <span v-if="!s.complete" class="text-orange-500 italic">(编辑中)</span><br />
              <span class="text-gray-500 font-mono text-[11px]">顶点: {{ s.points.length }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-4 mt-2.5 text-xs text-gray-500">
      <span
        >图形: <span class="font-semibold text-gray-800">{{ shapes.length }}</span></span
      >
      <span
        >缩放: <span class="font-semibold text-gray-800">{{ scale.toFixed(1) }}×</span></span
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
let isInternalUpdate = false
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
  const sl = engine._shapeLayer
  if (sl) {
    const last = sl.shapes[sl.shapes.length - 1]
    canComplete.value =
      (polygonActive.value && 'points' in last && last.points.length >= 3) ||
      (polylineActive.value && 'points' in last && last.points.length >= 2)
  }
  const selected = engine.getSelectedShape()
  group.value = selected ? selected.group : engine.currentGroup
  hasSelected.value = selected !== null
  canUndo.value = engine.canUndo()
  canRedo.value = engine.canRedo()
  isInternalUpdate = true
  emit('change', shapes.value, engine.getMeta())
  emit('update:modelValue', shapes.value)
  nextTick(() => {
    isInternalUpdate = false
  })
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
      const el = listRef.value!.querySelector('.selected-item')
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
    if (engine && engine._shapeLayer) {
      engine._shapeLayer.shapes = shapes
      engine._shapeLayer.drawHistory()
      engine._seedHistory()
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
    .then(() => refreshEngine())
    .catch((err) => emit('error', err as Error))

  document.addEventListener('keydown', handleKeydown)
})

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
  engine: (): AnnotationController | null => engine
})
</script>

<style scoped>
.selected-item :where(span) {
  color: inherit;
}
</style>
