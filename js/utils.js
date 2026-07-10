// ============================================================
// FileForge Utilities — shared helpers
// ============================================================
const Utils = (() => {
  let toastTimer;

  // ---- Toast ----
  function showToast(msg, isError) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (isError ? ' toast-error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // ---- Format size ----
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  // ---- File helpers ----
  function getFileExt(file) {
    return file.name.split('.').pop().toLowerCase();
  }

  function getFileType(file, ext) {
    ext = ext || getFileExt(file);
    const imageExts = ['png','jpg','jpeg','webp','bmp','gif','svg'];
    if (imageExts.includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx' || file.type.includes('officedocument') || file.type.includes('wordprocessingml'))
      return 'docx_bin';
    const textExts = ['csv','json','md','txt','html','htm','xml','yml','yaml','docx'];
    if (textExts.includes(ext)) return 'text';
    if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('csv'))
      return 'text';
    return 'unknown';
  }

  function typeLabel(ft, ext) {
    const map = {
      image: '图片', pdf: 'PDF 文档', docx_bin: 'Word 文档',
      csv: 'CSV 表格', json: 'JSON 数据', md: 'Markdown',
      html: 'HTML 网页', txt: '纯文本'
    };
    if (map[ft]) return map[ft];
    if (map[ext]) return map[ext];
    return ft === 'text' ? '文本文件' : (ext || '未知').toUpperCase();
  }

  // ---- MIME map ----
  function formatMime(format) {
    const map = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml'
    };
    return map[format] || 'image/' + format;
  }

  // ---- Text utils ----
  function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
  }

  // ---- Download ----
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Format converters ----
  function csvToJson(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return '[]';
    const headers = parseCsvLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCsvLine(lines[i]);
      if (vals.length === 0) continue;
      const obj = {};
      headers.forEach((h, j) => { obj[h] = vals[j] || ''; });
      rows.push(obj);
    }
    return JSON.stringify(rows, null, 2);
  }

  function parseCsvLine(line) {
    const result = [];
    let current = '', inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  }

  function jsonToCsv(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return '';
    const headers = Object.keys(arr[0]);
    const lines = [headers.join(',')];
    arr.forEach(row => {
      lines.push(headers.map(h => {
        const v = String(row[h] ?? '');
        return v.includes(',') || v.includes('"') || v.includes('\n') ? '"' + v.replace(/"/g,'""') + '"' : v;
      }).join(','));
    });
    return lines.join('\n');
  }

  function mdToHtml(md) {
    let html = escapeHtml(md);
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Bold & italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
    // Code
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    // Blockquote
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // Lines
    const parts = html.split('\n');
    let result = '', inPara = false;
    parts.forEach(line => {
      if (!line.trim()) { if (inPara) { result += '</p>'; inPara = false; } result += '\n'; return; }
      if (line.startsWith('<h') || line.startsWith('<pre') || line.startsWith('<blockquote')) {
        if (inPara) { result += '</p>'; inPara = false; }
        result += line + '\n';
        return;
      }
      if (!inPara) { result += '<p>'; inPara = true; }
      result += line + '\n';
    });
    if (inPara) result += '</p>';
    return result;
  }

  function htmlToMd(html) {
    let md = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```')
      .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1')
      .replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return stripHtml(md.trim());
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return {
    showToast, formatSize, getFileExt, getFileType, typeLabel,
    formatMime, escapeHtml, stripHtml, downloadBlob,
    csvToJson, jsonToCsv, mdToHtml, htmlToMd, sleep
  };
})();
