import { Storage } from "@plasmohq/storage"

import initOption from "~initOption"

const storage = new Storage()

console.log("background loaded")
storage.watch({
  options: (v) => {
    // console.log("status-change")
    // chrome.runtime.sendMessage({
    //   type: "status-change",
    //   data: {
    //     status: v.newValue.status
    //   }
    // })
  }
})
const sStorage = new Storage({
  area: "session"
})

chrome.runtime.onMessage.addListener((event, sender, callable) => {
  ;(async () => {
    if (event.type == "update-option") {
      const merged = { ...initOption, ...event.data }
      storage.set("options", merged)
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id!, {
              type: "options-updated",
              data: merged
            })
            .catch(() => {})
        })
      })
      callable(storage)
    }
    if (event.type == "get-options") {
      const options = await storage.get("options")
      callable({ ...initOption, ...(options || {}) })
    }
    if (event.type == "change-current-status") {
      let filterTabs = ((await sStorage.get("filter-tabs")) as any[]) ?? []

      if (!event.data.currentPageStatus) {
        //切换成false 加上黑名单
        filterTabs.push(event.data.id)
        filterTabs = [...new Set(filterTabs)]
      } else {
        filterTabs = filterTabs.filter((v) => v !== event.data.id)
      }
      sStorage.set("filter-tabs", filterTabs)
    }
    if (event.type == "get-current-tabId") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        callable(tabs[0].id)
      })
    }

    if (event.type == "get-current-status") {
      const filterTabs = ((await sStorage.get("filter-tabs")) as any[]) ?? []
      console.log(filterTabs)

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (filterTabs.some((v) => v == tabs[0].id)) {
          callable(false)
        } else {
          callable(true)
        }
      })
    }
  })()

  return true
})
chrome.runtime.onInstalled.addListener((details) => {
  console.log("init", details)
  ;(async () => {
    if (!(await storage.get("options"))) storage.set("options", initOption)
  })()
  return true
})
