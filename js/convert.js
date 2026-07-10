// ============================================================
// FileForge Convert Engine — all format conversions
// ============================================================
const Convert = (() => {

  // ---- Image conversion (Canvas-based) ----
  function convertImage(imgDataUrl, targetFormat, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const mime = Utils.formatMime(targetFormat);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('图片转换失败'));
        }, mime, quality / 100);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = imgDataUrl;
    });
  }

  // ---- Text conversion ----
  async function convertText(text, srcExt, targetFormat, currentFileName) {
    // --- SOURCE is PDF ---
    if (srcExt === 'pdf') {
      const extracted = extractPdfText(text);
      if (targetFormat === 'txt') return new Blob([extracted], { type: 'text/plain;charset=utf-8' });
      if (targetFormat === 'md') return new Blob([extracted], { type: 'text/markdown;charset=utf-8' });
      if (targetFormat === 'html') {
        const docName = (currentFileName || 'document').replace(/\.pdf$/i, '');
        return new Blob(['<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>' + docName + '</title></head><body><pre>' + Utils.escapeHtml(extracted) + '</pre></body></html>'], { type: 'text/html;charset=utf-8' });
      }
      if (targetFormat === 'docx') return generateDocx('<html><body><pre>' + Utils.escapeHtml(extracted) + '</pre></body></html>');
      throw new Error('不支持从 PDF 转换为 .' + targetFormat);
    }

    // --- SOURCE is DOCX ---
    if (srcExt === 'docx') {
      try {
        const result = await readDocx(text);
        const extractedHtml = result.value || result || text;
        if (targetFormat === 'html') return new Blob([extractedHtml], { type: 'text/html;charset=utf-8' });
        if (targetFormat === 'md') {
          const plain = Utils.stripHtml(extractedHtml);
          return new Blob([plain], { type: 'text/markdown;charset=utf-8' });
        }
        if (targetFormat === 'txt') return new Blob([Utils.stripHtml(extractedHtml)], { type: 'text/plain;charset=utf-8' });
        if (targetFormat === 'docx') throw new Error('已经是 DOCX 格式');
        if (targetFormat === 'json') {
          const sections = Utils.stripHtml(extractedHtml).split(/\n{2,}/).filter(Boolean);
          return new Blob([JSON.stringify(sections, null, 2)], { type: 'application/json;charset=utf-8' });
        }
        throw new Error('不支持从 DOCX 转换为 .' + targetFormat);
      } catch (e) {
        throw new Error('Word 处理失败：' + e.message + '（请确认文件为有效 .docx 格式）');
      }
    }

    // --- Other text formats ---
    try {
      let result = '';
      if ((srcExt === 'csv' || srcExt === 'tsv') && targetFormat === 'json') {
        result = Utils.csvToJson(text);
      } else if (srcExt === 'json' && targetFormat === 'csv') {
        result = Utils.jsonToCsv(text);
      } else if ((srcExt === 'md' || srcExt === 'txt') && targetFormat === 'html') {
        result = typeof marked !== 'undefined' ? marked.parse(text) : Utils.mdToHtml(text);
      } else if (srcExt === 'html' && (targetFormat === 'md' || targetFormat === 'txt')) {
        result = Utils.htmlToMd(text);
      } else if (srcExt === targetFormat) {
        result = text;
      } else if (['csv','json','md','html','txt'].includes(srcExt) && targetFormat === 'txt') {
        result = srcExt === 'html' ? Utils.stripHtml(text) : text;
      } else {
        throw new Error('不支持从 .' + srcExt + ' 转换为 .' + targetFormat);
      }
      return new Blob([result], { type: 'text/plain;charset=utf-8' });
    } catch (e) {
      throw new Error('文本转换失败：' + e.message);
    }
  }

  // ---- Generate DOCX (minimal valid .docx via JSZip) ----
  function generateDocx(html) {
    if (typeof JSZip === 'undefined') return generateDocxTxtFallback(Utils.stripHtml(html));
    const zip = new JSZip();

    const mimeTypes = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="' + mimeTypes + '"/>' +
      '</Types>';

    const cleanText = Utils.stripHtml(html).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = cleanText.split('\n').filter(l => l.trim()).map(l =>
      '<w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">' + l.trim() + '</w:t></w:r></w:p>'
    ).join('');

    const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + paragraphs + '</w:body></w:document>';

    zip.folder('_rels').file('.rels', rels);
    zip.file('[Content_Types].xml', contentTypes);
    zip.folder('word').file('document.xml', documentXml);
    zip.folder('word').folder('_rels').file('document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');

    return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats.officedocument.wordprocessingml.document' });
  }

  function generateDocxTxtFallback(text) {
    return generateDocx('<p>' + Utils.escapeHtml(text).replace(/\n/g, '<br>') + '</p>');
  }

  // ---- Read DOCX ----
  async function readDocx(arrayBuffer) {
    if (typeof mammoth !== 'undefined') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      return result;
    }
    if (typeof JSZip !== 'undefined') {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const docXml = await zip.file('word/document.xml')?.async('string');
      if (docXml) {
        const matches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (matches) {
          const text = matches.map(m => m.replace(/<\/?w:t[^>]*>/g, '')).join('');
          return { value: '<html><body><pre>' + Utils.escapeHtml(text) + '</pre></body></html>' };
        }
      }
    }
    throw new Error('无法读取 DOCX 文件，请确认 mammoth.js 或 JSZip 已加载');
  }

  // ---- PDF Text extraction (basic) ----
  function extractPdfText(raw) {
    const decoder = new TextDecoder('utf-8');
    const text = typeof raw === 'string' ? raw : decoder.decode(new Uint8Array(raw));
    const lines = [];
    const regex = /\(([^)]{2,})\)|BT([\s\S]*?)ET|\\\(|\\\)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) lines.push(match[1]);
    }
    return lines.length > 0 ? lines.join('\n') : text.substring(0, 5000);
  }

  // ---- PDF Generation ----
  function convertToPdf(fileType, fileData, fileName) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof jspdf === 'undefined' || !jspdf.jsPDF) throw new Error('jsPDF 未加载');

        if (fileType === 'image') {
          resolveImageToPdf(fileData, fileName).then(resolve).catch(reject);
        } else if (fileType === 'docx' || Utils.getFileExt({ name: fileName || '' }) === 'docx') {
          resolveDocxToPdf(fileData).then(resolve).catch(reject);
        } else {
          resolveTextToPdf(fileData, fileName).then(resolve).catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  function resolveImageToPdf(dataUrl, fileName) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
        doc.addImage(img, 'JPEG', 0, 0, img.width, img.height, undefined, 'FAST');
        resolve(doc.output('blob'));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }

  function resolveDocxToPdf(arrayBuffer) {
    return readDocx(arrayBuffer).then(result => {
      const text = Utils.stripHtml(result.value || '');
      return renderTextToPdf(text, 'Docx Export');
    });
  }

  function renderTextToPdf(text, title) {
    return new Promise((resolve, reject) => {
      try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(16);
        doc.text(title || 'FileForge Document', 20, 20);
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(text, 170);
        let y = 30;
        const lineHeight = 5;
        lines.forEach(line => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(line, 20, y);
          y += lineHeight;
        });
        resolve(doc.output('blob'));
      } catch (e) { reject(e); }
    });
  }

  return {
    convertImage, convertText, convertToPdf,
    generateDocx, generateDocxTxtFallback, readDocx,
    renderTextToPdf, extractPdfText
  };
})();
