# MarkDown Builder

簡單好用的 Markdown 編輯器 / 瀏覽器。單一執行檔、完全離線，介面可切換繁體中文 / English。

## 使用方式

📖 **完整的圖文操作手冊**：[docs/manual/操作手冊.md](docs/manual/操作手冊.md)（另有 [PDF](docs/manual/MarkDown%20Builder%20操作手冊.pdf) 與 [Word](docs/manual/MarkDown%20Builder%20操作手冊.docx) 版，可直接轉發給同事）

把 `MarkDownBuilder.exe` 複製到任何位置，雙擊即可執行，不需安裝。

開啟文件的方式：

- 工具列「開啟」或 `Ctrl+O`
- 把 `.md` 檔拖進視窗
- 雙擊 `.md`：程式啟動時會自動註冊 .md 檔案關聯；第一次啟動會詢問是否設為預設程式（也可以點狀態列右側的「設為預設程式」），在 Windows 的視窗中選擇 MarkDown Builder 並勾選「一律使用此應用程式」即可
- 程式已開啟時再雙擊其他 `.md`，會在同一個視窗開成新分頁
- 命令列：`MarkDownBuilder.exe 文件.md`

### 功能

- 多分頁：同時開啟多份文件（Ctrl+N 新分頁、Ctrl+W 關閉、Ctrl+Tab 切換），每個分頁各自保留內容與復原紀錄
- 左邊編輯、右邊即時預覽，兩邊同步捲動；右上角可切換「只編輯 / 分割 / 只預覽」
- 支援 GFM：表格、任務清單、刪除線、自動連結，程式碼區塊語法上色
- Mermaid 圖表：以 ```` ```mermaid ```` 撰寫流程圖、循序圖、甘特圖等，預覽中直接繪製
- 數學公式（KaTeX）：行內 `$E=mc^2$`、區塊 `$$ ... $$` 或 ```` ```math ````
- 匯出 PDF / Word：PDF 版面與預覽一致（使用系統內建的 Microsoft Edge 產生，文字可搜尋）；Word 為原生 .docx，圖表與公式以圖片嵌入
- 文件轉 Markdown：開啟或拖入 Word（.docx）、Excel（.xlsx / .xls / .ods）、PowerPoint（.pptx）、PDF、HTML、CSV 會自動轉成 Markdown 開在新分頁（Word 圖片另存到「原檔名_images」資料夾；PDF 只轉文字）
- 預覽可顯示相對路徑圖片（例如 `![](images/a.png)`）；點外部連結會用預設瀏覽器開啟，點其他 `.md` 連結會在編輯器中開啟
- 文件中的 HTML 會經過過濾，不會執行腳本
- 有未儲存變更時，標題列顯示 `*`；關閉視窗、新增或開啟其他檔案前會詢問是否儲存
- 以 UTF-8 儲存，保留原檔的換行格式（CRLF / LF）；Big5 編碼的舊檔也能正確開啟（存檔後轉為 UTF-8）
- 右上角切換介面語言，下次開啟會記住
- 自動更新：有網路時會檢查 GitHub 上的新版本，右下角提示後可一鍵下載並自動重新啟動成新版（離線時不檢查）

### 快捷鍵

| 功能 | 快捷鍵 |
| --- | --- |
| 新分頁 / 開啟 / 儲存 / 另存新檔 | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| 關閉分頁 / 下一個 / 上一個分頁 | `Ctrl+W` / `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| 粗體 / 斜體 / 刪除線 | `Ctrl+B` / `Ctrl+I` / `Ctrl+Shift+X` |
| 標題 1 / 2 / 3 | `Ctrl+1` / `Ctrl+2` / `Ctrl+3` |
| 行內程式碼 / 程式碼區塊 | `Ctrl+E` / `Ctrl+Shift+E` |
| 連結 | `Ctrl+K` |
| 搜尋 / 取代 | `Ctrl+F` |
| 復原 / 重做 | `Ctrl+Z` / `Ctrl+Y` |

### 系統需求

Windows 10 / 11，需有 Microsoft Edge WebView2 Runtime（Windows 11 內建；Windows 10 有更新者通常已安裝，若沒有，程式啟動時會提示下載）。

設定檔存在 `%APPDATA%\MarkDownBuilder\`。

## 開發

技術：Go + [Wails v2](https://wails.io/)（外殼）、CodeMirror 6（編輯器）、markdown-it + highlight.js + DOMPurify（預覽），前端以 Vite 打包後內嵌進 exe。

需求：Go 1.23+、Node.js 20.19+、wails CLI：

```powershell
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

```powershell
wails dev          # 開發模式（改前端程式會即時重載）
.\publish.ps1      # 產生 build\bin\MarkDownBuilder.exe
```

### 發布新版本

`version.json` 是最新版本資訊（之後的自動更新會讀取它判斷有無新版），每次推送前都要更新版本號：

```powershell
.\publish.ps1 -Version 1.1.0   # 更新 version.json 的版本與日期、同步 wails.json，並重新建置 exe
```

建置完成後 `publish.ps1` 會自動把 exe 的 SHA-256 寫入 `version.json`（程式下載更新後用來驗證檔案）。接著修改 `version.json` 的 `notes`（更新說明），再把 `build/bin/MarkDownBuilder.exe` 一起 commit 並推送。已安裝的程式會在下次檢查時看到新版本。

### 專案結構

| 路徑 | 說明 |
| --- | --- |
| `main.go` | 視窗設定、內嵌資源、拖放、關閉攔截 |
| `app.go` | 給前端呼叫的方法：開檔 / 存檔 / 對話框 / 設定 |
| `dochandler.go` | 提供預覽中的本機圖片 |
| `assoc.go` | .md 檔案關聯註冊（HKCU）、預設程式設定 |
| `updater.go` | 自動更新：檢查版本、下載驗證、替換並重新啟動 |
| `export.go` | 匯出：呼叫 Edge 產生 PDF、寫入 docx、用預設程式開啟 |
| `frontend/src/main.js` | 主畫面邏輯：工具列、檔案操作、同步捲動、對話框 |
| `frontend/src/editor.js` | 編輯器與格式化指令 |
| `frontend/src/export.js` | 匯出：組出獨立 HTML、DOM 轉 docx |
| `frontend/src/importer.js` | 各種文件格式轉 Markdown |
| `frontend/src/preview.js` | Markdown 轉 HTML、過濾、圖片路徑改寫 |
| `frontend/src/i18n.js` | 介面字串（新增字串時中英文都要補） |
| `frontend/vendor/` | SheetJS 官方套件（npm 上的舊版有已知漏洞，改用官方發佈的版本） |
| `build/appicon.png` | 程式圖示來源（刪掉 `build/windows/icon.ico` 後重新建置會重新產生） |
