import { PDFDocument, rgb } from 'pdf-lib';
import { blocksToLines, itemsToLines } from './transform.js';


function collectStylesheetText() {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + '\n';
    } catch (e) {
      // cross-origin stylesheet we can't read; nothing we can do about it
    }
  }
  return css;
}

// Clones the node and copies *live* form-control values onto the clone.
// outerHTML/XMLSerializer only reflect the `value` ATTRIBUTE (the initial/
// default value), not the current DOM property the user actually typed into
// -- so without this step, exported text fields would show stale content.
function cloneWithLiveFormValues(node) {
  const clone = node.cloneNode(true);
  const originalInputs = node.querySelectorAll('input, textarea, select');
  const cloneInputs = clone.querySelectorAll('input, textarea, select');
  originalInputs.forEach((orig, i) => {
    const c = cloneInputs[i];
    if (!c) return;
    if (orig.tagName === 'TEXTAREA') {
      c.textContent = orig.value;
    } else if (orig.type === 'checkbox' || orig.type === 'radio') {
      if (orig.checked) c.setAttribute('checked', 'checked');
      else c.removeAttribute('checked');
    } else if (orig.tagName === 'SELECT') {
      Array.from(c.options || []).forEach((opt, oi) => {
        if (orig.options[oi] && orig.options[oi].selected) opt.setAttribute('selected', 'selected');
        else opt.removeAttribute('selected');
      });
    } else {
      c.setAttribute('value', orig.value ?? '');
    }
  });
  return clone;
}

// Renders a DOM node to a PNG data URL using an SVG <foreignObject>. Uses a
// data: URI (not a blob: URI) for the SVG image source -- blob URIs taint the
// canvas in Chromium and block toDataURL(); data URIs do not. The clone is
// serialized via XMLSerializer (not outerHTML) because foreignObject content
// must be well-formed XML, and HTML5 void elements like <input> aren't
// self-closed in outerHTML.
export async function captureNodeAsPng(node, scale = 2) {
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const css = collectStylesheetText();
  const clone = cloneWithLiveFormValues(node);
  const html = new XMLSerializer().serializeToString(clone);

  const svgString =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
    '<foreignObject width="100%" height="100%">' +
    '<div xmlns="http://www.w3.org/1999/xhtml"><style>' + css + '</style>' + html + '</div>' +
    '</foreignObject></svg>';

  const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

  const img = new Image();
  const dataUrl = await new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      const bg = getComputedStyle(document.body).backgroundColor || '#121012';
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Не вдалося згенерувати зображення'));
    img.src = dataUri;
  });
  return { dataUrl, width, height };
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportNodeAsImage(node, filename) {
  const { dataUrl } = await captureNodeAsPng(node);
  downloadDataUrl(dataUrl, filename);
}

export async function exportNodeAsStyledPdf(node, filename) {
  const { dataUrl, width, height } = await captureNodeAsPng(node);
  const pngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
  const pdfDoc = await PDFDocument.create();
  const png = await pdfDoc.embedPng(pngBytes);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(png, { x: 0, y: 0, width, height });
  const bytes = await pdfDoc.save();
  downloadBytes(bytes, filename, 'application/pdf');
}

function downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function docToPlainLines(doc) {
  const lines = [doc.title || 'Без назви', ''];
  if (doc.type === 'note' || doc.type === 'project') {
    lines.push(...(doc.content || '').split('\n'));
  }
  if (doc.type === 'plan') {
    itemsToLines(doc.items || []).forEach((t, i) => lines.push(i + 1 + '. ' + t));
  }
  if (doc.type === 'wbs') {
    lines.push(...blocksToLines(doc.blocks || []));
  }
  if (doc.checklist && doc.checklist.length) {
    lines.push('', 'Чек-лист:');
    doc.checklist.forEach((c) => lines.push((c.checked ? '[x] ' : '[ ] ') + c.text));
  }
  return lines;
}

