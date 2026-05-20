# spell-check-editor

基于 TinyMCE 的拼写检查富文本编辑器 —— 支持错词高亮、纠错定位与一键替换。

## 技术栈

- **框架:** React 19, TypeScript
- **构建:** Vite 8 + tsc
- **编辑器:** TinyMCE 7 + @tinymce/tinymce-react 6
- **路由:** React Router 6
- **样式:** Tailwind CSS 3

## 功能

- TinyMCE 富文本编辑器集成
- **高效纠错定位**：基于节点位置索引算法，低内存占用，快速定位。
- **侧边栏托盘交互**：点击托盘错误项，编辑器内对应错词高亮为绿色。
- 自定义词典管理
- 修改建议接受/拒绝
- 跨标签错词高亮处理

## 快速开始

```bash
pnpm install
pnpm dev       # Vite 开发服务器
pnpm build     # 生产构建
pnpm preview   # 预览构建结果
```

## 目录结构

```
src/
  pages/
    EditorPage.tsx    # 编辑器主页面
    DictPage.tsx      # 词典管理页面
  components/         # 可复用组件
  context/            # React Context
  utils/              
    errorMatcher.ts   # 核心匹配逻辑 + 通用 DOM 工具
    spellCheck.ts     # 核心高亮算法
    tinymceSetup.ts   # TinyMCE 集成入口
  App.tsx
  main.tsx
  index.css
```

## 架构说明

项目将**错误匹配逻辑**与**DOM 操作逻辑**分离。

- **`errorMatcher.ts`**：负责将 DOM 转换为纯文本、在纯文本中查找错误、以及通用的清除/替换高亮操作。
- **`spellCheck.ts`**：核心高亮算法。通过记录文本节点的全局位置索引来定位错误，内存占用低，处理速度快。
- **`tinymceSetup.ts`**：TinyMCE 集成入口，负责注册工具栏按钮、绑定事件及提供外部 API（如 `setSelectedError`）。

## 交互设计

1.  **纠错定位**：点击工具栏「纠错定位」，错词在编辑器内标红高亮，并在右侧托盘列出。
2.  **定位错误**：点击托盘中的错误项，编辑器内对应错词背景变为绿色（通过 `.spell-error.selected` 类实现），并自动滚动到可视区域。
3.  **修改建议**：在托盘中点击建议词，编辑器内对应文本被替换，高亮自动清除。
