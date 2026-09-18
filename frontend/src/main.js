import './style.css';
import 'highlight.js/styles/github.css';
import {
  createElement,
  FilePlus, FolderOpen, Save, SaveAll,
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, ListTodo, TextQuote,
  Code, SquareCode, Link, Image, Table, Minus,
  PenLine, Columns2, Eye, Languages, Sigma,
} from 'lucide';
import {
  GetStartupFile, LoadSettings, SaveSettings, OpenFileDialog, SaveFileDialog,
  ReadFile, SaveFile, SetDirty, SetDocPath, ResolvePath, Quit,
} from '../wailsjs/go/main/App';
import { EventsOn, OnFileDrop, WindowSetTitle, BrowserOpenURL } from '../wailsjs/runtime/runtime';
import { t, setLanguage, detectLanguage, languages, applyToDom } from './i18n.js';
import { createEditor, commands } from './editor.js';
import { renderPreview, lineAnchors } from './preview.js';

const $ = (id) => document.getElementById(id);
const workspace = $('mdb-workspace');
const previewScroll = $('mdb-preview-scroll');
const preview = $('mdb-preview');

// ---- 文件狀態 ----
const doc = { path: '', encoding: 'UTF-8', crlf: false, bom: false };
let savedText = null; // 上次存檔（或開檔）時的內容，用來判斷是否有未存變更
let dirty = false;
let viewMode = 'split';

const editor = createEditor($('mdb-editor'), {
  onChange: () => {
    updateDirty();
    scheduleRender();
  },
  onCursor: updateStatusInfo,
});
const view = editor.view;

function fileName(path) {
  return path ? path.split(/[\\/]/).pop() : t('untitled');
}

function updateTitle() {
  WindowSetTitle(`${fileName(doc.path)}${dirty ? ' *' : ''} - ${t('appName')}`);
}

function updateDirty() {
  const now = !view.state.doc.eq(savedText);
  if (now === dirty) return;
  dirty = now;
  SetDirty(dirty);
  updateTitle();
}

function updateStatusInfo() {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  $('mdb-status-path').textContent = doc.path || t('untitled');
  $('mdb-status-info').textContent = [
    doc.encoding,
    doc.crlf ? 'CRLF' : 'LF',
    t('lineCol', { line: line.number, col: pos - line.from + 1 }),
  ].join('   ');
}

let messageTimer;
function flashMessage(text) {
  const el = $('mdb-status-message');
  el.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (el.textContent = ''), 2500);
}

// ---- 預覽 ----
let renderTimer;
let anchorsCache = null;

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
}

function render() {
  clearTimeout(renderTimer);
  const source = view.state.doc.toString();
  if (source.trim() === '') {
    preview.innerHTML = `<p class="empty-hint">${t('emptyPreview')}</p>`;
  } else {
    renderPreview(preview, source).then(invalidateAnchors);
    preview.querySelectorAll('img').forEach((img) => img.addEventListener('load', invalidateAnchors, { once: true }));
  }
  invalidateAnchors();
  syncScroll('editor');
}

function invalidateAnchors() {
  anchorsCache = null;
}

function anchors() {
  anchorsCache ??= lineAnchors(previewScroll);
  return anchorsCache;
}

// ---- 同步捲動（分割模式）----
// 以「使用者目前操作的那一邊」為主，帶動另一邊，避免兩邊互相觸發
let scrollLeader = 'editor';

function editorTopLine() {
  const sc = view.scrollDOM;
  const height = sc.getBoundingClientRect().top - view.documentTop;
  const block = view.lineBlockAtHeight(Math.max(0, height));
  const line = view.state.doc.lineAt(block.from).number - 1;
  const frac = block.height ? Math.min(1, Math.max(0, (height - block.top) / block.height)) : 0;
  return line + frac;
}

