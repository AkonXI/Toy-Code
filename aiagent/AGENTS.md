# aiagent

Express + AI SDK v6 + LangChain + DeepSeek + Qdrant

## Important

**All AI responses must be in Chinese.** Include "请用中文回答" in prompts.

## 操作指引

- **优先使用 MCP 服务** 进行文件读写、搜索、网页抓取等操作

## Commands

```
npm run dev       # nodemon + tsx, watches src/
npm run build     # tsc → dist/
npm start         # node dist/index.js
npm run qdrant    # qdrant/qdrant.exe --config-path qdrant/config/config.yaml
npm test          # vitest --run
npm test:watch    # vitest watch
```

## Environment

- `DEEPSEEK_API_KEY` required
- `PORT` defaults to 3000
- `ALLOWED_ORIGINS` — CORS whitelist

## Architecture

Controller → Service → Repository 分层，控制器薄（30-80 行），业务逻辑在 Service 层。

```
src/
  index.ts              # Entry, routes + shutdown + CORS
  controllers/          # Thin route handlers (req → service → res)
    rag-start.ts        # POST /rag/start + GET /rag/start/progress
    rag-search.ts       # POST /rag/search
    rag-modify.ts       # POST /rag/apply-modification + /rag/render-resume-pdf
    rag-documents.ts    # GET/DELETE/POST /rag/docs/*
    rag-summarize.ts    # POST /rag/summarize
    conversation.ts     # GET/POST/DELETE conversations + messages
    user.ts             # GET /user/profile + /user/documents CRUD
    admin.ts            # System knowledge base CRUD (+ PATCH active)
  services/             # Business logic (no Express types)
    start-conversation.ts
    perform-search.ts   # SSE orchestration: auth → context → intent → streamText
    apply-modification.ts
    restore-document.ts
    rag-context.ts      # Chunk/file/URL loading + user doc search + tempDir lifecycle
    intent.ts           # Intent classification (建议/修改/追问)
    tools.ts            # updateResumeTool + proposeModificationTool
    summary-service.ts  # LLM 自动摘要
    document-service.ts # 文档上传/索引（user + admin 共享）
  utils/                # Shared utilities (no framework deps)
    file-parser.ts      # PDF/DOCX/TXT content extraction
    file-classifier.ts  # Reference file classification
    text-utils.ts       # decodeFilename, mergeOverlappingChunks
    url-utils.ts        # validateURL
    multer.ts           # Multer upload config
    auth-utils.ts       # extractUserId
  middleware/
    validation.ts       # validateBody/Params/Query (zod-based)
  lib/
    providers.ts        # ChatDeepSeek + embedding (Redis + 内存 LRU 双级缓存) + p-retry
    prompts.ts          # ChatPromptTemplate + 所有 LLM prompt 模板
    resume-pdfmaker.ts  # PDF generation (pdfmake + SourceHanSansSC)
    resume-markdown.ts  # replaceText (4-level matching), modifySection
    vector-db.ts        # Qdrant client (system_chunks + user_chunks 双集合)
    schemas.ts          # 纯 zod schema 定义（无 Express 中间件）
    pagination.ts       # Shared pagination utility
    document-loader.ts  # DocumentLoader（文档加载+分块+页码元数据）
    redis.ts            # Redis client (auto-connect)
  auth/                 # Login, logout, token middleware, captcha
  storage/
    repositories/       # Domain repositories (user / conversation / document)
    file-manager.ts     # File storage management
    summary-manager.ts  # DB query + auto-summary registration hook
    database.ts         # Database init + migrations
    schema.sql          # SQL schema
```

## Key Dependencies

| Package | Purpose |
| :--- | :--- |
| `@ai-sdk/deepseek` | Main search (reasoning + SSE + tools, maxRetries: 3) |
| `@langchain/core` | StructuredOutputParser, ChatPromptTemplate |
| `@langchain/deepseek` | Offline LLM calls (p-retry 3次指数退避) |
| `@qdrant/js-client-rest` | Vector DB (user_chunks + system_chunks 集合) |
| `@huggingface/transformers` | `Xenova/bge-small-zh-v1.5` embedding |

## Core Features

- **Conversation Init**: Upload resume (PDF/DOCX) → classifyReferenceFile 预检 → LLM Markdown 转换 (120s 超时) → chunks 存储 (ref_id 直标) → progress polling
- **RAG Search**: Intent classification → tool registration → streamText → onStepFinish 事务包裹增量持久化
- **Intent Types**: `建议`/`修改`/`追问` via `StructuredOutputParser`
- **Tools**: `updateResumeTool` + `proposeModificationTool` → unified `{ field, current, suggestion, reason }`
- **Text Replacement**: 4-level matching (exact → flat → normalized → head+tail)
- **Auto Summary**: Chain-based, triggers at 60 unsummarized messages
- **PDF Generation**: pdfmake, Markdown inline parsing, nested lists
- **Embedding Cache**: Redis 优先 + 内存 LRU (SHA256 key, 24h TTL)；冷启动互斥锁
- **Streaming**: SSE `onStepFinish` 事务包裹 (首次 INSERT + 后续 UPDATE)
- **Prompt Defense**: XML `<user_query>` 标签结构化注入防御
- **Chunk Tracking**: `chunks.ref_id` 直标（无需中间映射表），软删除 + 页码元数据
- **User Documents**: POST/GET/DELETE/PATCH /user/documents, Qdrant 向量索引, RAG 上下文集成

## LLM Architecture

| Use Case | SDK | Model |
| :--- | :--- | :--- |
| Main search (streaming) | `@ai-sdk/deepseek` | `deepseek-v4-pro` |
| Classify/apply/summarize | `@langchain/deepseek` | `deepseek-v4-pro` |
| Markdown conversion | `@langchain/deepseek` | `deepseek-v4-flash` |

## API Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| POST | `/rag/start` | Yes | Upload resume + start (classifyReferenceFile 预检) |
| GET | `/rag/start/progress/:convId` | Yes | Poll processing progress |
| POST | `/rag/search` | Yes | Main search (SSE stream) |
| POST | `/rag/apply-modification` | Yes | Apply/supplement modification |
| POST | `/rag/render-resume-pdf` | Yes | Render PDF from markdown |
| POST | `/rag/summarize` | Yes | Generate conversation summary |
| GET | `/rag/docs` | Yes | List reference files |
| GET | `/rag/docs/:conversationId/history` | Yes | Doc version history |
| DELETE | `/rag/docs/:refId` | Yes | Delete document |
| POST | `/rag/docs/:refId/restore` | Yes | Restore historical version |
| GET | `/rag/docs/:refId/download` | Yes | Download document file |
| GET | `/user/documents` | Yes | List user uploaded documents |
| POST | `/user/documents` | Yes | Upload document to user library |
| DELETE | `/user/documents/:id` | Yes | Delete user document + Qdrant vectors |
| PATCH | `/user/documents/:id` | Yes | Toggle document active/inactive |

## Testing

- `npm test` = vitest, 75 tests in `test/`
- Coverage: routes, auth, captcha, RAG, storage, chunk classification, resume-markdown, pagination, schemas, URL validation
