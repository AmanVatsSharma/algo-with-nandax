import { getErrorMessage } from './error.utils';

describe('getErrorMessage', () => {
  it('returns fallback message for empty input', () => {
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('returns string errors directly', () => {
    expect(getErrorMessage('plain-error')).toBe('plain-error');
  });

  it('returns message from Error object', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns message from unknown object with message field', () => {
    expect(getErrorMessage({ message: 'object-message' })).toBe('object-message');
  });
});
