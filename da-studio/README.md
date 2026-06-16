# da-studio

`da-studio` 是一套图片标注工具，核心由 Vue 3 组件和 Canvas 2D 标注引擎组成，同时提供组件调试工作台和 Electron 桌面应用。

项目按三种模式使用：

- **库模式**：把 `da-studio` 作为标注引擎和组件库集成到其他项目。
- **组件模式**：在 Vue 页面中直接使用 `CanvasAnnotator`、`ComparisonPanel`、`ComparisonOverlay` 等组件。
- **App 模式**：运行 Electron 应用，完成数据集管理、图片导入、标注、查看和导出。

## 技术栈

- Vue 3 + TypeScript
- Canvas 2D 标注引擎
- Tailwind CSS 3
- Vite 组件库构建
- Electron + Element Plus + SQLite 本地应用

## 模式一：库模式

库模式适合把标注能力嵌入已有系统。包根入口只导出稳定的组件、组合式 API、引擎类型和基础引擎类。

### 构建

```bash
pnpm --filter da-studio build
```

组件库产物输出到 `build/components`，引擎独立产物输出到 `build/engine`。

### 包入口

`package.json` 暴露以下入口：

| 入口                  | 说明                           |
| --------------------- | ------------------------------ |
| `da-studio`           | 组件、组合式 API、引擎类和类型 |
| `da-studio/engine`    | 纯引擎入口                     |
| `da-studio/style.css` | 组件样式                       |

### 基础导入

```ts
import {
  CanvasAnnotator,
  ComparisonPanel,
  ComparisonOverlay,
  useComparison,
  comparableShapes,
  matchTrajectory,
  resample,
  AnnotationController,
  DEFAULT_GROUPS
} from 'da-studio'
import type { Shape, Meta, Group, ModeType, MatchResult, MatcherOptions } from 'da-studio'
import 'da-studio/style.css'
```

### 包根公开 API

| API                                  | 类型       | 说明                                                       |
| ------------------------------------ | ---------- | ---------------------------------------------------------- |
| `CanvasAnnotator`                    | Vue 组件   | 标注工具主组件，包含工具栏、600x600 画布、标注列表和状态栏 |
| `ComparisonPanel`                    | Vue 组件   | 轨迹比对控制面板，选择 A/B 标注并触发比对                  |
| `ComparisonOverlay`                  | Vue 组件   | 比对结果叠加层，在画布上绘制 OBB、重采样轨迹和错误段       |
| `ModeIcon`                           | Vue 组件   | 标注模式图标                                               |
| `ToolIcon`                           | Vue 组件   | 工具按钮图标                                               |
| `useComparison()`                    | composable | 管理轨迹比对状态，内部使用 Web Worker 计算                 |
| `comparableShapes(shapes)`           | function   | 从标注列表中过滤可比对图形，排除点和未完成图形             |
| `DEFAULT_GROUPS`                     | `Group[]`  | 默认四组颜色配置                                           |
| `buildGroupMap(groups)`              | function   | 将分组数组转为按 `name` 索引的对象                         |
| `deepCopy(value)`                    | function   | JSON 深拷贝工具                                            |
| `ImageLayer`                         | class      | 背景图层，负责图片加载、缩放、平移和坐标转换               |
| `ShapeLayer`                         | class      | 图形图层，负责绘制、命中检测、顶点和控制柄处理             |
| `AnnotationController`               | class      | 标注引擎控制器，负责交互、历史栈、选择、绘制和数据载入     |
| `matchTrajectory(a, b, options?)`    | function   | 轨迹比对算法，返回相似度、最大误差、违规点和包围盒结果     |
| `resample(points, spacing, closed?)` | function   | 按弧长等距重采样点集                                       |
| `computeBBox(points)`                | function   | 计算轴对齐包围盒 AABB                                      |
| `computeOBB(points)`                 | function   | 计算 PCA 定向包围盒 OBB                                    |
| `dist2(a, b)` / `dist(a, b)`         | function   | 计算两点距离平方或欧氏距离                                 |

### 公开类型

```ts
import type {
  ModeType,
  InteractionMode,
  Point,
  Group,
  RectShape,
  PointShape,
  PolylineShape,
  PolygonShape,
  Shape,
  Meta,
  VertexHit,
  Handle,
  DragCache,
  ControllerState,
  HandlerReturn,
  ControllerOpts,
  BBox,
  OBB,
  MatchResult,
  MatcherOptions
} from 'da-studio'
```

