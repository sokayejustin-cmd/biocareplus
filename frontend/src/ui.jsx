
export function Modal({ open = true, title, onClose, children }) {
  if (!open) return null;

  return (
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
    </div>
  );
}

export function confirmBox(message) {
  return window.confirm(message);
}
