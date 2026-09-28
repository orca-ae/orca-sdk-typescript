// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const GITHUB_DIR = path.resolve(__dirname, '../../.github');

function yamlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return yamlFiles(full);
    return /\.ya?ml$/.test(entry.name) ? [full] : [];
  });
}

// Prettier loads its YAML parser with a dynamic import, which Jest's module sandbox rejects, so
// parse in a separate Node process. Returns the first line of the parse error, or null.
function yamlParseError(file: string): string | null {
  const script = `
    const fs = require('node:fs');
    require('prettier')
      .format(fs.readFileSync(process.argv[1], 'utf8'), { parser: 'yaml' })
      .then(() => process.stdout.write('null'), (error) => process.stdout.write(JSON.stringify(String(error.message).split('\\n')[0])));
  `;
  return JSON.parse(execFileSync(process.execPath, ['-e', script, file], { encoding: 'utf8' }));
}

// GitHub silently drops workflows and issue forms it can't parse, and actionlint doesn't read issue
// forms, so parse every YAML file under .github here.
describe('.github YAML', () => {
  const files = yamlFiles(GITHUB_DIR);

  it('finds the workflows and issue forms', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(GITHUB_DIR, file), file]))('%s parses', (_name, file) => {
    expect(yamlParseError(file)).toBeNull();
  });
});