核心类型结构：

```ts
type ModeType = 'rect' | 'point' | 'polyline' | 'polygon'
type InteractionMode = 'select' | 'draw'

interface Group {
  name: string
  stroke: string
  fill: string
  fillHover: string
  label: string
}

interface Meta {
  scale: number
  translateX: number
  translateY: number
  mode: string
  group: string
}

type Shape = RectShape | PointShape | PolylineShape | PolygonShape
```

### AnnotationController

`AnnotationController` 是底层标注引擎。组件模式优先使用 `CanvasAnnotator`，只有需要自定义画布 UI 或完全接管交互时才直接使用控制器。

常用方法：

| 方法                                            | 说明                                  |
| ----------------------------------------------- | ------------------------------------- |
| `mount(bgCanvas, shapeCanvas, imageSrc?)`       | 绑定背景层和图形层 canvas，并加载图片 |
| `loadImage(src)`                                | 加载或切换背景图片                    |
| `setMode(mode)`                                 | 设置绘制类型                          |
| `setInteractionMode(mode)`                      | 设置选择或绘制交互模式                |
| `setReadonly(value)`                            | 切换只读状态                          |
| `setGroup(name)`                                | 设置当前分组                          |
| `zoom(delta)` / `resetZoom()` / `pan(dx, dy)`   | 视图缩放、重置和平移                  |
| `undo()` / `redo()`                             | 撤销和重做                            |
| `canUndo()` / `canRedo()`                       | 查询历史栈状态                        |
| `clear()`                                       | 清空标注                              |
| `completePolygon()` / `completePolyline()`      | 完成正在绘制的多边形或折线            |
| `isPolygonActive()` / `isPolylineActive()`      | 查询是否处于连续绘制状态              |
| `selectShapeByIndex(idx)` / `selectShape(x, y)` | 按索引或坐标选中图形                  |
| `getSelectedShape()` / `getLastShape()`         | 获取当前选中图形或最后一个图形        |
| `setSelectedShapeGroup(name)`                   | 修改选中图形分组                      |
| `deleteSelected()`                              | 删除选中图形                          |
| `getGroup(name)`                                | 获取分组配置                          |
| `getShapes()`                                   | 获取当前标注数据                      |
| `getMeta()`                                     | 获取当前画布元信息                    |
| `setShapes(shapes)`                             | 设置图形并写入历史基线                |
| `seedHistory()`                                 | 以当前图形作为历史基线                |
| `loadShapes(shapes, meta)`                      | 载入图形和视图状态                    |
| `loadAnnotationState(shapes, meta)`             | 载入完整标注状态并重置历史基线        |
| `resetView()`                                   | 重置视图                              |
| `destroy()`                                     | 移除事件并释放控制器                  |

### useComparison

```ts
const { templateIdx, testIdx, result, loading, compare, clear, clearResult } = useComparison()
```

| 返回值            | 说明                                                     |
| ----------------- | -------------------------------------------------------- |
| `templateIdx`     | 模板标注索引                                             |
| `testIdx`         | 测试标注索引                                             |
| `result`          | 比对结果，包含相似度、最大误差、违规点、OBB 和重采样轨迹 |
| `loading`         | Worker 计算中状态                                        |
| `compare(shapes)` | 使用当前 A/B 索引执行比对                                |
| `clear()`         | 清空选择和结果                                           |
| `clearResult()`   | 仅清空结果，保留当前选择                                 |

### Matcher API

matcher API 已从包根公开导出，可直接用于非组件场景。`useComparison` 和 `ComparisonPanel` 也是基于同一套算法能力封装。

```ts
import { matchTrajectory, resample, computeBBox, computeOBB, dist, dist2 } from 'da-studio'
import type { Point, MatchResult, MatcherOptions } from 'da-studio'

const curveA: Point[] = [
  { x: 10, y: 20 },
  { x: 80, y: 42 }
]
const curveB: Point[] = [
  { x: 12, y: 21 },
  { x: 78, y: 45 }
]

const options: MatcherOptions = {
  spacing: 2,
  delta: 3,
  pct: 0.03,
  closed: false
}

const result: MatchResult = matchTrajectory(curveA, curveB, options)
```

