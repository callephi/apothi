import React from 'react';

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, isError }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-modal-actions">
          {isError ? (
            <button className="btn btn-primary" onClick={onCancel}>
              OK
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={onConfirm}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