function interpolate(list, value, fromIdx, toIdx) {
  // list: [[line, y], ...]，以 fromIdx 欄位內插出 toIdx 欄位
  let prev = [0, 0];
  for (const item of list) {
    if (item[fromIdx] > value) {
      const span = item[fromIdx] - prev[fromIdx];
      const ratio = span > 0 ? (value - prev[fromIdx]) / span : 0;
      return prev[toIdx] + ratio * (item[toIdx] - prev[toIdx]);
    }
    prev = item;
  }
  return null; // 超過最後一個錨點
}

function syncScroll(source) {
  if (viewMode !== 'split') return;
  const sc = view.scrollDOM;
  const list = anchors();
  if (source === 'editor') {
    let y;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) {
      y = previewScroll.scrollHeight;
    } else {
      const line = editorTopLine();
      y = interpolate(list, line, 0, 1);
      if (y === null) {
        const last = list[list.length - 1] ?? [0, 0];
        const total = view.state.doc.lines;
        const ratio = total > last[0] ? (line - last[0]) / (total - last[0]) : 1;
        y = last[1] + ratio * (previewScroll.scrollHeight - last[1]);
      }
    }
    previewScroll.scrollTop = y;
  } else {
    const y = previewScroll.scrollTop;
    let line;
    if (y + previewScroll.clientHeight >= previewScroll.scrollHeight - 4) {
      line = view.state.doc.lines;
    } else {
      line = interpolate(list, y, 1, 0) ?? view.state.doc.lines;
    }
    const n = Math.min(view.state.doc.lines, Math.floor(line) + 1);
    const block = view.lineBlockAt(view.state.doc.line(n).from);
    const offset = view.documentTop - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTop = block.top + (line - Math.floor(line)) * block.height + offset;
  }
}

for (const [name, el] of [['editor', view.scrollDOM], ['preview', previewScroll]]) {
  for (const evt of ['pointerenter', 'pointerdown', 'wheel', 'keydown', 'focusin']) {
    el.addEventListener(evt, () => (scrollLeader = name), { passive: true });
  }
  el.addEventListener('scroll', () => {
    if (scrollLeader === name) requestAnimationFrame(() => syncScroll(name));
  }, { passive: true });
}
window.addEventListener('resize', invalidateAnchors);

// ---- 對話框 ----
let modalOpen = false;

// buttons: [{ label, value, primary }]；Esc 回傳 cancelValue
function showModal(title, message, buttons, cancelValue = 'cancel') {
  const modal = $('mdb-modal');
  const actions = $('mdb-modal-actions');
  $('mdb-modal-title').textContent = title;
  $('mdb-modal-message').textContent = message;
  actions.replaceChildren();
  modalOpen = true;
  modal.hidden = false;
  return new Promise((resolve) => {
    const close = (value) => {
      modal.hidden = true;
      modalOpen = false;
      document.removeEventListener('keydown', onKey, true);
      view.focus();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(cancelValue);
      }
    };
    document.addEventListener('keydown', onKey, true);
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.className = b.primary ? 'primary' : '';
      btn.addEventListener('click', () => close(b.value));
      actions.append(btn);
    }
    actions.querySelector('.primary')?.focus();
  });
}

function showError(message) {
  return showModal(t('errorTitle'), message, [{ label: t('btnOk'), value: 'ok', primary: true }], 'ok');
}

// 有未存變更時詢問；回傳 true 表示可以繼續（已存檔或放棄變更）
async function confirmDiscard() {
  if (!dirty) return true;
  const answer = await showModal(t('unsavedTitle'), t('unsavedMessage', { name: fileName(doc.path) }), [
    { label: t('btnSave'), value: 'save', primary: true },
    { label: t('btnDiscard'), value: 'discard' },
    { label: t('btnCancel'), value: 'cancel' },
  ]);
  if (answer === 'save') return save();
  return answer === 'discard';
}

// ---- 檔案操作 ----
function loadDocument(info, content) {
  Object.assign(doc, info);
  editor.setContent(content);
  savedText = view.state.doc;
  dirty = false;
  SetDirty(false);
  SetDocPath(doc.path);
  updateTitle();
  updateStatusInfo();
  render();
  view.scrollDOM.scrollTop = 0;
  previewScroll.scrollTop = 0;
  view.focus();
}

