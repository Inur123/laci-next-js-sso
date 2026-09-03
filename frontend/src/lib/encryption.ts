// UI-only helpers. Encryption/decryption is implemented exclusively by Go.
function getOriginalExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/-([a-z0-9]+)\.enc$/);
  return match?.[1] || "";
}
export function isPdf(fileName: string | null | undefined): boolean {
  return !!fileName && getOriginalExtension(fileName) === "pdf";
}
export function isImage(fileName: string | null | undefined): boolean {
  return !!fileName && ["png", "jpg", "jpeg", "gif", "webp"].includes(getOriginalExtension(fileName));
}
