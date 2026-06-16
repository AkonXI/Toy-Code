<template>
  <main class="dev-app">
    <header class="dev-header">
      <div>
        <p class="dev-kicker">DA STUDIO / DEVAPP</p>
        <h1>标注组件调试台</h1>
      </div>
      <div class="dev-route-pill">ANNOTATOR / 01</div>
    </header>

    <section class="dev-card">
      <aside class="dev-options">
        <div class="dev-section">
          <p class="dev-section-title">运行选项</p>
          <label class="dev-check">
            <input v-model="readonly" type="checkbox" />
            <span>只读模式</span>
          </label>
          <label class="dev-check">
            <input v-model="debugEngine" type="checkbox" />
            <span>调试引擎</span>
          </label>
          <label class="dev-check">
            <input v-model="showComparisonPanel" type="checkbox" />
            <span>展示对比面板</span>
          </label>
          <button class="dev-action" type="button" @click="loadPreloadedData">重载预置数据</button>
        </div>

        <div class="dev-section">
          <p class="dev-section-title">对比面板</p>
          <label class="dev-check">
            <input v-model="comparisonTeleport" type="checkbox" />
            <span>Teleport 到 body</span>
          </label>
          <label class="dev-check">
            <input v-model="comparisonSticky" type="checkbox" />
            <span>Sticky 定位</span>
          </label>
          <label class="dev-check">
            <input v-model="comparisonMovable" type="checkbox" />
            <span>Movable 拖动</span>
          </label>

          <div class="dev-offset-grid">
            <label>
              <span>Top</span>
              <input v-model.number="comparisonOffset.top" type="number" />
            </label>
            <label>
              <span>Right</span>
              <input v-model.number="comparisonOffset.right" type="number" />
            </label>
            <label>
              <span>Bottom</span>
              <input v-model.number="comparisonOffset.bottom" type="number" />
            </label>
            <label>
              <span>Left</span>
              <input v-model.number="comparisonOffset.left" type="number" />
            </label>
          </div>
        </div>
      </aside>

      <div class="dev-stage">
        <div class="dev-annotator-shell">
          <CanvasAnnotator ref="annotatorRef" :readonly="readonly" @change="onAnnotatorChange">
            <template #canvas-overlay>
              <ComparisonOverlay v-if="result" :result="result" :get-meta="getCurrentMeta" />
            </template>
          </CanvasAnnotator>

          <ComparisonPanel
            v-if="showComparisonPanel"
            :shapes="shapes"
            :template-idx="templateIdx"
            :test-idx="testIdx"
            :result="result"
            :loading="loading"
            :teleport="comparisonTeleport"
            :sticky="comparisonSticky"
            :movable="comparisonMovable"
            :offset="comparisonOffset"
            @select-template="templateIdx = $event"
            @select-test="testIdx = $event"
            @compare="compare(shapes)"
            @clear-result="clearResult"
            @clear="clear"
          />
        </div>
      </div>

      <section class="dev-json-panel">
        <div class="dev-json-header">
          <span>组件状态</span>
          <button type="button" @click="refreshDebugSnapshot">刷新</button>
        </div>
        <pre ref="debugPreRef" @scroll="onDebugScroll">{{ debugJson }}</pre>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import CanvasAnnotator from '../src/components/CanvasAnnotator.vue'
import ComparisonPanel from '../src/components/ComparisonPanel.vue'
import ComparisonOverlay from '../src/components/ComparisonOverlay.vue'
import { useComparison } from '../src/composables/useComparison'
import type { Meta, Shape } from '../src/engine/types'

const readonly = ref(false)
const debugEngine = ref(false)
const showComparisonPanel = ref(true)
const comparisonTeleport = ref(false)
const comparisonSticky = ref(false)
const comparisonMovable = ref(true)
const comparisonOffset = reactive({
  top: 12,
  right: 12,
  bottom: undefined as number | undefined,
  left: undefined as number | undefined
})

const annotatorRef = ref<InstanceType<typeof CanvasAnnotator> | null>(null)
const shapes = ref<Shape[]>([])
const meta = ref<Meta>({ scale: 1, translateX: 0, translateY: 0, mode: '', group: '' })
const shortcutState = ref<Record<string, boolean>>({})
const engineSnapshot = ref<Record<string, unknown> | null>(null)
const debugPreRef = ref<HTMLPreElement | null>(null)
const debugStickToBottom = ref(true)
const debugScrollTop = ref(0)

const { templateIdx, testIdx, result, loading, compare, clear, clearResult } = useComparison()

