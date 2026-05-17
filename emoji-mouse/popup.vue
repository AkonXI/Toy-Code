<template>
  <div
    class="w-[300px] bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white select-none">
    <div class="flex items-center gap-3 p-5 pb-3">
      <div class="text-3xl">🖱️</div>
      <div>
        <div class="text-lg font-bold tracking-wide">emoji mouse</div>
        <div class="text-xs text-white/40">鼠标尾迹扩展</div>
      </div>
    </div>

    <div class="mx-5 h-px bg-white/8" />

    <div class="p-5 pt-4">
      <div
        class="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3.5 hover:bg-white/8 transition-colors">
        <div class="flex items-center gap-3">
          <div
            class="w-2.5 h-2.5 rounded-full transition-colors duration-300"
            :class="
              status
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                : 'bg-white/20'
            " />
          <div>
            <div class="text-sm font-medium">当前页面</div>
            <div class="text-xs text-white/30 mt-0.5">
              {{ status ? "已开启" : "已关闭" }}
            </div>
          </div>
        </div>

        <Switch v-model:checked="status" size="small" @change="changeSatus">
          <template #checkedChildren><check-outlined /></template>
          <template #unCheckedChildren><close-outlined /></template>
        </Switch>
      </div>
    </div>

    <div class="px-5 pb-4 text-center">
      <span class="text-[10px] text-white/15 tracking-wider">EMOJI MOUSE</span>
    </div>
  </div>

  <iframe src="sandbox.html" ref="iframeRef" class="hidden" />
</template>
<script setup lang="ts">
import { CheckOutlined, CloseOutlined } from "@ant-design/icons-vue"
import Switch from "ant-design-vue/es/switch"
import { onMounted, onUnmounted, ref } from "vue"

const status = ref(true)

defineOptions({
  prepare(app) {}
})
const iframeRef = ref<HTMLIFrameElement>(null)

const changeSatus = (v) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "change-current-status",
      data: { currentPageStatus: v, id: tabs[0].id }
    })
    chrome.runtime.sendMessage(
      {
        type: "change-current-status",
        data: { currentPageStatus: v, id: tabs[0].id }
      },
      () => {
        if (chrome.runtime.lastError) return
        status.value = v
      }
    )
  })
}
const handleMessage = (event: MessageEvent) => {
  console.log("EVAL output: " + event.data)
}
onMounted(() => {
  window.addEventListener("message", handleMessage)
  chrome.runtime.sendMessage({ type: "get-current-status" }, (response) => {
    if (chrome.runtime.lastError) return
    status.value = response
  })
})
onUnmounted(() => {
  window.removeEventListener("message", handleMessage)
})
</script>
<style>
@import "./style.css";

.anticon {
  vertical-align: middle !important;
}

.ant-switch {
  background: rgba(255, 255, 255, 0.12) !important;
}

.ant-switch-checked {
  background: #10b981 !important;
}
</style>
