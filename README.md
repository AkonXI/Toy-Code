# Toy-Code

个人练手/玩具项目合集，pnpm monorepo 工作区管理。

> **说明**：本项目目录下的代码均为最小化实现，部分包含 AI 生成的代码片段，不可直接用于生产环境。

## 项目列表

| 项目 | 简介 | 技术栈 |
|------|------|--------|
| [aiagent](./aiagent) | AI 简历优化后端 | Express + Vercel AI SDK + LangChain + LanceDB + SQLite |
| [aiagentfe-react](./aiagentfe-react) | 简历优化前端（React） | React 19 + Ant Design 6 + Zustand 5 + Tailwind CSS |
| [aiagentfe-vue](./aiagentfe-vue) | 简历优化前端（Vue） | Vue 3 + Element Plus 2 + Pinia 3 + Tailwind CSS |
| [canvas-anno-vue](./canvas-anno-vue) | 图片标注工具 | Vue 3 + Canvas 2D + Tailwind CSS |
| [emoji-mouse](./emoji-mouse) | emoji 鼠标拖尾浏览器扩展 | Plasmo + Vue 3 + Ant Design Vue |
| [spell-check-editor](./spell-check-editor) | 拼写检查富文本编辑器 | React 19 + TinyMCE |

### AI 简历优化系统

`aiagent` + `aiagentfe-react`（或 `aiagentfe-vue`）组成一套完整的 AI 简历优化工具：
1. **后端**（`aiagent`）—— Express 服务器，处理文件上传、大模型交互、RAG 检索和 PDF 生成
2. **前端** —— 可选 React（`aiagentfe-react`）或 Vue（`aiagentfe-vue`），提供对话式交互界面

### 图片标注工具

`canvas-anno-vue` 独立的图片标注引擎，基于原生 Canvas 2D 实现，支持矩形、点、折线、多边形标注，具备完整的撤销/重做功能。

### 浏览器扩展

`emoji-mouse` 基于 Plasmo 实现的浏览器扩展，鼠标划过时生成动态 emoji 拖尾特效。

### 拼写检查编辑器

`spell-check-editor` 基于 TinyMCE 富文本编辑器实现拼写检查功能，支持错词高亮、纠错定位与一键替换。
