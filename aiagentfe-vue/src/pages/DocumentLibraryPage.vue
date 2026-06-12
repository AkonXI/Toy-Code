<template>
  <div class="doc-library-page">
    <div class="page-container">
      <div class="page-header">
        <h2>我的知识库</h2>
        <el-button type="primary" @click="showUpload = true">
          <el-icon><Plus /></el-icon>
          上传文档
        </el-button>
      </div>

      <div v-if="showUpload" class="upload-section">
        <el-card>
          <template #header>
            <div class="upload-header">
              <span>上传文档到知识库</span>
              <el-button size="small" @click="showUpload = false"> 取消 </el-button>
            </div>
          </template>

          <div
            class="upload-area"
            @click="triggerFile"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".pdf,.txt"
              style="display: none"
              @change="handleFileSelect"
            />
            <div v-if="!selectedFile" class="upload-placeholder">
              <el-icon :size="48">
                <UploadFilled />
              </el-icon>
              <p>点击或拖拽上传 PDF / TXT 文件</p>
            </div>
            <div v-else class="file-info">
              <el-icon :size="32">
                <Document />
              </el-icon>
              <span>{{ selectedFile.name }}</span>
              <el-button size="small" @click.stop="clearFile"> 重新选择 </el-button>
            </div>
          </div>

          <el-form class="upload-form" label-width="80px">
            <el-form-item label="文档类型">
              <el-radio-group v-model="docType">
                <el-radio value="reference_doc"> 参考资料 </el-radio>
                <el-radio value="excellent_resume"> 优秀简历 </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="分类">
              <el-input v-model="category" placeholder="可选，如：前端开发、产品经理" />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :disabled="!selectedFile || uploading"
                :loading="uploading"
                @click="handleUpload"
              >
                {{ uploading ? '上传中...' : '上传并索引' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>

      <div v-if="loading" class="loading-wrap">
        <el-icon class="is-loading" :size="32">
          <Loading />
        </el-icon>
        <p>加载中...</p>
      </div>

      <el-empty v-else-if="documents.length === 0" description="知识库为空，点击上方按钮上传文档" />

      <div v-else class="doc-list">
        <el-card v-for="doc in documents" :key="doc.id" class="doc-card">
          <div class="doc-card-content">
            <div class="doc-title">
              <el-icon><Document /></el-icon>
              {{ doc.original_name }}
            </div>
            <div class="doc-meta">
              <el-tag size="small" :type="doc.doc_type === 'excellent_resume' ? 'success' : 'info'">
                {{ doc.doc_type === 'excellent_resume' ? '优秀简历' : '参考资料' }}
              </el-tag>
              <span v-if="doc.category" class="doc-category">{{ doc.category }}</span>
              <span class="doc-size">{{ formatSize(doc.file_size) }}</span>
              <span class="doc-time">{{ formatTime(doc.created_at) }}</span>
            </div>
          </div>
          <div class="doc-actions">
            <el-switch
              :model-value="doc.active === 1"
              size="small"
              @change="(val: boolean) => handleToggle(doc.id, val)"
            />
            <el-button type="danger" :icon="Delete" link @click="handleDelete(doc.id)">
              删除
            </el-button>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, UploadFilled, Document, Loading, Delete } from '@element-plus/icons-vue'
import {
  getUserDocuments,
  uploadUserDocument,
  deleteUserDocument,
  toggleUserDocument,
  type UserDocument
} from '@/api'
import { formatTime } from '@/lib/format'

const showUpload = ref(false)
const uploading = ref(false)
const loading = ref(false)
const selectedFile = ref<File | null>(null)
const docType = ref('reference_doc')
const category = ref('')
const fileInputRef = ref<HTMLInputElement>()
const documents = ref<UserDocument[]>([])

async function fetchDocuments() {
  loading.value = true
  try {
    const result = await getUserDocuments()
    documents.value = result.data
  } catch (e) {
    console.error('Failed to fetch documents:', e)
    ElMessage.error('加载文档列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchDocuments)

function triggerFile() {
  fileInputRef.value?.click()
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) selectedFile.value = file
}

function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file && (file.type === 'application/pdf' || file.name.endsWith('.txt'))) {
    selectedFile.value = file
  } else {
    ElMessage.warning('请上传 PDF 或 TXT 文件')
  }
}

function clearFile() {
  selectedFile.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function handleUpload() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    await uploadUserDocument(selectedFile.value, docType.value, category.value || undefined)
    ElMessage.success('文档上传成功，已开始索引')
    showUpload.value = false
    clearFile()
    docType.value = 'reference_doc'
    category.value = ''
    await fetchDocuments()
  } catch (e: any) {
    console.error('Upload failed:', e)
    ElMessage.error(e?.response?.data?.error || '上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

async function handleToggle(id: number, active: boolean) {
  try {
    await toggleUserDocument(id, active ? 1 : 0)
    const doc = documents.value.find((d) => d.id === id)
    if (doc) doc.active = active ? 1 : 0
    ElMessage.success(active ? '已启用' : '已禁用')
  } catch (e) {
    console.error('Toggle failed:', e)
    ElMessage.error('操作失败')
  }
}

async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定要删除这个文档吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteUserDocument(id)
    documents.value = documents.value.filter((d) => d.id !== id)
    ElMessage.success('已删除')
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Delete failed:', e)
      ElMessage.error('删除失败')
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<style scoped>
.doc-library-page {
  padding-top: 50px;
  min-height: 100vh;
  background: #f5f7fa;
}

.page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.upload-section {
  margin-bottom: 24px;
}

.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
  margin-bottom: 16px;
}

.upload-area:hover {
  border-color: #409eff;
}

.upload-placeholder {
  color: #909399;
}

.upload-placeholder p {
  margin-top: 8px;
  font-size: 14px;
}

.file-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #333;
}

.upload-form {
  margin-top: 16px;
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: #909399;
  gap: 12px;
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-card {
  transition: box-shadow 0.2s;
}

.doc-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.doc-card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.doc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.doc-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.doc-category {
  padding: 2px 8px;
  background: #f0f2f5;
  border-radius: 4px;
}

.doc-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
</style>
