<template>
  <div class="da-modal-backdrop" @click.self="emit('close')">
    <section
      class="da-modal da-modal--dataset"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dataset-dialog-title"
    >
      <header class="da-modal-header">
        <h2 id="dataset-dialog-title">{{ dialogTitle }}</h2>
        <button class="da-modal-close" type="button" aria-label="关闭" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="da-modal-body">
        <label class="da-field">
          <span>名称</span>
          <el-input v-model="name" class="da-input" placeholder="数据集名称" />
        </label>

        <div class="da-field">
          <span>标注工具</span>
          <div class="da-tool-grid">
            <label
              v-for="tool in toolOptions"
              :key="tool.value"
              class="da-tool-option"
              :class="{ 'is-active': selectedTools.includes(tool.value) }"
            >
              <input v-model="selectedTools" type="checkbox" :value="tool.value" />
              <span>{{ tool.label }}</span>
            </label>
          </div>
        </div>

        <div class="da-field">
          <span>分组配置</span>
          <div class="da-group-grid">
            <div v-for="(group, i) in groups" :key="i" class="da-group-row">
              <el-color-picker v-model="group.stroke" size="small" :predefine="preColors" />
              <el-input v-model="group.label" size="small" placeholder="标签" />
              <button
                type="button"
                class="da-group-remove"
                :disabled="groups.length <= 1"
                @click="groups.splice(i, 1)"
              >
                ×
              </button>
            </div>
          </div>
          <button
            type="button"
            class="da-add-group"
            :disabled="groups.length >= maxGroups"
            @click="addGroup"
          >
            + 添加分组
          </button>
        </div>

        <div class="da-field da-field--editor">
          <span>标注要求</span>
          <RichTextEditor v-model="description" />
        </div>
      </div>

      <footer class="da-modal-actions">
        <el-button class="da-button da-button--outline" @click="emit('close')">取消</el-button>
        <el-button
          class="da-button da-button--primary"
          type="primary"
          :disabled="!canSave"
          @click="save"
          >{{ submitText }}</el-button
        >
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import RichTextEditor from '../components/RichTextEditor.vue'

interface GroupConfig {
  name: string
  stroke: string
  fill: string
  fillHover: string
  label: string
}

const emit = defineEmits<{
  close: []
  saved: []
}>()
const props = defineProps<{ dataset?: any }>()

const name = ref('')
const description = ref('')
const maxGroups = 4
const defaultTools = ['rect', 'point', 'polyline', 'polygon']
const selectedTools = ref<string[]>([...defaultTools])
const preColors = [
  '#e53935',
  '#f9a825',
  '#1e88e5',
  '#43a047',
  '#8e24aa',
  '#00acc1',
  '#ff7043',
  '#3949ab'
]
const toolOptions = [
  { value: 'rect', label: '矩形' },
  { value: 'point', label: '点' },
  { value: 'polyline', label: '折线' },
  { value: 'polygon', label: '多边形' }
]

function defaultGroups(): GroupConfig[] {
  return [
    {
      name: 'red',
      stroke: '#e53935',
      fill: 'rgba(229,57,53,0.12)',
      fillHover: 'rgba(229,57,53,0.04)',
      label: '红'
    },
    {
      name: 'yellow',
      stroke: '#f9a825',
      fill: 'rgba(249,168,37,0.12)',
      fillHover: 'rgba(249,168,37,0.04)',
      label: '黄'
    },
    {
      name: 'blue',
      stroke: '#1e88e5',
      fill: 'rgba(30,136,229,0.12)',
      fillHover: 'rgba(30,136,229,0.04)',
      label: '蓝'
    },
    {
      name: 'green',
      stroke: '#43a047',
      fill: 'rgba(67,160,71,0.12)',
      fillHover: 'rgba(67,160,71,0.04)',
      label: '绿'
    }
  ]
}

const groups = reactive<GroupConfig[]>(defaultGroups())
const canSave = computed(() => name.value.trim().length > 0 && selectedTools.value.length > 0)
const isEdit = computed(() => Boolean(props.dataset?.id))
const dialogTitle = computed(() => (isEdit.value ? '编辑数据集' : '新建数据集'))
const submitText = computed(() => (isEdit.value ? '保存' : '创建'))

function addGroup() {
  if (groups.length >= maxGroups) return
  const idx = groups.length
  groups.push({
    name: `group${idx}`,
    stroke: '#e53935',
    fill: 'rgba(229,57,53,0.12)',
    fillHover: 'rgba(229,57,53,0.04)',
    label: ''
  })
}

function hexToRgb(hex: string): string {
  const v = parseInt(hex.replace('#', ''), 16)
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`
}

function serializeGroups(): string {
  return JSON.stringify(
    groups.slice(0, maxGroups).map((group) => ({
      ...group,
      fill: `rgba(${hexToRgb(group.stroke)},0.12)`,
      fillHover: `rgba(${hexToRgb(group.stroke)},0.04)`
    }))
  )
}

function resetForm(dataset?: any) {
  name.value = dataset?.name ?? ''
  description.value = dataset?.description ?? ''
  selectedTools.value = dataset?.tools ? JSON.parse(dataset.tools) : [...defaultTools]
  const parsedGroups = dataset?.groups ? JSON.parse(dataset.groups) : defaultGroups()
  groups.splice(0, groups.length, ...parsedGroups.slice(0, maxGroups))
}

async function save() {
  if (!canSave.value) return
  if (isEdit.value) {
    await window.electronAPI.dataset.update(
      props.dataset.id,
      name.value.trim(),
      description.value,
      JSON.stringify(selectedTools.value),
      serializeGroups()
    )
  } else {
    await window.electronAPI.dataset.create(
      name.value.trim(),
      description.value,
      JSON.stringify(selectedTools.value),
      serializeGroups()
    )
  }
  emit('saved')
}

watch(() => props.dataset, resetForm, { immediate: true })
</script>
