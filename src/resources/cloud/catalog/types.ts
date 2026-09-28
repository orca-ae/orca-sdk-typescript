// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

export interface ConfigFieldDefinition {
  fieldName?: string;
  typeName?: string;
  attributes?: Record<string, string>;
}

export interface ConnectorDefinition {
  name?: string;
  description?: string;
  sourceClass?: string;
  sinkClass?: string;
  sourceConfigClass?: string;
  sinkConfigClass?: string;
}
