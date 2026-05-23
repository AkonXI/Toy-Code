# canvas-anno-vue

纯前端图片标注工具，基于 Vue 3 + TypeScript 和原生 Canvas 2D —— 支持绘制、拖拽、缩放、平移标注。

## 技术栈

- **框架:** Vue 3.4 + TypeScript
- **构建:** Vite 8 + vue-tsc
- **渲染:** Canvas 2D（无第三方图形库）
- **样式:** Tailwind CSS 3

## 功能

- 选择/绘制双模式 — Tab 切换，选择模式编辑已有图形，绘制模式创建新图形
- 四种标注类型：矩形（支持旋转）、点、折线、多边形
- 绘制中切换模式自动完成/丢弃图形
- 完成图形显示名称标签（分组色背景），选中高亮
- Ctrl+点击折线/多边形边缘插入新顶点
- 列表点击自动切换选择模式并选中
- 撤销/重做（单栈快照架构）
- 删除选中 / 清空全部
- 可配置颜色组（1-4 组）
- 可配置启用的标注类型（未启用的显示禁用态）
- 右侧标注列表面板，点击选中 + 自动滚动
- 完整快捷键（模式切换、颜色组、缩放、撤销重做、平移、完成/删除）
- 只读模式 + v-model 双向绑定，支持审核和回显
- 模块化引擎架构：`types` / `utils` / `image-layer` / `shape-layer` / `controller`

## 用法

### 作为组件使用

```vue
<template>
  <CanvasAnnotator
    image-src="/path/to/image.jpg"
    initial-mode="rect"
    :groups="customGroups"
    :enabled-modes="['rect', 'point']"
    @change="onAnnotationChange"
    ref="annotatorRef"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CanvasAnnotator from './components/CanvasAnnotator.vue'
import type { Shape, Meta } from './engine/types'

const annotatorRef = ref<InstanceType<typeof CanvasAnnotator> | null>(null)

const customGroups = [
  { name: 'red',    stroke: '#e53935', fill: 'rgba(229,57,53,0.12)', fillHover: 'rgba(229,57,53,0.04)', label: '红' },
  { name: 'yellow', stroke: '#f9a825', fill: 'rgba(249,168,37,0.12)', fillHover: 'rgba(249,168,37,0.04)', label: '黄' },
  { name: 'blue',   stroke: '#1e88e5', fill: 'rgba(30,136,229,0.12)', fillHover: 'rgba(30,136,229,0.04)', label: '蓝' },
  { name: 'green',  stroke: '#43a047', fill: 'rgba(67,160,71,0.12)', fillHover: 'rgba(67,160,71,0.04)', label: '绿' },
]

function onAnnotationChange(shapes: Shape[], meta: Meta) {
  console.log('标注数据:', shapes)
  console.log('画布状态:', meta)
}

// 通过 ref 调用方法
function getAnnotations() {
  const shapes = annotatorRef.value?.getShapes() ?? []
  const meta = annotatorRef.value?.getMeta() ?? {}
  console.log(shapes, meta)
}
</script>
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `imageSrc` | `string` | `''` | 背景图片地址，为空时自动生成网格背景 |
| `initialMode` | `string` | `'rect'` | 初始绘制模式：`'rect'` / `'point'` / `'polyline'` / `'polygon'` |
| `interactionMode` | `'select' \| 'draw'` | `'draw'` | 初始交互模式：`'select'` 编辑 / `'draw'` 绘制 |
| `groups` | `Group[]` | 默认四色组 | 颜色分组配置 |
| `enabledModes` | `ModeType[]` | 全启用 | 启用的标注类型，未启用的显示禁用态 |
| `readonly` | `boolean` | `false` | 只读模式：禁止所有编辑，仅可查看/选中 |
| `modelValue` | `Shape[]` | `[]` | v-model 双向绑定，用于外部传入标注数据 |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `change` | `(shapes: Shape[], meta: Meta)` | 任何标注变更时触发 |
| `update:modelValue` | `(shapes: Shape[])` | v-model 双向绑定，标注数据变更时触发 |

### 只读模式（审核/回显）

```vue
<CanvasAnnotator
  v-model="annotations"
  :readonly="true"
  @change="onChange"
/>
```

只读模式下仅允许选中查看图形、平移和缩放，禁止所有编辑操作。

### Ref 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getShapes()` | `Shape[]` | 获取当前所有标注图形（深拷贝） |
| `getMeta()` | `Meta` | 获取画布元信息（缩放、平移等） |
| `engine()` | `AnnotationController \| null` | 获取底层引擎实例 |

### 快捷键

| 操作 | 快捷键 |
|------|--------|
| 切换选择/绘制模式 | `Tab` |
| 矩形模式 | `1` |
| 点模式 | `2` |
| 折线模式 | `3` |
| 多边形模式 | `4` |
| 切换颜色组 1-4 | `Alt + 1/2/3/4` |
| 撤销 | `Ctrl + Z` |
| 重做 | `Ctrl + Y` 或 `Ctrl + Shift + Z` |
| 放大 | `Ctrl + =` |
| 缩小 | `Ctrl + -` |
| 重置缩放 | `Ctrl + 0` |
| 完成多边形/折线 | `Enter` |
| 删除选中图形 | `Backspace` |
| 清空全部 | `Delete` |
| 画布平移 | 方向键 |

> 注：快捷键受 `enabledModes` 配置影响，未启用的模式对应的数字键无效。

### 鼠标操作

| 模式 | 操作 | 方式 |
|------|------|------|
| 选择 | 选中图形 | 点击图形 |
| 选择 | 移动图形 | 点击并拖拽图形 |
| 选择 | 移动顶点 | 拖拽图形顶点控制点 |
| 选择 | 插入顶点 | `Ctrl`+点击折线/多边形边缘 |
| 选择 | 旋转矩形 | 拖拽旋转手柄（矩形上方圆形控制点） |
| 选择 | 缩放矩形 | 拖拽四角/四边手柄 |
| 绘制 | 绘制矩形 | 左键拖拽 |
| 绘制 | 绘制点 | 左键点击 |
| 绘制 | 绘制折线/多边形 | 连续左键点击，Enter 或切换模式完成 |
| 通用 | 画布平移 | 右键拖拽 / 方向键 |
| 通用 | 缩放 | 滚轮 / `Ctrl`+`=` / `Ctrl`+`-` |
| 通用 | 聚焦图形 | 右侧列表点击 → 平滑缩放居中 |

## 引擎架构

```
src/engine/
  types.ts           — 类型定义（Shape, Group, Meta, InteractionMode 等）
  utils.ts           — 工具函数（deepCopy, normalizeAngle, buildGroupMap）
  image-layer.ts     — 图像层（背景图加载、缩放、平移）
  shape-layer.ts     — 图形层（绘制、命中检测、顶点插入、形状标签、坐标变换）
  controller.ts      — 控制器（事件处理、交互模式、状态管理、撤销重做）
  index.ts           — 统一导出
```

## 快速开始

```bash
npm install
npm run dev       # Vite 开发服务器
npm run build     # vue-tsc --noEmit && vite build
npm run preview   # 预览构建结果
```
