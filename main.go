package main

import (
	"embed"
	"net/http"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "MarkDown Builder",
		Width:     1280,
		Height:    820,
		MinWidth:  720,
		MinHeight: 480,
		AssetServer: &assetserver.Options{
			Assets: assets,
			// 預覽中的本機圖片（相對 / 絕對路徑）由 docMiddleware 讀取
			Middleware: func(next http.Handler) http.Handler {
				return &docMiddleware{app: app, next: next}
			},
		},
		BackgroundColour:         &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		EnableDefaultContextMenu: true, // 讓編輯區可以右鍵剪下 / 複製 / 貼上
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop: true, // 拖進視窗的檔案交給前端 OnFileDrop 開啟
		},
		// 只執行一個程式：再次雙擊 .md 時交給既有視窗開成新分頁
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "e3a1c9f4-5b7d-4c2e-9f60-markdownbuilder",
			OnSecondInstanceLaunch: app.onSecondInstance,
		},
		OnStartup:     app.startup,
		OnBeforeClose: app.beforeClose,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewUserDataPath: userDataPath(),
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
