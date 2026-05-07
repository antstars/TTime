import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { GlobalShortcutEvent } from './service/GlobalShortcutEvent'
import { WinEvent } from './service/Win'
import { TrayEvent } from './service/TrayEvent'
import log from './utils/log'
import { SystemTypeEnum } from './enums/SystemTypeEnum'
import GlobalWin from './service/GlobalWin'
import './service/TTimeEvent'
import './service/channel/TranslateChannel'
import './service/HoverBall'
import './service/Ocr'
import './service/OcrSilence'
import './service/ClipboardListenerService'
import './service/IpcMainHandle'
import { injectWinAgent } from './utils/RequestUtil'
import StoreService from './service/StoreService'
import { YesNoEnum } from '../common/enums/YesNoEnum'

// 解决使用 win.hide() 后再使用 win.show() 会引起窗口闪烁问题
app.commandLine.appendSwitch('wm-window-animations-disabled')

if (!SystemTypeEnum.isMac()) {
  // 禁用硬件加速
  app.disableHardwareAcceleration()
}

StoreService.init()
StoreService.initConfig()

const mainWinInfo = {
  width: StoreService.configGet('mainWinWidth'),
  height: 339
}
// 主窗口
let mainWin: BrowserWindow

// 获取单例锁
const gotTheLock = app.requestSingleInstanceLock()
if (gotTheLock) {
  // 当多开时，多个实例执行调用 app.requestSingleInstanceLock() 时
  // 这个事件将在应用程序的首个已经启动的实例中触发
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    if (mainWin) {
      // 显示主窗口
      GlobalShortcutEvent.translateInput()
    }
  })
} else {
  // 如果获取单例锁失败，则表明应用程序已启动了
  // 这里直接执行退出当前重复实例即可
  app.quit()
}

async function createWindow(): Promise<void> {
  log.debug('[主窗口] 开始创建窗口, 配置: ', JSON.stringify(mainWinInfo))
  mainWin = new BrowserWindow({
    width: mainWinInfo.width,
    height: mainWinInfo.height,
    minWidth: 450,
    minHeight: 339,
    // 跳过任务栏显示
    skipTaskbar: true,
    // 关闭阴影效果 否则设置了窗口透明清空下 透明处会显示阴影效果
    hasShadow: false,
    // 设置窗口透明
    transparent: true,
    // 设置窗口透明色
    backgroundColor: '#0000',
    // 去除窗口边框
    frame: false,
    // 可调整大小
    resizable: true,
    // 默认不显示
    show: false,
    // 自动隐藏菜单栏
    autoHideMenuBar: true,
    ...('linux' === process.platform
      ? { icon: path.join(__dirname, '../../public/icon-1024x1024.png') }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      // 关闭检测同源策略
      webSecurity: false
    }
  })
  log.debug('[主窗口] BrowserWindow 创建完成, ID: ', mainWin.id)
  // 禁用按下F11全屏事件
  mainWin.setFullScreenable(false)
  // mainWin.setIgnoreMouseEvents(true, { forward: true })

  const agentRes = await injectWinAgent(
    StoreService.configGet('agentConfig'),
    mainWin.webContents.session
  )
  if (agentRes.code !== 1) {
    log.error('[主窗口] 初始代理设置失败 : ', agentRes.msg)
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    log.debug('[主窗口] 开发模式, 加载URL: ', process.env['ELECTRON_RENDERER_URL'])
    mainWin.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    const htmlPath = path.join(__dirname, '../renderer/index.html')
    log.debug('[主窗口] 生产模式, 加载文件: ', htmlPath)
    mainWin.loadFile(htmlPath)
  }

  // mainWin.webContents.openDevTools({ mode: 'detach' })
  GlobalWin.setMainWin(mainWin)
  // 窗口事件
  new WinEvent(mainWinInfo)
  // 托盘事件
  new TrayEvent()
  // 注册全局快捷方式
  new GlobalShortcutEvent().registerAll()

  /**
   * 主窗口关闭事件
   */
  mainWin.on('close', (event) => {
    if (!GlobalWin.isMainWinClose && !is.dev) {
      // 阻止窗口关闭
      event.preventDefault()
      // 隐藏窗口
      GlobalWin.mainWinHide()
    }
  })

  /**
   * 主窗口显示时触发事件
   */
  mainWin.on('show', () => {
    log.debug('[主窗口] 窗口显示事件触发')
    mainWin.webContents.send('win-show-event')
  })

  /**
   * 主窗口准备显示事件
   */
  mainWin.on('ready-to-show', () => {
    log.debug('[主窗口] ready-to-show 事件触发')
  })

  /**
   * 窗口失去焦点事件
   */
  mainWin.on('blur', () => {
    if (GlobalWin.isMainAlwaysOnTop) {
      return
    }
    // 隐藏窗口
    GlobalWin.mainWinHide()
    if (StoreService.configGet('showTranslateNotEmptyStatus') === YesNoEnum.N) {
      mainWin.webContents.send('clear-all-translated-content')
    }
    mainWin.webContents.send('win-show-input-event')
  })
}

app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.ttime')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().then()
    }
  })

  /**
   * 调整窗口大小时触发
   *
   * @param newBounds 新位置的坐标、宽高信息
   */
  mainWin.on('will-resize', (event, newBounds) => {
    // 禁止手动调整的事件 否则高度也会被改变
    event.preventDefault()
    // 下面自己实现调整的方法
    const width = newBounds.width
    StoreService.configSet('mainWinWidth', width)
    // 更新窗口大小
    WinEvent.updateWinSize(GlobalWin.mainWin, width, GlobalWin.mainWin.getSize()[1])
    GlobalWin.mainWin.webContents.send('win-size-update', newBounds)
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // app.quit()
  }
})

/**
 * 全局异常捕获
 */
process.on('uncaughtException', (err, _origin) => {
  // 收集日志
  log.error('全局异常捕获 err = ', err)
  // 显示异常提示信息或者重新加载应用
})
