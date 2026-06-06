import { createApp } from 'vue'
import Ocr from './Ocr.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '../css/css-light-vars.css'
import '../css/css-dark-vars.css'
import SvgIcon from '../components/SvgIcon/index.vue'
import 'virtual:svg-icons-register'
import { initTheme } from '../utils/themeUtil'

initTheme()
const app = createApp(Ocr)

app.component('SvgIcon', SvgIcon)
app.use(ElementPlus).mount('#app')
