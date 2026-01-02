const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const bodyIsFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && !bodyIsFormData) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: Error & { status?: number } = new Error(data?.message ?? "Request failed");
    error.status = res.status;
    throw error;
  }
  return data as T;
}

export function buildQuery(params?: Record<string, string | number | undefined | null>) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}
