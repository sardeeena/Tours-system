export const EMAIL_LOGO_URL = 'https://awesomeadventure.tours/logo.png';
export const EMAIL_BRAND_NAME = 'Awesome Adventure Tours';
export const EMAIL_SUPPORT_EMAIL = 'reservation@awesomeadventure.tours';

export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderTextBody(value: string): string {
  const escaped = escapeEmailHtml(value.trim());
  const linked = escaped.replace(/https:\/\/[^\s<]+/g, (url) =>
    '<a href="' + url + '" style="color:#9b7428;text-decoration:underline;">' + url + '</a>'
  );
  return linked.split(/\n\s*\n/g).map((paragraph) =>
    '<p style="margin:0 0 16px;color:#273449;font-size:15px;line-height:1.75;white-space:pre-line;">' + paragraph.replace(/\n/g, '<br>') + '</p>'
  ).join('');
}

function renderEmailShell(heading: string, preheader: string, content: string, footerNote?: string): string {
  const safeHeading = escapeEmailHtml(heading);
  const safePreheader = escapeEmailHtml(preheader || heading);
  const safeFooter = footerNote
    ? '<p style="margin:0 0 10px;color:#aab5c5;font-size:11px;line-height:1.6;">' + escapeEmailHtml(footerNote) + '</p>'
    : '';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>', safeHeading, '</title></head>',
    '<body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">', safePreheader, '</div>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f5f8;padding:24px 10px;"><tr><td align="center">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e7ebf0;border-radius:14px;overflow:hidden;">',
    '<tr><td align="center" style="background:#101b2b;padding:24px 20px;"><img src="', EMAIL_LOGO_URL, '" width="190" alt="Awesome Adventure Tours" style="display:block;width:190px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;"></td></tr>',
    '<tr><td style="padding:28px 24px 20px;"><h1 style="margin:0 0 20px;color:#142238;font-size:23px;line-height:1.3;font-weight:700;">', safeHeading, '</h1>', content, '</td></tr>',
    '<tr><td style="padding:0 24px 26px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #e8edf2;padding-top:18px;">',
    '<p style="margin:0 0 7px;color:#172033;font-size:13px;font-weight:700;">Awesome Adventure Tours</p><p style="margin:0 0 7px;color:#64748b;font-size:12px;line-height:1.6;">Hurghada, Red Sea, Egypt</p>',
    '<p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">Need assistance? <a href="mailto:', EMAIL_SUPPORT_EMAIL, '" style="color:#9b7428;text-decoration:underline;">Contact our team</a></p></td></tr></table></td></tr>',
    '<tr><td align="center" style="background:#101b2b;padding:18px 20px;">', safeFooter, '<p style="margin:0;color:#aab5c5;font-size:11px;line-height:1.6;">© ', String(new Date().getUTCFullYear()), ' Awesome Adventure Tours. All rights reserved.</p></td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
}

export function renderBrandedEmailHtml(options: { heading: string; bodyText: string; preheader?: string; footerNote?: string }): string {
  return renderEmailShell(options.heading, options.preheader || options.heading, renderTextBody(options.bodyText), options.footerNote);
}

export interface BookingTicketEmailOptions {
  heading: string;
  preheader?: string;
  introText?: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  tourName: string;
  tourDate: string;
  departureTime?: string;
  adultCount: number;
  childCount: number;
  infantCount: number;
  pickupLocation?: string;
  pickupArea?: string;
  hotelName?: string;
  roomNumber?: string;
  tourLanguage?: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: string;
  extras?: Array<{ name: string; quantity: number; total: string }>;
}

export function renderBookingTicketEmailHtml(options: BookingTicketEmailOptions): string {
  const value = (label: string, content: string | number | undefined) =>
    '<tr><td style="padding:9px 10px;border-bottom:1px solid #e8edf2;color:#64748b;font-size:12px;width:42%;">' + escapeEmailHtml(label) +
    '</td><td style="padding:9px 10px;border-bottom:1px solid #e8edf2;color:#172033;font-size:13px;font-weight:700;word-break:break-word;">' +
    escapeEmailHtml(String(content === undefined || content === null || content === '' ? 'To be confirmed' : content)) + '</td></tr>';

  const guests = [
    options.adultCount + ' adult' + (options.adultCount === 1 ? '' : 's'),
    options.childCount > 0 ? options.childCount + ' child' + (options.childCount === 1 ? '' : 'ren') : '',
    options.infantCount > 0 ? options.infantCount + ' infant' + (options.infantCount === 1 ? '' : 's') : '',
  ].filter(Boolean).join(', ');

  const extras = (options.extras || []).length
    ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;border:1px solid #e8edf2;border-radius:8px;"><tr><td colspan="2" style="padding:11px 12px;background:#f7f9fb;color:#172033;font-size:12px;font-weight:700;">Selected extras</td></tr>' +
      (options.extras || []).map((extra) => value(extra.name + ' × ' + extra.quantity, extra.total)).join('') + '</table>'
    : '';

  const details = [
    value('Booking reference', options.bookingReference),
    value('Lead traveller', options.customerName),
    value('Email', options.customerEmail),
    value('Excursion', options.tourName),
    value('Date', options.tourDate),
    value('Departure time', options.departureTime),
    value('Guests', guests),
    value('Pickup location', options.pickupLocation),
    value('Pickup area', options.pickupArea),
    value('Hotel', options.hotelName),
    value('Room number', options.roomNumber),
    value('Tour language', options.tourLanguage),
    value('Booking status', options.bookingStatus),
    value('Payment status', options.paymentStatus),
    value('Payment method', options.paymentMethod),
  ].join('');

  const content = [
    '<p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.7;">', escapeEmailHtml(options.introText || 'Your reservation has been received. Keep this digital ticket for your records.'), '</p>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d9e2eb;border-radius:10px;overflow:hidden;">',
    '<tr><td colspan="2" style="padding:15px 14px;background:#0e1b2a;color:#fff;"><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#d7b56d;">OFFICIAL BOOKING TICKET</div><div style="margin-top:5px;font-size:19px;line-height:1.3;font-weight:700;">', escapeEmailHtml(options.tourName), '</div><div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#fff;">Reference: ', escapeEmailHtml(options.bookingReference), '</div></td></tr>',
    details,
    '<tr><td colspan="2" style="padding:14px 12px;background:#f7f9fb;"><div style="color:#64748b;font-size:10px;letter-spacing:1px;text-transform:uppercase;">Booking total</div><div style="margin-top:4px;color:#0a6c74;font-size:22px;font-weight:700;">', escapeEmailHtml(options.totalAmount), '</div></td></tr>',
    '</table>',
    extras,
    '<p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.7;">Please keep your booking reference available when contacting our team. Pickup time and operational details may be confirmed separately.</p>',
  ].join('');

  return renderEmailShell(options.heading, options.preheader || options.heading, content);
}
