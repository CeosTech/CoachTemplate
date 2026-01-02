import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: "default" | "wide";
};

export function Modal({ open, onClose, title, children, width = "default" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card${width === "wide" ? " modal-card--wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          {title && <h3>{title}</h3>}
          <button className="modal-close" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );
}
