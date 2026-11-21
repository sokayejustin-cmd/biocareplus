import { createPortal } from "react-dom";

// La fenêtre est rendue directement dans <body> : ainsi les animations
// (3D, transformations) des pages ne peuvent pas la décaler ni la rogner.
export function Modal({ open = true, title, onClose, children }) {
  if (!open) return null;

  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div
        className="card modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h3>{title}</h3>

          <button
            className="btn secondary"
            type="button"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}

export function confirmBox(message) {
  return window.confirm(message);
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Chargement">
      <span />
    </div>
  );
}
