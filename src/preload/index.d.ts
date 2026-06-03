import { ElectronAPI } from '@electron-toolkit/preload'

declare global {

  interface api {
    windowHeightChangeEvent
    updateTranslateContentEvent
    clearAllTranslateContentEvent
    pageHeightChangeEvent
    openSetPageEvent
    alwaysOnTopEvent
    windowHeightChangeMaxEvent
    logDebugEvent
    logInfoEvent
    logErrorEvent
    screenshotEndNotifyEvent
    winShowEvent
    winShowByInputEvent
    apiUniteTranslate
    openAINodeRequestProbe
    showMsgEvent
    updateTranslateServiceEvent
    updateTranslateServiceNotify
    apiTranslateResultMsgCallbackEvent
    agentApiTranslateCallback
    agentApiOcr
    agentApiOcrCallback
    updateCacheEvent
    ttimeApiAppStart
    ttimeApiTranslateUse
    winFontSizeNotify
    winSizeUpdate
  }

  interface Window {
    electron: ElectronAPI
    api: api
  }

}
