export function encodeCrontabToHash(text: string): string {
  const encoded = btoa(unescape(encodeURIComponent(text)));
  return `#crontab=${encoded}`;
}

export function decodeCrontabFromHash(hash: string): string | null {
  const match = hash.match(/^#crontab=(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(escape(atob(match[1])));
  } catch {
    return null;
  }
}

export function getCrontabFromUrl(): string | null {
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith('crontab=')) return null;
  return decodeCrontabFromHash(`#${hash}`);
}
