// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

interface CheckResult {
  missing: string[];
  fixed: string[];
}

interface LicenseHeaders {
  checkFiles(files: string[], options: { root: string; fix?: boolean }): CheckResult;
}

const { checkFiles } = require('../../scripts/utils/license-headers.cjs') as LicenseHeaders;

const SLASH_HEADER = '// Copyright The Orca Authors\n// SPDX-License-Identifier: Apache-2.0\n';
const HASH_HEADER = '# Copyright The Orca Authors\n# SPDX-License-Identifier: Apache-2.0\n';

describe('license header check', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'license-headers-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(relativePath: string, content: string): string {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  }

  it('reports a TypeScript file without the header', () => {
    const file = write('src/a.ts', 'export const a = 1;\n');

    expect(checkFiles([file], { root }).missing).toEqual(['src/a.ts']);
  });

  it('accepts a file that starts with the header', () => {
    const file = write('src/a.ts', `${SLASH_HEADER}\nexport const a = 1;\n`);

    expect(checkFiles([file], { root }).missing).toEqual([]);
  });

  it('expects the header on the lines right after a shebang', () => {
    const ok = write('examples/ok.ts', `#!/usr/bin/env -S npm run tsn -T\n${SLASH_HEADER}\nmain();\n`);
    const late = write('examples/late.ts', `#!/usr/bin/env -S npm run tsn -T\n\n${SLASH_HEADER}main();\n`);

    expect(checkFiles([ok, late], { root }).missing).toEqual(['examples/late.ts']);
  });

  it('uses # comments for YAML files and shell scripts', () => {
    const yamlOk = write('.github/workflows/ci.yml', `${HASH_HEADER}\nname: CI\n`);
    const yamlWithSlashes = write('.github/workflows/bad.yml', `${SLASH_HEADER}\nname: Bad\n`);
    const script = write('scripts/build', '#!/usr/bin/env bash\nset -e\n');

    expect(checkFiles([yamlOk, yamlWithSlashes, script], { root }).missing.sort()).toEqual([
      '.github/workflows/bad.yml',
      'scripts/build',
    ]);
  });

  it('skips files that are not source files, and vendored specs', () => {
    const files = [
      write('package.json', '{}\n'),
      write('README.md', '# Readme\n'),
      write('LICENSE', 'Apache License\n'),
      write('.github/CODEOWNERS', '* @someone\n'),
      write('openapi/spec.yaml', 'openapi: 3.1.0\n'),
    ];

    expect(checkFiles(files, { root }).missing).toEqual([]);
  });

  it('accepts the header in a file with CRLF line endings', () => {
    const file = write('src/a.ts', `${SLASH_HEADER}\nexport const a = 1;\n`.replace(/\n/g, '\r\n'));

    expect(checkFiles([file], { root }).missing).toEqual([]);
  });

  it('accepts the header after a byte order mark', () => {
    const file = write('src/a.ts', `﻿${SLASH_HEADER}\nexport const a = 1;\n`);

    expect(checkFiles([file], { root }).missing).toEqual([]);
  });

  it('keeps CRLF line endings when it adds the header, and adds it only once', () => {
    const file = write('src/a.ts', 'export const a = 1;\r\n');

    checkFiles([file], { root, fix: true });
    const second = checkFiles([file], { root, fix: true });

    expect(second.fixed).toEqual([]);
    expect(fs.readFileSync(file, 'utf8')).toBe(`${SLASH_HEADER}\nexport const a = 1;\n`.replace(/\n/g, '\r\n'));
  });

  it('keeps a byte order mark at the start when it adds the header', () => {
    const file = write('src/a.ts', '﻿export const a = 1;\n');

    checkFiles([file], { root, fix: true });

    expect(fs.readFileSync(file, 'utf8')).toBe(`﻿${SLASH_HEADER}\nexport const a = 1;\n`);
  });

  it('adds the header with fix, after any shebang, and keeps the content', () => {
    const plain = write('src/a.ts', '/** Docs. */\nexport const a = 1;\n');
    const script = write('scripts/build', '#!/usr/bin/env bash\n\nset -e\n');

    const result = checkFiles([plain, script], { root, fix: true });

    expect(result.fixed.sort()).toEqual(['scripts/build', 'src/a.ts']);
    expect(fs.readFileSync(plain, 'utf8')).toBe(`${SLASH_HEADER}\n/** Docs. */\nexport const a = 1;\n`);
    expect(fs.readFileSync(script, 'utf8')).toBe(`#!/usr/bin/env bash\n${HASH_HEADER}\nset -e\n`);
    expect(checkFiles([plain, script], { root }).missing).toEqual([]);
  });
});
