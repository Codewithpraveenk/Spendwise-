export function downloadText(text, name, mimeType) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Keep the URL alive long enough for the browser to start its download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
