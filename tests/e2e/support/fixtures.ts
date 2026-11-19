import { randomInt, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { test as base, expect, type Page } from '@playwright/test';

export type Account = { id: string; name: string; email: string; password: string; phone: string };
type AccountFactory = (worker?: boolean) => Promise<Account>;

export const test = base.extend<
  { account: Account; signedInPage: Page; pageErrors: void },
  { database: PrismaClient; createAccount: AccountFactory }
>({
  database: [
    async ({ browserName }, use) => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/red_e2e') {
        throw new Error(
          `La suite ${browserName} requiere la base temporal creada por pnpm test:e2e.`,
        );
      }
      const prisma = new PrismaClient();
      try {
        await use(prisma);
      } finally {
        await prisma.$disconnect();
      }
    },
    { scope: 'worker' },
  ],
  createAccount: [
    async ({ database }, use) => {
      const password = 'PruebaLocal123';
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const documents = await database.legalDocument.findMany();
      await use(async (worker = false) => {
        const id = randomUUID();
        const zone = worker
          ? await database.zone.create({ data: { name: `Zona E2E ${id}` } })
          : null;
        const user = await database.user.create({
          data: {
            id,
            name: `Persona E2E ${id.slice(0, 8)}`,
            email: `${id}@example.test`,
            phone: '3000000000',
            passwordHash,
            status: 'ACTIVE',
            ageConfirmedAt: new Date(),
            emailConfirmedAt: new Date(),
            consents: {
              create: documents.map((doc) => ({ legalDocumentId: doc.id, ip: '127.0.0.1' })),
            },
            ...(zone && {
              workerProfile: {
                create: {
                  displayName: 'Trabajador E2E',
                  photoUrl: 'https://example.test/foto.png',
                  skills: ['Servicios'],
                  zoneId: zone.id,
                },
              },
            }),
          },
        });
        return { id: user.id, name: user.name, email: user.email, phone: user.phone, password };
      });
    },
    { scope: 'worker' },
  ],
  account: async ({ createAccount }, use) => {
    await use(await createAccount());
  },
  // IP sintética por contexto para separar clientes en el limitador local de main.
  extraHTTPHeaders: async ({ browserName }, use) => {
    expect(browserName).toBe('chromium');
    await use({ 'x-forwarded-for': `198.18.${randomInt(0, 256)}.${randomInt(1, 255)}` });
  },
  signedInPage: async ({ page, account }, use) => {
    await login(page, account);
    await use(page);
  },
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use();
      expect(errors, 'Errores JavaScript en el navegador').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

export async function login(page: Page, account: Account) {
  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(account.email);
  await page.getByLabel('Contraseña').fill(account.password);
  const response = page.waitForResponse(
    (value) => value.url().endsWith('/v1/auth/login') && value.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(new URL('/', page.url()).href);
  await expect(page.getByRole('heading', { name: '¿Qué quieres hacer hoy?' })).toBeVisible();
  await expect(page.getByText('Hola, Persona.', { exact: false })).toBeVisible();
}
