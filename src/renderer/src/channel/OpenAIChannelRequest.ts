import { isNotNull, isNull } from '../../../common/utils/validate'
import HttpMethodType from '../enums/HttpMethodTypeClassEnum'
import request from '../utils/requestNotHandle'
import R from '../../../common/class/R'
import AgentTranslateCallbackVo from '../../../common/class/AgentTranslateCallbackVo'
import TranslateServiceEnum from '../../../common/enums/TranslateServiceEnum'
import { commonError } from '../utils/RequestUtil'
import { OpenAIStatusEnum } from '../../../common/enums/OpenAIStatusEnum'
import { v4 as uuidv4 } from 'uuid'
import { EventStreamContentType, fetchEventSource } from '@fortaine/fetch-event-source'
import { OpenAIProtocolEnum } from '../../../common/enums/OpenAIProtocolEnum'
import {
  buildOpenAIRequestUrl,
  getOpenAIRequestProtocol,
  getOpenAIResponsesLanguageCode,
  isOpenAIResponsesUnsupportedMode
} from './OpenAIProtocolUtil'

export class QuoteProcessor {
  private quote: string
  public quoteStart: string
  public quoteEnd: string
  private prevQuoteStartBuffer: string
  private prevQuoteEndBuffer: string

  constructor() {
    this.quote = uuidv4().replace(/-/g, '').slice(0, 4)
    this.quoteStart = `<${this.quote}>`
    this.quoteEnd = `</${this.quote}>`
    this.prevQuoteStartBuffer = ''
    this.prevQuoteEndBuffer = ''
  }

  public processText(text: string): string {
    const deltas = text.split('')
    const targetPieces = deltas.map((delta) => this.processTextDelta(delta))
    return targetPieces.join('')
  }

  private processTextDelta(textDelta: string): string {
    if (textDelta === '') {
      return ''
    }
    if (textDelta.trim() === this.quoteEnd) {
      return ''
    }
    let result = textDelta
    let quoteStartBuffer = this.prevQuoteStartBuffer
    let startIdx = 0
    for (let i = 0; i < textDelta.length; i++) {
      const char = textDelta[i]
      if (char === this.quoteStart[quoteStartBuffer.length]) {
        if (this.prevQuoteStartBuffer.length > 0) {
          if (i === startIdx) {
            quoteStartBuffer += char
            result = textDelta.slice(i + 1)
            startIdx += 1
          } else {
            result = this.prevQuoteStartBuffer + textDelta
            quoteStartBuffer = ''
            break
          }
        } else {
          quoteStartBuffer += char
          result = textDelta.slice(i + 1)
        }
      } else {
        if (quoteStartBuffer.length === this.quoteStart.length) {
          quoteStartBuffer = ''
          break
        }
        if (quoteStartBuffer.length > 0) {
          result = this.prevQuoteStartBuffer + textDelta
          quoteStartBuffer = ''
          break
        }
      }
    }
    this.prevQuoteStartBuffer = quoteStartBuffer
    textDelta = result
    let quoteEndBuffer = this.prevQuoteEndBuffer
    let endIdx = 0
    for (let i = 0; i < textDelta.length; i++) {
      const char = textDelta[i]
      if (char === this.quoteEnd[quoteEndBuffer.length]) {
        if (this.prevQuoteEndBuffer.length > 0) {
          if (i === endIdx) {
            quoteEndBuffer += char
            result = textDelta.slice(i + 1)
            endIdx += 1
          } else {
            result = this.prevQuoteEndBuffer + textDelta
            quoteEndBuffer = ''
            break
          }
        } else {
          quoteEndBuffer += char
          result = textDelta.slice(0, textDelta.length - quoteEndBuffer.length)
        }
      } else {
        if (quoteEndBuffer.length === this.quoteEnd.length) {
          quoteEndBuffer = ''
          break
        }
        if (quoteEndBuffer.length > 0) {
          result = this.prevQuoteEndBuffer + textDelta
          quoteEndBuffer = ''
          break
        }
      }
    }
    this.prevQuoteEndBuffer = quoteEndBuffer
    return result
  }
}

class OpenAIChannelRequest {
  static resolveLanguageSettings(info): { languageType: string; languageResultType: string } {
    return {
      languageType: isNotNull(info.inputLanguageType) ? info.inputLanguageType : info.languageType,
      languageResultType: isNotNull(info.languageResultTypeCustom)
        ? info.languageResultTypeCustom
        : info.languageResultType
    }
  }

