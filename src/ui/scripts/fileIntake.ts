// Handles files handed to the app by the operating system:
// - Android/desktop Web Share Target (POST intercepted by the service worker)
// - Installed PWA "Open with" file handlers (launchQueue)
import { CurrentPage, LoadingToolsText, Pages, PopupData } from "src/ui/AppState";
import { openPopup } from "src/ui/PopupStore";
import { SelectedFiles } from "src/main";

/** Must match the cache name in public/mini-coi.js. */
const SHARE_CACHE = "convert2it-share";
const SHARE_PREFIX = "__shared__/";

function shareBase() {
  return new URL("./", location.href);
}

async function waitForFormats() {
  if (LoadingToolsText.value === undefined) return;
  await new Promise<void>((resolve) => {
    let done = false;
    let dispose: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      dispose?.();
      resolve();
    };
    timeout = setTimeout(finish, 60_000);
    dispose = LoadingToolsText.subscribe((value) => {
      if (value === undefined) finish();
    });
    // subscribe() runs immediately, so the promise may already be resolved.
    if (done) dispose();
  });
}

function acceptFiles(files: File[]) {
  if (!files.length) return;

  // The converter works on one input format at a time.
  const firstType = files[0].type;
  const sameType = files.filter((file) => file.type === firstType);
  const chosen = sameType.length ? sameType : files;

  SelectedFiles.value = Object.fromEntries(
    chosen.map((file) => [`${file.name}-${file.lastModified}`, file]),
  );
  CurrentPage.value = Pages.Conversion;
}

interface SharedMeta {
  files: { name: string; type: string; size: number }[];
  title?: string;
  text?: string;
  url?: string;
}

function isSharedMeta(value: unknown): value is SharedMeta {
  if (typeof value !== "object" || value === null) return false;
  const files = Reflect.get(value, "files");
  return files === undefined || Array.isArray(files);
}

async function consumeSharedFiles(id: string) {
  if (!("caches" in window)) return [];

  const cache = await caches.open(SHARE_CACHE);
  const base = shareBase();
  const metaKey = new URL(`${SHARE_PREFIX}${id}`, base).href;
  const metaResponse = await cache.match(metaKey);
  if (!metaResponse) return [];

  let meta: SharedMeta;
  try {
    const parsed: unknown = await metaResponse.json();
    if (!isSharedMeta(parsed)) return [];
    meta = parsed;
  } catch {
    return [];
  }

  const files: File[] = [];
  const keys = [metaKey];

  for (let index = 0; index < (meta.files?.length ?? 0); index++) {
    const key = new URL(`${SHARE_PREFIX}${id}/${index}`, base).href;
    keys.push(key);
    const response = await cache.match(key);
    if (!response) continue;

    const blob = await response.blob();
    const encodedName = response.headers.get("x-file-name");
    let name = meta.files[index]?.name || `shared-${index}`;
    if (encodedName) {
      try {
        name = decodeURIComponent(encodedName);
      } catch {}
    }

    files.push(
      new File([blob], name, {
        type: meta.files[index]?.type || blob.type || "application/octet-stream",
        lastModified: Date.now(),
      }),
    );
  }

  // A link or note was shared without a file: make it convertible.
  if (!files.length && (meta.text || meta.url)) {
    const content = [meta.title, meta.text, meta.url].filter(Boolean).join("\n\n");
    files.push(
      new File([content], "shared-link.txt", { type: "text/plain", lastModified: Date.now() }),
    );
  }

  await Promise.all(keys.map((key) => cache.delete(key).catch(() => false)));
  return files;
}

async function initShareTarget() {
  const params = new URLSearchParams(location.search);
  const id = params.get("share");
  const failed = params.get("share-error");

  // Drop the post-reload marker used by "Clear cache & site data".
  if (params.has("cleared")) {
    history.replaceState(null, "", location.pathname);
  }

  if (failed) {
    history.replaceState(null, "", location.pathname + location.hash);
    PopupData.value = {
      title: "Couldn't import the shared file",
      text: "The share could not be read. Try sharing the file again.",
      dismissible: true,
      buttonText: "OK",
    };
    openPopup();
  }

  if (!id) return;
  history.replaceState(null, "", location.pathname + location.hash);

  await waitForFormats();
  let files: File[] = [];
  try {
    files = await consumeSharedFiles(id);
  } catch (error) {
    console.error("[share-target]", error);
  }

  if (files.length) {
    acceptFiles(files);
  } else {
    PopupData.value = {
      title: "Nothing to convert",
      text: "The shared item didn't contain a file this app can open.",
      dismissible: true,
      buttonText: "OK",
    };
    openPopup();
  }
}

interface FileLaunchParams {
  files?: { getFile: () => Promise<File> }[];
}

declare global {
  interface Window {
    launchQueue?: {
      setConsumer: (fn: (params: FileLaunchParams) => void) => void;
    };
  }
}

function initFileHandlers() {
  const queue = window.launchQueue;
  if (!queue?.setConsumer) return;

  queue.setConsumer(async (params) => {
    const handles = params.files ?? [];
    if (!handles.length) return;

    await waitForFormats();
    const results = await Promise.all(handles.map((handle) => handle.getFile().catch(() => null)));
    const files = results.filter((file): file is File => file !== null);
    if (files.length) acceptFiles(files);
  });
}

export function initFileIntake() {
  void initShareTarget().catch((error) => console.error("[share-target]", error));
  initFileHandlers();
}