async function newFile() {
  if (!(await confirmDiscard())) return;
  loadDocument({ path: '', encoding: 'UTF-8', crlf: false, bom: false }, '');
}

async function openPath(path) {
  try {
    const d = await ReadFile(path);
    loadDocument({ path: d.path, encoding: d.encoding, crlf: d.crlf, bom: d.bom }, d.content);
  } catch (err) {
    await showError(t('openFailed', { error: String(err) }));
  }
}

async function openFile(path) {
  if (!(await confirmDiscard())) return;
  if (!path) {
    path = await OpenFileDialog(t('dialogOpenTitle'), t('markdownFiles'), t('allFiles'));
    if (!path) return;
  }
  await openPath(path);
}

async function writeTo(path) {
  try {
    await SaveFile(path, view.state.doc.toString(), doc.crlf, doc.bom);
  } catch (err) {
    await showError(t('saveFailed', { error: String(err) }));
    return false;
  }
  const pathChanged = path !== doc.path;
  doc.path = path;
  doc.encoding = 'UTF-8'; // 存檔一律為 UTF-8（Big5 開啟的檔案存檔後即轉為 UTF-8）
  savedText = view.state.doc;
  dirty = false;
  SetDirty(false);
  if (pathChanged) {
    SetDocPath(path);
    render(); // 資料夾變了，相對路徑圖片要重新解析
  }
  updateTitle();
  updateStatusInfo();
  flashMessage(t('saved'));
  return true;
}

async function save() {
  return doc.path ? writeTo(doc.path) : saveAs();
}

async function saveAs() {
  const defaultName = doc.path ? fileName(doc.path) : `${t('untitled')}.md`;
  const path = await SaveFileDialog(t('dialogSaveTitle'), defaultName, t('markdownFiles'), t('allFiles'));
  if (!path) return false;
  return writeTo(path);
}

// ---- 檢視模式 ----
function setViewMode(mode) {
  viewMode = mode;
  workspace.className = `workspace mode-${mode}`;
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === mode));
  invalidateAnchors();
  view.requestMeasure();
  if (mode !== 'preview') view.focus();
  if (mode === 'split') requestAnimationFrame(() => syncScroll('editor'));
}

// ---- 語言 ----
function changeLanguage(code) {
  setLanguage(code);
  updateTitle();
  updateStatusInfo();
  if (view.state.doc.length === 0) render();
  SaveSettings({ language: code });
}

// ---- 工具列 ----
const toolbarGroups = [
  [
    { icon: FilePlus, key: 'newFile', run: newFile },
    { icon: FolderOpen, key: 'openFile', run: () => openFile() },
    { icon: Save, key: 'save', run: save },
    { icon: SaveAll, key: 'saveAs', run: saveAs },
  ],
  [
    { icon: Bold, key: 'bold' },
    { icon: Italic, key: 'italic' },
    { icon: Strikethrough, key: 'strike' },
    { icon: Heading1, key: 'h1' },
    { icon: Heading2, key: 'h2' },
    { icon: Heading3, key: 'h3' },
  ],
  [
    { icon: List, key: 'bulletList' },
    { icon: ListOrdered, key: 'orderedList' },
    { icon: ListTodo, key: 'taskList' },
    { icon: TextQuote, key: 'quote' },
  ],
  [
    { icon: Code, key: 'inlineCode' },
    { icon: SquareCode, key: 'codeBlock' },
    { icon: Link, key: 'link' },
    { icon: Image, key: 'image' },
    { icon: Table, key: 'table' },
    { icon: Minus, key: 'hr' },
    { icon: Sigma, key: 'math' },
  ],
];

function iconButton(icon, key, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tool';
  btn.dataset.i18nTitle = key;
  btn.append(createElement(icon, { width: 18, height: 18, 'stroke-width': 2 }));
  btn.addEventListener('mousedown', (e) => e.preventDefault()); // 不搶走編輯區的焦點與選取
  btn.addEventListener('click', onClick);
  return btn;
}

