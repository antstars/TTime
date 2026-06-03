import { isNull } from '../../../common/utils/validate'

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
  const config = isNull(err?.config) ? {} : err.config
  const request = isNull(err?.request) ? {} : err.request
  const errResponseStatus = response.status
  const errResponseStatusText = response.statusText
  const errResponseData = response.data
  window.api['logErrorEvent']('[' + title + '请求错误事件] - 异常响应报文 : ', {
    errCode: errCode,
    errMessage: errMessage,
    errConfigUrl: config.url,
    errConfigMethod: config.method,
    errConfigTimeout: config.timeout,
    errRequestStatus: request.status,
    errRequestResponseURL: request.responseURL,
    errResponseStatus: errResponseStatus,
    errResponseStatusText: errResponseStatusText,
    errResponseData: stringifyErrorData(errResponseData)
  })
  const errResponseDataMessage = isNull(errResponseData)
    ? ''
    : isNull(errResponseData.error)
    ? errResponseData.message
    : // 这块的三元表达式主要是拿取OpenAI响应值 之前 error.message 中会返回错误提示
    // 现在不知道为什么突然没有了，所以这里再做一层校验从  error.code 中读取
    isNull(errResponseData.error.message)
    ? errResponseData.error.code
    : errResponseData.error.message
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
  } else if (errCode === 'ERR_NETWORK') {
    msg =
      '网络请求失败，请查看日志中的最终请求地址，并检查网络、代理、TLS证书、服务端POST支持或服务端日志'
  } else {
    msg = isNull(errResponseDataMessage) ? errMessage : errResponseDataMessage
  }
  return msg
}

const getErrorMessage = (err): string => {
  if (!isNull(err?.message)) {
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
