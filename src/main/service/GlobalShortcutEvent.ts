import { app, BrowserWindow, clipboard, globalShortcut } from 'electron'
import log from '../utils/log'
import robot from '@jitsi/robotjs'
import { ScreenshotsMain } from './Screenshot'
import R from '../../common/class/R'
import { ShortcutKeyEnum } from '../../common/enums/ShortcutKeyEnum'
import { SystemTypeEnum } from '../enums/SystemTypeEnum'
import GlobalWin from './GlobalWin'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import OcrTypeEnum from '../enums/OcrTypeEnum'
import StoreService from './StoreService'
import { YesNoEnum } from '../../common/enums/YesNoEnum'
import { startUIOHook } from '../utils/uIOhookUtil'

startUIOHook()

const isMac = SystemTypeEnum.isMac()
const DEFAULT_TRANSLATE_CHOICE_DELAY = 600
const MIN_TRANSLATE_CHOICE_DELAY = 100
const MAX_TRANSLATE_CHOICE_DELAY = 1000

/**
 * 全局快捷键
 */
class GlobalShortcutClass {
  /**
   * 快捷键
   */
  key: string

  /**
   * 快捷键触发回调
   */
  callback: () => void

  constructor(key: string, callback: () => void) {
    this.key = key
    this.callback = callback
  }
}

class GlobalShortcutEvent {
  /**
   * 主窗口
   */
  static mainWin: BrowserWindow

  /**
   * 是否划词中
   */
  static isChoice = false

  /**
   * 是否正在执行应用内部复制取词
   */
  private static isInternalCopying = false

  /**
   * 剪贴板监听抑制截止时间
   */
  private static clipboardListenerSuppressUntil = 0

  /**
   * 全局快捷键列表
   */
  globalShortcutList: GlobalShortcutClass[]

  constructor() {
    // 窗口注销前执行逻辑
    app.on('will-quit', () => {
      // 注销应用注册的所有快捷键
      globalShortcut.unregisterAll()
    })
    this.globalShortcutList = []
  }

  /**
   * 注册全局快捷方式
   */
  registerAll(): void {
    this.globalShortcutList.forEach((info) => {
      GlobalShortcutEvent.registerBuild(info)
    })
  }

  /**
   * 单个快捷键注册
   *`
   * @param info 全局快捷键
   */
  static registerBuild(info: GlobalShortcutClass): R {
    // 检查快捷方式是否已注册。
    if (globalShortcut.isRegistered(info.key)) {
      log.info(info.key + '快捷键已注册')
      return R.error(info.key + '快捷键已注册')
    }
    // 注册一个快捷并监听
    if (!globalShortcut.register(info.key, info.callback)) {
      log.info(info.key + '快捷键注册失败')
      return R.error(info.key + '快捷键注册失败')
    }
    return R.ok()
  }

  /**
   * 单个快捷键注册
   *
   * @param key 快捷键
   * @param callback 快捷键按下后的回调
   */
  static register(key, callback): R {
    return GlobalShortcutEvent.registerBuild(new GlobalShortcutClass(key, callback))
  }

  /**
   * 单个快捷键注销
   *
   * @param key 快捷键
   */
  static unregister(key): void {
    globalShortcut.unregister(key)
  }

  /**
   * 注销Esc
   */
  static unregisterEsc(): void {
    GlobalShortcutEvent.unregister('Esc')
  }

  /**
   * 翻译窗口快捷键注册
   */
  static translateRegister(type: string, shortcutKey: string): R {
    let res
    if (ShortcutKeyEnum.INPUT === type) {
      res = GlobalShortcutEvent.translateInputRegister(shortcutKey)
    } else if (ShortcutKeyEnum.SCREENSHOT === type) {
      res = GlobalShortcutEvent.translateScreenshotRegister(shortcutKey)
    } else if (ShortcutKeyEnum.CHOICE === type) {
      res = GlobalShortcutEvent.translateChoiceRegister(shortcutKey)
    } else if (ShortcutKeyEnum.SHOW_OCR === type) {
      res = GlobalShortcutEvent.ocrShowRegister(shortcutKey)
    } else if (ShortcutKeyEnum.SCREENSHOT_OCR === type) {
      res = GlobalShortcutEvent.ocrScreenshotRegister(shortcutKey)
    } else if (ShortcutKeyEnum.SCREENSHOT_SILENCE_OCR === type) {
      res = GlobalShortcutEvent.ocrSilenceScreenshotRegister(shortcutKey)
    } else {
      log.error('translateRegister type : ', type, ' is null ')
      res = R.error('快捷键类型不存在')
    }
    return res
  }

