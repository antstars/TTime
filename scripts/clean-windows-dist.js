const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const packageJson = require(path.join(rootDir, 'package.json'))
const distDir = path.join(rootDir, 'dist')
const targets = [
  path.join(distDir, 'latest.yml'),
  path.join(distDir, `TTime-${packageJson.version}-setup.exe.blockmap`),
  path.join(distDir, 'win-unpacked'),
  path.join(distDir, `TTime-${packageJson.version}-portable`),
  path.join(distDir, `TTime-${packageJson.version}-portable.zip`),
]

for (const target of targets) {
  if (!fs.existsSync(target)) {
    continue
  }
  fs.rmSync(target, { recursive: true, force: true })
}
