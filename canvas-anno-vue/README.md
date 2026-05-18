# canvas-anno-vue

纯前端图片标注工具，基于 Vue 3 和原生 Canvas 2D —— 支持绘制、拖拽、缩放、平移标注。

## 技术栈

- **框架:** Vue 3.4
- **构建:** Vite 5
- **渲染:** Canvas 2D（无第三方图形库）
- **样式:** Tailwind CSS 3

## 功能

- 四种标注模式：矩形、点、折线、多边形
- 绘制、移动图形、移动顶点、平移、缩放
- 撤销/重做（单栈快照架构）
- 删除选中 / 清空全部
- 可配置颜色组（1-4 组）
- 右侧标注列表面板，点击选中
- 完整快捷键（模式切换、颜色组、缩放、撤销重做、平移、完成/删除）

## 用法

### 作为组件使用

```vue
<template>
  <CanvasAnnotator
    image-src="/path/to/image.jpg"
    initial-mode="rect"
    :groups="customGroups"
    @change="onAnnotationChange"
    ref="annotatorRef"
  />
</template>

<script setup>
import { ref } from 'vue'
import CanvasAnnotator from './components/CanvasAnnotator.vue'

const annotatorRef = ref(null)

const customGroups = [
  { name: 'red',    stroke: '#e53935', fill: 'rgba(229,57,53,0.12)', fillHover: 'rgba(229,57,53,0.04)', label: '红' },
  { name: 'yellow', stroke: '#f9a825', fill: 'rgba(249,168,37,0.12)', fillHover: 'rgba(249,168,37,0.04)', label: '黄' },
  { name: 'blue',   stroke: '#1e88e5', fill: 'rgba(30,136,229,0.12)', fillHover: 'rgba(30,136,229,0.04)', label: '蓝' },
  { name: 'green',  stroke: '#43a047', fill: 'rgba(67,160,71,0.12)', fillHover: 'rgba(67,160,71,0.04)', label: '绿' },
]

function onAnnotationChange(shapes, meta) {
  console.log('标注数据:', shapes)
  console.log('画布状态:', meta)
}

// 通过 ref 调用方法
function getAnnotations() {
  const shapes = annotatorRef.value.getShapes()
  const meta = annotatorRef.value.getMeta()
  console.log(shapes, meta)
}
</script>
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `imageSrc` | `String` | `''` | 背景图片地址，为空时自动生成网格背景 |
| `initialMode` | `String` | `'rect'` | 初始标注模式：`'rect'` / `'point'` / `'polyline'` / `'polygon'` |
| `groups` | `Array` | 默认四色组 | 颜色分组配置，每个分组包含：`name`（标识）、`stroke`（边框色）、`fill`（填充色）、`fillHover`（悬停填充色）、`label`（显示名） |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `change` | `(shapes, meta)` | 任何标注变更时触发，`shapes` 为当前所有图形数组，`meta` 包含 `scale`、`translate` 等画布状态 |

### Ref 方法

通过 `ref` 可以调用以下方法获取当前状态：

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getShapes()` | `Array` | 获取当前所有标注图形 |
| `getMeta()` | `Object` | 获取画布元信息（缩放、平移等） |
| `engine()` | `AnnotationController` | 获取底层引擎实例（高级用法） |

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

### 鼠标操作

| 操作 | 方式 |
|------|------|
| 绘制图形 | 左键拖拽 |
| 移动图形 | 点击并拖拽图形 |
| 移动顶点 | 拖拽图形顶点控制点 |
| 画布平移 | 右键拖拽 |
| 缩放 | 滚轮 |

## 快速开始

```bash
npm install
npm run dev       # Vite 开发服务器
npm run build     # 生产构建
npm run preview   # 预览构建结果
```
