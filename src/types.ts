import type { Capabilities } from '@wdio/types';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export type TVLabsServiceOptions = {
  apiKey: string;
  endpoint?: string;
  retries?: number;
  reconnectRetries?: number;
  attachRequestId?: boolean;
};

export type TVLabsCapabilities =
  Capabilities.RequestedStandaloneCapabilities & {
    'tvlabs:session_id'?: string;
    'tvlabs:build'?: string;
    'tvlabs:constraints'?: {
      platform_key?: string;
      device_type?: string;
      make?: string;
      model?: string;
      year?: string;
      minimum_chromedriver_major_version?: number;
      supports_chromedriver?: boolean;
    };
    'tvlabs:match_timeout'?: number;
    'tvlabs:device_timeout'?: number;
  };

export type TVLabsSessionRequestEventHandler = (
  response: TVLabsSessionRequestUpdate,
) => void;

export type TVLabsSessionRequestUpdate = {
  request_id: string;
  session_id: string;
  reason: string;
};

export type TVLabsSessionRequestResponse = {
  request_id: string;
};

export type TVLabsSocketParams = TVLabsServiceInfo & {
  api_key: string;
};

export type TVLabsServiceInfo = {
  service_version: string;
  service_name: string;
};
