import { ipcMain, Menu } from 'electron'
import { getMainWindow } from '../window'

interface ShortcutState {
  page: string
  readonly: boolean
  canUndo: boolean
  canRedo: boolean
  hasSelected: boolean
  canComplete: boolean
  canClear: boolean
  canZoom: boolean
}
let currentPage = 'datasets'
let shortcutState: ShortcutState = disabledShortcutState()
export function registerShortcutStateIpcHandlers(): void {
  ipcMain.on('page:change', (_e, page: string) => {
    currentPage = page
    if (page !== 'annotate') shortcutState = disabledShortcutState(page)
    updateMenu()
  })
  ipcMain.on('shortcut-state:change', (_e, state: ShortcutState) => {
    if (state.page !== 'annotate' || currentPage !== 'annotate') {
      shortcutState = disabledShortcutState(currentPage)
      updateMenu()
      return
    }
    shortcutState = {
      page: 'annotate',
      readonly: Boolean(state.readonly),
      canUndo: Boolean(state.canUndo),
      canRedo: Boolean(state.canRedo),
      hasSelected: Boolean(state.hasSelected),
      canComplete: Boolean(state.canComplete),
      canClear: Boolean(state.canClear),
      canZoom: Boolean(state.canZoom)
    }
    updateMenu()
  })
}
export function updateMenu(): void {
  Menu.setApplicationMenu(buildMenu())
}
function disabledShortcutState(page = currentPage): ShortcutState {
  return {
    page,
    readonly: true,
    canUndo: false,
    canRedo: false,
    hasSelected: false,
    canComplete: false,
    canClear: false,
    canZoom: false
  }
}
function sendKey(keyCode: string, modifiers: Array<'control' | 'alt' | 'shift'> = []) {
  getMainWindow()?.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
}
function buildMenu(): Menu {
  const isAnnotate = currentPage === 'annotate' && shortcutState.page === 'annotate'
  const canEdit = isAnnotate && !shortcutState.readonly
  const canZoom = isAnnotate && shortcutState.canZoom
  return Menu.buildFromTemplate([
    { label: '文件', submenu: [{ role: 'quit', label: '退出' }] },
    {
      label: '编辑',
      submenu: isAnnotate
        ? [
            {
              label: '撤销',
              accelerator: 'CmdOrCtrl+Z',
              enabled: canEdit && shortcutState.canUndo,
              click: () => sendKey('z', ['control'])
            },
            {
              label: '重做',
              accelerator: 'CmdOrCtrl+Y',
              enabled: canEdit && shortcutState.canRedo,
              click: () => sendKey('y', ['control'])
            },
            { type: 'separator' },
            {
              label: '删除选中',
              accelerator: 'Backspace',
              enabled: canEdit && shortcutState.hasSelected,
              click: () => sendKey('Backspace')
            },
            {
              label: '清空全部',
              accelerator: 'Delete',
              enabled: canEdit && shortcutState.canClear,
              click: () => sendKey('Delete')
            },
            { type: 'separator' },
            {
              label: '完成多边形/折线',
              accelerator: 'Enter',
              enabled: canEdit && shortcutState.canComplete,
              click: () => sendKey('Enter')
            }
          ]
        : [{ label: '无可用操作', enabled: false }]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+=',
          enabled: canZoom,
          click: () => sendKey('=', ['control'])
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          enabled: canZoom,
          click: () => sendKey('-', ['control'])
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          enabled: canZoom,
          click: () => sendKey('0', ['control'])
        },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'reload', label: '重新加载' }
      ]
    },
    { label: '帮助', submenu: [{ role: 'about', label: '关于' }] }
  ])
}
