import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import * as fse from 'fs-extra'
import { is } from '@electron-toolkit/utils'
import { GlobalShortcutEvent } from './GlobalShortcutEvent'
import R from '../../common/class/R'
import log from '../utils/log'
import { isNotNull, isNull } from '../../common/utils/validate'
import GlobalWin from './GlobalWin'
import { SystemTypeEnum } from '../enums/SystemTypeEnum'
import { StoreTypeEnum } from '../../common/enums/StoreTypeEnum'
import StoreService from './StoreService'
import { StoreConfigFunTypeEnum } from '../../common/enums/StoreConfigFunTypeEnum'
import BrowserWindowConstructorOptions = Electron.BrowserWindowConstructorOptions
import { ecDictDbClose } from './channel/interfaces/EcDictRequest'

let nullWin: BrowserWindow

let setWin: BrowserWindow
let isSetWinReady = false

function showSetWindow(): void {
  log.debug('[设置窗口] 尝试显示窗口')
  if (isNull(setWin) || setWin.isDestroyed()) {
    log.warn('[设置窗口] 窗口为空或已销毁, 无法显示')
    return
  }
  if (setWin.isMinimized()) {
    log.debug('[设置窗口] 窗口已最小化, 正在恢复')
    setWin.restore()
  }
  log.debug('[设置窗口] 执行 show(), moveTop(), focus()')
  log.debug('[设置窗口] 窗口状态: isVisible=', setWin.isVisible(), ', isMinimized=', setWin.isMinimized(), ', isFocused=', setWin.isFocused())
  log.debug('[设置窗口] 窗口位置: ', JSON.stringify(setWin.getBounds()))
  setWin.show()
  setWin.moveTop()
  setWin.focus()
  log.debug('[设置窗口] 窗口显示完成, isVisible=', setWin.isVisible(), ', isFocused=', setWin.isFocused())
}

