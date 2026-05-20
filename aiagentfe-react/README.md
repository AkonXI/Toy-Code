# aiagentfe-react

AI 简历优化的 React 前端 —— 与 AI 对话优化简历，流式建议 + 实时 PDF 预览。

## 技术栈

- **框架:** React 19, TypeScript
- **构建:** Vite 6
- **UI:** Ant Design 6
- **样式:** Tailwind CSS 4
- **状态管理:** Zustand 5
- **路由:** React Router 7
- **AI SDK:** @ai-sdk/react（useChat hook）
- **HTTP:** axios

## 功能

- 对话管理（列表、新建、切换、删除）
- 简历上传与 AI 解析
- 分屏编辑器：PDF 预览 + 对话面板
- 流式 AI 对话，支持推理过程展示
- 优化建议卡片，一键应用
- 修改审核（接受/补充/拒绝）

## 快速开始

```bash
npm install
npm run dev       # Vite 开发服务器（端口 5173，代理 /api -> localhost:3000）
npm run build     # 生产构建
npm test          # 运行测试
```
