import { Buffer } from 'node:buffer';
import { randomInt } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export const apiURL = () => process.env.E2E_API_URL!;
export const createURL = () => `${apiURL()}/v1/profiles/publisher/with-photo`;

// PNG válido de un píxel. Se comprueban sus bytes después de guardarlo en la API.
export const photo = {
  name: 'perfil.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZXkAAAAASUVORK5CYII=',
    'base64',
  ),
};

export function publisher(kind: 'PERSON' | 'COMPANY' = 'PERSON') {
  const nit = String(randomInt(100_000_000, 999_999_999));
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41];
  const remainder =
    [...nit].reverse().reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0) % 11;
  return {
    kind,
    displayName: kind === 'PERSON' ? 'Publicador de Cali' : 'Empresa de Cali',
    description: 'Servicios y apoyo a la comunidad de Cali.',
    nit,
    nitCheckDigit: String(remainder > 1 ? 11 - remainder : remainder),
    contactName: 'Representante privado de prueba',
    sector: 'Transporte',
  };
}
export type Publisher = ReturnType<typeof publisher>;

export async function openForm(page: Page) {
  await page.getByRole('link', { name: /Necesito ayuda/ }).click();
  await expect(page).toHaveURL(/\/perfil\/publicador$/);
  await expect(page.getByLabel('Tipo de perfil')).toBeVisible();
}

export async function fillPublisher(page: Page, details: Publisher) {
  await page.getByLabel('Tipo de perfil').selectOption(details.kind);
  await page
    .getByLabel(details.kind === 'PERSON' ? 'Nombre' : 'Razón social', { exact: true })
    .fill(details.displayName);
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByLabel('Descripción', { exact: true }).fill(details.description);
  if (details.kind === 'COMPANY') {
    await page.getByLabel('NIT', { exact: true }).fill(details.nit);
    await page.getByLabel('Dígito de verificación').fill(details.nitCheckDigit);
    await page.getByLabel('Contacto o representante').fill(details.contactName);
    await page.getByLabel('Sector', { exact: true }).fill(details.sector);
  }
}

export async function savePublisher(page: Page) {
  const pending = page.waitForResponse(
    (response) => response.url() === createURL() && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click();
  const response = await pending;
  expect(response.status(), await response.text()).toBe(201);
  const profile = (await response.json()) as { id: string; photoUrl: string; isVerified: boolean };
  await expect(page.getByRole('link', { name: 'Ver perfil público' })).toHaveAttribute(
    'href',
    `/publicadores/${profile.id}`,
  );
  return profile;
}

export async function createPublisher(page: Page, details = publisher()) {
  await openForm(page);
  await fillPublisher(page, details);
  return savePublisher(page);
}
