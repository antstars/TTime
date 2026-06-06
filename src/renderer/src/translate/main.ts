import { createApp } from 'vue'
import App from './Translate.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '../css/css-light-vars.css'
import '../css/css-dark-vars.css'
import { ArrowDown, ArrowLeft } from '@element-plus/icons-vue'
import SvgIcon from '../components/SvgIcon/index.vue'
import 'virtual:svg-icons-register'

const app = createApp(App)

app.component('ArrowDown', ArrowDown)
app.component('ArrowLeft', ArrowLeft)
app.component('svg-icon', SvgIcon)
app.use(ElementPlus).mount('#app')
