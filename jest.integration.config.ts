// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[cm]?(t|j)sx?$': ['@swc/jest', {}],
  },
  testMatch: ['<rootDir>/tests/integration/**/*.int.test.ts'],
  testPathIgnorePatterns: [],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  moduleNameMapper: {
    '^@runorca/orca-sdk$': '<rootDir>/src/index.ts',
    '^@runorca/orca-sdk/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  passWithNoTests: true,
  testTimeout: 60_000,
};

export default config;
