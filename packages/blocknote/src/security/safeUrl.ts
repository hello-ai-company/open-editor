/** Allows relative media paths and HTTP(S) URLs. Rejects executable schemes and protocol-relative URLs. */
export function isSafeMediaUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url || url.startsWith("//") || /[\\\u0000-\u001f]/.test(url)) return false;

  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  if (!scheme) return true;
  if ((scheme !== "http" && scheme !== "https") || !/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${scheme}:` && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
