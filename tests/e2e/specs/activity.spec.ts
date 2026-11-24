import type { APIRequestContext } from '@playwright/test';
import type { PrismaClient } from '@prisma/client';
import { test, expect, login, type Account } from '../support/fixtures.ts';

const api = process.env.E2E_API_URL + '/v1';
async function headersFor(request: APIRequestContext, account: Account) {
  const result = await request.post(api + '/auth/login', {
    data: { email: account.email, password: account.password },
  });
  expect(result.ok()).toBe(true);
  const { accessToken } = await result.json();
  return { Authorization: 'Bearer ' + accessToken };
}

// Publicar y postularse corresponden a la otra área del frontend. Usamos sus endpoints reales.
async function opportunityWithApplicant(
  database: PrismaClient,
  request: APIRequestContext,
  account: Account,
  worker: Account,
  fields: object,
) {
  await database.publisherProfile.create({
    data: {
      userId: account.id,
      kind: 'PERSON',
      displayName: account.name,
      description: 'Publicador de prueba',
      photoUrl: '/foto.png',
    },
  });
  const category = await database.category.findFirstOrThrow({ where: { isActive: true } });
  const zone = await database.zone.findFirstOrThrow({ where: { isActive: true } });
  const created = await request.post(api + '/opportunities', {
    headers: await headersFor(request, account),
    data: {
      categoryId: category.id,
      zoneId: zone.id,
      ...fields,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  expect(
    (
      await request.post(api + '/opportunities/' + id + '/applications', {
        headers: await headersFor(request, worker),
        data: {},
      })
    ).status(),
  ).toBe(201);
  return id as string;
}

test('dos personas seleccionan, aceptan, finalizan y califican desde Mi actividad', async ({
  signedInPage: publisher,
  account,
  createAccount,
  browser,
  request,
  database,
  baseURL,
  extraHTTPHeaders,
}) => {
  const worker = await createAccount(true);
  const title = 'Organizar el archivo del barrio';
  const id = await opportunityWithApplicant(database, request, account, worker, {
    title,
    type: 'TASK',
    description: 'Organizar las carpetas de la biblioteca.',
    conditions: 'Traer un cuaderno',
    peopleNeeded: 1,
    durationMinutes: 60,
    paymentCop: 80000,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await publisher.goto('/mi-actividad');
  await publisher.getByLabel('Consultar').selectOption('publications');
  await publisher.getByRole('link', { name: title }).click();
  await publisher.getByLabel('Dirección exacta').fill('Biblioteca, sala 2');
  await publisher.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(publisher.getByText('Dirección actualizada.')).toBeVisible();
  await publisher.getByLabel('Seleccionar a Trabajador E2E').check();
  await publisher.getByRole('button', { name: 'Enviar selección (1)' }).click();
  await expect(publisher.getByText('1 de 1 cupos seleccionados')).toBeVisible();
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders,
    viewport: publisher.viewportSize(),
  });
  try {
    const page = await context.newPage();
    await login(page, worker);
    await page.goto('/mi-actividad');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Biblioteca, sala 2')).toHaveCount(0);
    await page.getByRole('link', { name: /Notificaciones/ }).click();
    await page.getByRole('button', { name: /Te seleccionaron para una oportunidad/ }).click();
    await expect(page.getByText('Condiciones: Traer un cuaderno')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aceptar trabajo' })).toBeDisabled();
    await page.getByLabel('Leí y acepto los términos de este trabajo').check();
    await page.getByRole('button', { name: 'Aceptar trabajo' }).click();
    await expect(page.getByText('Dirección: Biblioteca, sala 2')).toBeVisible();
    const job = await database.job.findFirstOrThrow({ where: { opportunityId: id } });
    // Adelantamos el inicio programado en la base efímera para probar las dos confirmaciones.
    await database.job.update({ where: { id: job.id }, data: { status: 'IN_PROGRESS' } });
    await page.reload();
    await page.getByRole('button', { name: 'Marcar como terminado' }).click();
    await expect(page.getByText('La otra parte debe confirmar la finalización.')).toBeVisible();
    await publisher.goto('/mi-actividad');
    await publisher.getByLabel('Consultar').selectOption('jobs');
    await publisher.getByLabel('Mi rol').selectOption('publisher');
    await publisher.getByRole('link', { name: title }).click();
    await publisher.getByRole('button', { name: 'Confirmar finalización' }).click();
    await publisher.getByRole('link', { name: 'Calificar el trabajo' }).click();
    for (const name of ['Cumplimiento', 'Puntualidad', 'Comunicación', 'Calidad']) {
      await publisher
        .getByRole('group', { name })
        .getByText('5 estrellas', { exact: true })
        .locator('..')
        .click();
    }
    await publisher.getByRole('button', { name: 'Enviar calificación' }).click();
    await expect(publisher.getByRole('heading', { name: '¡Gracias por calificar!' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('el publicador edita una vacante, gestiona candidatos y conserva el historial al cerrarla', async ({
  signedInPage: page,
  account,
  createAccount,
  request,
  database,
}) => {
  const worker = await createAccount(true);
  const title = 'Auxiliar de biblioteca';
  const id = await opportunityWithApplicant(database, request, account, worker, {
    type: 'FORMAL_JOB',
    title,
    description: 'Atender a visitantes de la biblioteca.',
    salaryMinCop: 2000000,
    modality: 'ONSITE',
    schedule: 'FULL_TIME',
    experienceRequired: 'Un año',
    requirements: 'Atención al público',
    closesAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await page.goto('/mi-actividad');
  await page.getByLabel('Consultar').selectOption('publications');
  await page.getByRole('link', { name: title }).click();
  await page.getByRole('button', { name: 'Editar publicación' }).click();
  await page.getByLabel('Salario mínimo (COP)').fill('2400000');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Publicación actualizada.')).toBeVisible();
  expect((await database.opportunity.findUniqueOrThrow({ where: { id } })).salaryMinCop).toBe(
    2400000,
  );
  await page.getByLabel('Cambiar estado de Trabajador E2E').selectOption('INTERVIEW');
  await page.getByRole('button', { name: 'Guardar estado' }).click();
  await expect(page.getByText('Postulación: Entrevista')).toBeVisible();
  await page.getByLabel('Cambiar estado de la publicación').selectOption('close');
  await page.getByLabel('Motivo', { exact: true }).fill('Vacante cubierta');
  await page.getByRole('button', { name: 'Confirmar cambio de estado' }).click();
  await expect(page.getByText('Motivo: Vacante cubierta')).toBeVisible();
  await expect(page.getByText('Postulación: Entrevista')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar publicación' })).toHaveCount(0);
});
