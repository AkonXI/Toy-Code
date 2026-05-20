# aiagentfe-react

React 19 + Vite + TypeScript + Ant Design v6 + Zustand

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
  lib/           # Utilities
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

## Testing

- Vitest, test files in `src/tests/`