  /**
   * 显示翻译窗口快捷键
   */
  static translateInput(): void {
    GlobalWin.mainWinShow()
    if (StoreService.configGet('showTranslateNotEmptyStatus') === YesNoEnum.N) {
      GlobalWin.mainWinSend('clear-all-translated-content')
    }
    GlobalWin.mainWinSend('win-show-input-event')
  }

  /**
   * 截图翻译快捷键
   */
  static translateScreenshot(): void {
    log.info('[截图翻译] - 开始截图')
    GlobalWin.mainWinSend('clear-all-translated-content')
    // 隐藏窗口
    GlobalWin.mainWinHide()
    GlobalWin.ocrWinHide()
    ScreenshotsMain.ocrType = OcrTypeEnum.OCR_TRANSLATE
    new ScreenshotsMain().createScreenshotsWin()
  }

  /**
   * OCR显示快捷键
   */
  static ocrShow(): void {
    GlobalWin.ocrWinShow()
  }

  /**
   * OCR截图快捷键
   */
  static ocrScreenshot(): void {
    log.info('[截图OCR] - 开始截图')
    GlobalWin.mainWinSend('clear-all-translated-content')
    // 隐藏窗口
    GlobalWin.mainWinHide()
    GlobalWin.ocrWinHide()
    ScreenshotsMain.ocrType = OcrTypeEnum.OCR
    new ScreenshotsMain().createScreenshotsWin()
  }

  /**
   * OCR静默截图快捷键
   */
  static ocrSilenceScreenshot(): void {
    log.info('[截图静默OCR] - 开始截图')
    GlobalWin.mainWinSend('clear-all-translated-content')
    // 隐藏窗口
    GlobalWin.mainWinHide()
    GlobalWin.ocrWinHide()
    GlobalWin.ocrSilenceTempImg = ''
    ScreenshotsMain.ocrType = OcrTypeEnum.OCR_SILENCE
    new ScreenshotsMain().createScreenshotsWin()
  }

  /**
   * 划词翻译快捷键
   */
  static translateChoice = async (): Promise<void> => {
    if (GlobalShortcutEvent.isChoice) {
      return
    }
    // 先释放按键
    uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
    uIOhook.keyToggle(UiohookKey.CtrlRight, 'up')
    uIOhook.keyToggle(UiohookKey.Alt, 'up')
    uIOhook.keyToggle(UiohookKey.AltRight, 'up')
    uIOhook.keyToggle(UiohookKey.Shift, 'up')
    uIOhook.keyToggle(UiohookKey.ShiftRight, 'up')
    uIOhook.keyToggle(UiohookKey.Space, 'up')
    uIOhook.keyToggle(UiohookKey.Meta, 'up')
    uIOhook.keyToggle(UiohookKey.MetaRight, 'up')
    uIOhook.keyToggle(UiohookKey.Tab, 'up')
    uIOhook.keyToggle(UiohookKey.Escape, 'up')
    try {
      GlobalShortcutEvent.isChoice = true
      let selectedText = await GlobalShortcutEvent.getSelectedText()
      if (GlobalShortcutEvent.isBlankText(selectedText)) {
        log.info('[划词翻译] - 本次复制选区为空，已跳过翻译')
        return
      }
      selectedText = GlobalShortcutEvent.splitSingleCamelCase(selectedText)
      selectedText = GlobalShortcutEvent.splitSingleUnderScore(selectedText)
      if (GlobalShortcutEvent.isBlankText(selectedText)) {
        log.info('[划词翻译] - 本次复制选区处理后为空，已跳过翻译')
        return
      }
      // 推送给Vue页面进行更新翻译输入内容
      GlobalWin.mainWinUpdateTranslatedContent(selectedText)
      GlobalWin.mainWinShow()
    } catch (error) {
      log.error('[划词翻译] - 获取选中文本失败 : ', error)
    } finally {
      GlobalShortcutEvent.isChoice = false
    }
  }

  /**
   * 单个词时拆分驼峰命名
   *
   * @param str 拆分的字符
   * @return 处理后的字符
   */
  static splitSingleCamelCase = (str): string => {
    if (/^[A-Za-z][A-Za-z]*$/.test(str)) {
      return str.replace(/([a-z])([A-Z])/g, '$1 $2')
    } else {
      return str
    }
  }

  /**
   * 单个词时拆分下划线命名
   *
   * @param str 拆分的字符
   * @return 处理后的字符
   */
  static splitSingleUnderScore = (str): string => {
    if (/^[a-z0-9_]+$/i.test(str)) {
      return str.replace(/_/g, ' ')
    } else {
      return str
    }
  }

