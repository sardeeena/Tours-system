/**
 * Stable keys shared by the build-time private UI catalogue extractor and
 * the runtime JSX translation component.
 */
export function normalizePrivateUiText(raw: string): string {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  let lastNonEmpty = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].length > 0) lastNonEmpty = index;
  }
  let result = '';
  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index].replace(/\t/g, ' ');
    if (index !== 0) line = line.replace(/^\s+/, '');
    if (index !== lines.length - 1) line = line.replace(/\s+$/, '');
    if (line) {
      if (index !== lastNonEmpty) line += ' ';
      result += line;
    }
  }
  return result;
}

export function privateUiMessageKey(message: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < message.length; index += 1) {
    hash ^= message.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return 'private.text.' + (hash >>> 0).toString(16).padStart(8, '0');
}

export function isPrivateUiSourcePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return /\/src\/pages\/(?:BookingPage|AccountPage|CustomerProfilePage|MyBookingPage|SupportPage|BookingConfirmationPage)\.tsx$/.test(normalized)
    || /\/src\/components\/(?:booking|auth|common|tours)\/.*\.tsx$/.test(normalized);
}
