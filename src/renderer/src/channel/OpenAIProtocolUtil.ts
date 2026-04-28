import { OpenAIModelEnum } from '../../../common/enums/OpenAIModelEnum'
import { OpenAIProtocolEnum } from '../../../common/enums/OpenAIProtocolEnum'
import { isNull } from '../../../common/utils/validate'

const RESPONSES_UNSUPPORTED_MODE_SET = new Set(['文字润色', '总结', '分析', '解释代码'])

const OPENAI_RESPONSES_LANGUAGE_CODE_MAP = new Map([
  ['中文(简体)', 'zh'],
  ['English', 'en'],
  ['日本語', 'ja'],
  ['한국어', 'ko'],
  ['Français', 'fr'],
  ['Deutsch', 'de'],
  ['Español', 'es'],
  ['Italiano', 'it'],
  ['Русский', 'ru'],
  ['Português', 'pt'],
  ['繁體中文(繁體)', 'zh-Hant']
])

export const normalizeOpenAIRequestUrlPrefix = (requestUrl): string => {
  let url = isNull(requestUrl) ? OpenAIModelEnum.REQUEST_URL : requestUrl.trim()
  url = url.replace(/\/+$/, '')
  if (url.endsWith('/chat/completions')) {
    return url.slice(0, -'/chat/completions'.length)
  }
  if (url.endsWith('/responses')) {
    return url.slice(0, -'/responses'.length)
  }
  return url
}

export const buildOpenAIRequestUrl = (requestUrl, requestProtocol): string => {
  const normalizedUrl = normalizeOpenAIRequestUrlPrefix(requestUrl)
  if (requestProtocol === OpenAIProtocolEnum.RESPONSES) {
    return normalizedUrl + '/responses'
  }
  return normalizedUrl + '/chat/completions'
}

export const getOpenAIRequestProtocol = (requestProtocol): string => {
  if (isNull(requestProtocol)) {
    return OpenAIProtocolEnum.CHAT_COMPLETIONS
  }
  return requestProtocol
}

export const isOpenAIResponsesUnsupportedMode = (languageResultType): boolean => {
  return RESPONSES_UNSUPPORTED_MODE_SET.has(languageResultType)
}

export const getOpenAIResponsesLanguageCode = (languageType): string => {
  return OPENAI_RESPONSES_LANGUAGE_CODE_MAP.get(languageType)
}
