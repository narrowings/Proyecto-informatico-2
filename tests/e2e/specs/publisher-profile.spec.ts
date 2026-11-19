import { test, expect, login } from '../support/fixtures.ts';
import {
  createPublisher,
  createURL,
  fillPublisher,
  openForm,
  photo,
  publisher,
  savePublisher,
} from '../support/publisher.ts';

for (const kind of ['PERSON', 'COMPANY'] as const) {
  test(`${kind === 'PERSON' ? 'CP-008-01' : 'CP-008-02'} crea ${kind}, persiste y habilita el acceso a publicar`, async ({
    signedInPage: page,
    account,
    database,
  }) => {
    const details = publisher(kind);
    const profile = await createPublisher(page, details);
    const stored = await database.publisherProfile.findUniqueOrThrow({
      where: { userId: account.id },
      include: { photo: true },
    });
    expect(stored).toMatchObject({
      id: profile.id,
      kind,
      displayName: details.displayName,
      description: details.description,
      isVerified: false,
    });
    expect(Buffer.from(stored.photo!.content)).toEqual(photo.buffer);
    if (kind === 'COMPANY')
      expect(stored).toMatchObject({
        nit: details.nit,
        nitCheckDigit: details.nitCheckDigit,
        contactName: details.contactName,
        sector: details.sector,
      });
    else expect(stored).toMatchObject({ nit: null, contactName: null, sector: null });

    await page.getByRole('link', { name: 'Continuar para publicar' }).click();
    await expect(page.getByRole('heading', { name: 'Publicar una necesidad' })).toBeVisible();
    const refreshed = page.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/auth/refresh') && response.request().method() === 'POST',
    );
    await page.reload();
    expect((await refreshed).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Publicar una necesidad' })).toBeVisible();

    await page.goto('/mi-actividad');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/iniciar-sesion$/);
    await login(page, account);
    await page.goto('/perfil/publicador');
    await expect(
      page.getByRole('heading', { name: 'Ya tienes perfil de publicador' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver perfil público' })).toHaveAttribute(
      'href',
      `/publicadores/${profile.id}`,
    );
    expect(await database.publisherProfile.count({ where: { userId: account.id } })).toBe(1);
  });
}

test('CP-008-06 redirige al formulario cuando no existe perfil y conserva la restricción al abandonarlo', async ({
  signedInPage: page,
  account,
  database,
}) => {
  await openForm(page);
  await page.getByLabel('Descripción', { exact: true }).fill('Perfil todavía sin guardar');
  await page.goto('/publicar');
  await expect(page).toHaveURL(/\/perfil\/publicador$/);
  await expect(page.getByLabel('Tipo de perfil')).toBeVisible();
  expect(await database.publisherProfile.count({ where: { userId: account.id } })).toBe(0);
});

test('la sesión es obligatoria para crear el perfil y acceder a publicar', async ({
  page,
  request,
}) => {
  for (const route of ['/perfil/publicador', '/publicar']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/iniciar-sesion$/);
  }
  const response = await request.post(createURL());
  expect(response.status()).toBe(401);
});

test('las credenciales incorrectas muestran el error y permiten iniciar sesión después', async ({
  page,
  account,
}) => {
  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(account.email);
  await page.getByLabel('Contraseña').fill('Incorrecta123');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Correo o contraseña incorrectos',
  );
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
  await login(page, account);
});

test('cerrar sesión revoca el acceso y bloquea la restauración al recargar', async ({
  signedInPage: page,
}) => {
  await page.goto('/mi-actividad');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
  await page.goto('/publicar');
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
});

test('rechaza el NIT usado por otra empresa y permite corregirlo', async ({
  signedInPage: page,
  browser,
  createAccount,
  account,
  database,
}) => {
  const details = publisher('COMPANY');
  await createPublisher(page, details);
  const second = await createAccount();
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    extraHTTPHeaders: { 'x-forwarded-for': '198.19.0.1' },
  });
  try {
    const other = await context.newPage();
    await login(other, second);
    await openForm(other);
    await fillPublisher(other, details);
    const pending = other.waitForResponse(
      (response) => response.url() === createURL() && response.request().method() === 'POST',
    );
    await other.getByRole('button', { name: 'Guardar perfil' }).click();
    expect((await pending).status()).toBe(409);
    await expect(other.getByText('Ya existe una empresa registrada con este NIT.')).toBeVisible();
    await expect(other.getByLabel('NIT', { exact: true })).toBeFocused();
    expect(await database.publisherProfile.count({ where: { userId: second.id } })).toBe(0);
    const corrected = publisher('COMPANY');
    await other.getByLabel('NIT', { exact: true }).fill(corrected.nit);
    await other.getByLabel('Dígito de verificación').fill(corrected.nitCheckDigit);
    await savePublisher(other);
    expect(
      await database.publisherProfile.count({ where: { userId: { in: [account.id, second.id] } } }),
    ).toBe(2);
  } finally {
    await context.close();
  }
});

test('dos formularios de la misma cuenta conservan un único perfil y enlazan al existente', async ({
  signedInPage: page,
  context,
  account,
  database,
}) => {
  await openForm(page);
  await fillPublisher(page, publisher());
  const other = await context.newPage();
  await other.goto('/perfil/publicador');
  await fillPublisher(other, publisher());
  const profile = await savePublisher(page);
  const pending = other.waitForResponse(
    (response) => response.url() === createURL() && response.request().method() === 'POST',
  );
  await other.getByRole('button', { name: 'Guardar perfil' }).click();
  expect((await pending).status()).toBe(409);
  await expect(
    other.getByRole('heading', { name: 'Ya tienes perfil de publicador' }),
  ).toBeVisible();
  await expect(other.getByRole('link', { name: 'Ver perfil público' })).toHaveAttribute(
    'href',
    `/publicadores/${profile.id}`,
  );
  expect(await database.publisherProfile.count({ where: { userId: account.id } })).toBe(1);
});

test('restaura la cookie desde dos pestañas sin invalidar la sesión', async ({
  signedInPage: page,
  context,
}) => {
  const second = await context.newPage();
  await Promise.all([page.reload(), second.goto('/')]);
  // El título se renderiza antes de consultar /auth/me. El saludo confirma que
  // terminó la renovación, antes de iniciar otra navegación en esa pestaña.
  for (const tab of [page, second])
    await expect(tab.getByText('Hola, Persona.', { exact: false })).toBeVisible();
  await second.goto('/publicar');
  await expect(second).toHaveURL(/\/perfil\/publicador$/);
});
