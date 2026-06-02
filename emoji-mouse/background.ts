import { Storage } from '@plasmohq/storage'

import type { EmojiOptions } from '~initOption'
import initOption from '~initOption'

const storage = new Storage()

console.log('background loaded')
storage.watch({
  options: () => {}
})

const sStorage = new Storage({
  area: 'session'
})

interface UpdateOptionMsg {
  type: 'update-option'
  data: Partial<EmojiOptions>
}

interface GetOptionsMsg {
  type: 'get-options'
}

interface ChangeStatusMsg {
  type: 'change-current-status'
  data: { currentPageStatus: boolean; id: number }
}

interface GetTabIdMsg {
  type: 'get-current-tabId'
}

interface GetStatusMsg {
  type: 'get-current-status'
}

type Message = UpdateOptionMsg | GetOptionsMsg | ChangeStatusMsg | GetTabIdMsg | GetStatusMsg

chrome.runtime.onMessage.addListener(
  // eslint-disable-next-line no-unused-vars
  (event: Message, _sender: chrome.runtime.MessageSender, callable: (_: unknown) => void) => {
    ;(async () => {
      if (event.type === 'update-option') {
        const merged: EmojiOptions = { ...initOption, ...event.data }
        await storage.set('options', merged)
        chrome.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
          tabs.forEach((tab: chrome.tabs.Tab) => {
            if (tab.id !== undefined) {
              chrome.tabs
                .sendMessage(tab.id, {
                  type: 'options-updated',
                  data: merged
                })
                .catch(() => {})
            }
          })
        })
        callable(storage)
      }

      if (event.type === 'get-options') {
        const options = await storage.get<EmojiOptions>('options')
        callable({ ...initOption, ...(options || {}) })
      }

      if (event.type === 'change-current-status') {
        let filterTabs = ((await sStorage.get<number[]>('filter-tabs')) as number[]) ?? []

        if (!event.data.currentPageStatus) {
          filterTabs.push(event.data.id)
          filterTabs = [...new Set(filterTabs)]
        } else {
          filterTabs = filterTabs.filter((v: number) => v !== event.data.id)
        }
        await sStorage.set('filter-tabs', filterTabs)
      }

      if (event.type === 'get-current-tabId') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
          callable(tabs[0]?.id)
        })
      }

      if (event.type === 'get-current-status') {
        const filterTabs = ((await sStorage.get<number[]>('filter-tabs')) as number[]) ?? []
        console.log(filterTabs)

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
          const currentTabId = tabs[0]?.id
          if (filterTabs.some((v: number) => v === currentTabId)) {
            callable(false)
          } else {
            callable(true)
          }
        })
      }
    })()

    return true
  }
)

chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
  console.log('init', details)
  ;(async () => {
    const existing = await storage.get<EmojiOptions>('options')
    if (!existing) {
      await storage.set('options', initOption)
    }
  })()
  return true
})
