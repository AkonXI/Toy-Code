# Toy-Code

个人练手/玩具项目合集，pnpm monorepo 工作区管理。

> **说明**：本项目目录下的代码均为最小化实现，部分包含 AI 生成的代码片段，不可直接用于生产环境。

## 项目列表

| 项目                                       | 简介                     | 技术栈                                                |
| ------------------------------------------ | ------------------------ | ----------------------------------------------------- |
| [aiagent](./aiagent)                       | AI 简历优化后端          | Express + Vercel AI SDK + LangChain + Qdrant + SQLite |
| [aiagentfe-react](./aiagentfe-react)       | 简历优化前端（React）    | React 19 + Ant Design 6 + Zustand + Tailwind CSS      |
| [aiagentfe-vue](./aiagentfe-vue)           | 简历优化前端（Vue）      | Vue 3 + Element Plus + Pinia + Tailwind CSS           |
| [big-screen](./big-screen)                 | 数据可视化大屏           | Vue 2 + ECharts + Ant Design Vue                      |
| DA Studio                                  | 图片数据标注工具         | Vue 3 + Canvas 2D + Electron + Tailwind CSS           |
| [emoji-mouse](./emoji-mouse)               | emoji 鼠标拖尾浏览器扩展 | Plasmo + React + Tailwind CSS                         |
| [spell-check-editor](./spell-check-editor) | 拼写检查富文本编辑器     | React 19 + TinyMCE                                    |

### AI 简历优化系统

`aiagent` + `aiagentfe-react`（或 `aiagentfe-vue`）组成一套完整的 AI 简历优化工具：

1. **后端**（`aiagent`）—— Express 服务器，处理文件上传、大模型交互、RAG 检索和 PDF 生成。采用 Controller → Service → Repository 分层架构
2. **前端** —— 可选 React（`aiagentfe-react`）或 Vue（`aiagentfe-vue`），提供对话式交互界面

### 数据可视化大屏

`big-screen` 独立的大屏数据可视化项目，基于 Vue 2 构建，使用 ECharts 展示各类图表数据，支持多个业务专题模块切换。

### DA Studio 图片标注工具

`DA Studio` 是图片数据标注项目，支持三种构建模式：底层引擎包、Vue 组件库、Electron 桌面应用。底层基于原生 Canvas 2D，支持矩形、点、折线、多边形标注，具备撤销/重做、只读查看、数据集管理和 JSON/CSV 导出。

### 浏览器扩展

`emoji-mouse` 基于 Plasmo 实现的浏览器扩展，鼠标划过时生成动态 emoji 拖尾特效。

### 拼写检查编辑器

`spell-check-editor` 基于 TinyMCE 富文本编辑器实现拼写检查功能，支持错词高亮、纠错定位与一键替换。
