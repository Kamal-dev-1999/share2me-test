'use strict';

/**
 * Lightweight Markdown → PDF regression suite.
 * Pure tests always run. The full render smoke test runs only when Chromium
 * is available, so CI does not need a browser image.
 */

const assert = require('assert');
const fs = require('fs');
const { marked } = require('marked');
const engine = require('../g2p/workers/engines/markdown');

const { escapeHtml, normalizeMarkdown, slugify, sanitizeHtml, buildTocHtml, buildPrintHtml } = engine._internal;

async function pureTests() {
  assert.strictEqual(escapeHtml('<a href="x">\'&"'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&quot;');

  const normalized = normalizeMarkdown(Buffer.from('\uFEFF\u200B# Title\n\nBody'));
  assert.ok(normalized.startsWith('# Title'), 'leading BOM/zero-width chars must be stripped');

  assert.throws(() => normalizeMarkdown(Buffer.from('a\u0000b')), /NUL bytes/);
  assert.throws(() => normalizeMarkdown(Buffer.from('   \n')), /empty/);
  assert.throws(() => normalizeMarkdown(Buffer.from('x'.repeat(32)), 8), /exceeds/);

  const used = new Set();
  assert.strictEqual(slugify('Hello World!', used), 'hello-world');
  assert.strictEqual(slugify('**Hello** World!', used), 'hello-world-2');

  const createDOMPurify = require('dompurify');
  const { JSDOM } = require('jsdom');
  const window = new JSDOM('').window;
  const clean = sanitizeHtml(
    '<h1>Hi</h1><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
    window
  );
  assert.ok(clean.includes('<h1>Hi</h1>'));
  assert.ok(!clean.includes('<script'));
  assert.ok(!/onerror/i.test(clean));
  assert.ok(!/javascript:/i.test(clean));

  const toc = buildTocHtml([{ depth: 2, text: '<A & B>', id: 'a-b' }]);
  assert.ok(toc.includes('href="#a-b"'));
  assert.ok(toc.includes('&lt;A &amp; B&gt;'));

  const print = buildPrintHtml('<p>ok</p>', {
    pageSize: 'Letter', orientation: 'landscape', marginMm: 12, printBackground: true,
    header: true, footer: true, language: 'fr',
  }, 'A "Title"', toc);
  assert.ok(print.html.includes('size: Letter landscape'));
  assert.ok(print.html.includes('lang="fr"'));
  assert.ok(print.html.includes('A &quot;Title&quot;'));
  assert.ok(print.footerTemplate.includes('pageNumber'));
  assert.ok(print.footerTemplate.includes('totalPages'));

  // Parser conformance spot-checks (CommonMark + GFM).
  assert.strictEqual(marked.parse('# Hi').trim(), '<h1>Hi</h1>');
  assert.ok(marked.parse('| A | B |\n| --- | --- |\n| 1 | 2 |').includes('<table>'));
  assert.ok(marked.parse('- [x] done').includes('checkbox'));
  assert.ok(marked.parse('~~gone~~').includes('<del>'));

  console.log('  ✓ pure markdown engine tests');
}

function resolveChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const isLocal = process.env.NODE_ENV !== 'production' && !process.env.RENDER;
  return isLocal
    ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    : '/usr/bin/chromium-browser';
}

async function renderSmokeTest() {
  const chrome = resolveChrome();
  if (!fs.existsSync(chrome)) {
    console.log('  • render smoke test skipped (no Chromium at', chrome + ')');
    return;
  }

  const markdown = ['# Smoke Test', '', '## Features', '', '- [x] Renders', '', '| A | B |', '| --- | --- |', '| 1 | 2 |', '', '```js', 'const x = 1;', '```', ''].join('\n');
  const pdf = await engine.processMarkdownToPdf(
    Buffer.from(markdown, 'utf8'),
    { toc: true, footer: true, deterministic: true, maxPages: 5 },
    () => {}
  );
  assert.ok(pdf.length > 1000, 'PDF output must be non-trivial');
  assert.strictEqual(pdf.subarray(0, 5).toString(), '%PDF-');

  const again = await engine.processMarkdownToPdf(
    Buffer.from(markdown, 'utf8'),
    { toc: true, footer: true, deterministic: true, maxPages: 5 },
    () => {}
  );
  assert.ok(pdf.equals(again), 'deterministic mode must produce identical bytes');

  console.log(`  ✓ render smoke test + determinism (${pdf.length} bytes)`);
}

(async () => {
  await pureTests();
  await renderSmokeTest();
  console.log('Markdown → PDF tests passed.');
})().catch((err) => {
  console.error('Markdown → PDF tests failed:', err);
  process.exitCode = 1;
});
