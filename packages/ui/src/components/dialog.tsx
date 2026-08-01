'use client';

/**
 * Modal dialog, built on the native `<dialog>` element.
 *
 * Native `showModal()` gives focus trapping, inertness of the page behind, Escape-to-close, and
 * the top layer for free. Every hand-rolled modal reimplements those, and most reimplement at
 * least one of them wrongly — focus escaping to the page behind is the usual casualty.
 *
 * Two things the platform does not do, handled here:
 *
 * - **Backdrop click to close.** A click on the backdrop reports the `<dialog>` itself as the
 *   target, since the backdrop is a pseudo-element. Comparing `event.target` to the element is
 *   how you tell "clicked outside" from "clicked the panel".
 * - **Cancel is still a close.** Escape fires `cancel`, not `close`, so both are forwarded to
 *   `onClose` — otherwise dismissing with the keyboard leaves the caller's state open.
 */
import { useEffect, useRef, type ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Rendered bottom-right; the confirming action goes last, as in the platform. */
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleClose = () => {
      onClose();
    };

    element.addEventListener('close', handleClose);
    element.addEventListener('cancel', handleClose);

    return () => {
      element.removeEventListener('close', handleClose);
      element.removeEventListener('cancel', handleClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      aria-labelledby="ui-dialog-title"
      aria-describedby={description ? 'ui-dialog-description' : undefined}
      onClick={(event) => {
        // The backdrop is a pseudo-element, so a click on it targets the dialog itself.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="ui-dialog__panel">
        <h2 className="ui-dialog__title" id="ui-dialog-title">
          {title}
        </h2>

        {description ? (
          <p className="ui-dialog__description" id="ui-dialog-description">
            {description}
          </p>
        ) : null}

        {children ? <div className="ui-dialog__body">{children}</div> : null}
        {footer ? <div className="ui-dialog__footer">{footer}</div> : null}
      </div>
    </dialog>
  );
}
