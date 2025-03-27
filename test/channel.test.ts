import { describe, it, expect } from 'vitest';

import { TVLabsChannel } from '../src/channel';

describe('TV Labs Channel', () => {
  it('should be a function', () => {
    expect(TVLabsChannel).toBeInstanceOf(Function);
  });
});