const preloadedMeta: Meta = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  mode: 'polyline',
  group: 'red'
}

const preloadedShapes: Shape[] = [
  {
    type: 'polyline',
    group: 'red',
    complete: true,
    points: [
      { x: 150, y: 210 },
      { x: 230, y: 180 },
      { x: 325, y: 240 },
      { x: 430, y: 225 },
      { x: 525, y: 295 }
    ]
  },
  {
    type: 'polyline',
    group: 'blue',
    complete: true,
    points: [
      { x: 150, y: 218 },
      { x: 238, y: 190 },
      { x: 322, y: 252 },
      { x: 438, y: 236 },
      { x: 526, y: 312 }
    ]
  },
  {
    type: 'rect',
    group: 'green',
    x: 330,
    y: 405,
    w: 210,
    h: 86,
    rotation: 0.12
  },
  {
    type: 'point',
    group: 'yellow',
    x: 488,
    y: 132
  }
]

let debugTimer: ReturnType<typeof setInterval> | null = null
let restoringDebugScroll = false

function getCurrentMeta(): Meta {
  return (
    annotatorRef.value?.getMeta() ?? {
      scale: 1,
      translateX: 0,
      translateY: 0,
      mode: '',
      group: ''
    }
  )
}

function readEngineSnapshot(): Record<string, unknown> | null {
  if (!debugEngine.value) return null
  const engine = annotatorRef.value?.engine?.() as any
  if (!engine) return { mounted: false }
  return {
    mounted: true,
    mode: engine.mode,
    interactionMode: engine.interactionMode,
    readonly: engine.readonly,
    currentGroup: engine.currentGroup,
    historyIndex: engine._historyIndex,
    historyLength: engine._historyStack?.length ?? 0,
    state: engine._state,
    shapeLayer: engine._shapeLayer
      ? {
          scale: engine._shapeLayer.scale,
          translateX: engine._shapeLayer.translateX,
          translateY: engine._shapeLayer.translateY,
          current: engine._shapeLayer.current,
          shapeCount: engine._shapeLayer.shapes?.length ?? 0
        }
      : null
  }
}

function refreshDebugSnapshot() {
  shortcutState.value = annotatorRef.value?.getShortcutState?.() ?? {}
  engineSnapshot.value = readEngineSnapshot()
}

function onDebugScroll() {
  if (restoringDebugScroll) return
  const el = debugPreRef.value
  if (!el) return
  debugScrollTop.value = el.scrollTop
  debugStickToBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 12
}

function cloneShapes(list: Shape[]): Shape[] {
  return JSON.parse(JSON.stringify(list)) as Shape[]
}

function loadPreloadedData() {
  const nextShapes = cloneShapes(preloadedShapes)
  annotatorRef.value?.loadAnnotationState?.(nextShapes, preloadedMeta)
  shapes.value = nextShapes
  meta.value = { ...preloadedMeta }
  clear()
  templateIdx.value = 0
  testIdx.value = 1
  refreshDebugSnapshot()
}

function displayComparisonResult() {
  if (!result.value) return null
  const rest = { ...result.value } as Record<string, unknown>
  delete rest.resampledA
  delete rest.resampledB
  return rest
}

function onAnnotatorChange(s: Shape[], m: Meta) {
  shapes.value = s
  meta.value = m
  refreshDebugSnapshot()
}

function startDebugTimer() {
  stopDebugTimer()
  if (!debugEngine.value) return
  debugTimer = setInterval(refreshDebugSnapshot, 250)
}

function stopDebugTimer() {
  if (debugTimer) {
    clearInterval(debugTimer)
    debugTimer = null
  }
}

watch(debugEngine, () => {
  refreshDebugSnapshot()
  startDebugTimer()
})

onMounted(() => {
  refreshDebugSnapshot()
  startDebugTimer()
})

onUnmounted(() => {
  stopDebugTimer()
})

const debugJson = computed(() =>
  JSON.stringify(
    {
      props: {
        readonly: readonly.value
      },
      comparisonPanel: {
        visible: showComparisonPanel.value,
        teleport: comparisonTeleport.value,
        sticky: comparisonSticky.value,
        movable: comparisonMovable.value,
        offset: comparisonOffset
      },
      component: {
        meta: meta.value,
        shapeCount: shapes.value.length,
        shortcutState: shortcutState.value,
        shapes: shapes.value
      },
      comparison: {
        templateIdx: templateIdx.value,
        testIdx: testIdx.value,
        loading: loading.value,
        hasResult: !!result.value,
        result: displayComparisonResult()
      },
      engine: debugEngine.value ? engineSnapshot.value : 'disabled'
    },
    null,
    2
  )
)

