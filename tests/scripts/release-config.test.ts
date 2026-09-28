// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

it('lets Release Please manage the node package and annotated SDK version', () => {
  const config = JSON.parse(read('release-please-config.json'));
  expect(config['release-type']).toBe('node');
  expect(config['include-component-in-tag']).toBe(false);
  expect(config['include-v-in-tag']).toBe(true);
  expect(config['bump-minor-pre-major']).toBe(true);
  expect(config['bump-patch-for-minor-pre-major']).toBe(false);
  expect(config['extra-files']).toEqual(['src/version.ts']);
  expect(Object.keys(config.packages)).toEqual(['.']);
  // initial-version affects bootstrap only; release-as would pin every future release.
  expect(config['initial-version']).toBe('0.2.2');
  expect(config).not.toHaveProperty('release-as');
  expect(config.packages['.']).not.toHaveProperty('release-as');
  expect(read('src/version.ts')).toContain('x-release-please-version');
});

it('has a coherent bootstrap or release manifest without a second VERSION authority', () => {
  const manifest = JSON.parse(read('.release-please-manifest.json'));
  const pkg = JSON.parse(read('package.json'));
  const config = JSON.parse(read('release-please-config.json'));
  expect(manifest['.'] === '0.0.0' ? config['initial-version'] : manifest['.']).toBe(pkg.version);
  expect(fs.existsSync(path.join(ROOT, 'VERSION'))).toBe(false);
  expect(fs.existsSync(path.join(ROOT, '.github/workflows/release-rc.yml'))).toBe(false);
  expect(fs.existsSync(path.join(ROOT, '.github/workflows/promote.yml'))).toBe(false);
});

it('regenerates the Release Please version annotation across a version bump', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-release-version-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.mkdirSync(path.join(root, 'scripts/utils'), { recursive: true });
    fs.copyFileSync(
      path.join(ROOT, 'scripts/utils/sync-version.cjs'),
      path.join(root, 'scripts/utils/sync-version.cjs'),
    );
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.3.0' }));
    fs.writeFileSync(path.join(root, 'src/version.ts'), read('src/version.ts'));
    execFileSync(process.execPath, ['scripts/utils/sync-version.cjs'], { cwd: root });
    expect(fs.readFileSync(path.join(root, 'src/version.ts'), 'utf8')).toContain(
      'export const VERSION = "0.3.0"; // x-release-please-version',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
