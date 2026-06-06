import { uIOhook, UiohookKey, UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi'
import log from './../utils/log'
import { GlobalShortcutEvent } from './GlobalShortcutEvent'
import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { SystemTypeEnum } from '../enums/SystemTypeEnum'
import path from 'path'
import { is } from '../utils/electronRuntime'
import GlobalWin from './GlobalWin'
import { YesNoEnum } from '../../common/enums/YesNoEnum'
import { spawn } from 'child_process'
import StoreService from './StoreService'
import { startUIOHook } from '../utils/uIOhookUtil'

if (!SystemTypeEnum.isMac()) {
  const HOVER_BALL_AUTO_HIDE_MS = 3000
  const SELECT_STATUS_RECHECK_DELAY_MS = 100
  const SELECT_STATUS_TIMEOUT_MS = 600
  const DRAG_TRIGGER_DISTANCE = 4
  const DOUBLE_CLICK_MAX_MOVE = 5
  const HOVER_BALL_HIDE_DISTANCE = 30

// 窗口加载完毕后执行
  app.whenReady().then(() => {
    // 预加载悬浮球窗口
    createHoverBallWin()
    // 隐藏窗口
    hoverBallWinHide()
  })

  const createHoverBallWin = (): void => {
    const hoverBallWin = new BrowserWindow({
      width: 30,
      height: 30,
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
      resizable: false,
      // 自动隐藏菜单栏
      autoHideMenuBar: true,
      focusable: false,
      type: SystemTypeEnum.isMac() ? 'panel' : 'toolbar',
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/hoverBall.js'),
        contextIsolation: true,
        sandbox: false
      }
    })
    // 禁用按下F11全屏事件
    hoverBallWin.setFullScreenable(false)

    // 打开开发者工具
    // hoverBallWin.webContents.openDevTools({ mode: 'detach' })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      hoverBallWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/hoverBall.html`)
    } else {
      hoverBallWin.loadFile(path.join(__dirname, '../renderer/hoverBall.html'))
    }

    GlobalWin.setHoverBallWin(hoverBallWin)
  }

  startUIOHook()

  let mousedownInfo: UiohookMouseEvent | null = null

  let selectTextStatus = false

  let mouseSelectCheckSequence = 0

  /**
   * 鼠标单击按下事件
   */
  uIOhook.on('mousedown', async (e: UiohookMouseEvent) => {
    // 鼠标左键单机
    if (e.button !== 1) {
      return
    }
    if (!isHoverBallEnabled()) {
      resetMouseSelectStatus()
      return
    }
    const currentSequence = ++mouseSelectCheckSequence
    mousedownInfo = e
    selectTextStatus = await isMouseSelectTextStatus()
    if (currentSequence !== mouseSelectCheckSequence) {
      return
    }
    setTimeout(async () => {
      // 定时任务再检测一遍，防止有时执行过快，获取到的状态不对
      // 例如划词百度或Google搜索结果的标题或链接地址时会出现
      const recheckStatus = await isMouseSelectTextStatus()
      if (currentSequence === mouseSelectCheckSequence) {
        selectTextStatus = recheckStatus
      }
    }, SELECT_STATUS_RECHECK_DELAY_MS)
  })

  /**
   * 鼠标单击放开事件
   */
  uIOhook.on('mouseup', async (e: UiohookMouseEvent) => {
    if (e.button !== 1) {
      return
    }
    if (!isHoverBallEnabled() || !mousedownInfo) {
      resetMouseSelectStatus()
      return
    }
    const currentSequence = mouseSelectCheckSequence
    let currentSelectTextStatus = selectTextStatus
    if (!currentSelectTextStatus) {
      currentSelectTextStatus = await isMouseSelectTextStatus()
      if (currentSequence === mouseSelectCheckSequence) {
        selectTextStatus = currentSelectTextStatus
      }
    }
    if (currentSequence !== mouseSelectCheckSequence) {
      return
    }
    if (currentSelectTextStatus && isMouseMovedBeyond(mousedownInfo, e, DRAG_TRIGGER_DISTANCE)) {
      hoverBallWinShow()
    }
    resetMouseSelectStatus()
  })

  let oneClick: UiohookMouseEvent | null = null
  let oneClickIsMouseSelectTextStatus = false
  let oneClickMouseSelectTextStatusTask: Promise<boolean> | null = null

  uIOhook.on('click', async (e: UiohookMouseEvent) => {
    if (e.button === 1 && !isHoverBallEnabled()) {
      resetOneClickStatus()
    } else if (e.clicks === 1 && e.button === 1) {
      oneClick = e
      oneClickIsMouseSelectTextStatus = false
      oneClickMouseSelectTextStatusTask = isMouseSelectTextStatus()
      oneClickMouseSelectTextStatusTask.then((status) => {
        if (oneClick === e) {
          oneClickIsMouseSelectTextStatus = status
        }
      })
    } else if (e.clicks === 2 && e.button === 1) {
      // 部分应用/页面当鼠标双击事件时
      // 鼠标第一击光标状态会变成文字选中模式
      // 鼠标第二击时光标会变回正常模式
      // 这种也属于正常状态 最终也可以选中内容
      // 所以在第一击时就需要先存储鼠标模式状态 在第二击时进行判断
      const oneClickSelectTextStatus = oneClickMouseSelectTextStatusTask
        ? await oneClickMouseSelectTextStatusTask
        : oneClickIsMouseSelectTextStatus
      if (!oneClick || !oneClickSelectTextStatus) {
        return
      }
      // 计算第一击和第二击时的X轴和Y轴的位移量 判断鼠标是否移动
      if (isMouseMovedBeyond(oneClick, e, DOUBLE_CLICK_MAX_MOVE)) {
        return
      }
      // log.info(e, '触发了双击')
      // log.info('触发了双击')
      hoverBallWinShow()
      return
    }
    if (GlobalWin.isHoverBall) {
      const position = GlobalWin.hoverBallWin.getPosition()
      const winX = position[0]
      const winY = position[1]
      const { x, y } = screen.getCursorScreenPoint()
      const statusX = winX - x
      const statusY = winY - y
      if (
        statusX > HOVER_BALL_HIDE_DISTANCE ||
        statusY > HOVER_BALL_HIDE_DISTANCE ||
        statusX < -HOVER_BALL_HIDE_DISTANCE ||
        statusY < -HOVER_BALL_HIDE_DISTANCE
      ) {
        // log.info('触发了单击隐藏窗口')
        // 隐藏窗口
        hoverBallWinHide()
      }
    }
  })

  /**
   * 滚动鼠标时关闭悬浮球
   */
  uIOhook.on('wheel', (_e: UiohookWheelEvent) => {
    if (GlobalWin.isHoverBall) {
      // log.info('触发了滚动隐藏窗口')
      hoverBallWinHide()
    }
  })

  /**
   * 悬浮球取词
   */
  let isHoverBallTranslating = false

  ipcMain.handle('hover-ball-events', async (_event, _) => {
    if (GlobalShortcutEvent.isChoice || isHoverBallTranslating) {
      return
    }
    log.info('[悬浮球取词] - 开始')
    hoverBallWinHide()
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
      isHoverBallTranslating = true
      GlobalShortcutEvent.isChoice = true
      let selectedText = await GlobalShortcutEvent.getSelectedText()
      if (GlobalShortcutEvent.isBlankText(selectedText)) {
        log.debug('[悬浮球取词] - 本次复制选区为空，已跳过翻译')
        return
      }
      selectedText = GlobalShortcutEvent.splitSingleCamelCase(selectedText)
      selectedText = GlobalShortcutEvent.splitSingleUnderScore(selectedText)
      if (GlobalShortcutEvent.isBlankText(selectedText)) {
        log.debug('[悬浮球取词] - 本次复制选区处理后为空，已跳过翻译')
        return
      }
      // 推送给Vue页面进行更新翻译输入内容
      GlobalWin.mainWinUpdateTranslatedContent(selectedText)
      GlobalWin.mainWinShow()
    } catch (error) {
      log.error('[悬浮球取词] - 获取选中文本失败 : ', error)
    } finally {
      GlobalShortcutEvent.isChoice = false
      isHoverBallTranslating = false
    }
  })

  let hoverBallWinHideTask: ReturnType<typeof setTimeout> | null = null

  /**
   * 悬浮球窗口显示
   */
  const hoverBallWinShow = (): void => {
    if (hoverBallWinHideTask !== null) {
      clearTimeout(hoverBallWinHideTask)
    }
    GlobalWin.hoverBallWinShow()
    // 3秒后自动关闭悬浮球
    hoverBallWinHideTask = setTimeout(() => {
      hoverBallWinHide()
    }, HOVER_BALL_AUTO_HIDE_MS)
  }

  /**
   * 悬浮球窗口隐藏
   */
  const hoverBallWinHide = (): void => {
    if (hoverBallWinHideTask !== null) {
      clearTimeout(hoverBallWinHideTask)
      hoverBallWinHideTask = null
    }
    GlobalWin.hoverBallWinHide()
  }

  /**
   * 鼠标指针是否选中文本状态
   */
  const isMouseSelectTextStatus = async (): Promise<boolean> => {
    if (!isHoverBallEnabled()) {
      return false
    }
    let response = false
    const hoverBallEnhanceStatus = StoreService.configGet('hoverBallEnhanceStatus')
    // 悬浮球增强模式
    response = YesNoEnum.Y === hoverBallEnhanceStatus
    if (!SystemTypeEnum.isWin() || !response) {
      // 如果不为Win环境下这块默认不进行获取状态 直接返回取词
      return true
    }
    return new Promise<boolean>((resolve) => {
      let mouseSelectTextStatusPath
      if (app.isPackaged) {
        mouseSelectTextStatusPath = path.join(
          __dirname,
          '../../../app.asar.unpacked/plugins/mouse-select-text-status.exe'
        )
      } else {
        mouseSelectTextStatusPath = path.join(__dirname, '../../plugins/mouse-select-text-status.exe')
      }
      const selectStatusSpawn = spawn(mouseSelectTextStatusPath)
      let output = ''
      let errorOutput = ''
      let isSettled = false
      const done = (status: boolean, error?: unknown): void => {
        if (isSettled) {
          return
        }
        isSettled = true
        clearTimeout(timeoutTask)
        if (error) {
          log.error('获取鼠标指针是否选中文本状态异常 = ', error)
        }
        resolve(status)
      }
      const timeoutTask = setTimeout(() => {
        selectStatusSpawn.kill()
        done(false, `mouse-select-text-status.exe timeout after ${SELECT_STATUS_TIMEOUT_MS}ms`)
      }, SELECT_STATUS_TIMEOUT_MS)
      // 执行成功回调
      selectStatusSpawn.stdout.on('data', (data) => {
        output += data.toString()
      })
      // 执行失败回调
      selectStatusSpawn.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })
      selectStatusSpawn.on('error', (error) => {
        done(false, error)
      })
      selectStatusSpawn.on('close', (code) => {
        if (code === 0 && output !== '') {
          done(output.trim() === '1')
        } else {
          done(false, errorOutput || `mouse-select-text-status.exe exited with code ${code}`)
        }
      })
    })
  }

  const isHoverBallEnabled = (): boolean => {
    const hoverBallStatus = StoreService.configGet('hoverBallStatus')
    return YesNoEnum.Y === hoverBallStatus
  }

  const isMouseMovedBeyond = (
    start: UiohookMouseEvent,
    end: UiohookMouseEvent,
    distance: number
  ): boolean => {
    return Math.abs(start.x - end.x) > distance || Math.abs(start.y - end.y) > distance
  }

  const resetMouseSelectStatus = (): void => {
    mouseSelectCheckSequence++
    mousedownInfo = null
    selectTextStatus = false
  }

  const resetOneClickStatus = (): void => {
    oneClick = null
    oneClickIsMouseSelectTextStatus = false
    oneClickMouseSelectTextStatusTask = null
  }
}