function buildToolbar() {
  const bar = $('mdb-toolbar');
  toolbarGroups.forEach((group, i) => {
    const g = document.createElement('div');
    g.className = 'tool-group';
    for (const item of group) {
      g.append(
        iconButton(item.icon, item.key, () => {
          if (item.run) return item.run();
          if (viewMode === 'preview') setViewMode('split'); // 只預覽時按格式鈕，先切回可編輯
          commands[item.key](view);
        }),
      );
    }
    bar.append(g);
    if (i === 0) g.classList.add('file-group');
  });

  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  bar.append(spacer);

  const modes = document.createElement('div');
  modes.className = 'tool-group segmented';
  for (const [mode, icon, key] of [['edit', PenLine, 'viewEdit'], ['split', Columns2, 'viewSplit'], ['preview', Eye, 'viewPreview']]) {
    const btn = iconButton(icon, key, () => setViewMode(mode));
    btn.dataset.view = mode;
    modes.append(btn);
  }
  bar.append(modes);

  const lang = document.createElement('label');
  lang.className = 'lang-select';
  lang.dataset.i18nTitle = 'language';
  lang.append(createElement(Languages, { width: 16, height: 16 }));
  const select = document.createElement('select');
  select.id = 'mdb-language';
  for (const l of languages) select.append(new Option(l.label, l.code));
  select.addEventListener('change', () => changeLanguage(select.value));
  lang.append(select);
  bar.append(lang);
}

// ---- 快捷鍵（檔案類；格式類在 editor.js）----
document.addEventListener(
  'keydown',
  (e) => {
    if (modalOpen) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    // 擋掉會讓 WebView 重新整理而遺失內容的按鍵
    if (e.key === 'F5' || (ctrl && k === 'r')) {
      e.preventDefault();
      return;
    }
    if (!ctrl || e.altKey) return;
    const actions = { n: newFile, o: () => openFile(), s: e.shiftKey ? saveAs : save };
    if (actions[k]) {
      e.preventDefault();
      e.stopPropagation();
      actions[k]();
    }
  },
  true,
);

// ---- 預覽中的連結 ----
previewScroll.addEventListener('click', async (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  if (href.startsWith('#')) {
    const target = preview.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`);
    if (target) {
      scrollLeader = 'preview';
      target.scrollIntoView({ block: 'start' });
    }
    return;
  }
  if (/^(https?|mailto):/i.test(href)) {
    BrowserOpenURL(href);
    return;
  }
  // 相對路徑的 .md 連結：在編輯器中開啟
  const pathPart = decodeURIComponent(href.split('#')[0]);
  if (/\.(md|markdown|mdown|mkd)$/i.test(pathPart)) {
    const abs = await ResolvePath(pathPart);
    if (abs) openFile(abs);
  }
});

// ---- 拖放開檔 ----
const SUPPORTED = /\.(md|markdown|mdown|mkd|txt)$/i;
OnFileDrop((_x, _y, paths) => {
  if (modalOpen || !paths?.length) return;
  const path = paths[0];
  if (!SUPPORTED.test(path)) {
    showError(t('unsupportedFile', { name: fileName(path) }));
    return;
  }
  openFile(path);
}, false);

// ---- 關閉視窗 ----
EventsOn('close-requested', async () => {
  if (modalOpen) return;
  if (await confirmDiscard()) Quit();
});

// ---- 啟動 ----
async function init() {
  buildToolbar();
  const settings = await LoadSettings();
  const lang = settings.language || detectLanguage();
  $('mdb-language').value = lang;
  setLanguage(lang);
  applyToDom();
  setViewMode('split');

  loadDocument({ path: '', encoding: 'UTF-8', crlf: false, bom: false }, '');
  const startup = await GetStartupFile();
  if (startup) await openPath(startup);
}

init();