// Wraps one logical line into as many visual lines as needed to fit
// maxWidth, greedily packing words. measureWidth(text) is injected (rather
// than calling a font API directly) so this stays a pure function that's
// fully unit-testable without a real font or pdf-lib.
export function wrapLine(text, maxWidth, measureWidth) {
  if (text === '') return [''];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (!current || measureWidth(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current || lines.length === 0) lines.push(current);
  return lines;
}

export function wrapAllLines(lines, maxWidth, measureWidth) {
  const out = [];
  for (const line of lines) out.push(...wrapLine(line, maxWidth, measureWidth));
  return out;
}

// Splits a flat list of visual lines into pages. The first page can have a
// smaller capacity than the rest (it also carries the document title), and
// capacities are floored at 1 so a pathological font-size/page-size
// combination can't produce an infinite loop.
export function paginateLines(lines, firstPageCapacity, restPageCapacity) {
  const first = Math.max(1, Math.floor(firstPageCapacity));
  const rest = Math.max(1, Math.floor(restPageCapacity));
  if (lines.length === 0) return [[]];
  const pages = [];
  let i = 0;
  pages.push(lines.slice(i, i + first));
  i += first;
  while (i < lines.length) {
    pages.push(lines.slice(i, i + rest));
    i += rest;
  }
  return pages;
}

const PDF_PAGE = { width: 595, height: 842, margin: 56 };
const PDF_BODY_SIZE = 11;
const PDF_LINE_HEIGHT = 16;
const PDF_TITLE_SIZE = 18;
const PDF_TITLE_GAP = 30; // space below the title before body text starts

// Generates a real, selectable-text PDF (not a screenshot) with full
// Cyrillic support. pdf-lib's built-in standard fonts only cover WinAnsi
// (Latin) and can't draw Cyrillic at all -- embedding a custom Unicode font
// needs pdf-lib's own documented companion package, @pdf-lib/fontkit,
// imported dynamically here so the rest of this module's exports stay
// usable/testable even in an environment where it hasn't been installed yet.
export async function exportDocAsTextPdf(doc, filename) {
  const fontkitModule = await import('@pdf-lib/fontkit');
  // @pdf-lib/fontkit is published as CommonJS; how a bundler exposes its
  // default export varies (some environments need .default, some don't).
  // Checking for the actual `.create` method it's used for, rather than
  // just trusting `.default` is present, avoids a "fontkit.create is not a
  // function" failure some bundler setups hit with a naive `.default` check.
  const fontkit = typeof fontkitModule.create === 'function' ? fontkitModule : fontkitModule.default;

  const fontBase = import.meta.env.BASE_URL;
  const [regularBytes, boldBytes] = await Promise.all([
    fetch(fontBase + 'fonts/LiberationSans-Regular.ttf').then((r) => r.arrayBuffer()),
    fetch(fontBase + 'fonts/LiberationSans-Bold.ttf').then((r) => r.arrayBuffer()),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const regularFont = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });

  const { width, height, margin } = PDF_PAGE;
  const maxWidth = width - margin * 2;
  const usableHeight = height - margin * 2;
  const restCapacity = usableHeight / PDF_LINE_HEIGHT;
  const firstCapacity = (usableHeight - PDF_TITLE_SIZE - PDF_TITLE_GAP) / PDF_LINE_HEIGHT;

  const allLines = docToPlainLines(doc);
  const title = allLines[0];
  const bodyLines = allLines.slice(1);
  const measure = (text) => regularFont.widthOfTextAtSize(text, PDF_BODY_SIZE);
  const wrapped = wrapAllLines(bodyLines, maxWidth, measure);
  const pages = paginateLines(wrapped, firstCapacity, restCapacity);

  pages.forEach((pageLines, pageIndex) => {
    const page = pdfDoc.addPage([width, height]);
    let y = height - margin;
    if (pageIndex === 0) {
      page.drawText(title, { x: margin, y: y - PDF_TITLE_SIZE, size: PDF_TITLE_SIZE, font: boldFont, color: rgb(0.07, 0.07, 0.07) });
      y -= PDF_TITLE_SIZE + PDF_TITLE_GAP;
    }
    pageLines.forEach((line) => {
      if (line) page.drawText(line, { x: margin, y, size: PDF_BODY_SIZE, font: regularFont, color: rgb(0.1, 0.1, 0.1) });
      y -= PDF_LINE_HEIGHT;
    });
  });

  const bytes = await pdfDoc.save();
  downloadBytes(bytes, filename, 'application/pdf');
}

// pdf-lib's built-in standard fonts only support WinAnsi (Latin) encoding and
// cannot draw Cyrillic text; embedding a custom Unicode font needs the
// `fontkit` package. Rather than pull in that dependency, the plain-text
// export uses the browser's own (fully Unicode-aware) print-to-PDF: it builds
// a hidden, plainly-styled printable view and opens the native print dialog,
// where "Save as PDF" produces a clean, colorless, selectable-text document.
export function printPlainTextDocument(doc) {
  const lines = docToPlainLines(doc);
  const container = document.createElement('div');
  container.id = 'plain-print-root';
  const title = document.createElement('h1');
  title.textContent = lines[0];
  container.appendChild(title);
  lines.slice(1).forEach((line) => {
    const p = document.createElement('div');
    p.textContent = line || '\u00A0';
    container.appendChild(p);
  });

  const style = document.createElement('style');
  style.id = 'plain-print-style';
  style.textContent =
    '@media print {' +
    '  body > *:not(#plain-print-root) { display: none !important; }' +
    '  #plain-print-root { display: block !important; position: static; color: #111; background: #fff; font-family: Georgia, serif; font-size: 13px; line-height: 1.6; padding: 20px; }' +
    '  #plain-print-root h1 { font-size: 20px; margin-bottom: 16px; }' +
    '}' +
    '#plain-print-root { display: none; }';

  document.head.appendChild(style);
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Fallback cleanup in case `afterprint` doesn't fire (some browsers/dialogs).
  setTimeout(cleanup, 15000);
}
