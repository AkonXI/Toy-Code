<script setup lang="ts">
import type { Shape } from '../engine/types'
import type { MatchResult } from '../matcher/types'
import { comparableShapes } from '../composables/useComparison'

defineProps<{
  shapes: Shape[]
  templateIdx: number | null
  testIdx: number | null
  result: MatchResult | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'select-template', idx: number): void
  (e: 'select-test', idx: number): void
  (e: 'compare'): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="absolute top-3 right-3 z-50 w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg p-3.5 text-xs">
    <div class="flex justify-between items-center mb-2.5">
      <span class="font-bold text-[13px] text-gray-800">轨迹比对</span>
      <button
        v-if="result"
        class="bg-transparent border-none text-lg cursor-pointer text-gray-400 leading-none px-0.5 hover:text-gray-700"
        @click="emit('clear')"
      >&times;</button>
    </div>

    <div class="mb-2">
      <label class="block text-[11px] text-gray-500 mb-1">模板标注 (A)</label>
      <select
        class="w-full py-1.5 px-2 border border-gray-300 rounded-md text-xs bg-white"
        :value="templateIdx ?? ''"
        @change="emit('select-template', Number(($event.target as HTMLSelectElement).value))"
      >
        <option value="" disabled>-- 选择模板 --</option>
        <option v-for="s in comparableShapes(shapes)" :key="s.idx" :value="s.idx">
          {{ s.label }}
        </option>
      </select>
    </div>

    <div class="mb-2">
      <label class="block text-[11px] text-gray-500 mb-1">测试标注 (B)</label>
      <select
        class="w-full py-1.5 px-2 border border-gray-300 rounded-md text-xs bg-white"
        :value="testIdx ?? ''"
        @change="emit('select-test', Number(($event.target as HTMLSelectElement).value))"
      >
        <option value="" disabled>-- 选择测试 --</option>
        <option v-for="s in comparableShapes(shapes)" :key="s.idx" :value="s.idx">
          {{ s.label }}
        </option>
      </select>
    </div>

    <button
      class="w-full py-1.5 mt-1.5 bg-blue-600 text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
      :disabled="templateIdx == null || testIdx == null || loading"
      @click="emit('compare')"
    >
      {{ loading ? '比对中...' : '开始比对' }}
    </button>

    <div v-if="result" class="mt-3 pt-2.5 border-t border-gray-200">
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-gray-500 text-[11px]">包围盒对角线</span>
        <span class="font-mono font-semibold text-xs text-gray-800">{{ result.diagonal.toFixed(0) }} px</span>
      </div>
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-gray-500 text-[11px]">阈值 E_max</span>
        <span class="font-mono font-semibold text-xs text-gray-800">{{ result.eMax.toFixed(1) }} px</span>
      </div>
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-gray-500 text-[11px]">最大误差</span>
        <span class="flex items-center gap-1.5 font-mono font-semibold text-xs text-gray-800">
          <span>{{ result.maxError.toFixed(1) }} px</span>
          <span :class="['text-[10px] font-bold px-1.5 py-px rounded-lg uppercase', result.maxErrorPass ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-600']">
            {{ result.maxErrorPass ? 'PASS' : 'FAIL' }}
          </span>
        </span>
      </div>
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-gray-500 text-[11px]">相似度</span>
        <span class="flex items-center gap-1.5 font-mono font-semibold text-xs text-gray-800">
          <span>{{ (result.similarity * 100).toFixed(1) }}%</span>
          <span :class="['text-[10px] font-bold px-1.5 py-px rounded-lg uppercase', result.similarityPass ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-600']">
            {{ result.similarityPass ? 'PASS' : 'FAIL' }}
          </span>
        </span>
      </div>
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-gray-400 text-[11px]">重合率（参考）</span>
        <span class="font-mono text-[11px] text-gray-400">{{ (result.coverage * 100).toFixed(1) }}%</span>
      </div>
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-gray-500 text-[11px]">违规点</span>
        <span class="font-mono font-semibold text-xs" :class="result.violations.length > 0 ? 'text-red-600' : 'text-green-600'">
          {{ result.violations.length }} 个
        </span>
      </div>
      <div
        class="mt-2.5 text-center font-bold text-[13px] py-1.5 rounded-md"
        :class="result.maxErrorPass && result.similarityPass ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-600'"
      >
        {{ result.maxErrorPass && result.similarityPass ? '✓ 通过' : '✗ 不通过' }}
      </div>
    </div>
  </div>
</template>
