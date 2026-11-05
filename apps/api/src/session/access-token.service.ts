import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, SignJWT } from 'jose';
import { ACCESS_TTL_SECONDS, TOKEN_ISSUER } from './session.constants';

const MIN_SECRET_LENGTH = 32;

@Injectable()
export class AccessTokenService {
  private readonly key: Uint8Array;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
    }
    this.key = new TextEncoder().encode(secret);
  }

  async sign(userId: string) {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.key);
    return { token, expiresIn: ACCESS_TTL_SECONDS };
  }

  // Devuelve el id del usuario, o null si el token es inválido, está manipulado o venció.
  async verify(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: TOKEN_ISSUER,
        algorithms: ['HS256'],
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}