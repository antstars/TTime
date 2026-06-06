const { spawn } = require('child_process')
const path = require('path')

const electronViteBin = path.resolve(__dirname, '../node_modules/electron-vite/bin/electron-vite.js')
const env = { ...process.env }

// Some shells keep this flag after running Electron tooling, which makes the
// Electron binary behave like Node and removes main-process APIs such as app.
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(process.execPath, [electronViteBin, ...process.argv.slice(2)], {
  env,
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
