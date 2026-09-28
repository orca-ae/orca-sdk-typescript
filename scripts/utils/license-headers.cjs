// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

'use strict';

// Checks that every source file starts with the project's two-line license header, after any
// shebang line, in the file's own comment syntax. Pass --fix to add missing headers. With no file
// arguments it checks every file tracked by git.
//
//   node scripts/utils/license-headers.cjs [--fix] [file ...]

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOLDER = 'Copyright The Orca Authors';
const SPDX = 'SPDX-License-Identifier: Apache-2.0';

const SLASH_COMMENT_FILES = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const HASH_COMMENT_FILES = /\.(?:ya?ml|sh)$/;
const SHELL_SHEBANG = /^#!.*\b(?:ba|z)?sh\b/;
// Vendored specs must stay byte-identical to their upstream artifacts.
const EXCLUDED = [/^openapi\//, /^node_modules\//, /^dist\//];

function commentStyle(relativePath, content) {
  if (EXCLUDED.some((pattern) => pattern.test(relativePath))) return null;
  if (SLASH_COMMENT_FILES.test(relativePath)) return '//';
  if (HASH_COMMENT_FILES.test(relativePath)) return '#';
  if (!path.extname(relativePath) && SHELL_SHEBANG.test(content)) return '#';
  return null;
}

function headerLines(style) {
  return [`${style} ${HOLDER}`, `${style} ${SPDX}`];
}

// Splits a file into lines, remembering a leading byte order mark and the line ending in use, so
// checkouts with CRLF endings (for example Windows with core.autocrlf) are handled like LF ones.
function splitContent(content) {
  const bom = content.startsWith('﻿') ? '﻿' : '';
  const text = content.slice(bom.length);
  return { bom, eol: text.includes('\r\n') ? '\r\n' : '\n', lines: text.split(/\r?\n/) };
}

function hasHeader(content, style) {
  const { lines } = splitContent(content);
  const start = lines[0].startsWith('#!') ? 1 : 0;
  const [holder, spdx] = headerLines(style);
  return lines[start] === holder && lines[start + 1] === spdx;
}

function addHeader(content, style) {
  const { bom, eol, lines } = splitContent(content);
  const shebang = lines[0].startsWith('#!') ? [lines.shift()] : [];
  if (lines.length > 1 && lines[0] === '') lines.shift();
  return bom + [...shebang, ...headerLines(style), '', ...lines].join(eol);
}

function checkFiles(files, { root, fix = false }) {
  const missing = [];
  const fixed = [];
  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join('/');
    if (fs.lstatSync(file).isSymbolicLink()) continue;
    const content = fs.readFileSync(file, 'utf8');
    const style = commentStyle(relativePath, content);
    if (!style || hasHeader(content, style)) continue;
    if (fix) {
      fs.writeFileSync(file, addHeader(content, style));
      fixed.push(relativePath);
    } else {
      missing.push(relativePath);
    }
  }
  return { missing, fixed };
}

function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((file) => file && fs.existsSync(path.join(root, file)));
}

function main(args) {
  const fix = args.includes('--fix');
  const named = args.filter((arg) => arg !== '--fix');
  const root = process.cwd();
  const files = (named.length > 0 ? named : trackedFiles(root)).map((file) => path.resolve(root, file));
  const { missing, fixed } = checkFiles(files, { root, fix });

  for (const file of fixed) console.log(`added license header: ${file}`);
  if (missing.length === 0) return 0;
  console.error('These files are missing the license header:');
  for (const file of missing) console.error(`  ${file}`);
  console.error('Run `node scripts/utils/license-headers.cjs --fix` to add it.');
  return 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { checkFiles };
