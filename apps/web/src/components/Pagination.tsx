type PaginationControlsProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ page, totalPages, total, pageSize, onPageChange }: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="pagination-controls">
      <button className="btn btn--ghost btn--small" type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        ← Précédent
      </button>
      <span>
        Page {page}/{totalPages} • {start}-{end} sur {total}
      </span>
      <button className="btn btn--ghost btn--small" type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Suivant →
      </button>
    </div>
  );
}
