import { createHash, randomBytes } from 'node:crypto';

// Los tokens de un solo uso viajan en el enlace; en la base de datos solo queda su SHA-256.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const createToken = () => {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
};
