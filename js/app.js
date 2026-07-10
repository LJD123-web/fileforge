// ============================================================
// FileForge App — main entry point & event bindings
// ============================================================
const App = (() => {
  // State
  let currentFile = null;
  let currentFileData = null;
  let currentFileType = null;
  let currentRawData = null;
  let targetFormat = 'png';
  let quality = 90;

  function init() {
    Chat.init();
    MdEditor.init();
    bindTabs();
    bindUpload();
    bindFormatChips();
    bindConvertBtn();
    bindQuality();
    bindQuickActions();
    bindHistoryPanel();
    bindSettings();
    bindRipple();
    initParticles();
    renderHistory();
    updateRecentFiles();
  }

  // ---- Tabs with sliding indicator ----
  function positionIndicator(navTabs, idx) {
    if (!navTabs) return;
    const tabs = navTabs.querySelectorAll('.capsule-tab');
    const tab = tabs[idx];
    if (!tab) return;
    // Use getBoundingClientRect for accurate positioning relative to parent
    const parentRect = navTabs.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const left = tabRect.left - parentRect.left;
    const width = tabRect.width;
    navTabs.style.setProperty('--cap-left', left + 'px');
    navTabs.style.setProperty('--cap-width', width + 'px');
  }

  function bindTabs() {
    const tabs = document.querySelectorAll('.capsule-tab');
    const navTabs = document.querySelector('.nav-tabs');
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (navTabs) {
          navTabs.setAttribute('data-active', i);
          positionIndicator(navTabs, i);
        }
        document.querySelectorAll('.view-panel').forEach(p => {
          p.classList.remove('active');
          p.style.animation = 'none';
          p.offsetHeight;
          p.style.animation = '';
        });
        const viewId = 'view-' + tab.dataset.view;
        const panel = document.getElementById(viewId);
        if (panel) panel.classList.add('active');
      });
    });
    // Set initial indicator position
    const activeIdx = Array.from(tabs).findIndex(t => t.classList.contains('active'));
    if (navTabs && activeIdx >= 0) {
      navTabs.setAttribute('data-active', activeIdx);
      // Position after layout settles (fonts, transitions, etc.)
      requestAnimationFrame(() => positionIndicator(navTabs, activeIdx));
      // Re-measure on resize so the indicator stays accurate
      window.addEventListener('resize', () => {
        const idx = Array.from(navTabs.querySelectorAll('.capsule-tab')).findIndex(t => t.classList.contains('active'));
        if (idx >= 0) positionIndicator(navTabs, idx);
      });
    }
  }

  // ---- Upload ----
  function bindUpload() {
    const zone = document.getElementById('upload-zone');
    const info = document.getElementById('file-info');
    const input = document.getElementById('file-input');
    const removeBtn = document.getElementById('remove-file');

    if (!zone) return;

    zone.addEventListener('click', () => { if (input) input.click(); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    if (input) input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        currentFile = null;
        currentFileData = null;
        currentFileType = null;
        currentRawData = null;
        if (zone) zone.style.display = '';
        if (info) info.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
      });
    }
  }

  async function handleFile(file) {
    const ext = Utils.getFileExt(file);
    const ft = Utils.getFileType(file, ext);

    currentFile = file;
    currentFileType = ft;
    currentFileData = null;
    currentRawData = null;

    // Read data — primary load
    const primaryData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      if (ft === 'image' || ft === 'pdf' || ft === 'docx_bin') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
    currentFileData = primaryData;

    // Secondary: raw bytes for PDF/DOCX
    if (ft === 'pdf' || ft === 'docx_bin') {
      currentRawData = await new Promise((resolve) => {
        const rawReader = new FileReader();
        rawReader.onload = () => resolve(rawReader.result);
        rawReader.readAsArrayBuffer(file);
      });
    }

    showFileInfo(file);
    enableFormatChips();
    Chat.addMessage('已识别文件：<b>' + file.name + '</b>（' + Utils.formatSize(file.size) + '，类型：' + Utils.typeLabel(ft, ext) + '）', false);
    Storage.addRecent(file.name, Utils.typeLabel(ft, ext), '已加载');
    updateRecentFiles();
  }

  function showFileInfo(file) {
    const zone = document.getElementById('upload-zone');
    const info = document.getElementById('file-info');
    const removeBtn = document.getElementById('remove-file');
    const nameEl = document.getElementById('fi-name');
    const typeEl = document.getElementById('fi-type');
    const sizeEl = document.getElementById('fi-size');

    if (zone) zone.style.display = 'none';
    if (info) {
      info.style.display = '';
      if (nameEl) nameEl.textContent = file.name;
      if (typeEl) typeEl.textContent = Utils.typeLabel(Utils.getFileType(file), Utils.getFileExt(file));
      if (sizeEl) sizeEl.textContent = Utils.formatSize(file.size);
    }
    if (removeBtn) removeBtn.style.display = '';
  }

  // ---- Format chips ----
  function bindFormatChips() {
    document.querySelectorAll('.format-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.classList.contains('disabled')) return;
        document.querySelectorAll('.format-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        targetFormat = chip.dataset.format;
      });
    });
  }

  function enableFormatChips() {
    const chips = document.querySelectorAll('.format-chip');
    const ft = currentFileType;
    const ext = currentFile ? Utils.getFileExt(currentFile) : '';

    if (ft === 'image') {
      chips.forEach(c => {
        const fmt = c.dataset.format;
        if (['png', 'jpeg', 'webp', 'jpg', 'pdf'].includes(fmt)) c.classList.remove('disabled');
        else c.classList.add('disabled');
      });
    } else {
      chips.forEach(c => {
        const fmt = c.dataset.format;
        if (['csv', 'json', 'md', 'html', 'docx', 'txt', 'pdf'].includes(fmt)) c.classList.remove('disabled');
        else c.classList.add('disabled');
      });
      // Don't allow source → same format as only option
      if (ext && chips.length > 1) {
        chips.forEach(c => { if (c.dataset.format === ext && !['png','jpg','jpeg','webp'].includes(ext)) c.classList.add('disabled'); });
      }
    }

    // Select first enabled
    let selected = false;
    chips.forEach(c => {
      c.classList.remove('selected');
      if (!selected && !c.classList.contains('disabled')) {
        c.classList.add('selected');
        targetFormat = c.dataset.format;
        selected = true;
      }
    });
  }

  // ---- Convert button ----
  function bindConvertBtn() {
    const btn = document.getElementById('convert-btn');
    if (btn) btn.addEventListener('click', doConversion);
  }

  async function doConversion() {
    if (!currentFile || !currentFileData) {
      Utils.showToast('请先上传文件', true);
      return;
    }

    const btn = document.getElementById('convert-btn');
    const srcExt = Utils.getFileExt(currentFile);
    const outExt = targetFormat;

    Chat.addMessage('开始转换：<b>.' + srcExt + ' → .' + outExt + '</b>', true);

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> 转换中...'; }

    showProgress('正在转换中...');
    setProgress(10);

    try {
      let resultBlob;
      const ft = currentFileType;

      setProgress(25);
      await Utils.sleep(150);

      // PDF target
      if (outExt === 'pdf') {
        if (ft === 'image') {
          resultBlob = await Convert.convertToPdf('image', currentFileData, currentFile.name);
        } else if (ft === 'docx_bin' && currentRawData) {
          resultBlob = await Convert.convertToPdf('docx_bin', currentRawData, currentFile.name);
        } else {
          resultBlob = await Convert.convertToPdf('text', currentFileData, currentFile.name);
        }
      }
      // Image conversion
      else if (ft === 'image') {
        resultBlob = await Convert.convertImage(currentFileData, outExt, quality);
      }
      // Text/Doc/Pdf conversion
      else {
        const data = (ft === 'docx_bin' || ft === 'pdf') && currentRawData ? currentRawData : currentFileData;
        resultBlob = await Convert.convertText(data, srcExt, outExt, currentFile.name);
      }

      setProgress(80);
      await Utils.sleep(100);

      const outName = currentFile.name.replace(/\.[^.]+$/, '') + '.' + outExt;
      Utils.downloadBlob(resultBlob, outName);
      Storage.saveHistory(currentFile.name, outName, srcExt.toUpperCase() + ' → ' + outExt.toUpperCase());
      renderHistory();
      updateRecentFiles();

      setProgress(100);
      await Utils.sleep(300);
      hideProgress();

      Chat.addMessage('✅ 转换完成！文件已下载：<b>' + Utils.escapeHtml(outName) + '</b>', false);
      Utils.showToast('转换完成！' + outName);
    } catch (e) {
      hideProgress();
      Chat.addMessage('❌ 转换失败：' + e.message, false);
      Utils.showToast('转换失败：' + e.message, true);
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> 开始转换'; }

    if (btn) { btn.disabled = false; btn.textContent = '开始转换'; }
  }

  // ---- Quality slider ----
  function bindQuality() {
    const slider = document.getElementById('quality-slider');
    const val = document.getElementById('quality-value');
    if (slider && val) {
      slider.addEventListener('input', () => {
        quality = parseInt(slider.value);
        val.textContent = quality + '%';
      });
    }
  }

  // ---- Quick actions ----
  function bindQuickActions() {
    document.querySelectorAll('.quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        quickAction(action);
      });
    });
  }

  function quickAction(action) {
    switch (action) {
      case 'png2jpg':
        targetFormat = 'jpeg';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'jpeg') c.classList.add('selected');
        });
        Chat.addMessage('已切换到 PNG → JPEG 模式，请上传图片。', false);
        break;
      case 'csv2json':
        targetFormat = 'json';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'json') c.classList.add('selected');
        });
        Chat.addMessage('已切换到 CSV → JSON 模式，请上传 .csv 文件。', false);
        break;
      case 'json2csv':
        targetFormat = 'csv';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'csv') c.classList.add('selected');
        });
        Chat.addMessage('已切换到 JSON → CSV 模式，请上传 .json 文件。', false);
        break;
      case 'imgcompress':
        targetFormat = 'jpeg';
        quality = 60;
        const qs = document.getElementById('quality-slider');
        const qv = document.getElementById('quality-value');
        if (qs) qs.value = 60;
        if (qv) qv.textContent = '60%';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'jpeg') c.classList.add('selected');
        });
        Chat.addMessage('已切换到图片压缩模式（质量 60%），请上传图片。', false);
        break;
      case 'md2html':
        document.querySelectorAll('.capsule-tab').forEach(t => t.classList.remove('active'));
        const edTab = document.querySelector('.capsule-tab[data-view="edit"]');
        if (edTab) edTab.classList.add('active');
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        const edPanel = document.getElementById('view-edit');
        if (edPanel) edPanel.classList.add('active');
        Chat.addMessage('已切换到 Markdown 编辑器，编写 MD 后点击「导出 HTML」即可。', false);
        break;
      case 'img2pdf':
        targetFormat = 'pdf';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'pdf') c.classList.add('selected');
        });
        Chat.addMessage('已切换到图片 → PDF 模式，请上传图片。', false);
        break;
      case 'word2pdf':
        targetFormat = 'pdf';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'pdf') c.classList.add('selected');
        });
        Chat.addMessage('已切换到 Word → PDF 模式，请上传 .docx 文件。', false);
        break;
      case 'word2txt':
        targetFormat = 'txt';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'txt') c.classList.add('selected');
        });
        Chat.addMessage('已切换到 Word → 纯文本模式，请上传 .docx 文件。', false);
        break;
      case 'txt2word':
        targetFormat = 'docx';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'docx') c.classList.add('selected');
        });
        Chat.addMessage('已切换到文本 → Word 模式，请上传 .txt/.md 文件。', false);
        break;
      case 'word2md':
        targetFormat = 'md';
        document.querySelectorAll('.format-chip').forEach(c => {
          c.classList.remove('selected');
          if (c.dataset.format === 'md') c.classList.add('selected');
        });
        Chat.addMessage('已切换到 Word → Markdown 模式，请上传 .docx 文件。', false);
        break;
      case 'md2pdf':
        document.querySelectorAll('.capsule-tab').forEach(t => t.classList.remove('active'));
        const mdTab = document.querySelector('.capsule-tab[data-view="edit"]');
        if (mdTab) mdTab.classList.add('active');
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        const mdPanel = document.getElementById('view-edit');
        if (mdPanel) mdPanel.classList.add('active');
        Chat.addMessage('已切换到 Markdown 编辑器，编写 MD 后点击「导出 PDF」即可。', false);
        break;
    }
  }

  // ---- History panel ----
  function bindHistoryPanel() {
    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Storage.clearHistory();
        renderHistory();
        Utils.showToast('历史记录已清空');
      });
    }
    const clearRecentBtn = document.getElementById('clear-recent');
    if (clearRecentBtn) {
      clearRecentBtn.addEventListener('click', () => {
        Storage.clearRecent();
        updateRecentFiles();
        Utils.showToast('最近文件已清空');
      });
    }
  }

  function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    const items = Storage.getHistory();
    list.innerHTML = items.slice(0, 15).map(item =>
      '<div class="history-item">' +
        '<span class="history-type">' + Utils.escapeHtml(item.type) + '</span>' +
        '<span class="history-src">' + Utils.escapeHtml(item.src) + '</span>' +
        '<span class="history-arrow">→</span>' +
        '<span class="history-out">' + Utils.escapeHtml(item.out) + '</span>' +
        '<span class="history-time">' + Utils.escapeHtml(item.time) + '</span>' +
      '</div>'
    ).join('') || '<div class="history-empty">暂无转换记录</div>';
  }

  function updateRecentFiles() {
    const container = document.getElementById('recent-files');
    if (!container) return;
    const files = Storage.getRecent();
    container.innerHTML = files.length ? files.map(f => {
      const iconMap = { 'PDF': ['fa-file-pdf', '#2563eb'], 'Word': ['fa-file-word', '#4f46e5'], '图片': ['fa-file-image', '#16a34a'], 'JSON': ['fa-file-code', '#f59e0b'], 'CSV': ['fa-file-csv', '#10b981'], 'Markdown': ['fa-file-alt', '#0ea5e9'], 'HTML': ['fa-file-code', '#ef4444'] };
      const iconCls = Object.entries(iconMap).find(([k]) => f.type.includes(k));
      const iconFa = iconCls ? iconCls[1][0] : 'fa-file';
      const iconBg = iconCls ? iconCls[1][1] : '#94a3b8';
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const extLabel = ext ? ext.toUpperCase() : 'FILE';
      return '<div class="recent-item">' +
        '<div class="recent-icon" style="background:' + iconBg + '">' + extLabel + '</div>' +
        '<div class="recent-info"><div class="recent-name">' + Utils.escapeHtml(f.name) + '</div><div class="recent-meta">' + Utils.escapeHtml(f.type) + '</div></div>' +
      '</div>';
    }).join('') : '<div class="history-empty">暂无最近文件</div>';
  }

  // ---- Settings dropdown ----
  function bindSettings() {
    const drop = document.getElementById('settings-drop');
    const toggle = document.getElementById('settings-toggle');
    const menu = document.getElementById('settings-menu');

    if (!drop || !toggle) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      drop.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!drop.contains(e.target)) drop.classList.remove('open');
    });

    // Menu item actions
    if (menu) {
      menu.querySelectorAll('.drop-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action;
          drop.classList.remove('open');
          if (action === 'theme') {
            document.documentElement.classList.toggle('dark');
            Utils.showToast(document.documentElement.classList.contains('dark') ? '已切换深色主题' : '已切换浅色主题');
          } else if (action === 'reset') {
            if (confirm('确定要重置所有数据吗？（历史记录和最近文件将被清空）')) {
              Storage.clearHistory();
              Storage.clearRecent();
              renderHistory();
              updateRecentFiles();
              Utils.showToast('已重置');
            }
          } else if (action === 'output') {
            Utils.showToast('当前使用浏览器默认下载目录');
          } else if (action === 'shortcuts') {
            Utils.showToast('快捷键：拖拽文件上传，点击格式芯片切换目标格式');
          } else {
          }
        });
      });
    }
  }

  // ---- Expose for chat.js integration ----
  function hasFile() { return !!currentFile; }

  function getCurrentFileType() { return currentFileType; }

  function getCurrentFileExt() { return currentFile ? Utils.getFileExt(currentFile) : null; }

  function triggerConversion(format, qualityOverride) {
    // Update format chips UI
    document.querySelectorAll('.format-chip').forEach(c => {
      c.classList.remove('selected');
      if (c.dataset.format === format) c.classList.add('selected');
    });
    targetFormat = format;
    if (qualityOverride !== undefined) {
      quality = qualityOverride;
      const qs = document.getElementById('quality-slider');
      const qv = document.getElementById('quality-value');
      if (qs) qs.value = quality;
      if (qv) qv.textContent = quality + '%';
    }
    doConversion();
  }

  // ---- Ripple Effect ----
  function bindRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.icon-btn, .convert-btn, .chat-send, .btn-capsule, .quick-action, .cw-chip, .format-chip');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  // ---- Floating Particles ----
  function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const maxP = 30;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < maxP; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.4 + 0.1
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16,185,129,' + p.alpha + ')';
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ---- Progress Ring ----
  function showProgress(label) {
    const overlay = document.getElementById('progress-overlay');
    if (overlay) overlay.classList.add('active');
    setProgress(0);
    if (label) {
      const lbl = document.getElementById('progress-label');
      if (lbl) lbl.textContent = label;
    }
  }

  function setProgress(pct) {
    const ring = document.getElementById('progress-ring-fill');
    const txt = document.getElementById('progress-text');
    if (ring) {
      const circumference = 2 * Math.PI * 34; // ~213.6
      const offset = circumference - (pct / 100) * circumference;
      ring.style.strokeDashoffset = offset;
    }
    if (txt) txt.textContent = Math.round(pct) + '%';
  }

  function hideProgress() {
    const overlay = document.getElementById('progress-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  // ---- Expose for HTML onclick & chat.js ----
  return { init, quickAction, doConversion, handleFile, hasFile, getCurrentFileType, getCurrentFileExt, triggerConversion, showProgress, setProgress, hideProgress };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
