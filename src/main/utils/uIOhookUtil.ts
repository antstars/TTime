import { uIOhook } from 'uiohook-napi'
import log from './log'

let isUIOHookStarted = false

export const startUIOHook = (): void => {
  if (isUIOHookStarted) {
    return
  }
  try {
    uIOhook.start()
    isUIOHookStarted = true
  } catch (error) {
    log.error('[uIOhook] - 启动失败 : ', error)
  }
}
