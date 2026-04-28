const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const packageJson = require(path.join(rootDir, 'package.json'))
const version = packageJson.version
const productName = 'TTime'
const distDir = path.join(rootDir, 'dist')
const unpackedDir = path.join(distDir, 'win-unpacked')
const portableDir = path.join(distDir, `${productName}-${version}-portable`)
const portableZipPath = path.join(distDir, `${productName}-${version}-portable.zip`)
const setupBlockMapPath = path.join(distDir, `${productName}-${version}-setup.exe.blockmap`)
const vcRedistSource = path.join(rootDir, 'build', 'VC_redist.x64.exe')
const appUpdateYml = path.join(unpackedDir, 'resources', 'app-update.yml')
const latestYml = path.join(distDir, 'latest.yml')
const startCmdPath = path.join(portableDir, 'Start-TTime.cmd')
const readmePath = path.join(portableDir, 'README.txt')

if (!fs.existsSync(unpackedDir)) {
  throw new Error(`未找到 Windows 解包目录: ${unpackedDir}`)
}

fs.rmSync(portableDir, { recursive: true, force: true })
fs.rmSync(portableZipPath, { force: true })
fs.rmSync(appUpdateYml, { force: true })
fs.rmSync(latestYml, { force: true })
fs.rmSync(setupBlockMapPath, { force: true })

copyDirectory(unpackedDir, portableDir)
fs.copyFileSync(vcRedistSource, path.join(portableDir, 'VC_redist.x64.exe'))

fs.writeFileSync(
  startCmdPath,
  `@echo off
setlocal
set "APP_DIR=%~dp0"
set "VC_REDIST=%APP_DIR%VC_redist.x64.exe"
reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64" /v Installed >nul 2>&1
if %errorlevel% neq 0 goto install_runtime
for /f "tokens=3" %%i in ('reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64" /v Installed ^| findstr /i "Installed"') do (
  if /i not "%%i"=="0x1" goto install_runtime
)
goto start_app

:install_runtime
echo.
echo TTime 检测到系统缺少 Microsoft Visual C++ 运行库，正在启动依赖安装程序...
if not exist "%VC_REDIST%" (
  echo 未找到 VC_redist.x64.exe，请确认便携版文件完整后重试。
  pause
  exit /b 1
)
start /wait "" "%VC_REDIST%" /install /passive /norestart
reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64" /v Installed >nul 2>&1
if %errorlevel% neq 0 goto runtime_failed
for /f "tokens=3" %%i in ('reg query "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64" /v Installed ^| findstr /i "Installed"') do (
  if /i "%%i"=="0x1" goto start_app
)

:runtime_failed
echo Microsoft Visual C++ 运行库安装失败，请先手动安装后再启动 TTime。
pause
exit /b 1

:start_app
start "" "%APP_DIR%TTime.exe"
exit /b 0
`,
  'utf8'
)

fs.writeFileSync(
  readmePath,
  [
    'TTime Windows 便携版说明',
    '',
    '1. 请优先双击 Start-TTime.cmd 启动程序。',
    '2. 首次运行若缺少 Microsoft Visual C++ 运行库，脚本会先自动拉起 VC_redist.x64.exe。',
    '3. 不建议直接双击裸 TTime.exe，缺少系统运行库时会直接弹 DLL 错误。',
  ].join('\r\n'),
  'utf8'
)

execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; if (Test-Path '${portableZipPath.replace(/'/g, "''")}') { Remove-Item -LiteralPath '${portableZipPath.replace(/'/g, "''")}' -Force }; [System.IO.Compression.ZipFile]::CreateFromDirectory('${portableDir.replace(/'/g, "''")}', '${portableZipPath.replace(/'/g, "''")}')`,
  ],
  {
    cwd: rootDir,
    stdio: 'inherit',
  }
)

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true })
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath)
      continue
    }
    fs.copyFileSync(sourcePath, targetPath)
  }
}