  static buildPromptRequest(info, isCheckRequest): { data: object; quoteProcessor: QuoteProcessor } {
    const { languageType, languageResultType } = OpenAIChannelRequest.resolveLanguageSettings(info)
    const quoteProcessor = new QuoteProcessor()
    let rolePrompt =
      'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.'
    let commandPrompt = `Translate from ${languageType} to ${languageResultType}. Return translated text only. Only translate the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
    let contentPrompt = `${quoteProcessor.quoteStart}${info.translateContent}${quoteProcessor.quoteEnd}`

    if (languageResultType === '文字润色') {
      rolePrompt =
        "You are a professional text summarizer, you can only summarize the text, don't interpret it."
      commandPrompt = `Please polish this text in ${languageType}. Only polish the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
    } else if (languageResultType === '总结') {
      rolePrompt =
        "You are a professional text summarizer, you can only summarize the text, don't interpret it."
      commandPrompt = `Please summarize this text in the most concise language and must use ${languageType} language! Only summarize the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
    } else if (languageResultType === '分析') {
      rolePrompt = 'You are a professional translation engine and grammar analyzer.'
      commandPrompt = `Please translate this text to ${languageType} and explain the grammar in the original text using ${languageType}. Only analyze the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
    } else if (languageResultType === '解释代码') {
      rolePrompt =
        'You are a code explanation engine that can only explain code but not interpret or translate it. Also, please report bugs and errors (if any).'
      commandPrompt = `explain the provided code, regex or script in the most concise language and must use ${languageType} language! You may use Markdown. If the content is not code, return an error message. If the code has obvious errors, point them out.`
      contentPrompt = '```\n' + info.translateContent + '\n```'
    }

