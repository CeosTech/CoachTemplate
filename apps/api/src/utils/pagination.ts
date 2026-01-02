export type PaginationParams = {
  page?: number | string;
  pageSize?: number | string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export function buildPagination(params?: PaginationParams) {
  const rawPage = typeof params?.page === "string" ? Number(params.page) : params?.page;
  const rawPageSize = typeof params?.pageSize === "string" ? Number(params.pageSize) : params?.pageSize;
  const page = Number.isFinite(rawPage) && rawPage ? Math.max(1, Math.floor(rawPage)) : 1;
  const baseSize = Number.isFinite(rawPageSize) && rawPageSize ? Math.floor(rawPageSize) : 10;
  const pageSize = Math.min(100, Math.max(5, baseSize));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

export function buildMeta(page: number, pageSize: number, total: number): PaginationMeta {
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, totalPages };
}
