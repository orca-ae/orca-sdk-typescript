// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const target = path.join(root, 'src/version.ts');
const source = `// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

// Generated from package.json by scripts/utils/sync-version.cjs.
export const VERSION = ${JSON.stringify(version)}; // x-release-please-version
`;

// Avoid changing timestamps when lint, test and build run against the same version.
if (fs.readFileSync(target, 'utf8') !== source) {
  fs.writeFileSync(target, source);
}
