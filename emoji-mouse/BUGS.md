# Bug & 优化清单

> 按优先级排列，标注受影响文件和行号。

---

## P0 — Bug（影响功能正确性）

### B1. 透明度绑定错误变量

**文件**: `options.vue:52` · `initOption.ts`

```html
<!-- 当前：v-model="FormData.stay" 错误地绑定了存在时长 -->
<input-number v-model:value="FormData.stay" ... />
```

`FormData.stay` 是存在时长(ms)，透明度字段应该绑定独立的 `FormData.opacity`。同时 `initOption.ts` 缺少 `opacity` 默认值。

---

### B2. Throttle 间隔不响应配置变更

**文件**: `contents/emoji-mouse.vue:77`

`lodash throttle` 的 `duration` 参数在 `onMounted` 时被闭包捕获，用户在选项页修改间隔后不会生效，必须刷新页面。

---

### B3. watchEffect 内存泄露

**文件**: `popup.vue:35-38`

```ts
watchEffect(() => {
  window.addEventListener("message", (event) => { ... })
})
```

每次响应式依赖变化都会新增一个 `message` 监听器，旧的不移除。应改用 `onMounted` + `onUnmounted`。

---

### B4. 拼写错误

**文件**: `popup.vue:3`

`emoji mosue` → `emoji mouse`

---

## P1 — 性能 / 体积

### P1.1 lodash-es 只用 throttle

**文件**: `contents/emoji-mouse.vue:3`

整个 `lodash-es` 依赖 (~70KB) 只用了 `throttle`，可用 10 行代码替代，减少依赖。

### P1.2 ant-design-vue 全量引入 → ~4MB

**文件**: `popup.vue:17` · `options.vue:73`

生产构建约 4MB，主要来自 Ant Design。popup 和 options 只用了 6 个组件：`Switch, Button, Radio, Form, FormItem, Select, InputNumber, message`。建议使用 `unplugin-vue-components` 按需引入。

### P1.3 每次事件都 query DOM

**文件**: `contents/emoji-mouse.vue:58`

```js
let body = document.querySelector("body") // 每次 mousemove 都执行
```

应缓存 `document.body` 到 throttle 外部。

### P1.4 setTimeout 清理 DOM

**文件**: `contents/emoji-mouse.vue:73-75`

每个 emoji 用 `setTimeout` 定时移除。频繁鼠标移动会产生大量定时器。改用 `animationend` 事件自动清理。

---

## P2 — 安全 / 架构

### P2.1 sandbox.ts 暴露 eval()

**文件**: `sandbox.ts:8`

```ts
source.window.postMessage(eval(event.data), event.origin)
```

直接 `eval()` 用户消息，存在远程代码执行风险。如未使用请移除。

### P2.2 多余的 permissions

**文件**: `package.json:38-40`

`clipboardRead`、`clipboardWrite`、`scripting` 声明了但代码中未使用，应在 manifest 中移除，避免安装时给用户不必要的权限警告。

### P2.3 content script 全量注入

**文件**: `contents/emoji-mouse.vue:9-11`

匹配所有 `http://*/*` + `https://*/*`，每个页面都注入内容脚本，即使用户从不用。可改为 `activeTab` + `chrome.scripting.executeScript` 按需注入。

### P2.4 无用的 DevTools / tabs 占位页面

**文件**: `devtools.vue` · `panels/` · `tabs/test.vue`

这些页面只含占位内容，无实际功能，可移除以减小包体积。

### P2.5 CI Node 版本

**文件**: `.github/workflows/submit.yml`

CI 使用 Node 16（已 EOL），应升级到 Node 20+。

---

## P3 — 代码质量

### P3.1 默认 emoji 列表硬编码

**文件**: `contents/emoji-mouse.vue:33-48`

14 个 emoji 的默认列表直接写在内容脚本里，应移入 `initOption.ts`。

~~### P3.2 注释掉的废弃代码~~
~~**文件**: `options.vue:80-82` — 两行注释掉的 emoji 数组~~

~~（保留作为测试数据，不删除）~~

### P3.3 未使用的 import

**文件**: `options.vue:73`

`Input` 组件已 import 但模板中未使用。`Row` 在模板中用作 `<row>`（HTML 大小写不敏感导致匹配）。

### P3.4 缺少 TypeScript 类型

**文件**: `initOption.ts`

没有对 options 对象的类型定义，应新增 `interface EmojiOptions`。

### P3.5 API 调用无错误处理

所有 `chrome.runtime.sendMessage` 的回调中未处理 `chrome.runtime.lastError`。

### P3.6 代码风格不统一

- `contents/emoji-mouse.vue` 使用 Options API (`export default { setup() }`)
- `popup.vue` / `options.vue` 使用 `<script setup>`
- 应统一为 Composition API + `<script setup>`

### P3.7 多余的 export {}

**文件**: `background.ts:5`

`export {}` 无实际作用，可移除。

### P3.8 无测试

项目中未配置任何测试框架，无测试用例。

---

## 变更统计

| 优先级 | 数量   | 类型      |
| ------ | ------ | --------- |
| P0     | 4      | Bug       |
| P1     | 4      | 性能/体积 |
| P2     | 5      | 安全/架构 |
| P3     | 8      | 代码质量  |
| **共** | **21** |           |