  static isClipboardListenerSuppressed = (): boolean => {
    return (
      GlobalShortcutEvent.isInternalCopying ||
      Date.now() < GlobalShortcutEvent.clipboardListenerSuppressUntil
    )
  }

  private static startInternalCopy = (suppressMilliseconds: number): void => {
    GlobalShortcutEvent.isInternalCopying = true
    GlobalShortcutEvent.clipboardListenerSuppressUntil = Date.now() + suppressMilliseconds
  }

  private static stopInternalCopy = (): void => {
    GlobalShortcutEvent.isInternalCopying = false
    GlobalShortcutEvent.clipboardListenerSuppressUntil = Date.now() + 500
  }

  private static releaseCopyKey = (): void => {
    try {
      robot.keyToggle('c', 'up', isMac ? 'command' : 'control')
    } catch (error) {
      log.error('[划词翻译] - 释放复制按键失败 : ', error)
    }
  }

  static isBlankText = (text): boolean => {
    return text === undefined || text === null || String(text).trim() === ''
  }

  private static getTranslateChoiceDelay = (): number => {
    const delayConfig = Number(StoreService.configGet('translateChoiceDelay'))
    const delay = Number.isFinite(delayConfig) ? delayConfig : DEFAULT_TRANSLATE_CHOICE_DELAY
    return Math.floor(
      Math.min(Math.max(delay, MIN_TRANSLATE_CHOICE_DELAY), MAX_TRANSLATE_CHOICE_DELAY) / 2
    )
  }

  static getSelectedText = async (): Promise<string> => {
    const translateChoiceDelay = GlobalShortcutEvent.getTranslateChoiceDelay()
    GlobalWin.mainWinSend('clear-all-translated-content')
    let currentClipboardContent = ''
    let hasClipboardSnapshot = false
    let selectedText = ''
    GlobalShortcutEvent.startInternalCopy(translateChoiceDelay * 4 + 1000)
    try {
      currentClipboardContent = clipboard.readText()
      hasClipboardSnapshot = true
      log.info('[划词翻译] - 读取剪贴板旧文本快照 : ', currentClipboardContent)
      clipboard.clear()
      await new Promise((resolve) => setTimeout(resolve, translateChoiceDelay))
      log.info('[划词翻译] - 执行复制选区操作')
      robot.keyToggle('c', 'down', isMac ? 'command' : 'control')
      await new Promise((resolve) => setTimeout(resolve, translateChoiceDelay))
      robot.keyToggle('c', 'up', isMac ? 'command' : 'control')
      selectedText = clipboard.readText()
      log.info('[划词翻译] - 读取本次复制选区内容 : ', selectedText)
    } finally {
      GlobalShortcutEvent.releaseCopyKey()
      if (hasClipboardSnapshot) {
        clipboard.writeText(currentClipboardContent)
      }
      GlobalShortcutEvent.stopInternalCopy()
    }
    return GlobalShortcutEvent.isBlankText(selectedText) ? '' : selectedText
  }

  /**
   * 显示翻译窗口快捷键 - 注册
   */
  static translateInputRegister(shortcutKey: string): R {
    return GlobalShortcutEvent.register(shortcutKey, () => GlobalShortcutEvent.translateInput())
  }

  /**
   * 截屏翻译快捷键 - 注册
   */
  static translateScreenshotRegister(shortcutKey: string): R {
    return GlobalShortcutEvent.register(shortcutKey, () =>
      GlobalShortcutEvent.translateScreenshot()
    )
  }

  /**
   * 划词翻译快捷键 - 注册
   */
  static translateChoiceRegister(shortcutKey: string): R {
    return GlobalShortcutEvent.register(shortcutKey, async () =>
      GlobalShortcutEvent.translateChoice()
    )
  }

  /**
   * OCR窗口显示快捷键 - 注册
   */
  static ocrShowRegister(shortcutKey: string): R {
    return GlobalShortcutEvent.register(shortcutKey, () => GlobalShortcutEvent.ocrShow())
  }

  /**
   * OCR截图快捷键 - 注册
   */
  static ocrScreenshotRegister(shortcutKey: string): R {
    return GlobalShortcutEvent.register(shortcutKey, () => GlobalShortcutEvent.ocrScreenshot())
  }

  /**
   * 静默OCR截图快捷键 - 注册
   */
  static ocrSilenceScreenshotRegister(shortcutKey: string): R {
    return GlobalShortcutEvent.register(shortcutKey, () =>
      GlobalShortcutEvent.ocrSilenceScreenshot()
    )
  }
}

export { GlobalShortcutEvent }
