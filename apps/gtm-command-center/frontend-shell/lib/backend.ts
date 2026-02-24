const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:1981';

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}
