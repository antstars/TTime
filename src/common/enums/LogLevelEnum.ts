/**
 * 日志输出等级枚举
 */
class LogLevelEnum {
  /**
   * debug
   */
  static DEBUG = 'debug'

  /**
   * info
   */
  static INFO = 'info'

  /**
   * warn
   */
  static WARN = 'warn'

  /**
   * error
   */
  static ERROR = 'error'

  static values = [LogLevelEnum.DEBUG, LogLevelEnum.INFO, LogLevelEnum.WARN, LogLevelEnum.ERROR]

  static getDefault = (): string => {
    return LogLevelEnum.DEBUG
  }

  static normalize = (level: unknown): string => {
    return typeof level === 'string' && LogLevelEnum.values.includes(level)
      ? level
      : LogLevelEnum.getDefault()
  }
}

export default LogLevelEnum
