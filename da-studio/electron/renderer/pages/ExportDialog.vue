<template>
  <div class="da-modal-backdrop" @click.self="close">
    <section
      class="da-modal da-modal--export"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
    >
      <header class="da-modal-header">
        <h2 id="export-title">导出标注</h2>
        <button class="da-modal-close" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="da-modal-body">
        <div class="da-export-options">
          <label class="da-export-option" :class="{ active: format === 'json' }">
            <input v-model="format" type="radio" value="json" />
            <span>
              <strong>JSON</strong>
              <small>完整标注数据，含图形坐标、类型、分组</small>
            </span>
          </label>
          <label class="da-export-option" :class="{ active: format === 'csv' }">
            <input v-model="format" type="radio" value="csv" />
            <span>
              <strong>CSV</strong>
              <small>表格化数据，可导入 Excel 等工具</small>
            </span>
          </label>
        </div>
      </div>

      <footer class="da-modal-actions">
        <el-button class="da-button da-button--outline" @click="close">取消</el-button>
        <el-button class="da-button da-button--primary" type="primary" @click="doExport"
          >导出</el-button
        >
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{ datasetId?: number }>()
const emit = defineEmits<{ close: [] }>()
const route = useRoute()
const router = useRouter()
const datasetId = computed(() => props.datasetId ?? Number(route.params.id))
const format = ref<'json' | 'csv'>('json')

function close() {
  if (props.datasetId) emit('close')
  else router.push(`/datasets/${datasetId.value}`)
}

async function doExport() {
  await window.electronAPI.annotation.export(datasetId.value, format.value)
  close()
}
</script>
