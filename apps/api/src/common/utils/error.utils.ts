/**
 * Extracts a safe human-readable message from unknown errors.
 * Keeps API error handling robust and avoids unsafe casts in catch blocks.
 */
export const getErrorMessage = (
  error: unknown,
  fallbackMessage: string = 'Unexpected error occurred',
): string => {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
};
