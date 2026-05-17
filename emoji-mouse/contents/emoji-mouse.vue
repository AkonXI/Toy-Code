<template></template>
<script setup lang="ts">
import throttle from "lodash-es/throttle"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"

import initOption from "~initOption"

const DEFAULT_EMOJIS = [
  "😀",
  "😍",
  "😝",
  "😪",
  "🍇",
  "🍉",
  "🥒",
  "🥦",
  "🍞",
  "🍔",
  "🍟",
  "🦞",
  "🍦",
  "🧃",
  "🍹"
]

// —— 动画方向数据 ——
const waterDrifts = [-20, -8, 0, 8, 20]
const balloonDirs = [
  { dx: -180, dy: -250 },
  { dx: -80, dy: -260 },
  { dx: 0, dy: -270 },
  { dx: 80, dy: -260 },
  { dx: 180, dy: -250 }
]
const sparkDirs = [
  { dx: 0, dy: -200 },
  { dx: 150, dy: -150 },
  { dx: 200, dy: 0 },
  { dx: 150, dy: 150 },
  { dx: 0, dy: 200 },
  { dx: -150, dy: 150 },
  { dx: -200, dy: 0 },
  { dx: -150, dy: -150 }
]

// —— 预计算动画名称列表 ——
const animNames: string[] = []
for (let i = 0; i < waterDrifts.length; i++) animNames.push(`w${i}`)
for (let i = 0; i < balloonDirs.length; i++) animNames.push(`b${i}`)
for (let i = 0; i < sparkDirs.length; i++) animNames.push(`s${i}`)

// —— 按透明度生成 @keyframes ——
const generateStyles = (op: number): string => {
  let css = ""

  // 类型1: 水果入水
  waterDrifts.forEach((drift, i) => {
    css += `@keyframes w${i}{`
    css += `0%{transform:translate(0,0);opacity:0;animation-timing-function:ease-in}`
    css += `10%{opacity:${op};animation-timing-function:cubic-bezier(.65,0,.95,0)}`
    css += `45%{transform:translate(${drift * 0.5}px,150px);opacity:${op};animation-timing-function:ease-out}`
    css += `100%{transform:translate(${drift * 0.3}px,125px);opacity:0}`
    css += `}`
  })

  // 类型2: 气球飞走
  balloonDirs.forEach((dir, i) => {
    css += `@keyframes b${i}{`
    css += `0%{transform:translate(0,0) scale(0.4);opacity:0;animation-timing-function:ease-out}`
    css += `12%{opacity:${op};transform:translate(${dir.dx * 0.1}px,${dir.dy * 0.05}px) scale(0.8);animation-timing-function:ease-in}`
    css += `55%{transform:translate(${dir.dx * 0.55}px,${dir.dy * 0.55}px) scale(1.25);animation-timing-function:ease-out}`
    css += `100%{transform:translate(${dir.dx}px,${dir.dy}px) scale(1.6);opacity:0}`
    css += `}`
  })

  // 类型3: 火花四溅
  sparkDirs.forEach((dir, i) => {
    css += `@keyframes s${i}{`
    css += `0%{transform:translate(0,0) scale(0.3);opacity:0}`
    css += `8%{opacity:${op};transform:translate(${dir.dx * 0.1}px,${dir.dy * 0.1 - 40}px) scale(1)}`
    css += `30%{transform:translate(${dir.dx * 0.4}px,${dir.dy * 0.3 - 60}px) scale(0.9)}`
    css += `65%{transform:translate(${dir.dx * 0.75}px,${dir.dy * 0.7 - 15}px) scale(0.5)}`
    css += `100%{transform:translate(${dir.dx}px,${dir.dy}px) scale(0.2);opacity:0}`
    css += `}`
  })

  return css
}

const styleEl = document.createElement("style")
styleEl.textContent = generateStyles(initOption.opacity)
document.head.appendChild(styleEl)

// —— 业务逻辑 ——
const currentPageStatus = ref(true)
const options = ref(initOption)

const images = computed(() => {
  return options.value.emojis?.length ? options.value.emojis : DEFAULT_EMOJIS
})

const compStay = computed(() => {
  return options.value.stay / 1000 + "s"
})

let throttledHandler: ReturnType<typeof throttle> | null = null

const createThrottledHandler = () => {
  if (throttledHandler) {
    document.removeEventListener("mousemove", throttledHandler)
  }
  const body = document.body
  throttledHandler = throttle(function (e: MouseEvent) {
    if (currentPageStatus.value && options.value.status) {
      const icon = images.value[Math.floor(Math.random() * images.value.length)]
      const size =
        (options.value.min ?? 15) +
        Math.random() * (options.value.max - options.value.min)

      const animName = animNames[Math.floor(Math.random() * animNames.length)]

      const emoji = document.createElement("span")
      emoji.innerText = icon
      emoji.style.position = "fixed"
      emoji.style.left = e.clientX + "px"
      emoji.style.top = e.clientY + "px"
      emoji.style.zIndex = "9999"
      emoji.style.pointerEvents = "none"
      emoji.style.fontSize = size + "px"
      emoji.style.animationName = animName
      emoji.style.animationDuration = compStay.value
      emoji.style.animationTimingFunction =
        animName[0] === "s" ? "ease-out" : "ease-in-out"
      emoji.style.animationFillMode = "forwards"

      body.appendChild(emoji)
      emoji.addEventListener("animationend", () => {
        emoji.remove()
      })
    }
  }, options.value.duration || 250)
  document.addEventListener("mousemove", throttledHandler)
}

watch(
  () => options.value.duration,
  () => {
    createThrottledHandler()
  }
)

watch(
  () => options.value.opacity,
  (op) => {
    styleEl.textContent = generateStyles(op)
  }
)

onMounted(() => {
  chrome.runtime.sendMessage({ type: "get-current-status" }, (response) => {
    if (chrome.runtime.lastError) return
    currentPageStatus.value = response
  })
  chrome.runtime.onMessage.addListener((event, sender, callable) => {
    if (event.type == "change-current-status") {
      currentPageStatus.value = event.data.currentPageStatus
    }
    if (event.type == "options-updated") {
      options.value = { ...initOption, ...event.data }
    }
  })

  chrome.runtime.sendMessage({ type: "get-options" }, (v) => {
    if (chrome.runtime.lastError) return
    options.value = { ...initOption, ...v }
    createThrottledHandler()
  })
})

onUnmounted(() => {
  if (throttledHandler) {
    document.removeEventListener("mousemove", throttledHandler)
  }
})
</script>
<script lang="ts">
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"]
}
</script>
<style></style>
