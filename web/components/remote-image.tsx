"use client";

import { useState } from "react";

/** Loads a team logo or player photo by id. If it fails, it simply disappears. */
export function RemoteImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />;
}
