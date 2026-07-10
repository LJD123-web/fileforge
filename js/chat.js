// ============================================================
// FileForge Chat — AI conversation UI
// ============================================================
const Chat = (() => {
  const el = {
    list: null,
    input: null,
    send: null
  };

  const suggestions = [
    { label: 'Word 转 PDF', icon: 'fa-file-word' },
    { label: '图片转 PDF', icon: 'fa-file-image' },
    { label: 'Word 转 Markdown', icon: 'fa-file-alt' },
    { label: '图片压缩', icon: 'fa-compress-arrows-alt' }
  ];

  const features = [
    { icon: 'fa-image', text: '图片格式互转（PNG / JPEG / WebP）' },
    { icon: 'fa-file-pdf', text: 'PDF 生成（图片 / 文本 / Word → PDF）' },
    { icon: 'fa-file-word', text: 'Word 读写（DOCX ↔ TXT / MD / HTML）' },
    { icon: 'fa-code', text: '文本格式互转（CSV / JSON / MD / HTML）' }
  ];

  function init() {
    el.list = document.getElementById('chat-list');
    el.input = document.getElementById('chat-input');
    el.send = document.getElementById('chat-send');
    if (el.list) {
      addWelcome();
    }
    if (el.send && el.input) {
      el.send.addEventListener('click', handleSend);
      el.input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });
    }
  }

  function addWelcome() {
    if (!el.list) return;
    const div = document.createElement('div');
    div.className = 'chat-welcome';
    div.innerHTML =
      '<div class="cw-grid">' +
        '<div class="cw-left">' +
          '<div class="cw-title"><i class="fas fa-robot"></i> 你好！我是 FileForge Agent</div>' +
          '<div class="cw-body">拖拽文件到上方区域，我会自动识别并帮你转换。也可以直接点击下方按钮，快速开始。</div>' +
          '<div class="cw-features">' +
            features.map(f => '<div class="cw-feature"><i class="fas ' + f.icon + '"></i>' + Utils.escapeHtml(f.text) + '</div>').join('') +
          '</div>' +
        '</div>' +
        '<div class="cw-right">' +
            suggestions.map(s => '<button class="cw-chip" data-suggest="' + Utils.escapeHtml(s.label) + '">' +
              '<i class="fas ' + s.icon + '"></i>' + Utils.escapeHtml(s.label) + '</button>').join('') +
        '</div>' +
      '</div>';
    el.list.appendChild(div);
    div.querySelectorAll('.cw-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        el.input.value = btn.dataset.suggest;
        handleSend();
      });
    });
  }

  function addMessage(text, isUser, typewriter) {
    if (!el.list) return;
    if (el.list.classList.contains('chat-list-centered')) {
      el.list.classList.remove('chat-list-centered');
    }
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (isUser ? 'chat-msg-user' : 'chat-msg-ai');
    el.list.appendChild(div);
    el.list.scrollTop = el.list.scrollHeight;

    if (!isUser && typewriter) {
      // Typewriter effect
      div.classList.add('typing');
      const stripped = text.replace(/<[^>]*>/g, '');
      let i = 0;
      const speed = 25 + Math.random() * 15;
      function type() {
        if (i < stripped.length) {
          // Preserve HTML tags by building progressively
          i++;
          div.innerHTML = text.substring(0, findCutPoint(text, i));
          el.list.scrollTop = el.list.scrollHeight;
          setTimeout(type, speed);
        } else {
          div.innerHTML = text;
          div.classList.remove('typing');
        }
      }
      type();
      return div;
    } else {
      div.innerHTML = text;
      el.list.scrollTop = el.list.scrollHeight;
      return div;
    }
  }

  // Find safe cut point in HTML string for typewriter
  function findCutPoint(html, charCount) {
    let count = 0, inTag = false;
    for (let i = 0; i < html.length; i++) {
      if (html[i] === '<') inTag = true;
      if (!inTag) count++;
      if (html[i] === '>') inTag = false;
      if (count >= charCount) return i + 1;
    }
    return html.length;
  }

  function addLoading() {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-ai chat-loading';
    div.innerHTML = '<span></span><span></span><span></span>';
    if (el.list) { el.list.appendChild(div); el.list.scrollTop = el.list.scrollHeight; }
    return div;
  }

  function removeLoading(loader) {
    if (loader && loader.parentNode) loader.remove();
  }

  // Smart conversion intent detection
  function detectConversionIntent(text) {
    const lower = text.replace(/\s+/g, '').toLowerCase();
    // Word → PDF
    if ((lower.includes('word') || lower.includes('docx') || lower.includes('文档')) && lower.includes('pdf'))
      return { format: 'pdf', label: 'Word → PDF' };
    // Word → Markdown
    if ((lower.includes('word') || lower.includes('docx')) && (lower.includes('markdown') || lower.includes('md')))
      return { format: 'md', label: 'Word → Markdown' };
    // Word → Text
    if ((lower.includes('word') || lower.includes('docx')) && (lower.includes('txt') || lower.includes('文本') || lower.includes('纯文本')))
      return { format: 'txt', label: 'Word → 纯文本' };
    // Word → HTML
    if ((lower.includes('word') || lower.includes('docx')) && lower.includes('html'))
      return { format: 'html', label: 'Word → HTML' };
    // Image → PDF
    if ((lower.includes('图片') || lower.includes('image') || lower.includes('照片')) && lower.includes('pdf'))
      return { format: 'pdf', label: '图片 → PDF' };
    // Image → JPEG
    if ((lower.includes('图片') || lower.includes('image')) && (lower.includes('jpg') || lower.includes('jpeg')))
      return { format: 'jpeg', label: '图片 → JPEG' };
    // Image → PNG
    if ((lower.includes('图片') || lower.includes('image')) && lower.includes('png'))
      return { format: 'png', label: '图片 → PNG' };
    // Image → WebP
    if ((lower.includes('图片') || lower.includes('image')) && lower.includes('webp'))
      return { format: 'webp', label: '图片 → WebP' };
    // Image compress
    if ((lower.includes('图片') || lower.includes('image')) && lower.includes('压缩'))
      return { format: 'jpeg', label: '图片压缩', quality: 70 };
    // CSV → JSON
    if (lower.includes('csv') && lower.includes('json'))
      return { format: 'json', label: 'CSV → JSON' };
    // JSON → CSV
    if (lower.includes('json') && lower.includes('csv'))
      return { format: 'csv', label: 'JSON → CSV' };
    // MD → HTML
    if ((lower.includes('md') || lower.includes('markdown')) && lower.includes('html'))
      return { format: 'html', label: 'Markdown → HTML' };
    // TXT → Word
    if ((lower.includes('txt') || lower.includes('文本')) && (lower.includes('word') || lower.includes('docx')))
      return { format: 'docx', label: '文本 → Word' };
    // General: just PDF
    if (lower.includes('转pdf') || lower.includes('转成pdf') || lower.includes('转为pdf') || (lower.includes('转换') && lower.includes('pdf')))
      return { format: 'pdf', label: '→ PDF' };
    // General: just JPEG
    if (lower.includes('转jpg') || lower.includes('转jpeg') || lower.includes('转成jpg'))
      return { format: 'jpeg', label: '→ JPEG' };
    // General: just PNG
    if (lower.includes('转png') || lower.includes('转成png'))
      return { format: 'png', label: '→ PNG' };
    // General: just WebP
    if (lower.includes('转webp') || lower.includes('转成webp'))
      return { format: 'webp', label: '→ WebP' };
    // General: 压缩
    if (lower.includes('压缩'))
      return { format: 'jpeg', label: '图片压缩', quality: 70 };
    return null;
  }

  function handleSend() {
    const text = el.input.value.trim();
    if (!text) return;
    addMessage(text, true);
    el.input.value = '';
    el.input.focus();

    const loader = addLoading();
    setTimeout(() => {
      removeLoading(loader);

      // ---- Priority 1: file loaded + conversion intent → execute! ----
      if (typeof App !== 'undefined' && App.hasFile && App.hasFile()) {
        const intent = detectConversionIntent(text);
        if (intent) {
          addMessage('收到！立即执行 <b>' + intent.label + '</b> 转换...', false, true);
          App.triggerConversion(intent.format, intent.quality);
          return;
        }
        // File loaded but no clear intent → suggest
        const ft = App.getCurrentFileType ? App.getCurrentFileType() : null;
        const ext = App.getCurrentFileExt ? App.getCurrentFileExt() : '';
        const suggestions = [];
        if (ft === 'docx_bin') suggestions.push('PDF', 'Markdown', '纯文本', 'HTML');
        else if (ft === 'image') suggestions.push('JPEG', 'PNG', 'WebP', 'PDF');
        else if (ft === 'csv') suggestions.push('JSON');
        else if (ft === 'json') suggestions.push('CSV');
        else if (ft === 'text') suggestions.push('Word', 'PDF', 'HTML');
        if (suggestions.length > 0) {
          addMessage('当前文件已加载（<b>.' + ext + '</b>），你想转为什么格式？试试说「转 ' + suggestions.join('」或「转 ') + '」~', false, true);
        } else {
          addMessage('文件已加载！告诉我想转成什么格式？', false, true);
        }
        return;
      }

      // ---- Priority 2: no file loaded → guide user ----
      const intent = detectConversionIntent(text);
      if (intent) {
        addMessage('好的，你想做 <b>' + intent.label + '</b> 转换。请先把文件拖到上方的上传区域，或点击上传区选择文件，我就能开始处理了！', false, true);
        return;
      }

      // ---- Fallback: generic reply ----
      const lower = text.toLowerCase();
      if (lower.includes('你好') || lower.includes('hi') || lower.includes('hello'))
        addMessage('嗨！\uD83D\uDC4B 有什么文件需要处理的，直接拖给我就行~', false, true);
      else
        addMessage('收到！你可以把文件拖到上传区，然后告诉我想要什么格式。比如：「转成 PDF」、「图片压到 70% 质量」、「CSV 转 JSON」~', false, true);
    }, 400 + Math.random() * 500);
  }

  return { init, addMessage, addLoading, removeLoading };
})();
