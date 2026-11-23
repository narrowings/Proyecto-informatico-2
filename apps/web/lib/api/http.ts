export const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
  .origin;

type ApiProblem = { code?: string; message?: string; errors?: Record<string, string[]> };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ApiProblem,
    readonly retryAfter: number,
  ) {
    super(problem.message ?? `HTTP ${status}`);
  }
}

/** Cómo leer una respuesta exitosa: JSON por defecto; `asBlob` para archivos. */
type ParseBody<T> = (response: Response) => Promise<T>;

const asJson = <T>(response: Response): Promise<T> =>
  response.status === 204 ? Promise.resolve(undefined as T) : response.json();

export const asBlob: ParseBody<Blob> = (response) => response.blob();

export async function request<T>(
  path: string,
  options: RequestInit = {},
  parse: ParseBody<T> = asJson,
): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/v1${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
  });
  if (!response.ok) {
    const problem: ApiProblem = await response.json().catch(() => ({}));
    throw new ApiError(response.status, problem, Number(response.headers.get('retry-after-ip')));
  }
  return parse(response);
}

export const postJson = (body: object): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

let accessToken: string | undefined;
let refreshing: Promise<string> | undefined;

// Al cambiar de cuenta o cerrar sesión, las otras pestañas deben descartar su JWT.
const sessionEvents =
  typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function'
    ? new window.BroadcastChannel('red:session')
    : null;
if (sessionEvents)
  sessionEvents.onmessage = () => {
    accessToken = undefined;
    window.location.reload();
  };

// La cookie rota en cada renovación. Las pestañas deben usarla de una en una.
async function sessionLock<T>(action: () => Promise<T>): Promise<T> {
  return globalThis.navigator?.locks
    ? await navigator.locks.request('red:session', action)
    : action();
}

export function loginSession(credentials: { email: string; password: string }) {
  return sessionLock(async () => {
    const session = await request<{ accessToken: string; requiresTermsAcceptance: boolean }>(
      '/auth/login',
      postJson(credentials),
    );
    accessToken = session.accessToken;
    sessionEvents?.postMessage('login');
    return session.requiresTermsAcceptance;
  });
}

export function logoutSession() {
  return sessionLock(async () => {
    await request<void>('/auth/logout', { method: 'POST' });
    accessToken = undefined;
    sessionEvents?.postMessage('logout');
  });
}

function renew(): Promise<string> {
  refreshing ??= sessionLock(async () => {
    const session = await request<{ accessToken: string }>('/auth/refresh', { method: 'POST' });
    accessToken = session.accessToken;
    return accessToken;
  }).finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

export async function authenticated<T>(
  path: string,
  options: RequestInit = {},
  parse: ParseBody<T> = asJson,
): Promise<T> {
  const send = (token: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return request<T>(path, { ...options, headers }, parse);
  };
  const token = accessToken ?? (await renew());
  try {
    return await send(token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (accessToken === token) accessToken = undefined;
    return send(accessToken ?? (await renew()));
  }
}
