# big-screen

数据可视化大屏项目 —— 基于 Vue 2 + Vite 8 构建，使用 ECharts 展示各类图表数据。

## 技术栈

- **框架:** Vue 2.7
- **构建:** Vite 8
- **图表:** ECharts 5 + ECharts GL
- **滚动:** vue-seamless-scroll
- **动画:** lottie-web
- **自适应:** autofit.js

## 功能

- 多专题大屏页面切换（4 个专题模块）
- 饼图/玫瑰图统一组件，支持灵活配置位置、半径、图例
- 3D 饼图（echarts-gl），水平自动旋转
- 自定义 3D 柱状图
- 图表背景圆环装饰
- 无缝滚动列表 + 表格
- 响应式自适应布局（autofit.js）

## 快速开始

```bash
npm install
npm run dev       # Vite 开发服务器（端口 3005）
npm run build     # 生产构建
npm run preview   # 预览构建结果
```

## 目录结构

```
src/
  views/bigScreen/
    com/                    # 公共组件（PieCharts、BarCharts、pieBg 等）
    topic1/                 # 专题一
    topic2/                 # 专题二
    topic3/                 # 专题三
    topic4/                 # 专题四
    leftNav/                # 左侧导航
    screenTitle.vue         # 顶部标题栏
    index.vue               # 大屏入口
  utils/
    mockData.js             # Mock 数据
  mixins/                   # 公共混入
  assets/                   # 静态资源
  App.vue
  main.js
```
