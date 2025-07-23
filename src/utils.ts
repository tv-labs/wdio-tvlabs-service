import { readFileSync } from 'fs';
import { join } from 'path';

export function getServiceVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    );

    return packageJson.version;
  } catch {
    return 'unknown';
  }
}
