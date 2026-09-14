import { useEffect, useState } from "preact/hooks";
import { bundledUrl, getMediaUrl } from "../../data/media.ts";
import type { DemoRef } from "../../domain/types.ts";

export function DemoImage({ demo, className, alt = "" }: { demo: DemoRef; className?: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(demo.kind === "bundled" ? bundledUrl(demo.path) : null);
  useEffect(() => {
    if (demo.kind === "bundled") {
      setSrc(bundledUrl(demo.path));
      return;
    }
    let alive = true;
    void getMediaUrl(demo.mediaId).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [demo.kind === "bundled" ? demo.path : demo.mediaId]);
  if (!src) return <div class={className} />;
  return <img class={className} src={src} alt={alt} loading="lazy" />;
}
