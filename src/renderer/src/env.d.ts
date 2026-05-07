/// <reference types="vite/client" />

declare module 'virtual:svg-icons-register'

declare const process: {
  env: {
    BASE_API: string
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
