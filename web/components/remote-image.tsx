"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Loads a team logo or player photo by id. If it fails, it simply disappears. */
export function RemoteImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      // Fade in once loaded. The parent's opacity (e.g. the 14% watermark) still applies on top.
      className={cn("transition-opacity duration-[850ms] ease-out", loaded ? "opacity-100" : "opacity-0", className)}
      ref={(el) => { if (el?.complete && el.naturalWidth) setLoaded(true); }}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
