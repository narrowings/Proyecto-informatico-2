import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySecurityHeaders } from './security-headers';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('Cabeceras de seguridad (auditoría, hallazgo bajo)', () => {
  let app: INestApplication;
  let url: string;

  beforeEach(async () => {
    @Module({ controllers: [PingController] })
    class TestModule {}
    const nest = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
    applySecurityHeaders(nest);
    await nest.listen(0, '127.0.0.1');
    app = nest;
    url = `${await nest.getUrl()}/ping`;
  });

  afterEach(() => app.close());

  it('no revela la tecnología y agrega las cabeceras de protección', async () => {
    const response = await fetch(url);
    expect(response.headers.get('x-powered-by')).toBeNull();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=');
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('las fotos se pueden mostrar desde la web del mismo sitio (otro puerto o subdominio)', async () => {
    const response = await fetch(url);
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-site');
  });
});
