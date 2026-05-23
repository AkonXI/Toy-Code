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
    <CanvasAnnotator :readonly="readonly" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CanvasAnnotator from './components/CanvasAnnotator.vue'

const readonly = ref(false)
</script>
