import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  // 回傳的內容不以 <pre 開頭，markdown-it 會自己包 <pre><code>，data-line 才會保留
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        /* 交給預設處理 */
      }
    }
    return '';
  },
}).use(taskLists, { label: true });

// 在每個區塊元素加上 data-line（原始碼行號，0 起算），供同步捲動使用
md.core.ruler.push('source_line', (state) => {
  for (const token of state.tokens) {
    if (token.map && token.nesting >= 0 && token.block) {
      token.attrSet('data-line', String(token.map[0]));
    }
  }
});

const EXTERNAL_URL = /^[a-z][a-z0-9+.-]*:/i; // http:、https:、mailto:、data: …
const WINDOWS_PATH = /^[a-z]:[\\/]/i;

// 把本機圖片路徑改寫成 /__doc?p=...，由 Go 端讀檔
function localImageUrl(src) {
  let path = src;
  if (/^file:\/\//i.test(src)) {
    path = decodeURIComponent(src.replace(/^file:\/\/\/?/i, ''));
  } else if (!WINDOWS_PATH.test(src)) {
    if (EXTERNAL_URL.test(src) || src.startsWith('//')) return null;
    path = decodeURIComponent(src.split(/[?#]/)[0]);
  }
  return '/__doc?p=' + encodeURIComponent(path);
}

// 仿 GitHub 的標題錨點 id，讓文件內 [目錄](#標題) 連結可以跳轉
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

// 產生預覽 HTML 並放進 container
export function renderPreview(container, source) {
  const html = DOMPurify.sanitize(md.render(source), {
    ADD_ATTR: ['data-line'],
    FORBID_TAGS: ['style', 'form'],
  });
  container.innerHTML = html;

  container.querySelectorAll('img[src]').forEach((img) => {
    const url = localImageUrl(img.getAttribute('src'));
    if (url) img.src = url;
  });

  const used = new Map();
  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const base = slugify(h.textContent) || 'section';
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    h.id = n ? `${base}-${n}` : base;
  });

  container.querySelectorAll('pre > code').forEach((code) => code.classList.add('hljs'));
}

// 取得預覽中各區塊的 [原始碼行號, 在 container 中的 Y 座標]，依行號排序
export function lineAnchors(container) {
  const top = container.getBoundingClientRect().top - container.scrollTop;
  const anchors = [];
  container.querySelectorAll('[data-line]').forEach((el) => {
    anchors.push([Number(el.dataset.line), el.getBoundingClientRect().top - top]);
  });
  anchors.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return anchors;
}