| API                                         | 说明                                         |
| ------------------------------------------- | -------------------------------------------- |
| `matchTrajectory(curveA, curveB, options?)` | 对 B 到 A 做轨迹比对，返回 `MatchResult`     |
| `resample(points, spacing, closed?)`        | 沿路径按固定弧长间隔重采样                   |
| `computeBBox(points)`                       | 计算 AABB，返回 `{ xmin, xmax, ymin, ymax }` |
| `computeOBB(points)`                        | 计算 OBB，返回角点和对角线长度               |
| `dist2(a, b)`                               | 返回两点距离平方                             |
| `dist(a, b)`                                | 返回两点欧氏距离                             |

`MatcherOptions`：

| 字段      | 默认值  | 说明                          |
| --------- | ------- | ----------------------------- |
| `spacing` | `2`     | 重采样间距，单位 px           |
| `delta`   | `3`     | 重合率参考阈值，单位 px       |
| `pct`     | `0.01`  | 最大误差阈值占 OBB 对角线比例 |
| `closed`  | `false` | 是否把首尾点闭合后参与采样    |

## 模式二：组件模式

组件模式适合在 Vue 页面中快速接入完整标注 UI。

### 最小用例

```vue
<template>
  <CanvasAnnotator
    v-model="shapes"
    image-src="/images/demo.jpg"
    initial-mode="rect"
    interaction-mode="draw"
    @change="handleChange"
    @load="handleLoad"
    @error="handleError"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasAnnotator } from 'da-studio'
import type { Shape, Meta } from 'da-studio'
import 'da-studio/style.css'

const shapes = ref<Shape[]>([])

function handleChange(nextShapes: Shape[], meta: Meta) {
  console.log(nextShapes, meta)
}

function handleLoad() {
  console.log('image loaded')
}

function handleError(error: Error) {
  console.error(error)
}
</script>
```

### 自定义工具和分组

```vue
<template>
  <CanvasAnnotator
    ref="annotatorRef"
    v-model="shapes"
    :groups="groups"
    :enabled-modes="['rect', 'polygon']"
    :readonly="readonly"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasAnnotator } from 'da-studio'
import type { Group, Shape } from 'da-studio'

const annotatorRef = ref<InstanceType<typeof CanvasAnnotator> | null>(null)
const readonly = ref(false)
const shapes = ref<Shape[]>([])

const groups: Group[] = [
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

function save() {
  const shapes = annotatorRef.value?.getShapes() ?? []
  const meta = annotatorRef.value?.getMeta()
  console.log(shapes, meta)
}
</script>
```

### 轨迹比对用例

```vue
<template>
  <div class="relative">
    <CanvasAnnotator ref="annotatorRef" v-model="shapes">
      <template #canvas-overlay>
        <ComparisonOverlay
          v-if="result"
          :result="result"
          :get-meta="() => annotatorRef?.getMeta() ?? defaultMeta"
        />
      </template>
    </CanvasAnnotator>

    <ComparisonPanel
      :shapes="shapes"
      :template-idx="templateIdx"
      :test-idx="testIdx"
      :result="result"
      :loading="loading"
      :sticky="true"
      :movable="true"
      :offset="{ top: 16, right: 16 }"
      @select-template="templateIdx = $event"
      @select-test="testIdx = $event"
      @compare="compare(shapes)"
      @clear-result="clearResult"
      @clear="clear"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CanvasAnnotator, ComparisonPanel, ComparisonOverlay, useComparison } from 'da-studio'
import type { Meta, Shape } from 'da-studio'

const annotatorRef = ref<InstanceType<typeof CanvasAnnotator> | null>(null)
const shapes = ref<Shape[]>([])
const defaultMeta: Meta = { scale: 1, translateX: 0, translateY: 0, mode: '', group: '' }
const { templateIdx, testIdx, result, loading, compare, clear, clearResult } = useComparison()
</script>
```

### CanvasAnnotator Props

| Prop              | 类型              | 默认值                                     | 说明                                              |
| ----------------- | ----------------- | ------------------------------------------ | ------------------------------------------------- |
| `imageSrc`        | `string`          | `''`                                       | 背景图片地址。为空时使用内置示例背景              |
| `initialMode`     | `string`          | `'rect'`                                   | 初始标注模式                                      |
| `interactionMode` | `InteractionMode` | `'draw'`                                   | 初始交互模式，`draw` 或 `select`                  |
| `readonly`        | `boolean`         | `false`                                    | 只读模式，禁止绘制、删除和修改                    |
| `modelValue`      | `Shape[]`         | `[]`                                       | 标注数据，支持 `v-model`                          |
| `groups`          | `Group[]`         | `DEFAULT_GROUPS`                           | 分组配置，最多 4 组时可使用快捷键 `Alt + 1/2/3/4` |
| `enabledModes`    | `ModeType[]`      | `['rect', 'point', 'polyline', 'polygon']` | 启用的标注类型                                    |

