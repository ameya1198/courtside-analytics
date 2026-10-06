"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { startNav } from "@/lib/nav-progress";

type Option = { value: string; label: string };

/** A select that writes its value into the URL, so every view can be linked and shared. */
export function ParamSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Option[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <label className="label relative inline-flex items-center gap-2 border-2 border-current px-3 py-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-current" data-pending={pending || undefined}>
      <span className="opacity-80">{label}</span>
      <select
        className="cursor-pointer appearance-none bg-transparent pr-5 font-mono text-[13px] font-medium uppercase outline-none [&>option]:text-ink"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set(name, e.target.value);
          startNav(path);
          start(() => router.push(`${path}?${next.toString()}`));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-[7px] -translate-y-[70%] rotate-45 border-b-2 border-r-2 border-current" />
      {pending ? <span aria-live="polite">…</span> : null}
    </label>
  );
}
