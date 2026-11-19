import { Buffer } from 'node:buffer';
import { test, expect } from '../support/fixtures.ts';
import {
  apiURL,
  createURL,
  fillPublisher,
  openForm,
  photo,
  publisher,
  savePublisher,
} from '../support/publisher.ts';

for (const kind of ['PERSON', 'COMPANY'] as const) {
  test(`exige los campos obligatorios de ${kind} y enfoca el primero`, async ({
    signedInPage: page,
    account,
    database,
  }) => {
    await openForm(page);
    await page.getByLabel('Tipo de perfil').selectOption(kind);
    await page.getByLabel(kind === 'PERSON' ? 'Nombre' : 'Razón social', { exact: true }).clear();
    let submitted = 0;
    page.on('request', (request) => {
      if (request.url() === createURL() && request.method() === 'POST') submitted++;
    });
    await page.getByRole('button', { name: 'Guardar perfil' }).click();
    await expect(page.locator('input[type=file]')).toBeFocused();
    await expect(page.getByText('Agrega una foto de perfil.')).toBeVisible();
    await expect(page.getByText('Ingresa el nombre o razón social.')).toBeVisible();
    await expect(page.getByText('Describe tu actividad.')).toBeVisible();
    if (kind === 'COMPANY') {
      await expect(page.getByLabel('NIT', { exact: true })).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText('Ingresa el nombre del contacto o representante.')).toBeVisible();
      await expect(page.getByText('Ingresa el sector de la empresa.')).toBeVisible();
    }
    expect(submitted).toBe(0);
    expect(await database.publisherProfile.count({ where: { userId: account.id } })).toBe(0);
  });
}

test('valida el formato y el dígito del NIT antes de enviarlo', async ({ signedInPage: page }) => {
  await openForm(page);
  await fillPublisher(page, { ...publisher('COMPANY'), nit: '800197268', nitCheckDigit: '3' });
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByText('El dígito de verificación no corresponde al NIT.')).toBeVisible();
  await page.getByLabel('NIT', { exact: true }).fill('12345');
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByLabel('NIT', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  const corrected = publisher('COMPANY');
  await page.getByLabel('NIT', { exact: true }).fill(corrected.nit);
  await page.getByLabel('Dígito de verificación').fill(corrected.nitCheckDigit);
  await savePublisher(page);
});

for (const invalid of [
  {
    name: 'archivo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
    message: 'La foto debe ser JPG, PNG o WebP.',
  },
  {
    name: 'grande.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    message: 'La foto no puede pesar más de 5 MB.',
  },
]) {
  test(`rechaza ${invalid.name} en el navegador`, async ({ signedInPage: page }) => {
    await openForm(page);
    await fillPublisher(page, publisher());
    await page.locator('input[type=file]').setInputFiles(invalid);
    await page.getByRole('button', { name: 'Guardar perfil' }).click();
    await expect(page.getByText(invalid.message)).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveAttribute('aria-invalid', 'true');
    await page.locator('input[type=file]').setInputFiles(photo);
    await savePublisher(page);
  });
}

test('acepta una imagen de exactamente 5 MB y conserva todos sus bytes', async ({
  signedInPage: page,
  database,
}) => {
  await openForm(page);
  await fillPublisher(page, publisher());
  const content = Buffer.alloc(5 * 1024 * 1024);
  photo.buffer.copy(content);
  await page.locator('input[type=file]').setInputFiles({ ...photo, buffer: content });
  const profile = await savePublisher(page);
  const stored = await database.publisherPhoto.findUniqueOrThrow({
    where: { profileId: profile.id },
  });
  expect(Buffer.from(stored.content)).toEqual(content);
});

for (const format of ['jpeg', 'webp'] as const) {
  test(`guarda y muestra una imagen ${format}`, async ({ signedInPage: page }) => {
    await openForm(page);
    await fillPublisher(page, publisher());
    const dataURL = await page.evaluate((type) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL(`image/${type}`);
    }, format);
    const content = Buffer.from(dataURL.split(',')[1], 'base64');
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: `perfil.${format}`, mimeType: `image/${format}`, buffer: content });
    const profile = await savePublisher(page);
    const response = await page.request.get(new URL(profile.photoUrl, apiURL()).href);
    expect(response.headers()['content-type']).toBe(`image/${format}`);
    expect(await response.body()).toEqual(content);
    await page.getByRole('link', { name: 'Ver perfil público' }).click();
    await expect(page.locator('article').getByRole('img')).toHaveJSProperty('naturalWidth', 1);
  });
}

test('la API rechaza un archivo que aparenta ser PNG y permite reemplazarlo', async ({
  signedInPage: page,
  account,
  database,
}) => {
  await openForm(page);
  const details = publisher();
  await fillPublisher(page, details);
  await page.locator('input[type=file]').setInputFiles({
    name: 'falso.png',
    mimeType: 'image/png',
    buffer: Buffer.from('contenido sin imagen'),
  });
  const pending = page.waitForResponse(
    (response) => response.url() === createURL() && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  expect((await pending).status()).toBe(400);
  await expect(page.getByText('Selecciona una imagen JPG, PNG o WebP válida.')).toBeVisible();
  expect(await database.publisherProfile.count({ where: { userId: account.id } })).toBe(0);
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(details.description);
  await page.locator('input[type=file]').setInputFiles(photo);
  await savePublisher(page);
});

test('conserva los datos tras una respuesta 503 y permite reintentar', async ({
  signedInPage: page,
}) => {
  await openForm(page);
  const details = publisher('COMPANY');
  await fillPublisher(page, details);
  await page.route(createURL(), async (route) => {
    if (route.request().method() === 'OPTIONS') await route.continue();
    else await route.fulfill({ status: 503, json: { message: 'Servicio no disponible' } });
  });
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'No pudimos guardar tu perfil. Inténtalo de nuevo.',
  );
  await expect(page.getByLabel('Razón social')).toHaveValue(details.displayName);
  await expect(page.getByLabel('NIT', { exact: true })).toHaveValue(details.nit);
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(details.description);
  await page.unroute(createURL());
  await savePublisher(page);
});

test('bloquea el formulario durante el envío y evita enviar dos veces', async ({
  signedInPage: page,
  account,
  database,
}) => {
  await openForm(page);
  await fillPublisher(page, publisher());
  let release: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submitted = 0;
  await page.route(createURL(), async (route) => {
    if (route.request().method() === 'POST') {
      submitted++;
      await waiting;
    }
    await route.continue();
  });
  const button = page.getByRole('button', { name: 'Guardar perfil' });
  await button.click();
  try {
    await expect(page.getByRole('button', { name: 'Guardando…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.getByLabel('Tipo de perfil')).toBeDisabled();
    await page.getByRole('button', { name: 'Guardando…' }).dispatchEvent('click');
    expect(submitted).toBeLessThanOrEqual(1);
  } finally {
    release();
  }
  await expect(page.getByRole('link', { name: 'Ver perfil público' })).toBeVisible();
  expect(submitted).toBe(1);
  expect(await database.publisherProfile.count({ where: { userId: account.id } })).toBe(1);
});
