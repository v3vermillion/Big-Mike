/*  INLINE HANDLER INTEGRITY AUDIT
    ──────────────────────────────────────────────────────────
    For every HTML file with a script block:
    1. Extract every onclick/onchange/oninput/onsubmit/onkeyup/
       onkeydown/onblur/onfocus/onkeypress handler attribute
    2. Parse function names from the handler body
    3. Check each function name exists as a definition in the
       script bundle
    4. Report orphans (references to undefined functions)      */

const fs = require('fs');
const path = require('path');

const FILES = [
  'app.html', 'portal.html', 'book.html', 'onboard.html',
  'index.html', 'services.html', 'results.html', 'platform.html',
  'about.html', 'gallery.html', 'contact.html', '404.html',
];

// Whitelist — browser built-ins, DOM methods, array/string/promise methods,
// keywords, all valid without being defined in the script bundle.
const BROWSER_BUILTINS = new Set([
  'alert', 'confirm', 'prompt', 'fetch', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'encodeURI', 'encodeURIComponent', 'decodeURI',
  'decodeURIComponent', 'JSON', 'Date', 'Math', 'String', 'Number',
  'Array', 'Object', 'Boolean', 'RegExp', 'Error', 'TypeError',
  'Promise', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet', 'URL',
  'URLSearchParams', 'FormData', 'FileReader', 'File', 'Blob',
  'console', 'localStorage', 'sessionStorage', 'navigator',
  'location', 'history', 'document', 'window', 'event', 'this',
  'return', 'void', 'new', 'typeof', 'instanceof', 'delete',
  'true', 'false', 'null', 'undefined', 'if', 'else', 'for',
  'while', 'do', 'switch', 'case', 'break', 'continue', 'try',
  'catch', 'finally', 'throw', 'function', 'var', 'let', 'const',
  // DOM / EventTarget methods — bare when inside a method chain
  'reload', 'remove', 'focus', 'blur', 'scrollTo', 'scrollIntoView',
  'click', 'querySelector', 'querySelectorAll', 'getElementById',
  'getElementsByClassName', 'getElementsByTagName', 'addEventListener',
  'removeEventListener', 'dispatchEvent', 'preventDefault',
  'stopPropagation', 'stopImmediatePropagation', 'getAttribute',
  'setAttribute', 'removeAttribute', 'classList', 'closest',
  'matches', 'insertBefore', 'appendChild', 'removeChild',
  'replaceChild', 'cloneNode', 'contains', 'createElement',
  'createTextNode', 'createDocumentFragment', 'write', 'writeln',
  'submit', 'reset', 'createRange', 'focus',
  // Array / iterable
  'forEach', 'map', 'filter', 'reduce', 'reduceRight', 'find',
  'findIndex', 'includes', 'indexOf', 'lastIndexOf', 'slice',
  'splice', 'concat', 'join', 'reverse', 'sort', 'some', 'every',
  'flat', 'flatMap', 'fill', 'push', 'pop', 'shift', 'unshift',
  'copyWithin', 'entries', 'keys', 'values', 'at',
  // String
  'replace', 'replaceAll', 'split', 'trim', 'trimStart', 'trimEnd',
  'toLowerCase', 'toUpperCase', 'substring', 'substr', 'padStart',
  'padEnd', 'startsWith', 'endsWith', 'charAt', 'charCodeAt',
  'codePointAt', 'fromCharCode', 'fromCodePoint', 'normalize',
  'repeat', 'match', 'matchAll', 'search',
  // Number / Math
  'toFixed', 'toString', 'toPrecision', 'valueOf', 'abs', 'round',
  'floor', 'ceil', 'max', 'min', 'pow', 'sqrt', 'random', 'sign',
  // Promise
  'then', 'catch', 'finally', 'all', 'race', 'allSettled', 'any',
  // Object
  'hasOwnProperty', 'keys', 'values', 'entries', 'assign', 'freeze',
  'isFrozen', 'defineProperty', 'getPrototypeOf',
  // JSON
  'parse', 'stringify',
  // CSS color functions (appear inside style strings — rare but valid)
  'rgba', 'rgb', 'hsla', 'hsl', 'url', 'linear-gradient',
  // Timing / animation
  'requestIdleCallback', 'cancelIdleCallback',
  // Event object methods
  'initEvent', 'composedPath',
  // Others
  'dataset', 'style', 'textContent', 'innerHTML', 'innerText',
  'outerHTML', 'value', 'checked', 'selected', 'disabled',
]);

