# AGENTS.md

## 项目概述

**emoji-mouse** — 一个浏览器扩展（Chrome + Edge），在用户鼠标光标后渲染下落的 emoji 尾迹。基于 [Plasmo](https://docs.plasmo.com/) + Vue 3 + TypeScript 构建。

## 技术栈

| 层级      | 技术                                                |
| --------- | --------------------------------------------------- |
| 扩展框架  | Plasmo 0.90.3（Manifest V3）                        |
| UI 框架   | Vue 3.5（Composition API，`<script setup lang="ts">`）|
| UI 组件   | Ant Design Vue 4（按需引入，仅 popup/options 页面） |
| 样式      | Tailwind CSS 3                                      |
| 语言      | TypeScript（全部文件已类型化）                      |
| 构建/打包 | Plasmo（基于 Parcel）                               |
| 包管理器  | pnpm                                                |
| 格式化    | Prettier 3 + import sort 插件                       |

## 命令

```bash
pnpm dev          # 启动开发服务器（watch 模式，输出到 build/chrome-mv3-dev/）
pnpm build        # 生产构建（输出到 build/chrome-mv3-prod/）
pnpm package      # 构建 + 生成 .zip 用于商店提交
npx prettier --check .
npx prettier --write .
npx tsc --noEmit   # 类型检查
```

## 目录结构

```
emoji-mouse/
├── contents/
│   └── emoji-mouse.vue    # 内容脚本：三种动画类型 + rAF/keyframe 混合
├── background.ts          # Service worker：消息路由 + 存储（含完整消息类型定义）
├── popup.vue              # 扩展弹窗：深色主题、状态切换
├── options.vue            # 选项页：emoji/时长/大小/透明度 配置
├── initOption.ts          # 默认选项值 + EmojiOptions 接口
├── sandbox.ts             # Plasmo sandbox 页面（eval 安全沙盒）
├── postcss.config.ts      # PostCSS 配置
├── tailwind.config.ts     # Tailwind 配置
├── style.css              # Tailwind 指令
└── assets/                # 扩展图标
```

## 架构

### 数据流

```
Popup ──sendMessage──→ Background (SW) ←──sendMessage── Content Script
  │                         │
  │  切换单页状态             │  读取/保存 options (Storage)
  │                         │  管理 filter-tabs (Session)
  └─────────────────────────┘
```

### 消息类型（chrome.runtime.sendMessage）

| 类型                    | 方向                 | 用途                       |
| ----------------------- | -------------------- | -------------------------- |
| `get-options`           | 任意 → SW            | 从 storage 读取 emoji 配置 |
| `update-option`         | options → SW         | 保存 emoji 配置到 storage  |
| `options-updated`       | SW → content         | 广播配置变更到所有标签页   |
| `get-current-status`    | popup/content → SW   | 检查当前标签页是否启用     |
| `change-current-status` | popup → SW + content | 切换当前标签页启停         |
| `get-current-tabId`     | popup → SW           | 获取当前活动标签页 ID      |

### 存储

- **sync/local**（`@plasmohq/storage`）： `options` — 全局 emoji 配置
- **session**：`filter-tabs` — 已禁用 emoji 的标签页 ID 数组

### 数据同步策略

所有跨 storage 的读写都使用 `{ ...initOption, ...data }` 合并，确保新增字段始终有默认值：

- `background.ts`：保存时合并后写入，读取时合并后返回，广播时发合并数据
- `options.vue`：加载时合并到表单，重置时展开副本
- `contents/emoji-mouse.vue`：接收消息/初始加载时合并

## 代码规范

- **Prettier**：80 字符宽度、2 空格缩进、不用分号、双引号、不加 trailing comma
- **Import 排序**（由 `@ianvs/prettier-plugin-sort-imports` 强制执行）：
  1. Node.js 内置模块
  2. 第三方模块
  3. `@plasmo/*`
  4. `@plasmohq/*`
  5. `~*`（根目录别名）
  6. `./`（相对路径）
- **Vue 风格**：全部使用 `<script setup lang="ts">`
- **路径别名**： `~` 映射到项目根目录（例：`import initOption from "~initOption"`）
- **按需引入**：antd 使用 `ant-design-vue/es/xxx` 个体路径，lodash 使用 `lodash-es/throttle`
- **类型安全**：所有函数参数、返回值、Chrome API 回调均有类型注释

## 动画系统

### 三种动画类型

内容脚本在模块加载时生成 18 个 CSS `@keyframes`（注入到页面 `<style>`）：

| 类型     | 前缀 | 数量 | 效果                                          |
| -------- | ---- | ---- | --------------------------------------------- |
| 水果入水 | `w`  | 5    | 减速坠落 → 贝塞尔上浮 + 淡出（5 种水平偏移）  |
| 气球飞走 | `b`  | 5    | 加速升空 → 减速飘走 + 放大 + 淡出（5 个角度） |
| 火花四溅 | `s`  | 8    | 抛物线弹出 + 缩小 + 淡出（8 个方向）          |

### 关键帧生成

`generateStyles(opacity)` 函数按全局透明度生成全部 keyframe，所有 `opacity:1` 替换为 `opacity:${opacity}`。透明度变更时 `watch` 自动重写 `<style>` 内容。

### 动画流程

- emoji `<span>` 直接挂 `document.body`，`position: fixed` 定位在鼠标位置
- CSS `@keyframes` 驱动 `transform: translate()` 位移动画
- 各关键帧内嵌 `animation-timing-function` 控制分段缓动（`ease-in`, `ease-out`, `cubic-bezier`）
- `animationend` 事件自动移除 DOM
- throttle 通过 `lodash-es/throttle` 控制生成间隔（默认 250ms）

### EmojiOptions 接口

```ts
interface EmojiOptions {
  status: boolean // 全局开关
  emojis: string[] // 自定义 emoji 列表
  duration: number // 掉落间隔 (ms)
  min: number // 最小尺寸 (px)
  max: number // 最大尺寸 (px)
  stay: number // 动画时长 (ms)
  opacity: number // 全局透明度 (0-1)
}
```
