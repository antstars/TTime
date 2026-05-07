import { clipboard } from 'electron'
import { uIOhook, UiohookKeyboardEvent } from 'uiohook-napi'
import GlobalWin from './GlobalWin'
import { YesNoEnum } from '../../common/enums/YesNoEnum'
import StoreService from './StoreService'
import { GlobalShortcutEvent } from './GlobalShortcutEvent'
import { SystemTypeEnum } from '../enums/SystemTypeEnum'
import { startUIOHook } from '../utils/uIOhookUtil'

startUIOHook()

/**
 * 剪贴板监听事件
 */
uIOhook.on('keydown', (e: UiohookKeyboardEvent) => {
  // console.log('text e = ', e)
  const status = SystemTypeEnum.isMac() ? e.metaKey : e.ctrlKey
  if (
    status &&
    e.keycode === 46 &&
    StoreService.configGet('clipboardListenerStatus') === YesNoEnum.Y &&
    !GlobalShortcutEvent.isChoice &&
    !GlobalShortcutEvent.isClipboardListenerSuppressed()
  ) {
    setTimeout(() => {
      if (GlobalShortcutEvent.isChoice || GlobalShortcutEvent.isClipboardListenerSuppressed()) {
        return
      }
      let text = clipboard.readText()
      if (GlobalShortcutEvent.isBlankText(text)) {
        return
      }
      text = GlobalShortcutEvent.splitSingleCamelCase(text)
      text = GlobalShortcutEvent.splitSingleUnderScore(text)
      if (GlobalShortcutEvent.isBlankText(text)) {
        return
      }
      // 推送给Vue页面进行更新翻译输入内容
      GlobalWin.mainWinUpdateTranslatedContent(text)
      GlobalWin.mainWinShow()
    }, 300)
  }
})
