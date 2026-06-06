import { createApp } from 'vue'
import Set from './Set.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '../css/css-light-vars.css'
import '../css/css-dark-vars.css'
import { Minus, Plus, Refresh } from '@element-plus/icons-vue'
import SvgIcon from '../components/SvgIcon/index.vue'
import 'virtual:svg-icons-register'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { initTheme } from '../utils/themeUtil'

try {
  window.api.logDebugEvent('[设置页] 入口开始执行')
  // 初始化主题
  initTheme()

  const app = createApp(Set)
  app.config.errorHandler = (error, instance, info): void => {
    const errorValue = error as { stack?: string }
    const instanceValue = instance as { type?: unknown } | null
    window.api.logErrorEvent(
      '[设置页Vue异常]',
      info,
      errorValue?.stack ? errorValue.stack : error,
      instanceValue?.type ?? ''
    )
  }

  app.component('Minus', Minus)
  app.component('Plus', Plus)
  app.component('Refresh', Refresh)
  app.component('svg-icon', SvgIcon)
  app
    .use(ElementPlus, {
      locale: zhCn
    })
    .mount('#app')

  window.api.logDebugEvent('[设置页] 挂载完成')
} catch (error) {
  const errorValue = error as { stack?: string }
  window.api.logErrorEvent(
    '[设置页入口异常]',
    errorValue?.stack ? errorValue.stack : error
  )
}
