import { randomUUID } from 'node:crypto';
import { test, expect, login } from '../support/fixtures.ts';
import { apiURL, createPublisher, photo, publisher } from '../support/publisher.ts';

for (const kind of ['PERSON', 'COMPANY'] as const) {
  test(`${kind === 'PERSON' ? 'CP-008-03' : 'CP-008-04'} y CP-008-05 muestran ${kind} al trabajador y protegen los datos privados`, async ({
    signedInPage: page,
    browser,
    createAccount,
    account,
  }) => {
    const details = publisher(kind);
    const profile = await createPublisher(page, details);
    const worker = await createAccount(true);
    const workerContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      extraHTTPHeaders: { 'x-forwarded-for': '198.19.1.1' },
    });
    const guest = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const workerPage = await workerContext.newPage();
      await login(workerPage, worker);
      await workerPage.goto(`/publicadores/${profile.id}`);
      await expect(workerPage.getByRole('heading', { name: details.displayName })).toBeVisible();
      await expect(workerPage.getByText(details.description, { exact: true })).toBeVisible();
      await expect(workerPage.getByText('Nuevo en la plataforma')).toBeVisible();
      await expect(workerPage.getByText('Identidad verificada')).toHaveCount(0);
      const image = workerPage.getByRole('img', {
        name: `${kind === 'PERSON' ? 'Foto' : 'Logo'} de ${details.displayName}`,
      });
      await expect(image).toBeVisible();
      await expect(image).toHaveJSProperty('naturalWidth', 1);
      if (kind === 'COMPANY')
        await expect(workerPage.getByText(`Sector: ${details.sector}`)).toBeVisible();
      for (const privateValue of [account.email, account.phone, details.contactName, details.nit]) {
        await expect(workerPage.getByText(privateValue, { exact: false })).toHaveCount(0);
      }
      const response = await guest.request.get(`${apiURL()}/v1/profiles/publisher/${profile.id}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Object.keys(body).sort()).toEqual(
        [
          'id',
          'kind',
          'displayName',
          'photoUrl',
          'description',
          'sector',
          'isVerified',
          'reputation',
        ].sort(),
      );
      const media = await guest.request.get(new URL(body.photoUrl, apiURL()).href);
      expect(media.status()).toBe(200);
      expect(media.headers()['content-type']).toBe('image/png');
      expect(media.headers()['x-content-type-options']).toBe('nosniff');
      expect(await media.body()).toEqual(photo.buffer);
      const guestPage = await guest.newPage();
      await guestPage.goto(`/publicadores/${profile.id}`);
      await expect(guestPage.getByRole('heading', { name: details.displayName })).toBeVisible();
      await guestPage.reload();
      await expect(guestPage.getByRole('heading', { name: details.displayName })).toBeVisible();
    } finally {
      await workerContext.close();
      await guest.close();
    }
  });
}

for (const id of [randomUUID(), 'identificador-invalido']) {
  test(`informa que el perfil ${id.length === 36 ? 'ausente' : 'inválido'} no existe`, async ({
    page,
  }) => {
    await page.goto(`/publicadores/${id}`);
    await expect(page.getByRole('heading', { name: 'Perfil no encontrado' })).toBeVisible();
  });
}

test('muestra la insignia únicamente cuando la API registra la verificación', async ({
  signedInPage: page,
  database,
}) => {
  const details = publisher();
  const profile = await createPublisher(page, details);
  await database.publisherProfile.update({ where: { id: profile.id }, data: { isVerified: true } });
  await page.goto(`/publicadores/${profile.id}`);
  await expect(page.getByText('Identidad verificada')).toBeVisible();
});

test('un fallo del servicio público muestra un error de carga', async ({ page }) => {
  const id = randomUUID();
  await page.route(`${apiURL()}/v1/profiles/publisher/${id}`, (route) =>
    route.fulfill({ status: 503, json: { message: 'Servicio no disponible' } }),
  );
  await page.goto(`/publicadores/${id}`);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'No pudimos cargar el perfil. Inténtalo de nuevo.',
  );
  await expect(page.getByRole('heading', { name: 'Perfil no encontrado' })).toHaveCount(0);
});
