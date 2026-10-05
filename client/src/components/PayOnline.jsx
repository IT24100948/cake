import { useRef, useState } from 'react';
import { myApi } from '../api';
import { useForm } from '../utils/useAsync';
import { formatDateTime, formatLKR } from '../utils/format';
import { Alert, Modal, SubmitButton } from './ui';
import { CardFields, SandboxNotice, TestCards, cardErrors, cardPayload, emptyCard, newPaymentKey, validateCard } from './CardFields';

/**
 * Pays the order's balance by card through the built-in DevmaPay sandbox gateway.
 * `onPaid(order)` receives the updated order after a successful payment.
 */
export default function PayOnline({ order, onClose, onPaid, onStale }) {
  const f = useForm(emptyCard(order.customer_name || ''));
  const [receipt, setReceipt] = useState(null);
  // One key per payment attempt: a retry after a lost connection reuses it, so the card can never be charged twice.
  const attemptKey = useRef(newPaymentKey());
  const amount = order.balance_due;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      try {
        const res = await myApi.pay(order.id, { ...cardPayload(v), amount, idempotencyKey: attemptKey.current });
        setReceipt({ ...res.transaction, order: res.order });
      } catch (err) {
        if (err.status !== 0) attemptKey.current = newPaymentKey(); // the gateway answered: the next try is a new attempt
        if (err.status === 409) onStale?.();
        throw { ...err, errors: cardErrors(err.errors) };
      }
    }, validateCard);
  };

  if (receipt) {
    return (
      <Modal title="Payment successful" onClose={() => onPaid(receipt.order)}>
        <div className="pay-receipt stack">
          <div className="check" aria-hidden="true">✓</div>
          <p className="mb-0"><strong>{formatLKR(receipt.amount)}</strong> paid for order {order.order_number}.</p>
          <dl className="kv">
            <dt>Card</dt><dd>{receipt.cardBrand} •••• {receipt.cardLast4}</dd>
            <dt>Reference</dt><dd><code>{receipt.gatewayRef}</code></dd>
            <dt>Date</dt><dd>{formatDateTime(receipt.createdAt)}</dd>
          </dl>
          <p className="text-sm muted mb-0">{order.awaiting_prepayment ? 'Thank you! Your order is secured and we will start preparing it.' : 'Thank you! A receipt has been added to your order updates.'}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => onPaid(receipt.order)}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Pay online" onClose={onClose}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="pay-amount"><span>Amount due</span><strong>{formatLKR(amount)}</strong></div>
        <SandboxNotice />
        <Alert>{f.formError}</Alert>
        <CardFields f={f} idPrefix="pay" />
        <SubmitButton busy={f.submitting} className="btn btn-primary btn-block btn-lg">Pay {formatLKR(amount)}</SubmitButton>
        <TestCards f={f} />
      </form>
    </Modal>
  );
}
