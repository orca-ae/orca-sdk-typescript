// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REGISTRY = 'https://registry.npmjs.org/';
const PACKAGE = '@orca-ae/orca-sdk';
const REPOSITORY = 'https://github.com/orca-ae/orca-sdk-typescript.git';
const STABLE_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function isStable(version) {
  return typeof version === 'string' && version.trim() === version && STABLE_VERSION.test(version);
}

async function publishRelease({
  root = path.resolve(__dirname, '../..'),
  tag = process.env.RELEASE_TAG,
  fetchMetadata = globalThis.fetch,
  run = execFileSync,
  log = console.log,
} = {}) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const pkg = read('package.json');
  const dist = read('dist/package.json');
  if (!isStable(pkg.version) || tag !== 'v' + pkg.version) {
    throw new Error('Release tag must match the stable package.json version');
  }
  if (dist.version !== pkg.version || read('.release-please-manifest.json')['.'] !== pkg.version) {
    throw new Error('Release version differs between package.json, dist and the release manifest');
  }
  for (const metadata of [pkg, dist]) {
    if (
      metadata.name !== PACKAGE ||
      metadata.private ||
      metadata.repository?.url !== REPOSITORY ||
      metadata.publishConfig?.registry !== REGISTRY ||
      metadata.publishConfig?.access !== 'public' ||
      metadata.publishConfig?.['@orca-ae:registry'] !== undefined
    ) {
      throw new Error('Unsafe package metadata: expected public npmjs.org package and canonical repository');
    }
  }

  async function getVersion(version) {
    const response = await fetchMetadata(REGISTRY + PACKAGE.replace('/', '%2F') + '/' + version, {
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('npm registry lookup failed: HTTP ' + response.status);
    const metadata = await response.json();
    if (!isStable(metadata.version)) throw new Error('Invalid registry version for ' + version);
    return metadata;
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-release-'));
  try {
    // Pack once, check that exact artifact, then publish it without lifecycle hooks.
    const [packed] = JSON.parse(
      run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp], {
        cwd: path.join(root, 'dist'),
        encoding: 'utf8',
      }),
    );
    if (!packed?.integrity || !packed.filename || path.basename(packed.filename) !== packed.filename) {
      throw new Error('Invalid npm pack output');
    }

    const existing = await getVersion(pkg.version);
    if (existing) {
      if (existing.version !== pkg.version || existing.dist?.integrity !== packed.integrity) {
        throw new Error('Published version integrity differs; do not overwrite it. Release a new version.');
      }
      log(PACKAGE + '@' + pkg.version + ' already published with matching integrity; skipping.');
      return 'already-published';
    }

    const latest = await getVersion('latest');
    if (latest) {
      const currentParts = pkg.version.split('.').map(BigInt);
      const latestParts = latest.version.split('.').map(BigInt);
      const different = currentParts.findIndex((part, index) => part !== latestParts[index]);
      if (different >= 0 && currentParts[different] < latestParts[different]) {
        throw new Error('Refusing to move npm latest backwards from ' + latest.version);
      }
    }

    run(
      'npm',
      [
        'publish',
        path.join(temp, packed.filename),
        '--access',
        'public',
        '--provenance',
        '--ignore-scripts',
        '--tag',
        'latest',
        '--registry',
        REGISTRY,
      ],
      { cwd: root, stdio: 'inherit' },
    );
    return 'published';
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

module.exports = { publishRelease };

if (require.main === module) {
  publishRelease().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
