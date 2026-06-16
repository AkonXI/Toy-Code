<template>
  <div class="page-wrap dataset-detail-page">
    <div class="page-card">
      <div class="detail-back">
        <el-button
          class="da-button da-button--text da-back-button"
          text
          size="small"
          @click="$router.push('/datasets')"
          ><el-icon><ArrowLeft /></el-icon> 数据集</el-button
        >
      </div>

      <div v-if="dataset" class="detail-hero">
        <div>
          <p class="section-kicker">DATASET</p>
          <h1>{{ dataset.name }}</h1>
          <div v-if="dataset.description" class="detail-description-wrap">
            <div
              ref="detailDescriptionRef"
              :class="[
                'detail-description',
                { 'is-collapsed': !descriptionExpanded, 'is-expanded': descriptionExpanded }
              ]"
              v-html="dataset.description"
            ></div>
            <button
              v-if="descriptionExpandable"
              type="button"
              class="detail-description-toggle"
              @click="toggleDescription"
            >
              {{ descriptionExpanded ? '收起' : '展开' }}
            </button>
          </div>
        </div>
        <div class="detail-actions">
          <el-button
            class="da-button da-button--outline da-button--action"
            :disabled="images.length === 0"
            @click="showExport = true"
          >
            <el-icon><Download /></el-icon> 导出
          </el-button>
          <el-button
            class="da-button da-button--primary da-button--action"
            type="primary"
            :disabled="pendingCount === 0"
            @click="$router.push(`/datasets/${$route.params.id}/annotate`)"
          >
            <el-icon><Pointer /></el-icon> 开始标注
          </el-button>
        </div>
      </div>

      <div v-if="dataset" class="detail-stats">
        <div>
          <span>全部</span>
          <strong>{{ images.length }}</strong>
        </div>
        <div>
          <span>已标注</span>
          <strong>{{ annotatedCount }}</strong>
        </div>
        <div>
          <span>已跳过</span>
          <strong>{{ skippedCount }}</strong>
        </div>
        <div>
          <span>待标注</span>
          <strong>{{ pendingCount }}</strong>
        </div>
        <div>
          <span>创建</span>
          <strong class="detail-date">{{ dataset.created_at }}</strong>
        </div>
      </div>

      <ExportDialog
        v-if="showExport"
        :dataset-id="Number($route.params.id)"
        @close="showExport = false"
      />

      <el-table
        v-if="images.length > 0"
        class="dataset-image-table"
        :data="images"
        style="width: 100%"
      >
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="original_name" label="原始文件名" min-width="260">
          <template #default="{ row }">
            <span class="detail-file-name">{{ row.original_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="md5" label="MD5" min-width="300">
          <template #default="{ row }">
            <span class="detail-md5">{{ row.md5 || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="150" align="center" header-align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.annotated"
              class="da-tag da-tag--success"
              type="success"
              size="small"
              effect="plain"
              >已标注</el-tag
            >
            <el-tag
              v-else-if="row.skipped"
              class="da-tag da-tag--warning"
              type="warning"
              size="small"
              effect="plain"
              >已跳过</el-tag
            >
            <el-tag v-else class="da-tag da-tag--info" type="info" size="small" effect="plain"
              >未标注</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" header-align="center">
          <template #default="{ row }">
            <el-button
              class="da-button da-button--table-primary"
              size="small"
              native-type="button"
              @click.stop="$router.push(`/datasets/${$route.params.id}/annotate/${row.id}`)"
              >标注</el-button
            >
            <el-button
              v-if="row.annotated || row.skipped"
              class="da-button da-button--outline"
              size="small"
              native-type="button"
              @click.stop="
                $router.push(`/datasets/${$route.params.id}/annotate/${row.id}?readonly=1`)
              "
              >查看</el-button
            >
            <el-button
              class="da-button da-button--danger"
              size="small"
              type="danger"
              plain
              native-type="button"
              @click.stop.prevent="requestRemoveImage(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else-if="dataset" description="暂无图片" :image-size="80" />
    </div>
    <div
      v-if="pendingDeleteImage"
      class="da-modal-backdrop"
      @click.self="pendingDeleteImage = null"
    >
      <section
        class="da-modal da-modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-image-title"
      >
        <header class="da-modal-header">
          <h2 id="delete-image-title">删除图片</h2>
          <button
            class="da-modal-close"
            type="button"
            aria-label="关闭"
            @click="pendingDeleteImage = null"
          >
            ×
          </button>
        </header>
        <div class="da-modal-body">
          <p class="da-confirm-text">
            确定删除「{{ pendingDeleteImage.original_name }}」？对应标注记录会一起删除。
          </p>
        </div>
        <footer class="da-modal-actions">
          <el-button
            class="da-button da-button--outline"
            :disabled="deletingImage"
            @click="pendingDeleteImage = null"
            >取消</el-button
          >
          <el-button
            class="da-button da-button--danger"
            type="danger"
            :loading="deletingImage"
            @click="confirmRemoveImage"
            >删除</el-button
          >
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Download, Pointer } from '@element-plus/icons-vue'
import ExportDialog from './ExportDialog.vue'

const route = useRoute()
const dataset = ref<any>(null)
const images = ref<any[]>([])
const showExport = ref(false)
const detailDescriptionRef = ref<HTMLElement | null>(null)
const descriptionExpanded = ref(false)
const descriptionExpandable = ref(false)
const pendingDeleteImage = ref<any | null>(null)
const deletingImage = ref(false)
const annotatedCount = computed(() => images.value.filter((i: any) => i.annotated).length)
const skippedCount = computed(() => images.value.filter((i: any) => i.skipped).length)
const pendingCount = computed(
  () => images.value.filter((i: any) => !i.annotated && !i.skipped).length
)

async function load() {
  const id = Number(route.params.id)
  const list = await window.electronAPI.dataset.list()
  dataset.value = list.find((d: any) => d.id === id) ?? null
  images.value = await window.electronAPI.image.listWithStatus(id)
  descriptionExpanded.value = false
  await nextTick()
  measureDescription()
}

function measureDescription() {
  const el = detailDescriptionRef.value
  if (!el) {
    descriptionExpandable.value = false
    return
  }
  if (descriptionExpanded.value) return
  descriptionExpandable.value = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
}

async function toggleDescription() {
  descriptionExpanded.value = !descriptionExpanded.value
  await nextTick()
  if (!descriptionExpanded.value) measureDescription()
}

function requestRemoveImage(image: any) {
  pendingDeleteImage.value = image
}

async function confirmRemoveImage() {
  if (!pendingDeleteImage.value || deletingImage.value) return
  const image = pendingDeleteImage.value
  deletingImage.value = true
  try {
    await window.electronAPI.image.delete(image.id)
    pendingDeleteImage.value = null
    ElMessage.success('已删除')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    deletingImage.value = false
  }
}

watch(() => route.params.id, load, { immediate: true })
onMounted(() => {
  window.addEventListener('resize', measureDescription)
})
onUnmounted(() => {
  window.removeEventListener('resize', measureDescription)
})
</script>
