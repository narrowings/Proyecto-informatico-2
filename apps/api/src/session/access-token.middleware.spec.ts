import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { AccessTokenMiddleware } from './access-token.middleware';
import type { AccessTokenService } from './access-token.service';

const run = async (authorization: string | undefined, userId: string | null) => {
  const tokens = { verify: vi.fn().mockResolvedValue(userId) };
  const middleware = new AccessTokenMiddleware(tokens as unknown as AccessTokenService);
  const request = { headers: { authorization } } as unknown as AuthenticatedRequest;
  const next = vi.fn();
  await middleware.use(request, {} as Response, next);
  return { request, tokens, next };
};

describe('AccessTokenMiddleware', () => {
  it('con un token válido llena request.user', async () => {
    const { request, tokens, next } = await run('Bearer abc', 'u1');

    expect(tokens.verify).toHaveBeenCalledWith('abc');
    expect(request.user).toEqual({ id: 'u1' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('con un token inválido deja request.user vacío y sigue', async () => {
    const { request, next } = await run('Bearer malo', null);

    expect(request.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('sin cabecera Authorization no consulta nada', async () => {
    const { request, tokens, next } = await run(undefined, 'u1');

    expect(tokens.verify).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});