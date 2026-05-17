# AGENTS.md

## 项目概述

**emoji-mouse** — 一个浏览器扩展（Chrome + Edge），在用户鼠标光标后渲染下落的 emoji 尾迹。基于 [Plasmo](https://docs.plasmo.com/) + Vue 3 构建。

## 技术栈

| 层级      | 技术                                      |
| --------- | ----------------------------------------- |
| 扩展框架  | Plasmo 0.90.3（Manifest V3）              |
| UI 框架   | Vue 3.5（Composition API）                |
| UI 组件   | Ant Design Vue 4（popup 和 options 页面） |
| 样式      | Tailwind CSS 3                            |
| 语言      | TypeScript 5.6                            |
| 构建/打包 | Plasmo（基于 Parcel）                     |
| 包管理器  | pnpm                                      |
| 格式化    | Prettier 3 + import sort 插件             |
| CI/CD     | GitHub Actions（发布到 Chrome/Edge 商店） |

## 命令

```bash
pnpm dev          # 启动开发服务器（watch 模式，输出到 build/chrome-mv3-dev/）
pnpm build        # 生产构建（输出到 build/chrome-mv3-prod/）
pnpm package      # 构建 + 生成 .zip 用于商店提交
pnpm lint         # 尚未配置 — 直接用 Prettier：
npx prettier --check .
npx prettier --write .
npx tsc --noEmit   # 类型检查
```

## 目录结构

```
emoji-mouse/
├── contents/
│   └── emoji-mouse.vue    # 内容脚本：监听 mousemove 生成下落 emoji
├── background.ts          # Service worker：消息路由 + 存储
├── popup.vue              # 扩展弹窗：单个标签页开关
├── options.vue            # 选项页：emoji/时长/大小 配置
├── initOption.ts          # 默认选项值
├── devtools.vue           # DevTools 面板入口（占位）
├── sandbox.ts             # Sandbox eval 页面（⚠️ 安全风险）
├── style.css              # Tailwind 指令
├── panels/                # DevTools 子页面（占位）
├── tabs/                  # 新标签页面（占位）
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
| `get-current-status`    | popup/content → SW   | 检查当前标签页是否启用     |
| `change-current-status` | popup → SW + content | 切换当前标签页启停         |
| `get-current-tabId`     | popup → SW           | 获取当前活动标签页 ID      |

### 存储

- **sync/local**（`@plasmohq/storage`）： `options` — 全局 emoji 配置
- **session**：`filter-tabs` — 已禁用 emoji 的标签页 ID 数组

## 代码规范

- **Prettier**：80 字符宽度、2 空格缩进、不用分号、双引号、不加 trailing comma
- **Import 排序**（由 `@ianvs/prettier-plugin-sort-imports` 强制执行）：
  1. Node.js 内置模块
  2. 第三方模块
  3. `@plasmo/*`
  4. `@plasmohq/*`
  5. `~*`（根目录别名）
  6. `./`（相对路径）
- **Vue 风格**：新文件优先使用 `<script setup>`（现有的 Options API `setup()` 应迁移）
- **路径别名**： `~` 映射到项目根目录（例：`import initOption from "~initOption"`）

## 已知问题（改进计划）

### P0 — Bug

- **`options.vue:52`**：透明度 `<input-number>` 绑定了 `FormData.stay` 而非应有的专用字段 `FormData.opacity`。`initOption.ts` 也缺少 `opacity` 字段。
- **`contents/emoji-mouse.vue:77`**：throttle 的 `duration` 在 `onMounted` 时闭包捕获一次，后续修改配置不会生效，必须刷新页面。
- **`popup.vue:35-38`**：`watchEffect` 在每次响应式更新时都会新增一个 `message` 监听器导致泄露。改用 `onMounted` + `onUnmounted`。

### P1 — 性能 / 包体积

- **ant-design-vue 全量引入**导致生产包约 4MB，实际只用了 6 个组件（Switch、Button、Radio、Form、Select、InputNumber、message）。建议使用 `unplugin-vue-components` 按需引入。
- **lodash-es** 只用了 `throttle` — 用约 10 行代码实现即可移除依赖。
- `document.querySelector("body")` 在每次 mousemove 事件中执行 — 将 `document.body` 缓存到 throttle 外部。
- 每个 emoji 用 `setTimeout` 清理 — 改用 `animationend` 事件。

### P2 — 安全 / 架构

- **`sandbox.ts`** 暴露 `eval()` — 如未使用应移除。
- **权限** `clipboardRead`、`clipboardWrite`、`scripting` 声明但未使用 — 从 manifest 移除。
- **内容脚本匹配所有页面**（`https://*/*`、`http://*/*`） — 考虑通过 `activeTab` + `chrome.scripting` 按需注入。
- **DevTools 面板**（`devtools.vue`、`panels/`）是占位内容 — 移除以减小包体积。
- **CI 使用 Node 16**（已 EOL） — 升级到 Node 20+。

### P3 — 代码质量

- **`contents/emoji-mouse.vue:33-48`**：硬编码的默认 emoji 列表 — 移入 `initOption.ts`。
- **`options.vue`**： `Input` 已引入但未使用； `Row` 在模板中写成 `<row>`（HTML 大小写不敏感）。
- **缺少 TypeScript 接口** 定义选项结构 — 新增 `interface EmojiOptions`。
- **`chrome.runtime.sendMessage` 回调缺少错误处理**。
- **拼写错误** `popup.vue:3` — `emoji mosue` → `emoji mouse`。
- **`contents/emoji-mouse.vue`** 使用 Options API，其他文件用 `<script setup>` — 统一风格。
- `options.vue:80-82` 注释掉的 emoji 数组 — 测试数据，保留。
- **`background.ts:5`** — `export {}` 无实际作用。
- **未配置测试**。
