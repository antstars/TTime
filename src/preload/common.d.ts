import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface api {
    logInfoEvent
    logErrorEvent
    getSystemTypeEvent
    openSetPageEvent
    jumpToPage
    showMsgEvent
    cacheHas
    cacheGet
    cacheSet: (storeTypeEnum: string, key: string, obj: unknown) => Promise<void>
    cacheDelete: (storeTypeEnum: string, key: string) => Promise<void>
    textWriteShearPlateEvent
  }
}
