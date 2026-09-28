// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[cm]?(t|j)sx?$': ['@swc/jest', {}],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/integration'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  moduleNameMapper: {
    '^@orca-ae/orca-sdk$': '<rootDir>/src/index.ts',
    '^@orca-ae/orca-sdk/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  passWithNoTests: true,
  collectCoverage: false,
  coverageDirectory: 'coverage',
};

export default config;