### CanvasAnnotator Events

| Event               | 参数                            | 说明                     |
| ------------------- | ------------------------------- | ------------------------ |
| `change`            | `(shapes: Shape[], meta: Meta)` | 标注或视图状态变化时触发 |
| `update:modelValue` | `(shapes: Shape[])`             | `v-model` 更新事件       |
| `error`             | `(error: Error)`                | 图片加载失败时触发       |
| `load`              | `()`                            | 图片加载完成后触发       |

### CanvasAnnotator Ref 方法

| 方法                                | 返回值                                                     | 说明                     |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------ |
| `getShapes()`                       | `Shape[]`                                                  | 获取当前图形             |
| `getMeta()`                         | `Meta`                                                     | 获取当前视图和工具状态   |
| `completeCurrent()`                 | `void`                                                     | 完成当前折线或多边形     |
| `loadShapes(shapes, meta)`          | `void`                                                     | 载入图形和元信息         |
| `loadAnnotationState(shapes, meta)` | `void`                                                     | 载入完整标注状态         |
| `getShortcutState()`                | `{ canUndo; canRedo; hasSelected; canComplete; canClear }` | 获取菜单或快捷键可用状态 |
| `engine()`                          | `AnnotationController \| null`                             | 获取底层控制器           |

### CanvasAnnotator Slot

| Slot             | 说明                                                        |
| ---------------- | ----------------------------------------------------------- |
| `canvas-overlay` | 渲染在画布上层，适合挂载 `ComparisonOverlay` 或自定义叠加层 |

### ComparisonPanel Props

| Prop          | 类型                                                               | 默认值                   | 说明                                 |
| ------------- | ------------------------------------------------------------------ | ------------------------ | ------------------------------------ |
| `shapes`      | `Shape[]`                                                          | 必填                     | 当前标注数据                         |
| `templateIdx` | `number \| null`                                                   | 必填                     | 模板标注索引                         |
| `testIdx`     | `number \| null`                                                   | 必填                     | 测试标注索引                         |
| `result`      | `MatchResult \| null`                                              | 必填                     | 比对结果                             |
| `loading`     | `boolean`                                                          | 必填                     | 比对计算中状态                       |
| `teleport`    | `boolean \| string`                                                | `false`                  | 是否 Teleport 到 `body` 或指定选择器 |
| `sticky`      | `boolean`                                                          | `false`                  | 使用 sticky 定位，否则使用 absolute  |
| `movable`     | `boolean`                                                          | `false`                  | 是否允许拖动面板                     |
| `offset`      | `{ top?: number; right?: number; bottom?: number; left?: number }` | `{ top: 12, right: 12 }` | 面板定位偏移                         |

### ComparisonPanel Events

| Event             | 参数            | 说明                                                     |
| ----------------- | --------------- | -------------------------------------------------------- |
| `select-template` | `(idx: number)` | 选择模板标注                                             |
| `select-test`     | `(idx: number)` | 选择测试标注                                             |
| `compare`         | `()`            | 请求执行比对                                             |
| `clear-result`    | `()`            | 输入变化时立即清除旧结果，组件内部随后防抖触发 `compare` |
| `clear`           | `()`            | 清空面板状态                                             |

### ComparisonOverlay Props

| Prop      | 类型          | 说明                                         |
| --------- | ------------- | -------------------------------------------- |
| `result`  | `MatchResult` | 比对结果                                     |
| `getMeta` | `() => Meta`  | 获取当前画布视图状态，叠加层会实时按视图重绘 |

### 样式变量

组件内部使用 Tailwind 类和 CSS 变量组织样式。宿主应用应通过祖先节点覆盖变量，而不是穿透组件内部选择器。

