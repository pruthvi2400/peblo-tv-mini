/**
 * Generic confirm dialog. Used for delete flows.
 */
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  /** Label of the confirm button (e.g. "Delete"). */
  confirmLabel?: string;
  /** Label of the cancel button. */
  cancelLabel?: string;
  /** Style of the confirm button (danger for destructive actions). */
  variant?: 'primary' | 'danger';
  isWorking?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  testId?: string;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isWorking,
  onConfirm,
  onClose,
  testId,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      testId={testId}
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={isWorking}
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
            disabled={isWorking}
            data-testid="confirm-confirm"
          >
            {isWorking ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Dialog>
  );
}