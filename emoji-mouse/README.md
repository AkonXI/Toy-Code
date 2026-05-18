# emoji-mouse

浏览器扩展（Chrome/Edge），鼠标移动时在页面上生成动态 emoji 拖尾特效。

## 技术栈

- **框架:** Plasmo 0.90（Manifest V3）
- **UI:** Vue 3.5 + TypeScript + Ant Design Vue 4
- **样式:** Tailwind CSS 3
- **存储:** @plasmohq/storage
- **节流:** lodash-es/throttle
- **构建:** Plasmo（基于 Parcel）
- **包管理器:** pnpm

## 功能

- 三种动画类型：水果落水、气球飞走、火花炸裂（18 组 CSS 关键帧）
- 弹窗快捷开关（按标签页控制）
- 全局选项页：emoji 列表、发射间隔、动画时长、大小、透明度
- 全局总开关
- 节流控制发射频率（默认 250ms）
- 动画结束后自动清理 DOM
- 跨标签页设置同步

## 目录结构

```
emoji-mouse/
├── contents/
│   └── emoji-mouse.vue    # 内容脚本：动画生成 + 事件监听
├── background.ts          # Service worker：消息路由 + 存储管理
├── popup.vue              # 扩展弹窗：深色主题、状态切换
├── options.vue            # 选项页：emoji/时长/大小/透明度 配置
├── initOption.ts          # 默认选项值 + EmojiOptions 接口
├── sandbox.ts             # Plasmo sandbox 页面（eval 安全沙盒）
├── postcss.config.ts      # PostCSS 配置
├── tailwind.config.ts     # Tailwind 配置
├── style.css              # Tailwind 指令
└── assets/                # 扩展图标
```

## 快速开始

```bash
pnpm install
pnpm dev          # 开发构建 -> build/chrome-mv3-dev/（以未打包扩展加载）
pnpm build        # 生产构建 -> build/chrome-mv3-prod/
pnpm package      # 构建 + 打包 .zip 用于商店提交
```

## 动画系统

三种动画类型，共 18 组 CSS `@keyframes`，在内容脚本加载时动态注入页面 `<style>`：

| 类型     | 前缀 | 数量 | 效果                                          |
| -------- | ---- | ---- | --------------------------------------------- |
| 水果入水 | `w`  | 5    | 减速坠落 → 贝塞尔上浮 + 淡出（5 种水平偏移）  |
| 气球飞走 | `b`  | 5    | 加速升空 → 减速飘走 + 放大 + 淡出（5 个角度） |
| 火花四溅 | `s`  | 8    | 抛物线弹出 + 缩小 + 淡出（8 个方向）          |

关键帧根据全局透明度动态生成，透明度变更时 `watch` 自动重写 `<style>` 内容。
