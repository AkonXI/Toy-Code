# emoji-mouse

浏览器扩展（Chrome/Edge），鼠标移动时在页面上生成动态 emoji 拖尾特效。

## 技术栈

- **框架:** Plasmo（Manifest V3）
- **UI:** Vue 3.5 + Ant Design Vue 4
- **样式:** Tailwind CSS 3
- **语言:** TypeScript
- **存储:** @plasmohq/storage

## 功能

- 三种动画类型：水果落水、气球飞走、火花炸裂（18 组 CSS 关键帧）
- 弹窗快捷开关（按标签页控制）
- 全局选项页：emoji 列表、发射间隔、动画时长、大小、透明度
- 全局总开关
- 节流控制发射频率（默认 250ms）
- 动画结束后自动清理 DOM
- 跨标签页设置同步

## 快速开始

```bash
pnpm install
pnpm dev          # 开发构建 -> build/chrome-mv3-dev/（以未打包扩展加载）
pnpm build        # 生产构建 -> build/chrome-mv3-prod/
pnpm package      # 构建 + 打包 .zip 用于商店提交
```
