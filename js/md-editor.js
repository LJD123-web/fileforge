// ============================================================
// FileForge Markdown Editor
// ============================================================
const MdEditor = (() => {
  // Custom marked extension: ==highlight== syntax
  function setupMarkedHighlight() {
    if (typeof marked === 'undefined') return;
    const tokenizer = {
      name: 'highlight',
      level: 'inline',
      start(src) { return src.indexOf('=='); },
      tokenizer(src) {
        const rule = /^==([^=\n]+)==/;
        const match = rule.exec(src);
        if (match) {
          return {
            type: 'highlight',
            raw: match[0],
            text: match[1]
          };
        }
      }
    };
    const renderer = {
      name: 'highlight',
      renderer(token) {
        return '<mark>' + token.text + '</mark>';
      }
    };
    marked.use({ extensions: [tokenizer, renderer] });
  }

  // Call once on load
  setupMarkedHighlight();

  const demoMd = `# 欢迎使用 FileForge 文档编辑器

## 功能一览

- **Markdown 实时预览** — 左边写，右边看
- **导出 HTML** — 一键生成网页
- **导出 Word** — 生成 .docx 文档
- **导出 PDF** — 打印级排版输出

## 高亮 & 格式测试

这句话里有 ==高亮文字== 试试看。

### 三级标题 — 注意层级梯度
#### 四级标题 — 应该可见区分
##### 五级标题 — 越来越轻
###### 六级标题 — 最轻但仍可读

## 嵌套列表测试

- 列表项 1
  - 嵌套子项 1-1
  - 嵌套子项 1-2
    - 第三层嵌套
- 列表项 2

## 引用层级测试

> 一级引用
>> 二级引用
>>> 三级引用 — 竖线应有层次区分

## 行内代码 & 其他

这里有一个 \`const test = true\` 的行内代码。

## 代码块示例

\`\`\`javascript
function greet(name) {
  return "你好, " + name + "!";
}
console.log(greet("FileForge"));
\`\`\`

## 表格

| 功能 | 状态 | 备注 |
|------|------|------|
| 图片转换 | ✅ 已支持 | 多格式互转 |
| Word 读写 | ✅ 已支持 | .docx 导出 |
| PDF 生成 | ✅ 已支持 | 支持导出 |
| Markdown 编辑 | ✅ 当前页面 | 实时预览 |

## 链接 & 分割线

访问 [FileForge 官网](https://example.com) 了解更多。

---

> 拖入 .md 文件可以直接加载到编辑器中。
`;

  let editor, preview, wordCount, charCount, exportBtn, exportWordBtn, exportPdfBtn, fileInput;

  function init() {
    editor = document.getElementById('md-editor');
    preview = document.getElementById('md-preview');
    wordCount = document.getElementById('md-wordcount');
    charCount = document.getElementById('md-charcount');
    exportBtn = document.getElementById('mdExportHtml');
    exportWordBtn = document.getElementById('mdExportDocx');
    exportPdfBtn = document.getElementById('mdExportPdf');
    fileInput = document.getElementById('md-file-input');

    if (!editor) return;

    if (!editor.value) editor.value = demoMd;
    updatePreview();
    updateStats();

    editor.addEventListener('input', () => {
      updatePreview();
      updateStats();
    });

    // Export HTML
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const md = editor.value;
        if (!md.trim()) { Utils.showToast('编辑器为空，请先编写内容'); return; }
        const html = typeof marked !== 'undefined' ? marked.parse(md) : Utils.mdToHtml(md);
        const fullHtml = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>导出的文档</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;color:#1a2b3c}code{background:#f1f5f9;padding:2px 6px;border-radius:4px}pre{background:#f8fafc;padding:14px;border-radius:8px;overflow-x:auto}blockquote{border-left:3px solid #4a9eff;padding-left:14px;color:#475569}</style></head><body>' + html + '</body></html>';
        Utils.downloadBlob(new Blob([fullHtml], { type: 'text/html' }), 'exported.html');
        Storage.saveHistory('markdown.md', 'exported.html', 'MD → HTML');
        Utils.showToast('HTML 文件已导出并下载！');
      });
    }

    // Export Word
    if (exportWordBtn) {
      exportWordBtn.addEventListener('click', () => {
        const md = editor.value;
        if (!md.trim()) { Utils.showToast('编辑器为空，请先编写内容'); return; }
        const html = typeof marked !== 'undefined' ? marked.parse(md) : Utils.mdToHtml(md);
        try {
          if (typeof JSZip === 'undefined') throw new Error('JSZip 未加载');
          const docxName = 'exported.docx';
          const fullHtml_2 = '<html><head><meta charset="UTF-8"></head><body>' + html + '</body></html>';
          const blob = Convert.generateDocx(fullHtml_2) || Convert.generateDocxTxtFallback(Utils.stripHtml(html));
          Utils.downloadBlob(blob, docxName);
          Storage.saveHistory('markdown.md', docxName, 'MD → DOCX');
          Utils.showToast('Word 文档已导出并下载！');
        } catch (e) {
          Utils.showToast('Word 导出失败：' + e.message, true);
        }
      });
    }

    // Export PDF
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        const md = editor.value;
        if (!md.trim()) { Utils.showToast('编辑器为空，请先编写内容'); return; }
        try {
          if (typeof jspdf === 'undefined' || !jspdf.jsPDF) throw new Error('jsPDF 未加载');
          const html = typeof marked !== 'undefined' ? marked.parse(md) : Utils.mdToHtml(md);
          const text = Utils.stripHtml(html);
          Convert.renderTextToPdf(text, 'FileForge 文档').then(blob => {
            Utils.downloadBlob(blob, 'exported.pdf');
            Storage.saveHistory('markdown.md', 'exported.pdf', 'MD → PDF');
            Utils.showToast('PDF 文件已导出并下载！');
          }).catch(e => {
            Utils.showToast('PDF 导出失败：' + e.message, true);
          });
        } catch (e) {
          Utils.showToast('PDF 导出失败：' + e.message, true);
        }
      });
    }

    // File input for loading .md
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.match(/\.(md|txt)$/i)) {
          Utils.showToast('仅支持 .md 和 .txt 文件', true);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          editor.value = reader.result;
          updatePreview();
          updateStats();
          Utils.showToast('文件已加载：' + file.name);
        };
        reader.readAsText(file);
      });
    }
  }

  function updatePreview() {
    if (!preview || !editor) return;
    if (typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(editor.value);
    } else {
      preview.innerHTML = editor.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  }

  function updateStats() {
    if (!editor) return;
    const text = editor.value;
    if (wordCount) wordCount.textContent = '字数 ' + (text.trim() ? text.trim().split(/\s+/).length : 0);
    if (charCount) charCount.textContent = '字符 ' + text.length;
  }

  function loadContent(md) {
    if (editor) {
      editor.value = md;
      updatePreview();
      updateStats();
    }
  }

  return { init, loadContent, updatePreview, updateStats };
})();
