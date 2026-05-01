import { isNotNull, isNull } from '../../common/utils/validate'
import log from './log'
import createHttpsProxyAgent from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import StoreService from '../service/StoreService'
import R from '../../common/class/R'

const AGENT_TYPE_NONE = 0
const AGENT_TYPE_HTTP = 1
const AGENT_TYPE_SOCKS5 = 2
const AGENT_TYPE_LIST = [AGENT_TYPE_NONE, AGENT_TYPE_HTTP, AGENT_TYPE_SOCKS5]
const proxyAuthSessionSet = new WeakSet()
let currentWinAgentConfig = null

/**
 * 公共错误处理
 *
 * @param title 标题
 * @param err 错误信息
 * @return 错误响应内容
 */
export const commonError = (title, err): string => {
  const errCode = err?.code
  const errMessage = getErrorMessage(err)
  const response = isNull(err?.response) ? {} : err.response
  const errResponseStatus = response.status
  const errResponseStatusText = response.statusText
  const errResponseData = response.data
  log.error('[' + title + '事件] - 异常响应报文 : ', {
    errCode: errCode,
    errMessage: errMessage,
    errResponseStatus: errResponseStatus,
    errResponseStatusText: errResponseStatusText,
    errResponseData: stringifyErrorData(errResponseData)
  })
  let msg = ''
  if (errCode === 'ECONNREFUSED') {
    msg = '连接被拒绝，请检查配置的代理是否正确'
  } else if (
    errCode === 'ECONNRESET' &&
    errMessage.indexOf(
      'Client network socket disconnected before secure TLS connection was established'
    ) !== -1
  ) {
    msg = '代理连接中断，请检查配置的代理是否可用'
  } else if (errCode === 'ECONNRESET' && errMessage.indexOf('read ECONNRESET') !== -1) {
    msg = '代理连接读取中断，请检查配置的代理是否可用'
  } else if (errMessage.indexOf('timeout of 15000ms exceeded') !== -1) {
    msg = '连接超过15秒无响应，请检查配置的代理是否可用'
  } else if (errMessage.indexOf('getaddrinfo ENOTFOUND') !== -1) {
    msg = '找不到连接地址，请检查配置的代理是否正确'
  } else {
    msg = isNull(errResponseData) ? errMessage : stringifyErrorData(errResponseData)
  }
  return msg
}

/**
 * 注入代理
 *
 * @param requestInfo 请求信息
 */
export const injectAgent = async (requestInfo): Promise<void> => {
  await injectAgentBySetAgentFieldName(requestInfo, 'httpsAgent')
}

/**
 * 注入代理
 *
 * @param requestInfo     请求信息
 * @param agentFieldName  根据字段名称设置代理信息
 */
export const injectAgentBySetAgentFieldName = async (
  requestInfo,
  agentFieldName
): Promise<void> => {
  const agentConfig = normalizeAgentConfig(StoreService.configGet('agentConfig'))
  if (!isProxyEnabled(agentConfig)) {
    return
  }
  if (agentConfig.type === AGENT_TYPE_HTTP) {
    requestInfo[agentFieldName] = createHttpsProxyAgent(getAgentUrl(agentConfig))
    return
  }
  if (agentConfig.type === AGENT_TYPE_SOCKS5) {
    requestInfo[agentFieldName] = new SocksProxyAgent(getAgentUrl(agentConfig))
  }
}

/**
 * 注入窗口代理
 *
 * @param agentConfig 代理配置
 * @param session 窗口会话信息
 */
export const injectWinAgent = async (agentConfig, session): Promise<R> => {
  const normalizedAgentConfig = normalizeAgentConfig(agentConfig)
  currentWinAgentConfig = normalizedAgentConfig
  registerProxyLoginEvent(session)
  try {
    if (isProxyEnabled(normalizedAgentConfig)) {
      log.info('[窗口代理] - 开始设置')
      const agentUrl = getAgentUrl(normalizedAgentConfig)
      await session.setProxy({
        proxyRules: agentUrl
      })
      log.info('[窗口代理] - 结束设置')
    } else {
      // 移除 proxyRules 配置的代理信息并使用系统默认代理
      await session.setProxy({
        mode: 'system'
      })
    }
    await session.closeAllConnections()
    return R.ok()
  } catch (error) {
    log.error('[窗口代理] - 设置失败 : ', error)
    return R.error(getErrorMessage(error) || '代理设置失败')
  }
}

/**
 * 注入Url代理
 *
 * @param agentConfig 代理配置
 * @param requestInfo     请求信息
 * @param agentFieldName  根据字段名称设置代理信息
 */
export const injectUrlAgent = (agentConfig, requestInfo, agentFieldName): void => {
  const normalizedAgentConfig = normalizeAgentConfig(agentConfig)
  if (isProxyEnabled(normalizedAgentConfig)) {
    requestInfo[agentFieldName] = getAgentUrl(normalizedAgentConfig)
  }
}
/**
 * 注入窗口代理
 *
 * @param agentConfig 代理配置
 */
export const getAgentUrl = (agentConfig): string => {
  const protocol = agentConfig.type === AGENT_TYPE_SOCKS5 ? 'socks5' : 'http'
  return `${protocol}://${getAgentAccount(agentConfig)}${agentConfig.host}:${agentConfig.port}`
}

export const normalizeAgentConfig = (agentConfig): any => {
  const type = Number(agentConfig?.type)
  return {
    type: AGENT_TYPE_LIST.includes(type) ? type : AGENT_TYPE_NONE,
    checkStatus: agentConfig?.checkStatus === true,
    host: trimAgentConfigValue(agentConfig?.host),
    port: trimAgentConfigValue(agentConfig?.port),
    userName: trimAgentConfigValue(agentConfig?.userName),
    passWord: trimAgentConfigValue(agentConfig?.passWord)
  }
}

export const isProxyEnabled = (agentConfig): boolean => {
  return (
    isNotNull(agentConfig) &&
    isNotNull(agentConfig.host) &&
    isNotNull(agentConfig.port) &&
    agentConfig.type !== AGENT_TYPE_NONE
  )
}

const getAgentAccount = (agentConfig): string => {
  if (isNull(agentConfig.userName) || isNull(agentConfig.passWord)) {
    return ''
  }
  return `${encodeURIComponent(agentConfig.userName)}:${encodeURIComponent(agentConfig.passWord)}@`
}

const trimAgentConfigValue = (value): string => {
  return isNull(value) ? '' : String(value).trim()
}

const getErrorMessage = (err): string => {
  if (isNotNull(err?.message)) {
    return String(err.message)
  }
  if (typeof err === 'string') {
    return err
  }
  return isNull(err) ? '' : stringifyErrorData(err)
}

const stringifyErrorData = (data): string => {
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

const registerProxyLoginEvent = (session): void => {
  if (proxyAuthSessionSet.has(session)) {
    return
  }
  proxyAuthSessionSet.add(session)
  session.on('login', (event, _webContents, _request, authInfo, callback) => {
    const agentConfig = isNull(currentWinAgentConfig)
      ? normalizeAgentConfig(StoreService.configGet('agentConfig'))
      : currentWinAgentConfig
    if (
      authInfo.isProxy &&
      isProxyEnabled(agentConfig) &&
      isNotNull(agentConfig.userName) &&
      isNotNull(agentConfig.passWord)
    ) {
      event.preventDefault()
      callback(agentConfig.userName, agentConfig.passWord)
    }
  })
}
