package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/text/encoding/traditionalchinese"
)

var utf8BOM = []byte{0xEF, 0xBB, 0xBF}

// Document 是開啟檔案後回傳給前端的內容。
// Content 一律以 "\n" 換行；原檔的換行格式與 BOM 記在 CRLF / BOM，存檔時還原。
type Document struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
	CRLF     bool   `json:"crlf"`
	BOM      bool   `json:"bom"`
}

// Settings 是使用者偏好，存在 %APPDATA%\MarkDownBuilder\settings.json
type Settings struct {
	Language string `json:"language"`
}

// App 提供給前端呼叫的方法。
type App struct {
	ctx context.Context

	mu        sync.Mutex
	docPath   string // 目前文件路徑，預覽用它來解析相對路徑圖片
	dirty     bool
	forceQuit bool
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// beforeClose：有未存變更時先攔下，交給前端詢問使用者。
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.forceQuit || !a.dirty {
		return false
	}
	runtime.EventsEmit(ctx, "close-requested")
	return true
}

// Quit 由前端在使用者確認後呼叫，略過未存檔檢查直接關閉。
func (a *App) Quit() {
	a.mu.Lock()
	a.forceQuit = true
	a.mu.Unlock()
	runtime.Quit(a.ctx)
}

func (a *App) SetDirty(dirty bool) {
	a.mu.Lock()
	a.dirty = dirty
	a.mu.Unlock()
}

// SetDocPath 設定目前文件路徑（新文件傳空字串）。
func (a *App) SetDocPath(path string) {
	a.mu.Lock()
	a.docPath = path
	a.mu.Unlock()
}

func (a *App) docDir() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.docPath == "" {
		return ""
	}
	return filepath.Dir(a.docPath)
}

// GetStartupFiles 回傳命令列帶進來的檔案路徑（例如「開啟檔案 → 選擇此程式」）。
func (a *App) GetStartupFiles() []string {
	return filesFromArgs(os.Args[1:])
}

func filesFromArgs(args []string) []string {
	files := []string{}
	for _, arg := range args {
		if strings.HasPrefix(arg, "-") {
			continue
		}
		if abs, err := filepath.Abs(arg); err == nil {
			arg = abs
		}
		files = append(files, arg)
	}
	return files
}

// ResolvePath 把預覽中的相對連結轉成絕對路徑（以目前文件所在資料夾為基準）。
func (a *App) ResolvePath(rel string) string {
	if filepath.IsAbs(rel) {
		return filepath.Clean(rel)
	}
	dir := a.docDir()
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, filepath.FromSlash(rel))
}

func markdownFilters(filterName, allName string) []runtime.FileFilter {
	return []runtime.FileFilter{
		{DisplayName: filterName + " (*.md;*.markdown)", Pattern: "*.md;*.markdown;*.mdown;*.mkd"},
		{DisplayName: allName + " (*.*)", Pattern: "*.*"},
	}
}

// OpenFileDialog 顯示開啟檔案對話框（可多選），取消時回傳空陣列。
func (a *App) OpenFileDialog(title, filterName, allName string) ([]string, error) {
	return runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            title,
		DefaultDirectory: a.docDir(),
		Filters:          markdownFilters(filterName, allName),
	})
}

// SaveFileDialog 顯示另存新檔對話框，取消時回傳空字串；沒有副檔名時自動補 .md。
func (a *App) SaveFileDialog(title, defaultName, filterName, allName string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:            title,
		DefaultDirectory: a.docDir(),
		DefaultFilename:  defaultName,
		Filters:          markdownFilters(filterName, allName),
	})
	if err != nil || path == "" {
		return path, err
	}
	if filepath.Ext(path) == "" {
		path += ".md"
	}
	return path, nil
}

// ReadFile 讀取文字檔。非 UTF-8 的檔案嘗試以 Big5 解碼（舊文件常見）。
func (a *App) ReadFile(path string) (*Document, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	doc := &Document{Path: path, Encoding: "UTF-8"}
	if bytes.HasPrefix(b, utf8BOM) {
		doc.BOM = true
		b = b[len(utf8BOM):]
	}
	if !utf8.Valid(b) {
		if decoded, err := traditionalchinese.Big5.NewDecoder().Bytes(b); err == nil {
			b = decoded
			doc.Encoding = "Big5"
		}
	}
	s := string(b)
	doc.CRLF = strings.Contains(s, "\r\n")
	doc.Content = strings.ReplaceAll(s, "\r\n", "\n")
	return doc, nil
}

// SaveFile 以 UTF-8 寫檔，保留原本的換行格式與 BOM。
func (a *App) SaveFile(path, content string, crlf, bom bool) error {
	if crlf {
		content = strings.ReplaceAll(content, "\n", "\r\n")
	}
	var buf bytes.Buffer
	if bom {
		buf.Write(utf8BOM)
	}
	buf.WriteString(content)
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

func configDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "MarkDownBuilder")
}

func userDataPath() string {
	return filepath.Join(configDir(), "WebView2")
}

func settingsPath() string {
	return filepath.Join(configDir(), "settings.json")
}

// LoadSettings 讀取設定；檔案不存在時回傳空設定（前端依系統語言決定預設值）。
func (a *App) LoadSettings() Settings {
	var s Settings
	if b, err := os.ReadFile(settingsPath()); err == nil {
		_ = json.Unmarshal(b, &s)
	}
	return s
}

func (a *App) SaveSettings(s Settings) error {
	if err := os.MkdirAll(configDir(), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(settingsPath(), b, 0o644)
}