    const data = {
      model: info.model,
      temperature: 0,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 1,
      presence_penalty: 1,
      messages: [
        { role: 'system', content: rolePrompt },
        { role: 'user', content: commandPrompt },
        { role: 'user', content: contentPrompt }
      ],
      stream: !isCheckRequest
    }
    if (getOpenAIRequestProtocol(info.requestProtocol) === OpenAIProtocolEnum.CHAT_COMPLETIONS_THINKING) {
      data['extra_body'] = {
        enable_thinking: info.enableThinking === true
      }
    }
    return { data, quoteProcessor }
  }

  static buildResponsesRequest(
    info,
    isCheckRequest
  ): { data: object; quoteProcessor: QuoteProcessor | null } {
    const resolvedLanguage = OpenAIChannelRequest.resolveLanguageSettings(info)
    if (!isCheckRequest && isOpenAIResponsesUnsupportedMode(resolvedLanguage.languageResultType)) {
      throw new Error('Responses协议暂不支持当前模式，请切换到 Chat Completions')
    }
    const sourceLanguage = getOpenAIResponsesLanguageCode(
      isCheckRequest ? '中文(简体)' : resolvedLanguage.languageType
    )
    const targetLanguage = getOpenAIResponsesLanguageCode(
      isCheckRequest ? 'English' : resolvedLanguage.languageResultType
    )
    if (isNull(sourceLanguage) || isNull(targetLanguage)) {
      throw new Error('Responses协议暂不支持当前语言，请切换到 Chat Completions')
    }
    return {
      data: {
        model: info.model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: isCheckRequest ? '你好' : info.translateContent,
                translation_options: {
                  source_language: sourceLanguage,
                  target_language: targetLanguage
                }
              }
            ]
          }
        ],
        stream: !isCheckRequest
      },
      quoteProcessor: null
    }
  }

  static buildRequest(
    info,
    isCheckRequest
  ): { data: object; quoteProcessor: QuoteProcessor | null; requestUrl: string } {
    const requestProtocol = getOpenAIRequestProtocol(info.requestProtocol)
    const requestUrl = buildOpenAIRequestUrl(info.requestUrl, requestProtocol)
    if (requestProtocol === OpenAIProtocolEnum.RESPONSES) {
      const { data, quoteProcessor } = OpenAIChannelRequest.buildResponsesRequest(info, isCheckRequest)
      return { data, quoteProcessor, requestUrl }
    }
    const { data, quoteProcessor } = OpenAIChannelRequest.buildPromptRequest(info, isCheckRequest)
    return { data, quoteProcessor, requestUrl }
  }

  static sendTranslateStart(info): void {
    window.api['agentApiTranslateCallback'](
      R.okD(
        new AgentTranslateCallbackVo(info, {
          code: OpenAIStatusEnum.START
        })
      )
    )
  }

  static sendTranslateDelta(info, content): void {
    window.api['agentApiTranslateCallback'](
      R.okD(
        new AgentTranslateCallbackVo(info, {
          code: OpenAIStatusEnum.ING,
          content
        })
      )
    )
  }

  static sendTranslateEnd(info): void {
    window.api['agentApiTranslateCallback'](
      R.okD(
        new AgentTranslateCallbackVo(info, {
          code: OpenAIStatusEnum.END
        })
      )
    )
  }

  static sendTranslateError(info, error): void {
    window.api['agentApiTranslateCallback'](
      R.errorD(
        new AgentTranslateCallbackVo(info, {
          code: OpenAIStatusEnum.ERROR,
          error
        })
      )
    )
  }

  static parseChatCompletionsEvent(data, quoteProcessor: QuoteProcessor): string {
    if (isNotNull(data?.error)) {
      throw data
    }
    const delta = data?.choices?.[0]?.delta
    if (isNotNull(delta?.reasoning_content) || isNull(delta?.content)) {
      return ''
    }
    return quoteProcessor.processText(delta.content)
  }

  static parseResponsesEvent(data): string {
    if (isNotNull(data?.error)) {
      throw data
    }
    if (data?.type === 'response.output_text.delta' && isNotNull(data?.delta)) {
      return data.delta
    }
    if (data?.type === 'response.output_text.done' || data?.type === 'response.completed') {
      return ''
    }
    if (isNotNull(data?.delta)) {
      return data.delta
    }
    if (isNotNull(data?.output_text)) {
      return data.output_text
    }
    return ''
  }

  /**
   * OpenAI - 翻译
   *
   * @param info 翻译信息
   */
  static openaiTranslate = async (info): Promise<void> => {
    const isCheckRequest = false
    let requestInfo
    try {
      requestInfo = OpenAIChannelRequest.buildRequest(info, isCheckRequest)
    } catch (error) {
      OpenAIChannelRequest.sendTranslateError(
        info,
        error instanceof Error ? error.message : error
      )
      return
    }
    const { data, quoteProcessor, requestUrl } = requestInfo
    OpenAIChannelRequest.sendTranslateStart(info)
    let text = ''

    await fetchEventSource(requestUrl, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${info.appKey}`
      },
      async onopen(response) {
        const contentType = response.headers.get('content-type') ?? ''
        if (response.ok && contentType.indexOf(EventStreamContentType) !== -1) {
          return
        }
        window.api.logInfoEvent('[OpenAI翻译事件] - error 连接失败 :', {
          status: response.status,
          statusText: response.statusText
        })
        OpenAIChannelRequest.sendTranslateError(info, '连接失败')
      },
      onmessage(msg) {
        if (msg.data === '[DONE]') {
          return
        }
        try {
          const data = JSON.parse(msg.data)
          const requestProtocol = getOpenAIRequestProtocol(info.requestProtocol)
          const content =
            requestProtocol === OpenAIProtocolEnum.RESPONSES
              ? OpenAIChannelRequest.parseResponsesEvent(data)
              : OpenAIChannelRequest.parseChatCompletionsEvent(data, quoteProcessor)
          if (isNull(content)) {
            return
          }
          text += content
          if (content !== '') {
            OpenAIChannelRequest.sendTranslateDelta(info, content)
          }
        } catch (error) {
          if (isNotNull(error?.error) || isNotNull(error?.message)) {
            OpenAIChannelRequest.sendTranslateError(info, error)
            return
          }
          window.api.logErrorEvent('[OpenAI翻译事件] - parse error : ', text, msg)
        }
      },
      onclose() {
        OpenAIChannelRequest.sendTranslateEnd(info)
        window.api.logInfoEvent('[OpenAI翻译事件] - 响应报文 : ', text)
      },
      onerror(err) {
        window.api.logInfoEvent('[OpenAI翻译事件] - error {}', err)
        OpenAIChannelRequest.sendTranslateError(info, err)
        throw err
      }
    })
  }

  /**
   * OpenAI - 翻译校验
   *
   * @param info 翻译信息
   */
  static openaiCheck = (info): void => {
    const isCheckRequest = true
    let requestInfo
    try {
      requestInfo = OpenAIChannelRequest.buildRequest(info, isCheckRequest)
    } catch (error) {
      OpenAIChannelRequest.sendTranslateError(
        info,
        error instanceof Error ? error.message : error
      )
      return
    }
    const { data, requestUrl } = requestInfo
    request({
      url: requestUrl,
      method: HttpMethodType.POST,
      data,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + info.appKey
      }
    }).then(
      (data) => {
        const error = data['error']
        if (error) {
          OpenAIChannelRequest.sendTranslateError(
            info,
            commonError(TranslateServiceEnum.OPEN_AI, error)
          )
          return
        }
        window.api['agentApiTranslateCallback'](R.okD(new AgentTranslateCallbackVo(info, data)))
      },
      (err) => {
        OpenAIChannelRequest.sendTranslateError(
          info,
          commonError(TranslateServiceEnum.OPEN_AI, err)
        )
      }
    )
  }
}

export { OpenAIChannelRequest }
