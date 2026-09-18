// 介面字串。新增字串時兩種語言都要補。
const messages = {
  'zh-TW': {
    appName: 'MarkDown Builder',
    untitled: '未命名',
    newFile: '新增 (Ctrl+N)',
    openFile: '開啟 (Ctrl+O)',
    save: '儲存 (Ctrl+S)',
    saveAs: '另存新檔 (Ctrl+Shift+S)',
    bold: '粗體 (Ctrl+B)',
    italic: '斜體 (Ctrl+I)',
    strike: '刪除線 (Ctrl+Shift+X)',
    h1: '標題 1 (Ctrl+1)',
    h2: '標題 2 (Ctrl+2)',
    h3: '標題 3 (Ctrl+3)',
    bulletList: '項目清單',
    orderedList: '編號清單',
    taskList: '任務清單',
    quote: '引用',
    inlineCode: '行內程式碼 (Ctrl+E)',
    codeBlock: '程式碼區塊 (Ctrl+Shift+E)',
    link: '連結 (Ctrl+K)',
    image: '圖片',
    table: '表格',
    hr: '分隔線',
    viewEdit: '只編輯',
    viewSplit: '分割',
    viewPreview: '只預覽',
    language: '介面語言',
    placeholderText: '文字',
    placeholderLink: '連結文字',
    placeholderImage: '圖片說明',
    placeholderCode: '程式碼',
    tableHeader: '欄位',
    tableCell: '內容',
    markdownFiles: 'Markdown 檔案',
    allFiles: '所有檔案',
    dialogOpenTitle: '開啟 Markdown 檔案',
    dialogSaveTitle: '另存新檔',
    unsavedTitle: '尚未儲存',
    unsavedMessage: '「{name}」有尚未儲存的變更，要先儲存嗎？',
    btnSave: '儲存',
    btnDiscard: '不儲存',
    btnCancel: '取消',
    btnOk: '確定',
    errorTitle: '發生錯誤',
    openFailed: '無法開啟檔案：{error}',
    saveFailed: '無法儲存檔案：{error}',
    unsupportedFile: '不支援的檔案類型：{name}',
    saved: '已儲存',
    lineCol: '第 {line} 行，第 {col} 欄',
    emptyPreview: '在左邊輸入 Markdown，這裡會即時顯示排版結果。',
    mermaidError: '圖表語法錯誤',
  },
  en: {
    appName: 'MarkDown Builder',
    untitled: 'Untitled',
    newFile: 'New (Ctrl+N)',
    openFile: 'Open (Ctrl+O)',
    save: 'Save (Ctrl+S)',
    saveAs: 'Save As (Ctrl+Shift+S)',
    bold: 'Bold (Ctrl+B)',
    italic: 'Italic (Ctrl+I)',
    strike: 'Strikethrough (Ctrl+Shift+X)',
    h1: 'Heading 1 (Ctrl+1)',
    h2: 'Heading 2 (Ctrl+2)',
    h3: 'Heading 3 (Ctrl+3)',
    bulletList: 'Bulleted list',
    orderedList: 'Numbered list',
    taskList: 'Task list',
    quote: 'Quote',
    inlineCode: 'Inline code (Ctrl+E)',
    codeBlock: 'Code block (Ctrl+Shift+E)',
    link: 'Link (Ctrl+K)',
    image: 'Image',
    table: 'Table',
    hr: 'Horizontal rule',
    viewEdit: 'Editor only',
    viewSplit: 'Split',
    viewPreview: 'Preview only',
    language: 'Interface language',
    placeholderText: 'text',
    placeholderLink: 'link text',
    placeholderImage: 'image description',
    placeholderCode: 'code',
    tableHeader: 'Column',
    tableCell: 'Cell',
    markdownFiles: 'Markdown files',
    allFiles: 'All files',
    dialogOpenTitle: 'Open Markdown file',
    dialogSaveTitle: 'Save As',
    unsavedTitle: 'Unsaved changes',
    unsavedMessage: 'Do you want to save the changes to "{name}"?',
    btnSave: 'Save',
    btnDiscard: "Don't Save",
    btnCancel: 'Cancel',
    btnOk: 'OK',
    errorTitle: 'Error',
    openFailed: 'Could not open the file: {error}',
    saveFailed: 'Could not save the file: {error}',
    unsupportedFile: 'Unsupported file type: {name}',
    saved: 'Saved',
    lineCol: 'Ln {line}, Col {col}',
    emptyPreview: 'Type Markdown on the left to see the formatted result here.',
    mermaidError: 'Diagram syntax error',
  },
};

export const languages = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
];

let current = 'zh-TW';

export function detectLanguage() {
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

export function setLanguage(code) {
  current = messages[code] ? code : 'en';
  document.documentElement.lang = current;
  applyToDom();
}

export function getLanguage() {
  return current;
}

export function t(key, params = {}) {
  const text = messages[current][key] ?? messages.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

// data-i18n → textContent、data-i18n-title → 滑鼠提示
export function applyToDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  });
}
