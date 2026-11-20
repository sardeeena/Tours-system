import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/MyBookingPage.tsx', import.meta.url), 'utf8');
const handlerStart = source.indexOf('const handleConfirmCancellation = async () =>');
const handlerEnd = source.indexOf('\n  const getStatusBadge', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'Cancellation handler must exist');
const handler = source.slice(handlerStart, handlerEnd);

assert.match(handler, /if \(!updated\)\s*\{\s*throw new Error/,
  'A missing cancellation result must be surfaced as a failure.');
assert.match(handler, /setCancelErrorMsg\(/,
  'Cancellation failures must be stored for visible customer feedback.');
assert.match(handler, /setCancelSuccessMsg\(/,
  'Successful cancellation requests must show a success message.');
assert.match(handler, /void notificationService\.sendCancellationNotification\(updated\)[\s\S]*?\.catch\(/,
  'Notification delivery must be best-effort after the cancellation request is persisted.');
assert.doesNotMatch(handler, /await notificationService\.sendCancellationNotification/,
  'A notification delivery error must not cause a customer to retry a persisted cancellation request.');
assert.match(source, /\{cancelErrorMsg && \([\s\S]*?role="alert"/,
  'Cancellation failures must be announced in the modal as an accessible alert.');

console.log('Customer cancellation feedback and notification retry safety checks passed.');
