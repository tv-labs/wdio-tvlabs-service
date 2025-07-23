import { join } from 'path';
import { getServiceVersion } from '../src/utils.js';
import { promises as fs } from 'fs';

describe('TV Labs Utils', () => {
  it('can get the service version', async () => {
    const packageJson = await fs.readFile(
      join(__dirname, '..', 'package.json'),
      'utf8',
    );
    const packageObject = JSON.parse(packageJson);

    const version = getServiceVersion();

    expect(version).not.toBe('unknown');
    expect(version).toBe(packageObject.version);
  });
});
