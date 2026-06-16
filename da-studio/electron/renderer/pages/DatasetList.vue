<template>
  <div class="page-wrap dataset-list-page">
    <div class="page-card">
      <header class="dataset-card-header flex items-start justify-between">
        <div>
          <p class="section-kicker">DATASETS</p>
          <h1>标注数据资产</h1>
          <p>共 {{ datasets.length }} 个数据集</p>
        </div>
        <el-button
          class="da-button da-button--primary da-button--large"
          type="primary"
          @click="showCreate = true"
        >
          <el-icon class="mr-1"><Plus /></el-icon> 新建数据集
        </el-button>
      </header>

      <el-empty v-if="datasets.length === 0" description="暂无数据集" :image-size="80" />

      <div v-else class="dataset-list">
        <div
          v-for="(ds, i) in datasets"
          :key="ds.id"
          class="dataset-row anim-in"
          :style="{ animationDelay: `${i * 0.04}s` }"
        >
          <div class="dataset-row-card" @click="$router.push(`/datasets/${ds.id}`)">
            <div class="flex items-start justify-between gap-4">
              <div class="dataset-row-main flex-1 min-w-0">
                <div class="dataset-index">{{ String(i + 1).padStart(2, '0') }}</div>
                <div class="min-w-0">
                  <h3>{{ ds.name }}</h3>
                  <div v-if="ds.descriptionText" class="dataset-description">
                    {{ ds.descriptionText }}
                  </div>
                  <div class="dataset-date">{{ ds.created_at }}</div>
                </div>
              </div>
              <div class="dataset-actions flex gap-2 shrink-0" @click.stop>
                <el-button
                  class="da-button da-button--outline"
                  size="small"
                  native-type="button"
                  @click.stop="uploadImages(ds.id)"
                  >上传</el-button
                >
                <el-button
                  class="da-button da-button--primary"
                  size="small"
                  type="primary"
                  :disabled="!ds.canAnnotate"
                  native-type="button"
                  @click.stop="$router.push(`/datasets/${ds.id}/annotate`)"
                  >标注</el-button
                >
                <el-button
                  :class="['da-button', ds.canEdit ? 'da-button--outline' : 'da-button--muted']"
                  size="small"
                  :disabled="!ds.canEdit"
                  native-type="button"
                  @click.stop="showEdit = ds"
                  >编辑</el-button
                >
                <el-button
                  class="da-button da-button--danger"
                  size="small"
                  type="danger"
                  plain
                  native-type="button"
                  @click.stop.prevent="requestRemove(ds)"
                  >删除</el-button
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <DatasetCreateDialog v-if="showCreate" @close="showCreate = false" @saved="handleSaved" />
    <DatasetCreateDialog
      v-if="showEdit"
      :dataset="showEdit"
      @close="showEdit = null"
      @saved="handleSaved"
    />
    <div v-if="pendingDelete" class="da-modal-backdrop" @click.self="pendingDelete = null">
      <section
        class="da-modal da-modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dataset-title"
      >
        <header class="da-modal-header">
          <h2 id="delete-dataset-title">删除数据集</h2>
          <button
            class="da-modal-close"
            type="button"
            aria-label="关闭"
            @click="pendingDelete = null"
          >
            ×
          </button>
        </header>
        <div class="da-modal-body">
          <p class="da-confirm-text">
            确定删除「{{ pendingDelete.name }}」？数据集内图片和标注记录会一起删除。
          </p>
        </div>
        <footer class="da-modal-actions">
          <el-button
            class="da-button da-button--outline"
            :disabled="deleting"
            @click="pendingDelete = null"
            >取消</el-button
          >
          <el-button
            class="da-button da-button--danger"
            type="danger"
            :loading="deleting"
            @click="confirmRemove"
            >删除</el-button
          >
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DatasetCreateDialog from './DatasetCreateDialog.vue'

const datasets = ref<any[]>([])
const showCreate = ref(false)
const showEdit = ref<any | null>(null)
const pendingDelete = ref<any | null>(null)
const deleting = ref(false)

function toPlainText(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim()
}

async function load() {
  const list = await window.electronAPI.dataset.list()
  datasets.value = await Promise.all(
    list.map(async (dataset: any) => {
      const images = await window.electronAPI.image.listWithStatus(dataset.id)
      const annotatedCount = images.filter((image: any) => image.annotated).length
      const pendingCount = images.filter((image: any) => !image.annotated && !image.skipped).length
      return {
        ...dataset,
        descriptionText: dataset.description ? toPlainText(dataset.description) : '',
        imageCount: images.length,
        annotatedCount,
        pendingCount,
        canAnnotate: pendingCount > 0,
        canEdit: annotatedCount === 0
      }
    })
  )
}

async function handleSaved() {
  showCreate.value = false
  showEdit.value = null
  await load()
}

async function uploadImages(datasetId: number) {
  const result = await window.electronAPI.image.upload(datasetId)
  if (result.created.length > 0 && result.skipped > 0) {
    ElMessage.success(`上传完成，新增 ${result.created.length} 张，跳过重复 ${result.skipped} 张`)
  } else if (result.created.length > 0) {
    ElMessage.success(`上传完成，共 ${result.created.length} 张`)
  } else if (result.skipped > 0) {
    ElMessage.warning(`已跳过 ${result.skipped} 张重复图片`)
  }
  await load()
}

function requestRemove(ds: any) {
  pendingDelete.value = ds
}

async function confirmRemove() {
  if (!pendingDelete.value || deleting.value) return
  const ds = pendingDelete.value
  deleting.value = true
  try {
    await window.electronAPI.dataset.delete(ds.id)
    pendingDelete.value = null
    ElMessage.success('已删除')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>