function createSetWindow(): void {
  log.debug('[设置窗口] 开始创建窗口')
  if (isNotNull(setWin) && !setWin.isDestroyed()) {
    log.debug('[设置窗口] 窗口已存在, isSetWinReady: ', isSetWinReady)
    if (isSetWinReady) {
      showSetWindow()
    } else {
      setWin.once('ready-to-show', () => {
        log.debug('[设置窗口] ready-to-show 事件触发')
        isSetWinReady = true
        showSetWindow()
      })
    }
    return
  }

  // 是否Mac系统
  const isMac = SystemTypeEnum.isMac()

  let setWinConfig: BrowserWindowConstructorOptions = {
    width: 850,
    height: 600,
    // Windows 下透明窗口偶发只显示空白/不可见，设置页改为非透明窗口渲染更稳定
    hasShadow: isMac,
    // 设置窗口透明
    transparent: isMac,
    // 设置窗口背景色
    backgroundColor: isMac ? '#0000' : '#F7F7F7',
    // 去除窗口边框
    frame: false,
    // 可调整大小
    resizable: false,
    // 默认不显示，等页面就绪后统一显示
    show: false,
    // 首次创建时居中显示，避免 Windows 打包版窗口不可见
    center: true,
    title: 'TTime设置',
    // 设置任务栏图标
    icon: path.join(__dirname, '../../public/icon-1024x1024.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/set.js'),
      sandbox: false
    }
  }

  // 是否Mac环境
  if (isMac) {
    // Mac环境下加载配置 此处为了兼容显示窗口红绿灯
    // 部分Win系统中加入配置可能存在不兼容问题 导致窗口显示时会出现黑阴影
    setWinConfig = {
      ...setWinConfig,
      // Mac 环境下设置窗口中的关闭按钮使用 Mac 原生的红绿灯
      titleBarStyle: SystemTypeEnum.isMac() ? 'hidden' : 'default',
      // 自定义macOS上的红绿灯位置
      trafficLightPosition: { x: 20, y: 10 }
    }
  }

  setWin = new BrowserWindow(setWinConfig)
  log.debug('[设置窗口] BrowserWindow 创建完成, ID: ', setWin.id)
  // 禁用按下F11全屏事件
  setWin.setFullScreenable(false)
  GlobalWin.setSetWin(setWin)

  /**
   * 窗口显示时触发事件
   */
  setWin.on('show', () => {
    setWin.webContents.send('win-show-event')
  })

  setWin.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      log.error(
        '[设置窗口] 页面加载失败 errorCode=',
        errorCode,
        ' errorDescription=',
        errorDescription,
        ' validatedURL=',
        validatedURL,
        ' isMainFrame=',
        isMainFrame
      )
    }
  )

  setWin.webContents.on('render-process-gone', (_event, details) => {
    log.error('[设置窗口] 渲染进程退出 details=', JSON.stringify(details))
  })

  setWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level < 2 && !message.includes('[Vue warn]') && !message.includes('[设置窗口异常]')) {
      return
    }
    log.error(
      '[设置窗口] 控制台消息 level=',
      level,
      ' message=',
      message,
      ' line=',
      line,
      ' sourceId=',
      sourceId
    )
  })

  // 所有平台都在窗口加载完毕后统一显示，避免 Windows 打包版只出任务栏图标不出窗口
  setWin.on('ready-to-show', () => {
    log.debug('[设置窗口] ready-to-show 事件触发 (主监听器)')
    isSetWinReady = true
    showSetWindow()
  })

  setWin.webContents.on('did-finish-load', () => {
    log.debug('[设置窗口] did-finish-load 事件触发')
    setTimeout(() => {
      if (isNull(setWin) || setWin.isDestroyed()) {
        return
      }
      setWin.webContents
        .executeJavaScript(`(() => {
          const app = document.getElementById('app')
          return {
            title: document.title,
            readyState: document.readyState,
            bodyClassName: document.body ? document.body.className : '',
            htmlClassName: document.documentElement ? document.documentElement.className : '',
            appExists: !!app,
            appChildElementCount: app ? app.childElementCount : -1,
            appInnerHtmlLength: app && app.innerHTML ? app.innerHTML.length : 0,
            bodyInnerTextLength: document.body && document.body.innerText ? document.body.innerText.length : 0,
            bodyInnerTextPreview: document.body && document.body.innerText ? document.body.innerText.slice(0, 200) : ''
          }
        })()`)
        .then((domInfo) => {
          log.debug('[设置窗口] DOM自检信息: ', JSON.stringify(domInfo))
          if (!domInfo.appExists || domInfo.appChildElementCount > 0) {
            return
          }
          setWin.webContents
            .executeJavaScript(`(async () => {
              const moduleScript = document.querySelector('script[type="module"][src]')
              if (!moduleScript || !moduleScript.src) {
                return {
                  ok: false,
                  reason: 'module-script-not-found'
                }
              }
              try {
                await import(moduleScript.src)
                const app = document.getElementById('app')
                return {
                  ok: true,
                  moduleSrc: moduleScript.src,
                  appChildElementCount: app ? app.childElementCount : -1,
                  appInnerHtmlLength: app && app.innerHTML ? app.innerHTML.length : 0,
                  bodyInnerTextLength: document.body && document.body.innerText ? document.body.innerText.length : 0
                }
              } catch (error) {
                return {
                  ok: false,
                  moduleSrc: moduleScript.src,
                  message: error && error.message ? error.message : String(error),
                  stack: error && error.stack ? error.stack : ''
                }
              }
            })()`)
            .then((retryInfo) => {
              log.debug('[设置窗口] 入口脚本重试结果: ', JSON.stringify(retryInfo))
            })
            .catch((err) => {
              log.error('[设置窗口] 入口脚本重试异常: ', err)
            })
        })
        .catch((err) => {
          log.error('[设置窗口] DOM自检异常: ', err)
        })
    }, 500)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    setWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/set.html`)
  } else {
    const htmlPath = path.join(__dirname, '../renderer/set.html')
    log.debug('[设置窗口] 生产模式, 加载文件: ', htmlPath)
    setWin.loadFile(htmlPath)
  }

  // 当 window 被关闭，这个事件会被触发。
  setWin.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持    多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    isSetWinReady = false
    setWin = nullWin
    GlobalWin.setSetWin(null)
  })

  // 设置窗口获取焦点事件
  setWin.on('focus', () => {
    GlobalWin.setWin.webContents.send('set-win-focus-event')
  })
}

/**
 * 更新翻译快捷键事件
 */
ipcMain.on('update-translate-shortcutKey-event', (event, type, oldShortcutKey, shortcutKey) => {
  // 如果原快捷键不为空 但新快捷键为空则直接注销之前的快捷键
  if (isNotNull(oldShortcutKey) && isNull(shortcutKey)) {
    log.info(' 更新翻译快捷键事件 translateInput 移除 [', oldShortcutKey, '] 快捷键')
    GlobalShortcutEvent.unregister(oldShortcutKey)
    event.returnValue = R.ok()
    return
  }
  // 翻译快捷键根据类型注册
  const response = GlobalShortcutEvent.translateRegister(type, shortcutKey)
  log.info(' 更新翻译快捷键事件 translateInput response = ', response)
  // 如果 旧翻译快捷键 存在 并且 新的翻译快捷键 已注册完毕则移除旧的翻译快捷键
  if (isNotNull(oldShortcutKey) && response.code === 1) {
    log.info(' 更新翻译快捷键事件 translateInput 移除 [', oldShortcutKey, '] 快捷键')
    GlobalShortcutEvent.unregister(oldShortcutKey)
  }
  event.returnValue = response
})

/**
 * 关闭设置窗口事件
 */
ipcMain.handle('close-set-win-event', (_event, _args) => {
  if (isNotNull(setWin) && !setWin.isDestroyed()) {
    setWin.close()
  }
})

/**
 * 更新翻译源通知
 *
 * @param channel 翻译类型
 * @param info    翻译信息
 */
ipcMain.handle('update-translate-service-notify', (_event, _args) => {
  GlobalWin.mainWinSend('update-translate-service-event')
})

/**
 * 更新置顶时允许隐藏窗口选择事件通知
 */
ipcMain.handle('always-onTop-allow-esc-status-notify', (_event, _args) => {
  GlobalWin.mainOrOcrWinShowCallback()
})

/**
 * 窗口字体大小更新通知
 */
ipcMain.handle('win-font-size-notify', (_event, _args) => {
  GlobalWin.mainWinSend('win-font-size-notify')
})

/**
 * 更新配置信息路径
 */
ipcMain.on('update-config-info-path', (event, storeConfigFunType, storeType, directoryPath) => {
  directoryPath = path.join(directoryPath, StoreService.userDataConfigFolderName)
  let oldFilePath, oldPath
  if (storeType === StoreTypeEnum.CONFIG) {
    oldFilePath = StoreService.configStore.path
    oldPath = StoreService.systemGet(StoreService.configPathKey)
  } else if (storeType === StoreTypeEnum.HISTORY_RECORD) {
    oldFilePath = StoreService.historyRecordStore.path
    oldPath = StoreService.systemGet(StoreService.historyRecordPathKey)
  } else if (storeType === StoreTypeEnum.PLUGINS) {
    oldFilePath = StoreService.systemGet(StoreService.userPluginsPathKey)
    oldPath = oldFilePath
    directoryPath = path.join(directoryPath, StoreService.userPluginsName)
    ecDictDbClose()
  }
  const fileName = oldFilePath.replaceAll(oldPath, '')
  const newFilePath = path.join(directoryPath, fileName)
  if (oldFilePath === newFilePath) {
    event.returnValue = R.error('文件路径未修改')
    return
  }

  if (StoreConfigFunTypeEnum.MOVE === storeConfigFunType) {
    fse
      .move(oldFilePath, newFilePath)
      .then(() => {
        updateStoreConfig(storeType, directoryPath)
        event.returnValue = R.okD(directoryPath)
      })
      .catch((err) => {
        log.error('移动文件异常 : ', err)
        // 当修改翻译记录的路径时 如果新安装还未翻译过将会导致没有生成翻译记录文件
        // 这里校验一下 如果没有的话则进行迁移
        if (err.message.indexOf('no such file or directory') != -1) {
          updateStoreConfig(storeType, directoryPath)
          event.returnValue = R.okD(directoryPath)
          return
        } else if (err.message.indexOf('dest already exists') != -1) {
          event.returnValue = R.error('移动失败，移动的路径下已经存在配置')
          return
        }
        event.returnValue = R.error('修改失败，未知错误，如重复出现请联系作者')
      })
  } else if (StoreConfigFunTypeEnum.SWITCH === storeConfigFunType) {
    updateStoreConfig(storeType, directoryPath)
    event.returnValue = R.okD(directoryPath)
  }
})

const updateStoreConfig = (storeType, directoryPath): void => {
  if (storeType === StoreTypeEnum.CONFIG) {
    StoreService.systemSet(StoreService.configPathKey, directoryPath)
  } else if (storeType === StoreTypeEnum.HISTORY_RECORD) {
    StoreService.systemSet(StoreService.historyRecordPathKey, directoryPath)
  } else if (storeType === StoreTypeEnum.PLUGINS) {
    StoreService.systemSet(StoreService.userPluginsPathKey, directoryPath)
  }
  StoreService.init()
}

export default createSetWindow
