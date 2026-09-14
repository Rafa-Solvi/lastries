// Archivos de demostración propios en IndexedDB (FR-012).
import type { DemoRef, Id, Media, MediaMimeType } from "../domain/types.ts";
import { getMediaBlob, type StoredMedia } from "./db.ts";
import { commit, getState, newId, removeWhere } from "./store.ts";

const EXT: Record<MediaMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ACCEPTED_MEDIA = Object.keys(EXT).join(",");

export async function addMedia(file: File): Promise<Media> {
  const mimeType = file.type as MediaMimeType;
  if (!(mimeType in EXT)) throw new Error("Formato no admitido: usa JPEG, PNG, WebP o GIF");
  const id = newId();
  const media: Media = { id, mimeType, fileName: `${id}.${EXT[mimeType]}`, byteSize: file.size };
  const stored: StoredMedia = { ...media, blob: file };
  await commit(
    ["media"],
    async (tx) => {
      await tx.objectStore("media").put(stored);
    },
    (s) => ({ ...s, media: [...s.media, media] }),
  );
  return media;
}

const urlCache = new Map<Id, string>();

export async function getMediaUrl(mediaId: Id): Promise<string | null> {
  const cached = urlCache.get(mediaId);
  if (cached) return cached;
  const blob = await getMediaBlob(mediaId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(mediaId, url);
  return url;
}

export function clearMediaUrlCache(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

export function bundledUrl(path: string): string {
  return `./catalog/img/${path}`;
}

/** Borra el Media si ningún ejercicio lo referencia. */
export async function removeMediaIfOrphan(mediaId: Id): Promise<void> {
  const used = getState().exercises.some((e) =>
    e.demos.some((d: DemoRef) => d.kind === "media" && d.mediaId === mediaId),
  );
  if (used) return;
  await commit(
    ["media"],
    async (tx) => {
      await tx.objectStore("media").delete(mediaId);
    },
    (s) => ({ ...s, media: removeWhere(s.media, (m) => m.id === mediaId) }),
  );
  const url = urlCache.get(mediaId);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(mediaId);
  }
}
