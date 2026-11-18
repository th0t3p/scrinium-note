import _sodium from 'libsodium-wrappers-sumo';

export type Sodium = typeof _sodium;

let readyPromise: Promise<Sodium> | null = null;

/** Await libsodium's WebAssembly initialization, then return the sodium API. */
export function ensureSodium(): Promise<Sodium> {
  if (!readyPromise) {
    readyPromise = _sodium.ready.then(() => _sodium);
  }
  return readyPromise;
}
