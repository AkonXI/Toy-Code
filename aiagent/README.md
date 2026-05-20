# aiagent

AI 简历优化后端 —— 上传简历，让 DeepSeek 大模型分析并给出智能优化建议。

## 技术栈

- **运行时:** Node.js, TypeScript
- **框架:** Express 5
- **大模型:** DeepSeek（@ai-sdk/deepseek + @langchain/deepseek）
- **向量数据库:** LanceDB
- **嵌入模型:** @huggingface/transformers（Xenova/bge-small-zh-v1.5）
- **数据库:** SQLite（better-sqlite3）
- **缓存:** Redis（ioredis）
- **PDF 处理:** pdf-parse, mammoth, pdfmake
- **验证码:** @napi-rs/canvas

## 功能

- 简历上传与 AI 解析（PDF/Markdown）
- RAG 检索增强生成，支持意图分类
- 流式 AI 对话（SSE + 推理过程展示）
- 双工具系统：优化建议 + 具体修改
- 对话自动摘要
- 系统知识库向量检索

## 快速开始

```bash
npm install
```

配置环境变量：

```env
DEEPSEEK_API_KEY=你的API密钥
# 可选: REDIS_HOST=localhost REDIS_PORT=6379
```

```bash
npm run dev      # 开发模式热重载（端口 3000）
npm run build    # 编译 TypeScript
npm start        # 启动生产服务
npm test         # 运行测试
```
