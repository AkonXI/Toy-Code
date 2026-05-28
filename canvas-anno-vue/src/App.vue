<template>
  <div>
    <div class="flex items-center gap-2 max-w-[1160px] mx-auto px-5 pt-5">
      <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-600 select-none">
        <input
          type="checkbox"
          :checked="readonly"
          @change="readonly = !readonly"
          class="w-4 h-4"
        />
        只读模式
      </label>
      <span class="text-xs text-gray-400">
        {{ readonly ? '仅可查看和平移缩放，禁止编辑' : '正常编辑模式' }}
      </span>
    </div>

    <div style="position: relative;">
      <CanvasAnnotator ref="annotatorRef" :readonly="readonly" @change="onAnnotatorChange">
        <template #canvas-overlay>
          <ComparisonOverlay
            v-if="result"
            :result="result"
            :get-meta="getCurrentMeta"
          />
        </template>
      </CanvasAnnotator>

      <ComparisonPanel
        :shapes="shapes"
        :template-idx="templateIdx"
        :test-idx="testIdx"
        :result="result"
        :loading="loading"
        @select-template="templateIdx = $event"
        @select-test="testIdx = $event"
        @compare="compare(shapes)"
        @clear="clear"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CanvasAnnotator from './components/CanvasAnnotator.vue'
import ComparisonPanel from './components/ComparisonPanel.vue'
import ComparisonOverlay from './components/ComparisonOverlay.vue'
import { useComparison } from './composables/useComparison'
import type { Shape, Meta } from './engine/types'

const readonly = ref(false)
const annotatorRef = ref<InstanceType<typeof CanvasAnnotator> | null>(null)
const shapes = ref<Shape[]>([])
const meta = ref<Meta>({ scale: 1, translateX: 0, translateY: 0, mode: '', group: '' })

const { templateIdx, testIdx, result, loading, compare, clear } = useComparison()

let recompareTimer: ReturnType<typeof setTimeout> | null = null

function getCurrentMeta(): Meta {
  return annotatorRef.value?.getMeta()
    ?? { scale: 1, translateX: 0, translateY: 0, mode: '', group: '' }
}

function onAnnotatorChange(s: Shape[], m: Meta) {
  shapes.value = s
  meta.value = m
  // 比对已激活时，图形变动自动触发重新比对（拖拽期间 250ms 防抖）
  if (result.value) {
    if (recompareTimer) clearTimeout(recompareTimer)
    recompareTimer = setTimeout(() => compare(s), 250)
  }
}
</script>
