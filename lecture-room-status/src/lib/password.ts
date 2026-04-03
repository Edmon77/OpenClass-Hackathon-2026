import * as Crypto from 'expo-crypto';

const SALT = 'lecture-room-status-v1';

export async function hashPassword(plain: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${SALT}:${plain}`
  );
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const h = await hashPassword(plain);
  return h === hash;
}
