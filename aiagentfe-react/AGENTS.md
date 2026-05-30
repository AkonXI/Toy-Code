# aiagentfe-react

React 19 + Vite + TypeScript + Ant Design v6 + Zustand + marked

## 操作指引

- **优先使用 MCP 服务** 进行文件读写、搜索、网页抓取等操作

## Commands

```
npm run dev       # Vite dev server
npm run build     # tsc --noEmit && vite build
npm run test      # vitest watch
npm run test:run  # vitest once
npm run lint      # ESLint check
npm run format    # Prettier format
```

## Architecture

- React 19 + React Router v7
- Zustand for state management
- Ant Design v6 UI components
- Axios, proxied to backend
- Zod for validation
- `@ai-sdk/react` for AI chat streaming
- Path alias `@/` → `src/`

## Directory Structure

```
src/
  api/           # Axios instance + API functions
  components/    # Shared UI components
  hooks/         # Custom React hooks
  lib/           # Utilities (MultipartChatTransport, etc.)
  pages/         # Route pages
  router/        # React Router config
  stores/        # Zustand stores
  styles/        # Global styles
  types/         # TypeScript type definitions
  tests/         # Vitest tests
```

## Key Dependencies

| Package | Purpose |
| :--- | :--- |
| `react` + `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `antd` + `@ant-design/icons` | UI component library |
| `@ai-sdk/react` + `ai` | AI chat streaming |
| `zustand` | State management |
| `zod` | Schema validation |
| `axios` | HTTP client |
| `marked` | Markdown parsing for assistant messages |

## Core Features

- **Transport Stability**: `useRef` 惰性初始化 transport + `useCallback` 稳定 `onFinish`/`onError` 引用，避免 `useChat` 内部无限重渲染
- **Stop Button**: 发送+停止按钮共存（`isSearchProcessing`），仅 search 流式回复可停止；`transport.stop()` 正确 abort
- **Message Queue**: Serial execution via `enqueueRequest`/`processQueue`, dedup, drag reorder, cancel/cancelAll
- **Queue State**: `isProcessing` + `isSearchProcessing` 分离，processQueue split guards 防止 multi-queue 误清 flags
- **ChatPanel Methods**: `useImperativeHandle` 暴露 `scrollToBottom`, `getScrollHeight`, `restoreScrollPosition`, `setInput`, `openSupplementDialog`
- **History Scroll**: 滚动到顶自动加载 + `restoreScrollPosition(delta)` 保持滚动位置
- **Initial Scroll**: `useEffect([loading])` → React batch flush 后 `scrollToBottom()`
- **Markdown Rendering**: `marked` 标准解析（代码块、表格、标题），仅 assistant 消息，`whitespace-pre-wrap` 仅应用于 user 消息
- **Upload Progress**: 指数衰减曲线模拟 + 6 阶段 + `rAF` 平滑到 100%
- **Loading/Error UI**: Skeleton + Result + 重试按钮
- **Apply/Accept**: `/rag/apply-modification` → PDF regenerate
- **Supplement**: Open dialog, `displayText` 字段对齐 Vue

## Testing

- Vitest, 45 tests in `src/tests/`
