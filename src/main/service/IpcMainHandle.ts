import { app, dialog, ipcMain, shell } from 'electron'
import axios from 'axios'
import createSetWindow from './Set'
import { SystemTypeEnum } from '../enums/SystemTypeEnum'
import { isNull } from '../../common/utils/validate'
import log from '../utils/log'
import GlobalWin from './GlobalWin'
import { injectAgent, injectWinAgent, normalizeAgentConfig } from '../utils/RequestUtil'
import { StoreConfigFunTypeEnum } from '../../common/enums/StoreConfigFunTypeEnum'
import StoreService from './StoreService'
import { StoreTypeEnum } from '../../common/enums/StoreTypeEnum'
import R from '../../common/class/R'

/**
 * 打开设置页面
 */
ipcMain.handle('open-set-page-event', (_event) => {
  createSetWindow()
})

/**
 * 获取系统类型事件
 */
ipcMain.on('get-system-type-event', (event, _args) => {
  event.returnValue = SystemTypeEnum.getSystemType()
})

/**
 * 跳转页面
 */
ipcMain.on('jump-to-page-event', (_event, url) => {
  if (isNull(url)) {
    return
  }
  try {
    const targetUrl = new URL(url)
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      log.warn('[跳转页面事件] - 不支持的URL协议 : ', targetUrl.protocol)
      return
    }
    shell.openExternal(targetUrl.toString())
  } catch (error: any) {
    log.warn('[跳转页面事件] - URL格式错误 : ', url, error)
  }
})

/**
 * 日志 - info级别
 */
ipcMain.handle('log-info-event', (_event, ...text) => {
  log.info(...text)
})

/**
 * 日志 - error级别
 */
ipcMain.handle('log-error-event', (_event, ...text) => {
  log.error(...text)
})

/**
 * 退出应用
 */
ipcMain.handle('close-app-event', (_event) => {
  GlobalWin.closeApp()
})

// 当前软件版本
const version = app.getVersion()

/**
 * 获取版本事件
 */
ipcMain.on('get-version-event', (event) => {
  event.returnValue = version
})

/**
 * 代理更新事件
 */
ipcMain.handle('agent-update-event', async (_event, agentConfig) => {
  if (isNull(GlobalWin.mainWin)) {
    return R.error('主窗口未初始化，代理设置失败')
  }
  const normalizedAgentConfig = normalizeAgentConfig(agentConfig)
  const res = await injectWinAgent(normalizedAgentConfig, GlobalWin.mainWin.webContents.session)
  if (res.code === R.SUCCESS) {
    StoreService.configSet('agentConfig', normalizedAgentConfig)
  }
  return res
})

/**
 * OpenAI Node侧请求探测
 */
ipcMain.handle('openai-node-request-probe', async (_event, probeInfo) => {
  const requestUrl = probeInfo?.requestUrl
  const requestProtocol = probeInfo?.requestProtocol
  const model = probeInfo?.model
  const data = probeInfo?.data
  const isCheckRequest = probeInfo?.isCheckRequest === true
  const requestConfig: any = {
    url: requestUrl,
    method: 'post',
    timeout: 15000,
    data,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + probeInfo?.appKey
    },
    validateStatus: () => true
  }
  log.info('[OpenAI Node探测事件] - 请求信息 : ', {
    requestUrl,
    requestProtocol,
    method: requestConfig.method,
    model,
    stream: data?.stream,
    isCheckRequest
  })
  try {
    await injectAgent(requestConfig)
    const response = await axios(requestConfig)
    const responseData = stringifyProbeData(response.data)
    log.info('[OpenAI Node探测事件] - 响应信息 : ', {
      requestUrl,
      status: response.status,
      statusText: response.statusText,
      responseData
    })
    return {
      ok: true,
      hasHttpResponse: true,
      status: response.status,
      statusText: response.statusText
    }
  } catch (error: any) {
    const response = error?.response
    const hasHttpResponse = !isNull(response?.status)
    log.error('[OpenAI Node探测事件] - 异常响应报文 : ', {
      requestUrl,
      errCode: error?.code,
      errMessage: getProbeErrorMessage(error),
      status: response?.status,
      statusText: response?.statusText,
      responseData: stringifyProbeData(response?.data)
    })
    return {
      ok: false,
      hasHttpResponse,
      status: response?.status,
      statusText: response?.statusText,
      errCode: error?.code,
      errMessage: getProbeErrorMessage(error)
    }
  }
})

const getProbeErrorMessage = (error: any): string => {
  if (!isNull(error?.message)) {
    return String(error.message)
  }
  return isNull(error) ? '' : stringifyProbeData(error)
}

const stringifyProbeData = (data): string => {
  if (isNull(data)) {
    return ''
  }
  if (typeof data !== 'object') {
    return String(data)
  }
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

/**
 * 打开目录对话框
 */
ipcMain.on('open-directory-dialog', (event, storeConfigFunType, storeType) => {
  if(StoreConfigFunTypeEnum.OPEN === storeConfigFunType && StoreTypeEnum.PLUGINS === storeType) {
    shell.openPath(StoreService.systemGet(StoreService.userPluginsPathKey)).then()
    return
  }
  dialog
    .showOpenDialog({
      properties: ['openDirectory'],
      title: '请选择文件夹',
      buttonLabel: '选择文件夹'
    })
    .then((result) => {
      if (result.canceled) {
        return
      }
      event.sender.send(
        'open-directory-dialog-callback',
        storeConfigFunType,
        storeType,
        result.filePaths[0]
      )
    })
})

