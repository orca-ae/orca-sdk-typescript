// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const { publishRelease } = require('../../scripts/utils/publish-release.cjs');
const REGISTRY = 'https://registry.npmjs.org/';

describe('publishing a release', () => {
  let root: string;
  let fetchMetadata: jest.Mock;
  let run: jest.Mock;
  let log: jest.Mock;
  const pkg = {
    name: '@orca-ae/orca-sdk',
    version: '0.2.2',
    repository: { url: 'https://github.com/orca-ae/orca-sdk-typescript.git' },
    publishConfig: { registry: REGISTRY, access: 'public' },
  };

  function write(file: string, value: unknown) {
    fs.writeFileSync(path.join(root, file), JSON.stringify(value));
  }

  function publish(tag = 'v0.2.2') {
    return publishRelease({ root, tag, fetchMetadata, run, log });
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-publish-test-'));
    fs.mkdirSync(path.join(root, 'dist'));
    write('package.json', pkg);
    write('dist/package.json', pkg);
    write('.release-please-manifest.json', { '.': pkg.version });
    fetchMetadata = jest.fn().mockResolvedValue(new Response(null, { status: 404 }));
    run = jest.fn().mockReturnValue(JSON.stringify([{ filename: 'sdk.tgz', integrity: 'sha512-matching' }]));
    log = jest.fn();
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('packs dist and publishes the checked tarball publicly with provenance', async () => {
    await expect(publish()).resolves.toBe('published');
    expect(run.mock.calls[0][1]).toEqual([
      'pack',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      expect.any(String),
    ]);
    expect(run.mock.calls[0][2].cwd).toBe(path.join(root, 'dist'));
    expect(run.mock.calls[1][1]).toEqual([
      'publish',
      expect.stringContaining('sdk.tgz'),
      '--access',
      'public',
      '--provenance',
      '--ignore-scripts',
      '--tag',
      'latest',
      '--registry',
      REGISTRY,
    ]);
    expect(fetchMetadata.mock.calls.map(([url]) => url)).toEqual([
      `${REGISTRY}@orca-ae%2Forca-sdk/0.2.2`,
      `${REGISTRY}@orca-ae%2Forca-sdk/latest`,
    ]);
    expect(fs.existsSync(run.mock.calls[0][1][4])).toBe(false);
  });

  it('skips an identical published version without changing latest', async () => {
    fetchMetadata.mockResolvedValueOnce(
      Response.json({ version: pkg.version, dist: { integrity: 'sha512-matching' } }),
    );
    await expect(publish()).resolves.toBe('already-published');
    expect(run).toHaveBeenCalledTimes(1);
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
  });

  it('refuses an existing version with different contents', async () => {
    fetchMetadata.mockResolvedValueOnce(
      Response.json({ version: pkg.version, dist: { integrity: 'sha512-other' } }),
    );
    await expect(publish()).rejects.toThrow(/integrity/);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 429, 500])('does not treat HTTP %s as unpublished', async (status) => {
    fetchMetadata.mockResolvedValueOnce(new Response(null, { status }));
    await expect(publish()).rejects.toThrow(String(status));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('fails closed on network errors', async () => {
    fetchMetadata.mockRejectedValueOnce(new Error('network failure'));
    await expect(publish()).rejects.toThrow('network failure');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('refuses to move latest backwards when retrying an old release', async () => {
    fetchMetadata
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ version: '0.3.0' }));
    await expect(publish()).rejects.toThrow(/latest/);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('compares versions numerically before advancing latest', async () => {
    write('package.json', { ...pkg, version: '0.10.0' });
    write('dist/package.json', { ...pkg, version: '0.10.0' });
    write('.release-please-manifest.json', { '.': '0.10.0' });
    fetchMetadata
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ version: '0.9.0' }));
    await expect(publish('v0.10.0')).resolves.toBe('published');
  });

  it('fails closed if latest is not a stable version', async () => {
    fetchMetadata
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ version: '0.3.0-rc1' }));
    await expect(publish()).rejects.toThrow(/latest/);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each(['main', 'v0.2.2-rc1', 'v00.2.2', 'v0.2.3', '', 'v0.2.2' + String.fromCharCode(10)])(
    'rejects invalid or mismatched tag %j',
    async (tag) => {
      await expect(publish(tag)).rejects.toThrow(/tag/);
      expect(run).not.toHaveBeenCalled();
      expect(fetchMetadata).not.toHaveBeenCalled();
    },
  );

  it.each(['package.json', 'dist/package.json', '.release-please-manifest.json'])(
    'rejects version drift in %s',
    async (file) => {
      write(file, file.startsWith('.') ? { '.': '0.2.1' } : { ...pkg, version: '0.2.1' });
      await expect(publish()).rejects.toThrow(/version|tag/);
      expect(run).not.toHaveBeenCalled();
    },
  );

  it.each([
    { publishConfig: { registry: 'https://npm.pkg.github.com/', access: 'public' } },
    { publishConfig: { registry: REGISTRY, access: 'restricted' } },
    {
      publishConfig: {
        registry: REGISTRY,
        access: 'public',
        '@orca-ae:registry': 'https://npm.pkg.github.com/',
      },
    },
    { repository: { url: 'https://github.com/other/repo.git' } },
    { name: '@other/package' },
    { private: true },
  ])('rejects unsafe package metadata %j', async (override) => {
    write('dist/package.json', { ...pkg, ...override });
    await expect(publish()).rejects.toThrow(/metadata/);
    expect(run).not.toHaveBeenCalled();
  });

  it('propagates publish failure and removes the temporary tarball directory', async () => {
    run
      .mockImplementationOnce(() => JSON.stringify([{ filename: 'sdk.tgz', integrity: 'sha512-matching' }]))
      .mockImplementationOnce(() => {
        throw new Error('publish denied');
      });
    await expect(publish()).rejects.toThrow('publish denied');
    expect(fs.existsSync(run.mock.calls[0][1][4])).toBe(false);
  });
});
