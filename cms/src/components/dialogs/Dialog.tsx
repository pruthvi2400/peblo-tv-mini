/**
 * Minimal modal dialog.
 *
 *   <Dialog title="Delete show?" onClose={...}>
 *     <p>Are you sure?</p>
 *     <button onClick={onConfirm}>Delete</button>
 *   </Dialog>
 *
 * Uses the native <dialog> element where possible; falls back to a
 * role="dialog" wrapper for jsdom test compatibility (the native
 * <dialog> requires `showModal()` which jsdom does not implement).
 */
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import './Dialog.css';

export interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional footer (typically the action buttons). */
  footer?: ReactNode;
  /** Test hook. */
  testId?: string;
}

export function Dialog({ title, onClose, children, footer, testId }: DialogProps) {
  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onClick={onClose}
      data-testid={testId}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog__header">
          <h2 className="dialog__title">{title}</h2>
          <button
            type="button"
            className="dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>
        <div className="dialog__body">{children}</div>
        {footer && <footer className="dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
}