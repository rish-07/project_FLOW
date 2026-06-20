// Hands a drag-dropped image from the global DropZone to the /upload screen.
// In-memory (module-scoped) — a File can't go through a URL param, and the
// project bans localStorage/sessionStorage for cross-page state. Lives only
// for the SPA session; consumed and cleared by the upload page.
export const pendingUpload = $state<{ file: File | null }>({ file: null });

export function setPendingUpload(file: File): void {
  pendingUpload.file = file;
}
export function takePendingUpload(): File | null {
  const f = pendingUpload.file;
  pendingUpload.file = null;
  return f;
}