function extractScriptBundle(html) {
  // Grab everything between <script> and </script> — main app scripts only
  // (skip <script src=...>)
  const re = /<script(?:\s[^>]*)?\s*>([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    // Only include inline scripts (not src= referenced)
    if (!m[0].match(/<script[^>]*\bsrc\s*=/)) {
      out.push(m[1]);
    }
  }
  return out.join('\n');
}

function extractDefinedFunctions(js) {
  const names = new Set();
  // function NAME(
  const re1 = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re1.exec(js)) !== null) names.add(m[1]);
  // var|let|const NAME = function
  const re2 = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function/g;
  while ((m = re2.exec(js)) !== null) names.add(m[1]);
  // NAME = function (assignments, including on window.NAME)
  const re3 = /(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*function\s*\(/g;
  while ((m = re3.exec(js)) !== null) names.add(m[1]);
  // NAME: function  (inside objects — harder to statically check; include anyway)
  const re4 = /([A-Za-z_$][\w$]*)\s*:\s*function/g;
  while ((m = re4.exec(js)) !== null) names.add(m[1]);
  // Arrow fn: var|let|const NAME = (...) =>
  const re5 = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
  while ((m = re5.exec(js)) !== null) names.add(m[1]);
  // Arrow fn without parens: var|let|const NAME = x =>
  const re6 = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/g;
  while ((m = re6.exec(js)) !== null) names.add(m[1]);
  return names;
}

function stripStringLiterals(code) {
  // Replace single + double quoted strings with placeholder so regex
  // doesn't match identifiers that live inside string literals
  // (e.g. "rgba(212,168,40,.8)" inside a style= expression).
  return code.replace(/'(?:\\.|[^'\\])*'/g, '""').replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function extractHandlerFunctionCalls(html) {
  // Find every on* attribute
  const attrRe = /\bon(?:click|change|input|submit|keyup|keydown|keypress|blur|focus|mouseenter|mouseleave|mouseover|mouseout|load|error|dblclick|touchstart|touchend|dragover|dragleave|drop|paste|wheel)\s*=\s*"([^"]*)"/g;
  const attrRe2 = /\bon(?:click|change|input|submit|keyup|keydown|keypress|blur|focus|mouseenter|mouseleave|mouseover|mouseout|load|error|dblclick|touchstart|touchend|dragover|dragleave|drop|paste|wheel)\s*=\s*'([^']*)'/g;
  const calls = [];
  let m;
  const bodies = [];
  while ((m = attrRe.exec(html)) !== null) bodies.push({ body: m[1], pos: m.index });
  while ((m = attrRe2.exec(html)) !== null) bodies.push({ body: m[1], pos: m.index });
  function lineOf(pos) {
    return (html.substring(0, pos).match(/\n/g) || []).length + 1;
  }
  // Look for IDENTIFIER( patterns, but first strip string literals
  // and then ensure the char BEFORE the identifier is not a dot (method call)
  const callRe = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g;
  for (const b of bodies) {
    const cleanBody = stripStringLiterals(b.body);
    let cm;
    const localRe = new RegExp(callRe.source, 'g');
    while ((cm = localRe.exec(cleanBody)) !== null) {
      const name = cm[1];
      // Skip JS keywords
      if (/^(if|else|for|while|return|var|let|const|new|typeof|function|void|delete|switch|case|throw|try|catch|finally|do|in|of|instanceof)$/.test(name)) continue;
      calls.push({ name, line: lineOf(b.pos), body: b.body.substring(0, 80) });
    }
  }
  return calls;
}

const report = {
  files: {},
  totalHandlers: 0,
  totalCalls: 0,
  orphans: [],
};

for (const file of FILES) {
  const full = path.join('/home/user/Big-Mike', file);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  const js = extractScriptBundle(html);
  const defined = extractDefinedFunctions(js);

  // Also extract function names from external js/site.js if referenced
  let allDefined = new Set(defined);
  if (html.indexOf('js/site.js') >= 0) {
    try {
      const siteJs = fs.readFileSync('/home/user/Big-Mike/js/site.js', 'utf8');
      const siteDefined = extractDefinedFunctions(siteJs);
      for (const name of siteDefined) allDefined.add(name);
    } catch(e) {}
  }

  const calls = extractHandlerFunctionCalls(html);
  const orphans = [];
  for (const call of calls) {
    if (!allDefined.has(call.name) && !BROWSER_BUILTINS.has(call.name)) {
      orphans.push({ file, line: call.line, name: call.name, context: call.body });
    }
  }

  report.files[file] = {
    inlineScripts: js.length,
    definedFunctions: defined.size,
    inlineHandlerCalls: calls.length,
    orphans: orphans.length,
  };
  report.totalHandlers += calls.length;
  report.totalCalls += calls.length;
  if (orphans.length) {
    report.orphans.push(...orphans);
  }
}

console.log('\n══════════ INLINE HANDLER INTEGRITY AUDIT ══════════\n');
for (const [file, stats] of Object.entries(report.files)) {
  console.log(`${file.padEnd(18)} ${String(stats.inlineHandlerCalls).padStart(5)} calls → ${stats.orphans} orphan${stats.orphans === 1 ? '' : 's'}`);
}
console.log(`\nTotal inline handler calls scanned: ${report.totalCalls}`);
console.log(`Orphans (undefined function references): ${report.orphans.length}`);

if (report.orphans.length) {
  console.log('\nORPHAN REFERENCES:');
  const byName = {};
  for (const o of report.orphans) {
    if (!byName[o.name]) byName[o.name] = [];
    byName[o.name].push(`${o.file}:${o.line}`);
  }
  for (const [name, locations] of Object.entries(byName)) {
    console.log(`  ${name}() — ${locations.slice(0, 3).join(', ')}${locations.length > 3 ? ` (+${locations.length - 3} more)` : ''}`);
  }
}

fs.writeFileSync('/tmp/handler_audit.json', JSON.stringify(report, null, 2));
process.exit(report.orphans.length > 0 ? 1 : 0);
