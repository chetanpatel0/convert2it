// Outgoing Web Share support: hands converted files to the device's native
// share sheet (Android, iOS, and any browser that implements share targets).
import mime from "mime";

export interface OutputFile {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

export function toShareFiles(files: OutputFile[]): File[] {
  return files.map(
    (file) =>
      new File([file.bytes], file.name, {
        type: mime.getType(file.name) ?? "application/octet-stream",
      }),
  );
}

export function canShareFiles(files: File[]): boolean {
  if (!files.length || typeof navigator === "undefined") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

export async function shareFiles(files: File[], title: string, text: string): Promise<ShareResult> {
  if (!canShareFiles(files) || typeof navigator.share !== "function") return "unsupported";
  try {
    await navigator.share({ files, title, text });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    console.error("[share]", error);
    return "unsupported";
  }
}