watch(
  debugJson,
  () => {
    const el = debugPreRef.value
    if (!el) return
    const shouldFollowBottom = debugStickToBottom.value
    const previousTop = debugScrollTop.value
    nextTick(() => {
      const nextEl = debugPreRef.value
      if (!nextEl) return
      restoringDebugScroll = true
      if (shouldFollowBottom) {
        nextEl.scrollTop = nextEl.scrollHeight
      } else {
        nextEl.scrollTop = Math.min(previousTop, nextEl.scrollHeight - nextEl.clientHeight)
      }
      requestAnimationFrame(() => {
        restoringDebugScroll = false
      })
    })
  },
  { flush: 'post' }
)
</script>

<style scoped>
:global(:root) {
  --dev-bg: #ecefe6;
  --dev-bg-card: rgba(255, 255, 250, 0.78);
  --dev-bg-subtle: #eef0e8;
  --dev-border: #d9ddd2;
  --dev-border-strong: #c6ccbf;
  --dev-text: #091012;
  --dev-text-secondary: #4d5652;
  --dev-text-tertiary: #82908c;
  --dev-accent: #171b16;
  --dev-accent-hover: #252a23;
  --dev-danger: #ff5b64;
  --dev-danger-light: #fff0f1;
  --dev-success: #0d8d41;
  --dev-success-light: #e8f6e9;
  --dev-font-display: 'Arial Black', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif;
  --dev-font-body: 'Aptos', 'Microsoft YaHei UI', sans-serif;
  --dev-font-mono: 'Cascadia Mono', 'Consolas', monospace;

  --da-annotator-bg: rgba(238, 240, 232, 0.72);
  --da-annotator-text: var(--dev-text);
  --da-annotator-muted: var(--dev-text-secondary);
  --da-annotator-subtle: var(--dev-text-tertiary);
  --da-annotator-panel-bg: rgba(255, 255, 250, 0.9);
  --da-annotator-canvas-bg: #fffefa;
  --da-annotator-border: var(--dev-border);
  --da-annotator-border-strong: var(--dev-border-strong);
  --da-annotator-divider: rgba(198, 204, 191, 0.72);
  --da-annotator-tool-bg: rgba(255, 255, 250, 0.72);
  --da-annotator-tool-fg: var(--dev-text-secondary);
  --da-annotator-tool-hover-bg: rgba(9, 16, 18, 0.075);
  --da-annotator-tool-active-bg: rgba(9, 16, 18, 0.12);
  --da-annotator-selected-bg: rgba(9, 16, 18, 0.12);
  --da-annotator-selected-border: var(--dev-accent);
  --da-annotator-selected-fg: var(--dev-text);
  --da-annotator-mode-selected-bg: rgba(9, 16, 18, 0.12);
  --da-annotator-mode-selected-border: var(--dev-accent);
  --da-annotator-group-selected-border: var(--dev-accent);
  --da-annotator-action-fg: #ffffff;
  --da-annotator-primary-bg: var(--dev-accent);
  --da-annotator-primary-hover-bg: var(--dev-accent-hover);
  --da-annotator-primary-border: var(--dev-accent);
  --da-annotator-primary-disabled-bg: #d8ddd2;
  --da-annotator-danger-bg: var(--dev-danger);
  --da-annotator-danger-hover-bg: #e84c55;
  --da-annotator-danger-border: var(--dev-danger);
  --da-annotator-danger-soft-bg: var(--dev-danger-light);
  --da-annotator-danger-soft-fg: var(--dev-danger);
  --da-annotator-danger-soft-border: #ffb6bd;
  --da-annotator-list-title: var(--dev-text);
  --da-annotator-shape-title: var(--dev-text);
  --da-annotator-shape-angle: var(--dev-danger);
  --da-annotator-shape-editing: #966400;
  --da-annotator-shape-border: rgba(217, 221, 210, 0.82);
  --da-annotator-shape-hover-bg: rgba(9, 16, 18, 0.045);

  --da-compare-panel-bg: #fffefa;
  --da-compare-panel-border: var(--dev-border);
  --da-compare-panel-text: var(--dev-text);
  --da-compare-panel-title: var(--dev-text);
  --da-compare-panel-muted: var(--dev-text-secondary);
  --da-compare-panel-subtle: var(--dev-text-tertiary);
  --da-compare-control-bg: rgba(255, 255, 250, 0.78);
  --da-compare-control-border: var(--dev-border-strong);
  --da-compare-primary-bg: var(--dev-accent);
  --da-compare-primary-hover-bg: var(--dev-accent-hover);
  --da-compare-primary-fg: #ffffff;
  --da-compare-primary-disabled-bg: #d8ddd2;
  --da-compare-primary-disabled-fg: #98a198;
  --da-compare-pass-bg: var(--dev-success-light);
  --da-compare-pass-fg: var(--dev-success);
  --da-compare-fail-bg: var(--dev-danger-light);
  --da-compare-fail-fg: var(--dev-danger);
}

