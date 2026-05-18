# canvas-anno-vue

纯前端图片标注工具，基于 Vue 3 + TypeScript 和原生 Canvas 2D —— 支持绘制、拖拽、缩放、平移标注。

## 技术栈

- **框架:** Vue 3.4 + TypeScript
- **构建:** Vite 6 + vue-tsc
- **渲染:** Canvas 2D（无第三方图形库）
- **样式:** Tailwind CSS 3

## 功能

- 四种标注模式：矩形（支持旋转）、点、折线、多边形
- 绘制、移动图形、移动顶点、平移、缩放
- 撤销/重做（单栈快照架构）
- 删除选中 / 清空全部
- 可配置颜色组（1-4 组）
- 可配置启用的标注类型（未启用的显示禁用态）
- 右侧标注列表面板，点击选中 + 自动滚动
- 完整快捷键（模式切换、颜色组、缩放、撤销重做、平移、完成/删除）
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
| `initialMode` | `string` | `'rect'` | 初始标注模式：`'rect'` / `'point'` / `'polyline'` / `'polygon'` |
| `groups` | `Group[]` | 默认四色组 | 颜色分组配置 |
| `enabledModes` | `ModeType[]` | `['rect','point','polyline','polygon']` | 启用的标注类型，未启用的显示禁用态 |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `change` | `(shapes: Shape[], meta: Meta)` | 任何标注变更时触发 |

### Ref 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getShapes()` | `Shape[]` | 获取当前所有标注图形（深拷贝） |
| `getMeta()` | `Meta` | 获取画布元信息（缩放、平移等） |
| `engine()` | `AnnotationController \| null` | 获取底层引擎实例 |

### 快捷键

| 操作 | 快捷键 |
|------|--------|
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

| 操作 | 方式 |
|------|------|
| 绘制图形 | 左键拖拽 |
| 移动图形 | 点击并拖拽图形 |
| 移动顶点 | 拖拽图形顶点控制点 |
| 画布平移 | 右键拖拽 |
| 缩放 | 滚轮 |
| 旋转矩形 | 拖拽旋转手柄（矩形上方圆形控制点） |

## 引擎架构

```
src/engine/
  types.ts           — 类型定义（Shape, Group, Meta 等）
  utils.ts           — 工具函数（deepCopy, normalizeAngle, buildGroupMap）
  image-layer.ts     — 图像层（背景图加载、缩放、平移）
  shape-layer.ts     — 图形层（绘制、命中检测、坐标变换）
  controller.ts      — 控制器（事件处理、状态管理、撤销重做）
  index.ts           — 统一导出
```

## 快速开始

```bash
npm install
npm run dev       # Vite 开发服务器
npm run build     # vue-tsc --noEmit && vite build
npm run preview   # 预览构建结果
```
