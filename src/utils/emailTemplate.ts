export const EMAIL_LOGO_URL = 'https://awesomeadventure.tours/logo.png';
export const EMAIL_BRAND_NAME = 'Awesome Adventure Tours';
export const EMAIL_SUPPORT_EMAIL = 'reservation@awesomeadventure.tours';

export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderTextBody(value: string): string {
  return escapeEmailHtml(value.trim()).split(/\n\s*\n/g).map((paragraph) =>
    '<p style="margin:0 0 16px;color:#273449;font-size:15px;line-height:1.75;white-space:pre-line;">' + paragraph.replace(/\n/g, '<br>') + '</p>'
  ).join('');
}

export function renderBrandedEmailHtml(options: { heading: string; bodyText: string; preheader?: string; footerNote?: string }): string {
  const heading = escapeEmailHtml(options.heading);
  const preheader = escapeEmailHtml(options.preheader || options.heading);
  const footerNote = options.footerNote ? '<p style="margin:0 0 10px;color:#aab5c5;font-size:11px;line-height:1.6;">' + escapeEmailHtml(options.footerNote) + '</p>' : '';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>', heading, '</title></head>',
    '<body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">', preheader, '</div>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f5f8;padding:28px 12px;"><tr><td align="center">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e7ebf0;border-radius:14px;overflow:hidden;">',
    '<tr><td align="center" style="background:#101b2b;padding:26px 24px 22px;"><img src="' + EMAIL_LOGO_URL + '" width="190" alt="Awesome Adventure Tours" style="display:block;width:190px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;"></td></tr>',
    '<tr><td style="padding:34px 34px 20px;"><h1 style="margin:0 0 22px;color:#142238;font-size:24px;line-height:1.3;font-weight:700;">', heading, '</h1>', renderTextBody(options.bodyText), '</td></tr>',
    '<tr><td style="padding:0 34px 30px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #e8edf2;padding-top:20px;">',
    '<p style="margin:0 0 7px;color:#172033;font-size:13px;font-weight:700;">Awesome Adventure Tours</p><p style="margin:0 0 7px;color:#64748b;font-size:12px;line-height:1.6;">Hurghada, Red Sea, Egypt</p>',
    '<p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">Need assistance? <a href="mailto:' + EMAIL_SUPPORT_EMAIL + '" style="color:#9b7428;text-decoration:underline;">Contact our team</a></p></td></tr></table></td></tr>',
    '<tr><td align="center" style="background:#101b2b;padding:20px 24px;">', footerNote, '<p style="margin:0;color:#aab5c5;font-size:11px;line-height:1.6;">© ' + new Date().getUTCFullYear() + ' Awesome Adventure Tours. All rights reserved.</p></td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
}
