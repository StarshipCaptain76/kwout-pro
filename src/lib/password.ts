/** Generate uniformly selected characters with Web Crypto, never Math.random. */
export function randomPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const limit = 256 - (256 % chars.length);
  let password = "";
  const bytes = new Uint8Array(32);
  while (password.length < 16) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      password += chars[byte % chars.length];
      if (password.length === 16) break;
    }
  }
  return password;
}