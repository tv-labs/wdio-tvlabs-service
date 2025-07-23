import { readFileSync } from 'fs';
import { join } from 'path';
import { TVLabsServiceInfo } from './types.js';

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
);

export function getServiceInfo(): TVLabsServiceInfo {
  return {
    service_name: getServiceName(),
    service_version: getServiceVersion(),
  };
}

export function getServiceVersion(): string {
  return packageJson.version;
}

export function getServiceName(): string {
  return packageJson.name;
}
