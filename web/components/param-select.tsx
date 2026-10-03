"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Option = { value: string; label: string };

/** A select that writes its value into the URL, so every view can be linked and shared. */
export function ParamSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Option[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <label className="label inline-flex items-center gap-2 border-2 border-current px-3 py-2" data-pending={pending || undefined}>
      <span className="opacity-80">{label}</span>
      <select
        className="cursor-pointer bg-transparent font-mono text-[13px] font-medium uppercase outline-none [&>option]:text-ink"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set(name, e.target.value);
          start(() => router.push(`${path}?${next.toString()}`));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {pending ? <span aria-live="polite">…</span> : null}
    </label>
  );
}
