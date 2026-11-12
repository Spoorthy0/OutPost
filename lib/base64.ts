// Yjs updates are binary; Realtime messages and Server Action arguments need plain strings.
// Converted in chunks: one String.fromCharCode call per 32 KB instead of one string append per
// byte, which matters for whole-doc states sent on every save. Chunks stay well under the
// engine's argument-count limit.
const CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
