/**
 * Fire-and-forget mutation helper (shared by Table / Board / Calendar).
 * Swallow provider rejection after the store has recorded mutationError.
 */
export function catchStoreMutation(promise: Promise<unknown>): void {
  void promise.catch(() => undefined);
}
