<template>
  <div class="precision-annotation-view">
    <header class="precision-annotation-header">
      <div class="flex items-center gap-3">
        <el-button class="da-back-button" text size="small" @click="backToDetail"
          ><el-icon><ArrowLeft /></el-icon> 数据集详情</el-button
        >
        <span style="color: var(--text-tertiary); font-size: 12px">|</span>
        <span class="text-xs" style="color: var(--text-secondary)">{{
          allImages.length > 0 ? `图片 ${currentIdx + 1} / ${allImages.length}` : ''
        }}</span>
      </div>
      <div v-if="currentImage" class="flex items-center gap-2">
        <el-button size="small" @click="showPendingRail = !showPendingRail">{{
          showPendingRail ? '隐藏待标注' : '显示待标注'
        }}</el-button>
        <el-button size="small" :disabled="props.readonly" @click="skipImage">跳过</el-button>
        <el-button size="small" type="primary" :disabled="props.readonly" @click="completeImage"
          >完成</el-button
        >
      </div>
    </header>

    <div class="precision-annotation-body">
      <div v-if="showPendingRail && allImages.length > 0" class="precision-image-rail">
        <ImageGrid
          :images="pendingImages"
          :selected-id="currentImage?.id ?? null"
          @select="goToImage"
        />
      </div>
      <div class="precision-annotation-canvas">
        <div
          v-if="currentImage && currentSrc"
          class="w-full h-full flex items-center justify-center p-4"
        >
          <div
            class="precision-annotator-shell rounded-xl overflow-hidden shadow-lg"
            style="background: #fff"
          >
            <CanvasAnnotator
              :key="currentSrc"
              ref="annotatorRef"
              :image-src="currentSrc"
              :readonly="props.readonly"
              :enabled-modes="datasetTools"
              :groups="datasetGroups"
              @change="onAnnotatorChange"
              @load="publishShortcutState"
            />
          </div>
        </div>
        <el-empty v-else description="暂无待标注图片" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import CanvasAnnotator from '../../../src/components/CanvasAnnotator.vue'
import ImageGrid from '../components/ImageGrid.vue'
import type { Shape, Meta, ModeType } from '../../../src/engine/types'

const props = defineProps<{ datasetId: number; startImageId?: number | null; readonly?: boolean }>()
const router = useRouter()

interface ImageItem {
  id: number
  dataset_id: number
  filename: string
  original_name: string
  width: number
  height: number
  created_at: string
  annotated: boolean
  skipped: boolean
}

const allImages = ref<ImageItem[]>([])
const currentIdx = ref(0)
const currentSrc = ref('')
const annotatorRef = ref<InstanceType<typeof CanvasAnnotator> | null>(null)
const datasetTools = ref<ModeType[]>(['rect', 'point', 'polyline', 'polygon'])
const datasetGroups = ref<any[]>([])
const showPendingRail = ref(true)

const currentImage = computed(() => allImages.value[currentIdx.value] ?? null)
const pendingImages = computed(() => allImages.value.filter((i) => !i.annotated && !i.skipped))

function publishShortcutState() {
  const state = annotatorRef.value?.getShortcutState?.() ?? {
    canUndo: false,
    canRedo: false,
    hasSelected: false,
    canComplete: false,
    canClear: false
  }
  window.electronAPI?.setShortcutState?.({
    page: 'annotate',
    readonly: Boolean(props.readonly || !currentImage.value || !currentSrc.value),
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    hasSelected: state.hasSelected,
    canComplete: state.canComplete,
    canClear: state.canClear,
    canZoom: Boolean(currentImage.value && currentSrc.value)
  })
}

function scheduleShortcutStatePublish() {
  nextTick(() => publishShortcutState())
}

function backToDetail() {
  router.push(`/datasets/${props.datasetId}`)
}

async function loadDatasetTools() {
  const list = await window.electronAPI.dataset.list()
  const ds = list.find((d: any) => d.id === props.datasetId)
  if (ds?.tools) {
    const t = JSON.parse(ds.tools)
    datasetTools.value = Array.isArray(t)
      ? t.filter((x: any): x is ModeType => ['rect', 'point', 'polyline', 'polygon'].includes(x))
      : datasetTools.value
  }
  if (ds?.groups) {
    const g = JSON.parse(ds.groups)
    datasetGroups.value = Array.isArray(g) ? g.slice(0, 4) : datasetGroups.value
  }
}

async function loadImages() {
  allImages.value = await window.electronAPI.image.listWithStatus(props.datasetId)
  if (allImages.value.length === 0) {
    currentIdx.value = 0
    currentSrc.value = ''
    scheduleShortcutStatePublish()
    return
  }
  const targetId = props.startImageId
  const targetIdx = targetId ? allImages.value.findIndex((image) => image.id === targetId) : -1
  if (targetIdx >= 0) {
    currentIdx.value = targetIdx
  } else {
    const nextPending = pendingImages.value[0]
    currentIdx.value = nextPending
      ? allImages.value.findIndex((image) => image.id === nextPending.id)
      : 0
  }
  if (currentImage.value) await loadCurrentImage()
}

async function loadCurrentImage() {
  const img = currentImage.value
  if (!img) {
    currentSrc.value = ''
    scheduleShortcutStatePublish()
    return
  }
  const url =
    (await window.electronAPI.image.getUrl?.(img.id)) ??
    'local-file:///' +
      encodeURI((await window.electronAPI.image.getPath(img.id)).replace(/\\/g, '/'))
  currentSrc.value = url
  scheduleShortcutStatePublish()
}

