import { expect, test, type Page, type Request } from '@playwright/test';

type Role = 'admin' | 'viewer';

interface MockPost {
  id: string;
  title: string | null;
  caption: string | null;
  day: string | null;
  time: string | null;
  scheduledFor: string | null;
  status: 'draft' | 'scheduled';
  networks: Array<'instagram' | 'facebook'>;
  mediaType: 'image' | 'carousel' | 'reel' | 'video';
  media: unknown[];
}

const settings = {
  timezone: 'America/Caracas',
  maxPostsPerDay: 2,
  defaultPostTime: '18:00',
  brandName: 'RAI E2E',
  brandHandle: '@rai_e2e',
};

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function mockCalendarApis(page: Page, role: Role = 'admin') {
  let getCount = 0;
  const posts: MockPost[] = [];

  await page.route('**/api/me', async (route) => {
    await route.fulfill(json({
      id: `e2e-${role}`,
      email: `${role}@example.test`,
      name: `E2E ${role}`,
      role,
      workspaceId: 'workspace-e2e',
    }));
  });

  await page.route('**/api/content-calendar/settings', async (route) => {
    await route.fulfill(json({ settings }));
  });

  await page.route('**/api/content-posts**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname !== '/api/content-posts') {
      await route.fulfill(json({ error: 'Ruta E2E no configurada' }, 404));
      return;
    }

    if (request.method() === 'GET') {
      getCount += 1;
      const visibleDay = url.searchParams.get('from');
      const seededPost: MockPost = {
        id: 'post-visible-e2e',
        title: 'Publicación visible E2E',
        caption: 'Contenido visible para todos los roles',
        day: visibleDay,
        time: '10:30',
        scheduledFor: visibleDay ? `${visibleDay}T14:30:00.000Z` : null,
        status: 'scheduled',
        networks: ['instagram'],
        mediaType: 'image',
        media: [],
      };
      await route.fulfill(json({ posts: [seededPost, ...posts] }));
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as Partial<MockPost>;
      const created: MockPost = {
        id: `post-created-${posts.length + 1}`,
        title: payload.title ?? null,
        caption: payload.caption ?? null,
        day: null,
        time: null,
        scheduledFor: null,
        status: 'draft',
        networks: payload.networks ?? ['instagram'],
        mediaType: payload.mediaType ?? 'image',
        media: payload.media ?? [],
      };
      posts.push(created);
      await route.fulfill(json({ post: created }, 201));
      return;
    }

    await route.fulfill(json({ error: 'Método E2E no configurado' }, 405));
  });

  return {
    get getCount() {
      return getCount;
    },
  };
}

function isCreatePostRequest(request: Request) {
  return request.method() === 'POST' && new URL(request.url()).pathname === '/api/content-posts';
}

test.describe('Calendario de contenido 2A', () => {
  test('carga la vista semanal y permite cambiar a la vista mensual', async ({ page }) => {
    await mockCalendarApis(page);
    await page.goto('/calendario-contenido');

    const calendar = page.getByRole('region', { name: 'Calendario de publicaciones' });
    const weekButton = page.getByRole('button', { name: 'Semana', exact: true });
    const monthButton = page.getByRole('button', { name: 'Mes', exact: true });

    await expect(page.getByRole('heading', { name: 'Calendario de Contenido' })).toBeVisible();
    await expect(weekButton).toHaveAttribute('aria-pressed', 'true');
    await expect(calendar.locator('div[aria-label$="publicaciones"]')).toHaveCount(7);
    await expect(page.getByText('Publicación visible E2E')).toBeVisible();

    await monthButton.click();

    await expect(monthButton).toHaveAttribute('aria-pressed', 'true');
    await expect(weekButton).toHaveAttribute('aria-pressed', 'false');
    await expect(calendar.locator('div[aria-label$="publicaciones"]')).toHaveCount(42);
  });

  test('admin crea y guarda un borrador, envía el POST y recarga el calendario', async ({ page }) => {
    const api = await mockCalendarApis(page, 'admin');
    await page.goto('/calendario-contenido');
    await expect(page.getByText('Publicación visible E2E')).toBeVisible();

    await page.getByRole('button', { name: 'Nueva publicación', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Nueva publicación' });
    const closeButton = editor.getByRole('button', { name: 'Cerrar editor' });

    await expect(editor).toBeVisible();
    await expect(closeButton).toBeFocused();
    await editor.getByLabel('Título interno').fill('Borrador creado por E2E');
    await editor.getByLabel('Texto de la publicación').fill('Caption estable del borrador E2E');

    const postRequestPromise = page.waitForRequest(isCreatePostRequest);
    await editor.getByRole('button', { name: 'Guardar borrador' }).click();
    const postRequest = await postRequestPromise;
    const payload = postRequest.postDataJSON();

    expect(payload).toMatchObject({
      title: 'Borrador creado por E2E',
      caption: 'Caption estable del borrador E2E',
      networks: ['instagram'],
      mediaType: 'image',
      scheduledFor: null,
    });
    await expect(editor).toBeHidden();
    await expect(page.getByText('Borrador creado por E2E')).toBeVisible();
    expect(api.getCount).toBeGreaterThanOrEqual(2);
  });

  test('Escape cierra el editor y devuelve el foco al botón que lo abrió', async ({ page }) => {
    await mockCalendarApis(page, 'admin');
    await page.goto('/calendario-contenido');

    const openButton = page.getByRole('button', { name: 'Nueva publicación', exact: true });
    await expect(openButton).toBeVisible();
    await openButton.click();

    const editor = page.getByRole('dialog', { name: 'Nueva publicación' });
    await expect(editor.getByRole('button', { name: 'Cerrar editor' })).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(editor).toBeHidden();
    await expect(openButton).toBeFocused();
  });

  test('viewer ve calendario y publicaciones sin controles de gestión', async ({ page }) => {
    await mockCalendarApis(page, 'viewer');
    await page.goto('/calendario-contenido');

    await expect(page.getByRole('region', { name: 'Calendario de publicaciones' })).toBeVisible();
    await expect(page.getByText('Publicación visible E2E')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ajustes', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva publicación', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Crear publicación el / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Mover / })).toHaveCount(0);
    await expect(page.locator('button[title="Editar publicación"]')).toHaveCount(0);

    const readOnlyPost = page.getByRole('button', { name: /Publicación visible E2E/ });
    await expect(readOnlyPost).toBeDisabled();
    await expect(readOnlyPost).toHaveAttribute('title', 'Publicación de solo lectura');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
