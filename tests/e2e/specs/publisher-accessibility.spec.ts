import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../support/fixtures.ts';
import { fillPublisher, openForm, publisher, savePublisher } from '../support/publisher.ts';

async function accessibility(page: Page, testInfo: TestInfo, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await testInfo.attach(`axe-${state}`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect(
    results.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.target) })),
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Desbordamiento horizontal',
  ).toBe(true);
}

for (const kind of ['PERSON', 'COMPANY'] as const) {
  test(`T-02 accesibilidad y teclado en el formulario ${kind}, errores y vista pública`, async ({
    signedInPage: page,
  }, testInfo) => {
    await openForm(page);
    await page.getByLabel('Tipo de perfil').selectOption(kind);
    await accessibility(page, testInfo, 'formulario');
    await page.getByLabel('Tipo de perfil').focus();
    await page.keyboard.press('Tab');
    const file = page.locator('input[type=file]');
    await expect(file).toBeFocused();
    const focusOutline = await file.evaluate(
      (element) => getComputedStyle(element.closest('label')!).outlineWidth,
    );
    expect(Number.parseFloat(focusOutline)).toBeGreaterThanOrEqual(3);
    const button = page.getByRole('button', { name: 'Guardar perfil' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(file).toBeFocused();
    await expect(file).toHaveAttribute('aria-invalid', 'true');
    const described = await file.getAttribute('aria-describedby');
    expect(described?.split(' ')).toHaveLength(2);
    await accessibility(page, testInfo, 'errores');
    await fillPublisher(page, publisher(kind));
    const profile = await savePublisher(page);
    await accessibility(page, testInfo, 'confirmacion');
    await page.goto(`/publicadores/${profile.id}`);
    await expect(page.locator('article').getByRole('img')).toHaveJSProperty('naturalWidth', 1);
    await accessibility(page, testInfo, 'perfil-publico');
  });
}
