import { useEffect, useId, useRef } from 'react';
import { STATUS_META } from '../utils/format';
import Icon from './Icons';

export function Spinner({ small }) {
  return <div className={`spinner${small ? ' spinner-sm' : ''}`} role="status" aria-label="Loading" />;
}

export function Loading() {
  return <div className="loading-block"><Spinner /></div>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="alert alert-error row-between">
      <span>{error?.message || 'Could not load data.'}</span>
      {onRetry && <button className="btn btn-sm btn-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ icon = '🧁', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      {title && <h3>{title}</h3>}
      {children && <div>{children}</div>}
    </div>
  );
}

export function StatusBadge({ status, label }) {
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' };
  return <span className={`badge badge-${meta.tone}`}>{label || meta.label}</span>;
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div>;
}

/** Labelled form control with error message. `as` = input | select | textarea. */
export function Field({ label, error, hint, required, as = 'input', children, className = '', ...props }) {
  const id = useId();
  const Tag = as;
  const cls = as === 'select' ? 'select' : as === 'textarea' ? 'textarea' : 'input';
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}{required && <span className="req">*</span>}</label>}
      <Tag id={id} className={cls} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} {...props}>
        {children}
      </Tag>
      {error ? <span id={`${id}-err`} className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Runs once per open: Escape closes, page scroll is locked, first field gets focus.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('.modal-body input:not([disabled]), .modal-body select:not([disabled]), .modal-body textarea, .modal-body button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${size === 'lg' ? ' modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose, children }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner small /> : confirmLabel}
          </button>
        </>
      )}
    >
      <p className="mb-0">{message}</p>
      {children}
    </Modal>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <div className="pagination">
      <span>Showing {from}–{to} of {meta.total}</span>
      <div className="row">
        <button className="btn btn-sm btn-secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
        <span>Page {meta.page} of {meta.totalPages}</span>
        <button className="btn btn-sm btn-secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function QtyInput({ value, onChange, min = 1, max = 99, label = 'Quantity' }) {
  const clamp = (n) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease">−</button>
      <input type="number" value={value} min={min} max={max} aria-label={label}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))} />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Increase">+</button>
    </div>
  );
}

export function SubmitButton({ busy, children, className = 'btn btn-primary', ...rest }) {
  return (
    <button type="submit" className={className} disabled={busy} {...rest}>
      {busy ? <Spinner small /> : children}
    </button>
  );
}
