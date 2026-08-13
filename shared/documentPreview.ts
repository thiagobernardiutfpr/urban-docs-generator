export function getPdfPreviewUrl(storageUrl: string): string {
  const baseUrl = storageUrl.split("#", 1)[0] ?? "";
  return `${baseUrl}#view=FitH`;
}
