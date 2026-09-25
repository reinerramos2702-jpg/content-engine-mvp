/**
 * Fetch wrapper del frontend (Etapa 3 — Auth real).
 * La sesión viaja en cookie httpOnly (`rai_session`), que el navegador envía
 * sola en requests same-origin — el wrapper no necesita adjuntar ningún token
 * (nada de localStorage). Su trabajo:
 *  1. Forzar credentials same-origin (explícito, no confiar en el default).
 *  2. Ante 401 (sesión expirada/inválida) redirigir a /login y cortar el flujo.
 * Las páginas públicas /login y /registro NO usan este wrapper (un 401 ahí es
 * "credenciales inválidas", no "sesión expirada").
 */

export class UnauthorizedError extends Error {
  constructor() {
    super('Sesión expirada. Inicia sesión de nuevo.');
    this.name = 'UnauthorizedError';
  }
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (!path.startsWith('/login') && !path.startsWith('/registro')) {
      window.location.href = '/login';
    }
    throw new UnauthorizedError();
  }

  return res;
}