```css
.my-annotator-theme {
  --da-annotator-bg: rgba(238, 240, 232, 0.72);
  --da-annotator-panel-bg: #fffefa;
  --da-annotator-canvas-bg: #fffefa;
  --da-annotator-text: #151916;
  --da-annotator-muted: #667067;
  --da-annotator-border: #d9ddd2;
  --da-annotator-border-strong: #c6ccbf;
  --da-annotator-tool-bg: rgba(255, 255, 250, 0.72);
  --da-annotator-tool-hover-bg: rgba(9, 16, 18, 0.075);
  --da-annotator-selected-bg: rgba(9, 16, 18, 0.12);
  --da-annotator-selected-border: #62715c;
  --da-annotator-primary-bg: #62715c;
  --da-annotator-danger-bg: #d93f49;
}
```

常用变量：

| 变量                                                                                           | 说明                                     |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `--da-annotator-bg`                                                                            | 标注组件外层背景                         |
| `--da-annotator-text` / `--da-annotator-muted` / `--da-annotator-subtle`                       | 文本颜色                                 |
| `--da-annotator-panel-bg`                                                                      | 工具栏和列表面板背景                     |
| `--da-annotator-canvas-bg`                                                                     | 画布容器背景                             |
| `--da-annotator-border` / `--da-annotator-border-strong` / `--da-annotator-divider`            | 边框和分割线                             |
| `--da-annotator-tool-bg` / `--da-annotator-tool-fg`                                            | 工具按钮默认状态                         |
| `--da-annotator-tool-hover-bg` / `--da-annotator-tool-active-bg`                               | 工具按钮 hover 和 active 状态            |
| `--da-annotator-selected-bg` / `--da-annotator-selected-border` / `--da-annotator-selected-fg` | 选中状态                                 |
| `--da-annotator-mode-selected-bg` / `--da-annotator-mode-selected-border`                      | 标注模式选中状态                         |
| `--da-annotator-group-selected-border`                                                         | 分组选中边框                             |
| `--da-annotator-primary-*`                                                                     | 完成按钮等主操作                         |
| `--da-annotator-danger-*`                                                                      | 删除按钮等危险操作                       |
| `--da-annotator-list-title` / `--da-annotator-shape-title`                                     | 标注列表文本                             |
| `--da-compare-*`                                                                               | 对比面板背景、边框、按钮、通过和失败状态 |

### 快捷键

| 操作            | 快捷键                           | 说明                             |
| --------------- | -------------------------------- | -------------------------------- |
| 切换选择/绘制   | `Tab`                            | 在编辑已有图形和绘制新图形间切换 |
| 矩形模式        | `1`                              | 受 `enabledModes` 配置影响       |
| 点模式          | `2`                              | 受 `enabledModes` 配置影响       |
| 折线模式        | `3`                              | 受 `enabledModes` 配置影响       |
| 多边形模式      | `4`                              | 受 `enabledModes` 配置影响       |
| 切换分组        | `Alt + 1/2/3/4`                  | 对应当前数据集或组件配置中的分组 |
| 撤销            | `Ctrl + Z`                       | 只读模式不可用                   |
| 重做            | `Ctrl + Y` 或 `Ctrl + Shift + Z` | 只读模式不可用                   |
| 放大            | `Ctrl + =` 或 `Ctrl + +`         | 以当前视图中心缩放               |
| 缩小            | `Ctrl + -`                       | 以当前视图中心缩放               |
| 重置缩放        | `Ctrl + 0`                       | 恢复默认视图                     |
| 平移            | `ArrowUp/Down/Left/Right`        | 按固定步长移动画布视图           |
| 完成折线/多边形 | `Enter`                          | 仅在连续绘制中可用               |
| 删除选中图形    | `Backspace`                      | 只读模式不可用                   |
| 清空全部图形    | `Delete`                         | 只读模式不可用                   |

### 鼠标操作

| 场景     | 操作            | 方式                                            |
| -------- | --------------- | ----------------------------------------------- |
| 选择模式 | 选中图形        | 点击图形主体、线段或顶点                        |
| 选择模式 | 移动图形        | 拖拽已选中的图形主体                            |
| 选择模式 | 调整矩形尺寸    | 拖拽矩形四角或四边控制柄                        |
| 选择模式 | 旋转矩形        | 拖拽矩形上方旋转控制点                          |
| 选择模式 | 移动顶点        | 拖拽折线或多边形顶点                            |
| 选择模式 | 插入顶点        | `Ctrl + 点击` 折线或多边形边缘                  |
| 绘制模式 | 绘制矩形        | 按住左键拖拽生成矩形                            |
| 绘制模式 | 绘制点          | 左键点击画布                                    |
| 绘制模式 | 绘制折线/多边形 | 连续左键点击添加顶点，按 `Enter` 或完成按钮结束 |
| 通用     | 缩放画布        | 鼠标滚轮                                        |
| 通用     | 平移画布        | 右键拖拽                                        |
| 通用     | 从列表定位图形  | 点击右侧标注列表项，组件会切换选择模式并聚焦    |