:global(body) {
  margin: 0;
  color: var(--dev-text);
  background:
    linear-gradient(rgba(33, 39, 31, 0.045) 1px, transparent 1px) 0 0 / 38px 38px,
    linear-gradient(90deg, rgba(33, 39, 31, 0.045) 1px, transparent 1px) 0 0 / 38px 38px,
    var(--dev-bg);
  font-family: var(--dev-font-body);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

.dev-app {
  min-height: 100vh;
  padding: 20px 24px 24px;
}

.dev-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dev-kicker,
.dev-section-title {
  margin: 0 0 4px;
  color: var(--dev-text-tertiary);
  font-family: var(--dev-font-mono);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.dev-header h1 {
  margin: 0;
  color: var(--dev-text);
  font-family: var(--dev-font-display);
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
}

.dev-route-pill {
  min-width: 126px;
  height: 34px;
  border: 1px solid var(--dev-border);
  border-radius: 999px;
  background: rgba(255, 255, 250, 0.82);
  color: var(--dev-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--dev-font-mono);
  font-size: 11px;
  font-weight: 800;
}

.dev-card {
  min-width: 0;
  min-height: calc(100vh - 124px);
  border: 1px solid var(--dev-border);
  border-radius: 24px;
  background: var(--dev-bg-card);
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 320px;
  grid-template-areas: 'options stage json';
  gap: 18px;
  padding: 18px;
  box-shadow: 0 28px 60px rgba(24, 28, 22, 0.1);
  overflow-x: hidden;
}

.dev-options,
.dev-json-panel,
.dev-annotator-shell {
  border: 1px solid var(--dev-border);
  border-radius: 18px;
  background: rgba(255, 255, 250, 0.78);
  box-shadow: 0 1px 2px rgba(16, 20, 15, 0.04);
}

.dev-options {
  grid-area: options;
  height: max-content;
  padding: 16px;
}

.dev-section + .dev-section {
  margin-top: 22px;
}

.dev-check {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--dev-text-secondary);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.dev-check input {
  width: 15px;
  height: 15px;
  accent-color: var(--dev-accent);
}

.dev-action {
  width: 100%;
  height: 28px;
  margin-top: 8px;
  border: 1px solid var(--dev-border-strong);
  border-radius: 8px;
  background: #fffefa;
  color: var(--dev-text-secondary);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.dev-action:hover {
  color: #ffffff;
  background: var(--dev-accent);
  border-color: var(--dev-accent);
}

.dev-offset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.dev-offset-grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--dev-text-tertiary);
  font-family: var(--dev-font-mono);
  font-size: 10px;
  font-weight: 900;
}

.dev-offset-grid input {
  width: 100%;
  height: 28px;
  border: 1px solid var(--dev-border-strong);
  border-radius: 8px;
  background: #fffefa;
  color: var(--dev-text);
  padding: 0 8px;
  font-family: var(--dev-font-mono);
  font-size: 11px;
  font-weight: 800;
}

.dev-stage {
  grid-area: stage;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: auto;
  overflow-y: hidden;
}

.dev-annotator-shell {
  position: relative;
  flex: 0 0 auto;
  overflow: hidden;
  background: var(--da-annotator-bg);
}

.dev-json-panel {
  grid-area: json;
  min-height: 0;
  max-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dev-json-header {
  height: 42px;
  border-bottom: 1px solid var(--dev-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  color: var(--dev-text);
  font-size: 12px;
  font-weight: 900;
}

.dev-json-header button {
  height: 24px;
  border: 1px solid var(--dev-border-strong);
  border-radius: 8px;
  background: #fffefa;
  color: var(--dev-text-secondary);
  padding: 0 10px;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.dev-json-header button:hover {
  color: #ffffff;
  background: var(--dev-accent);
  border-color: var(--dev-accent);
}

.dev-json-panel pre {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 14px;
  overflow: auto;
  color: #2f3934;
  font-family: var(--dev-font-mono);
  font-size: 11px;
  line-height: 1.55;
  white-space: pre;
}
</style>
