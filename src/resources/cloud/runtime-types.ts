// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

export interface RuntimeResources {
  cpu?: number;
  ram?: number;
  disk?: number;
}

export interface CryptoConfig {
  cryptoKeyReaderClassName?: string;
  cryptoKeyReaderConfig?: Record<string, Record<string, unknown>>;
  encryptionKeys?: string[];
  producerCryptoFailureAction?: 'FAIL' | 'SEND';
  consumerCryptoFailureAction?: 'FAIL' | 'DISCARD' | 'CONSUME';
}

export interface MessagePayloadProcessorConfig {
  className?: string;
  config?: Record<string, Record<string, unknown>>;
}

export interface ConsumerConfig {
  schemaType?: string;
  serdeClassName?: string;
  schemaProperties?: Record<string, string>;
  consumerProperties?: Record<string, string>;
  receiverQueueSize?: number;
  cryptoConfig?: CryptoConfig;
  messagePayloadProcessorConfig?: MessagePayloadProcessorConfig;
  poolMessages?: boolean;
  regexPattern?: boolean;
}

export interface BatchingConfig {
  enabled?: boolean;
  batchingMaxPublishDelayMs?: number;
  roundRobinRouterBatchingPartitionSwitchFrequency?: number;
  batchingMaxMessages?: number;
  batchingMaxBytes?: number;
  batchBuilder?: string;
}

export interface ProducerConfig {
  maxPendingMessages?: number;
  maxPendingMessagesAcrossPartitions?: number;
  useThreadLocalProducers?: boolean;
  cryptoConfig?: CryptoConfig;
  batchBuilder?: string;
  compressionType?: 'NONE' | 'LZ4' | 'ZLIB' | 'ZSTD' | 'SNAPPY';
  batchingConfig?: BatchingConfig;
}

export interface RuntimeUpdateOptions {
  /** Whether to update stored authentication data. */
  'update-auth-data'?: boolean;
}

export interface RuntimeExceptionInformation {
  exceptionString?: string;
  timestampMs?: number;
}