## 模式三：App 模式

App 模式是面向标注任务的 Electron 桌面应用。它使用组件库作为标注工作台，在 Electron 层实现数据集、文件存储、SQLite、Element Plus 页面和应用级样式。

### 运行

```bash
pnpm --filter da-studio dev:app
```

打包当前平台桌面应用：

```bash
pnpm --filter da-studio build:app
```

按平台打包：

```bash
pnpm --filter da-studio build:app:win
pnpm --filter da-studio build:app:mac
pnpm --filter da-studio build:app:linux
```

仅生成当前平台解包目录，用于快速验证 packaging 阶段：

```bash
pnpm --filter da-studio build:app:dir
```

构建 Electron renderer/main/preload 但不打安装包：

```bash
pnpm --filter da-studio exec vite build --config vite.electron.config.ts
```

`better-sqlite3` 是 native addon，跨平台产物应在对应平台环境执行安装和打包：Windows 构建 Windows 包，macOS 构建 macOS 包，Linux 构建 Linux 包。

组件调试工作台：

```bash
pnpm --filter da-studio dev
```

### 应用功能

| 功能       | 说明                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| 数据集管理 | 创建、编辑、删除数据集，列表展示数据集数量、图片数、已标注和待标注数量         |
| 富文本描述 | 数据集描述支持正文、标题、粗体、斜体、下划线、链接、撤销/重做和对齐            |
| 工具配置   | 每个数据集可配置启用的标注工具                                                 |
| 分组配置   | 每个数据集可配置最多 4 个颜色分组                                              |
| 图片导入   | 从本地选择图片导入数据集，导入时按 MD5 对同一数据集内重复文件去重              |
| 图片列表   | 数据集详情展示文件名、MD5、状态和操作                                          |
| 标注工作台 | 左侧待标注图片列表，中间 600x600 标注组件，支持隐藏待标注面板                  |
| 状态控制   | 已标注图片可查看；无可标注数据时标注入口禁用；已有标注数据时编辑数据集入口禁用 |
| 跳过       | 可跳过当前图片，并进入下一张待标注图片                                         |
| 保存       | 保存当前图片的 shapes 和 meta 到 SQLite                                        |
| 导出       | 以 JSON 或 CSV 导出已标注数据，不导出未标注或仅跳过的数据                      |

### 基本流程

1. 进入数据集页面，点击新建数据集。
2. 填写名称、富文本描述、启用工具和分组。
3. 进入数据集详情，导入图片。
4. 点击标注，从待标注图片列表开始逐张标注。
5. 使用矩形、点、折线或多边形工具绘制图形，并按分组标记。
6. 点击完成或保存后进入下一张，必要时可跳过。
7. 在数据集详情中查看图片状态。
8. 点击导出，选择 JSON 或 CSV。

### 导出数据

JSON 导出包含：

```json
[
  {
    "image_md5": "md5",
    "image_name": "example.png",
    "shapes": [],
    "meta": {}
  }
]
```

CSV 导出字段：

```txt
image_md5,image_name,shape_type,group_id,x,y,w,h,rotation,points
```

导出时会把图形的 `group` 映射为当前数据集分组配置中的 `group_id`。

### 本地数据

Electron 应用在本机维护 SQLite 数据库和上传文件目录：

- `datasets`：数据集名称、描述、工具和分组配置。
- `images`：图片文件名、原始名、MD5、尺寸和所属数据集。
- `annotations`：图片对应的标注图形、画布元信息和跳过状态。

### 开发边界

- `src/` 只放组件库、标注引擎、对比组件和包导出面。
- `dev/` 放组件调试工作台。
- `electron/` 放桌面应用页面、IPC、数据库、文件存储和 Electron 专属样式。
- Electron 应用通过组件 CSS 变量调整工具风格，不穿透覆盖组件内部结构。