async function goToImage(id: number) {
  const idx = allImages.value.findIndex((i) => i.id === id)
  if (idx >= 0) {
    currentIdx.value = idx
    await loadCurrentImage()
  }
}

async function completeImage() {
  if (!currentImage.value || !annotatorRef.value) return
  annotatorRef.value.completeCurrent?.()
  publishShortcutState()
  const shapes = annotatorRef.value.getShapes?.() ?? []
  const meta = annotatorRef.value.getMeta?.() ?? {
    scale: 1,
    translateX: 0,
    translateY: 0,
    mode: datasetTools.value[0] ?? 'rect',
    group: datasetGroups.value[0]?.name ?? 'red'
  }
  await window.electronAPI.annotation.save(
    currentImage.value.id,
    JSON.stringify(shapes),
    JSON.stringify(meta)
  )
  updateImageStatus(currentImage.value.id, { annotated: true, skipped: false })
  await advanceToNext()
}

async function skipImage() {
  if (!currentImage.value) return
  await window.electronAPI.annotation.skip(currentImage.value.id)
  updateImageStatus(currentImage.value.id, { annotated: false, skipped: true })
  await advanceToNext()
}

function updateImageStatus(id: number, st: Pick<ImageItem, 'annotated' | 'skipped'>) {
  const img = allImages.value.find((i) => i.id === id)
  if (img) {
    img.annotated = st.annotated
    img.skipped = st.skipped
  }
}

async function advanceToNext() {
  const next = pendingImages.value[0]
  if (next) {
    await goToImage(next.id)
  } else {
    backToDetail()
  }
}

function onAnnotatorChange(_shapes: Shape[], _meta: Meta) {
  publishShortcutState()
}

onMounted(() => {
  window.electronAPI?.onPageChange?.('annotate')
  scheduleShortcutStatePublish()
})

onUnmounted(() => {
  window.electronAPI?.setShortcutState?.({
    page: 'annotate',
    readonly: true,
    canUndo: false,
    canRedo: false,
    hasSelected: false,
    canComplete: false,
    canClear: false,
    canZoom: false
  })
})

watch(
  () => [props.datasetId, props.startImageId],
  () => {
    loadDatasetTools()
    loadImages()
  },
  { immediate: true }
)

watch(
  () => props.readonly,
  () => scheduleShortcutStatePublish()
)
</script>

<style scoped>
.precision-annotation-view {
  height: 100%;
  min-height: 0;
  margin: 0 30px 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(255, 255, 250, 0.78);
  box-shadow: var(--shadow-lg);
}

.precision-annotation-header {
  height: 52px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 250, 0.8);
}

.precision-annotation-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
}

.precision-image-rail {
  width: 260px;
  flex: 0 0 260px;
  overflow: hidden;
  border-right: 1px solid var(--border);
  background: var(--bg-subtle);
}

.precision-annotation-canvas {
  min-width: 1000px;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    linear-gradient(rgba(33, 39, 31, 0.045) 1px, transparent 1px) 0 0 / 38px 38px,
    linear-gradient(90deg, rgba(33, 39, 31, 0.045) 1px, transparent 1px) 0 0 / 38px 38px,
    rgba(255, 255, 250, 0.36);
}

.precision-annotator-shell {
  --da-annotator-bg: rgba(238, 240, 232, 0.72);
  --da-annotator-text: var(--text);
  --da-annotator-muted: var(--text-secondary);
  --da-annotator-subtle: var(--text-tertiary);
  --da-annotator-panel-bg: rgba(255, 255, 250, 0.9);
  --da-annotator-canvas-bg: #fffefa;
  --da-annotator-border: var(--border);
  --da-annotator-border-strong: var(--border-strong);
  --da-annotator-divider: rgba(198, 204, 191, 0.72);
  --da-annotator-tool-bg: rgba(255, 255, 250, 0.72);
  --da-annotator-tool-fg: var(--text-secondary);
  --da-annotator-tool-hover-bg: rgba(9, 16, 18, 0.075);
  --da-annotator-tool-active-bg: rgba(9, 16, 18, 0.12);
  --da-annotator-selected-bg: rgba(9, 16, 18, 0.12);
  --da-annotator-selected-border: var(--accent);
  --da-annotator-selected-fg: var(--text);
  --da-annotator-mode-selected-bg: rgba(9, 16, 18, 0.12);
  --da-annotator-mode-selected-border: var(--accent);
  --da-annotator-group-selected-border: var(--accent);
  --da-annotator-action-fg: #ffffff;
  --da-annotator-primary-bg: var(--accent);
  --da-annotator-primary-hover-bg: var(--accent-hover);
  --da-annotator-primary-border: var(--accent);
  --da-annotator-primary-disabled-bg: #d8ddd2;
  --da-annotator-danger-bg: var(--danger);
  --da-annotator-danger-hover-bg: #e84c55;
  --da-annotator-danger-border: var(--danger);
  --da-annotator-danger-soft-bg: var(--danger-light);
  --da-annotator-danger-soft-fg: var(--danger);
  --da-annotator-danger-soft-border: #ffb6bd;
  --da-annotator-list-title: var(--text);
  --da-annotator-shape-title: var(--text);
  --da-annotator-shape-angle: var(--danger);
  --da-annotator-shape-editing: #966400;
  --da-annotator-shape-border: rgba(217, 221, 210, 0.82);
  --da-annotator-shape-hover-bg: rgba(9, 16, 18, 0.045);
  overflow: hidden;
  border-radius: 12px;
  background: var(--da-annotator-bg);
  box-shadow: var(--shadow-lg);
}
</style>
