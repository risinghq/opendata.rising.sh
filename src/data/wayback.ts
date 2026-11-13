const WEB = "https://web.archive.org/web/";
const COPY = /^https:\/\/web\.archive\.org\/web\/(\d{14})\/(.+)$/;

export function archiveCopyUrl(timestamp: string, url: string): string {
  return `${WEB}${timestamp}/${url}`;
}

export function isArchiveCopy(archive: unknown, url: unknown): boolean {
  const match = typeof archive === "string" ? COPY.exec(archive) : null;
  return match !== null && match[2] === url;
}
