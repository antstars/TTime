class OpenAIProtocolEnum {
  static CHAT_COMPLETIONS = 'chat_completions'

  static RESPONSES = 'responses'

  static CHAT_COMPLETIONS_THINKING = 'chat_completions_thinking'

  static PROTOCOL_LIST = [
    {
      value: OpenAIProtocolEnum.CHAT_COMPLETIONS,
      label: 'Chat Completions'
    },
    {
      value: OpenAIProtocolEnum.RESPONSES,
      label: 'Responses'
    },
    {
      value: OpenAIProtocolEnum.CHAT_COMPLETIONS_THINKING,
      label: 'Chat Completions + Thinking'
    }
  ]
}

export { OpenAIProtocolEnum }
