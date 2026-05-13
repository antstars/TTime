<div align='center'>


  # TTime

  🚀 A concise and efficient input, screenshot, selected-text translation, and OCR tool

  <a href="https://github.com/antstars/TTime"><img src="https://img.shields.io/badge/-Windows-blue?logo=windows&logoColor=white" /></a>
  <a href="https://github.com/antstars/TTime"><img src="https://img.shields.io/badge/-macOS-black?&logo=apple&logoColor=white" /></a>

  (English | [中文](README.md))

</div>

## Brief Introduction

Main functions: `Input Translation`, `Screenshot Translation`, `Selected Text Translation`, `Hover Ball Translation`, `Screenshot OCR`, `Silent Screenshot OCR`, `Clipboard Listening Translation`

Highlights:

- Translation window: supports last position, follow mouse, and top-offset display modes; font size can be adjusted; input box and language selector can be hidden
- Theme: supports system theme, light mode, and dark mode
- Translation workflow: supports automatic input translation, translation history, speech playback, line-break handling, and keeping previous content when opening the translation window
- OCR processing: supports writing OCR results to the clipboard and replacing OCR line breaks with spaces or blanks
- Clipboard listening: can show a listener switch in the translation window and automatically translate copied text
- Result tools: English translation results can be copied as camelCase or snake_case
- Network proxy: supports no proxy, HTTP proxy, and SOCKS5 proxy
- Configuration management: supports moving or switching the config, translation history, and plugin directories

## Interface
<div align='center'>
  <table>
    <tr>
        <td>
        <p>Bright Mode</p>
        <img width="350px" src="https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/translate.png"/>
        </td>
        <td>
        <p>Dark Mode</p>
        <img width="350px" src="https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/translate-dark.png"/>
        </td>
    </tr>
  </table>
</div>

| Method | Description | Preview |
| :---: | :---: | :---: |
| Screenshot Translation | Press the screenshot translation shortcut key (default `Alt + W`) and select the area to translate | ![Screenshot translation](https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/screenshot.gif) |
| Selected Text Translation | Select text, then press the selected-text translation shortcut key (default `Alt + E`) | ![Selected translation](https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/choice.gif) |
| Input Translation | Press the input translation shortcut key (default `Alt + Q`), enter text, then press `Enter` to translate | ![Input Translation](https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/input.gif) |
| Hover Ball Translation | Select text, then click the hover ball icon. It is disabled by default and can be enabled in settings | ![Hover Ball Translation](https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/hover-ball.gif) |
| Screenshot OCR | Press the shortcut key to recognize text in the selected screenshot area | ![Screenshot OCR](https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/screenshot-ocr.gif) |
| Silent Screenshot OCR | Press the shortcut key to recognize text in the selected screenshot area and write the result to the clipboard without opening the OCR window | ![Screenshot Silence OCR](https://raw.githubusercontent.com/InkTimeRecord/TTime/dev/README.assets/screenshot-silence-ocr.gif) |

## Integrated Translation/OCR Services
[Translation source/text recognition application reference](https://github.com/antstars/TTime/pages/93e0f8/#%E7%BF%BB%E8%AF%91%E6%BA%90%E4%BB%8B%E7%BB%8D)

- [x] Translation Services
  - [x] TTime (built-in)
  - [x] Google Translation (built-in)
  - [x] DeepL Translation (built-in) = DeepLX Translation
  - [x] Bing Translation (built-in)
  - [x] Bing dict Translation (built-in)
  - [x] Tencent TranSmart Translation (built-in)
  - [x] NiuTrans (built-in)
  - [x] ECDICT Translation-Offline (built-in)
  - [x] Tencent Translator
  - [x] Baidu Translation
  - [x] Alibaba Translation
  - [x] Google Translation
  - [x] OpenAI(ChatGPT) Translation
  - [x] AzureOpenAI Translation
  - [x] YouDao Translation
  - [x] DeepL Translation
  - [x] Volcano Translation
  - [x] NiuTrans
  - [x] CaiYun Translation
  - [x] Papago Translation

- [x] OCR
  - [x] TTime
  - [x] TTime Online OCR
  - [x] Baidu OCR
  - [x] Baidu Image Translation OCR
  - [x] Volcano OCR
  - [x] Ocr Space
  - [x] Iflytek OCR
  - [x] Tencent OCR
  - [x] Tencent Image Translation OCR

## Development Guide

Development environment
```
Node.js Version >= 22.18.0

Npm Version >= 10
```

Install dependencies
```
npm run npm-i-extend-modules-update
```

Run the project
```
npm run dev
```

Build the project
```
npm run build:win
npm run build:win:portable
npm run build:mac
npm run build:linux
```

## Quickly Add a Translation/OCR Service

Adding a translation/OCR service is simple. You only need basic JS/TS knowledge and API debugging ability. The following example uses NiuTrans.

### 1. Add Type

Edit this file and add a translation service enum.

```
src/common/enums/TranslateServiceEnum.ts
```

`Note: after defining the service enum, subsequent file names should follow the enum name. See the naming pattern in the following steps.`

```
static NIU_TRANS = 'NiuTrans'
```

### 2. Add Logo

Copy the logo file to this path.

```
src/renderer/src/assets/translate/NiuTransLogo.png
```

### 3. Add Translation/OCR Service Information

Add the translation/OCR service information file.

```
src/common/channel/translate/info/NiuTransInfo.ts
```

### 4. Add Translation/OCR Service Implementation

Add the translation/OCR service request implementation.

```
src/main/service/channel/interfaces/NiuTransRequest.ts
```

Add the translation/OCR service channel implementation for returning results to the page.

```
src/main/service/channel/product/translate/NiuTransChannel.ts
```

## Thanks
* Thanks [electron-vite](https://github.com/alex8088/electron-vite) The provided electron framework saved me a lot of time and cost
* Thanks [Bob](https://github.com/ripperhe/Bob) Main sources of inspiration
* Thanks [bob-plugin-openai-translator](https://github.com/yetone/bob-plugin-openai-translator) Reference for the original implementation of OpenAI
* Thanks [eSearch](https://github.com/xushengfeng/eSearch) Reference for offline OCR and initial version screenshot implementation
