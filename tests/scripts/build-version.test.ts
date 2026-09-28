// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

it('builds both module formats with the package release version and matching User-Agent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-build-version-'));
  const releaseVersion = '9.8.7-rc.1';

  try {
    for (const name of ['src', 'scripts', 'tsconfig.json', 'tsconfig.build.json', 'tsc-multi.json']) {
      fs.cpSync(path.join(ROOT, name), path.join(root, name), { recursive: true });
    }
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'junction');
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ ...pkg, version: releaseVersion }));
    // VERSION stays at the planned stable release while package.json carries the RC being built.
    fs.writeFileSync(path.join(root, 'VERSION'), '9.8.7\n');

    execFileSync('bash', ['scripts/build'], { cwd: root, encoding: 'utf8', timeout: 60_000 });

    const script = `
      (async () => {
        const modules = [require('./dist'), await import('./dist/index.mjs')];
        const results = [];
        for (const sdk of modules) {
          let userAgent;
          let clientHeader;
          const client = new sdk.Orca({
            apiKey: null,
            baseURL: 'https://api.example.test',
            fetch: async (_url, init) => {
              userAgent = new Headers(init.headers).get('user-agent');
              clientHeader = new Headers(init.headers).get('x-orca-client');
              return Response.json({ kind: 'APIGroupList', groups: [] });
            },
          });
          await client.discovery.groups();
          results.push({ version: sdk.VERSION, userAgent, clientHeader });
        }
        process.stdout.write(JSON.stringify(results));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const result = execFileSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8' });
    expect(JSON.parse(result)).toEqual([
      {
        version: releaseVersion,
        userAgent: `Orca/JS ${releaseVersion}`,
        clientHeader: `orca-sdk-ts/${releaseVersion}`,
      },
      {
        version: releaseVersion,
        userAgent: `Orca/JS ${releaseVersion}`,
        clientHeader: `orca-sdk-ts/${releaseVersion}`,
      },
    ]);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'dist/package.json'), 'utf8')).version).toBe(
      releaseVersion,
    );
    expect(fs.readFileSync(path.join(root, 'dist/version.d.ts'), 'utf8')).toContain(releaseVersion);
    expect(fs.readFileSync(path.join(root, 'dist/src/version.ts'), 'utf8')).toContain(releaseVersion);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 90_000);
