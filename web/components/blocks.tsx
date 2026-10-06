import { cn } from "@/lib/utils";

export function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 md:px-12", className)}>{children}</div>;
}

/** Section title: one actionable sentence, then a short line saying what the chart shows. */
export function Heading({ title, caption, size = "lg" }: { title: string; caption?: string; size?: "lg" | "md" }) {
  return (
    // Big headings sit above full-width charts: span the whole width and fill each line.
    // Smaller ones sit in half-width columns, where evenly balanced lines read better.
    <div className="flex flex-col gap-2">
      <h2 className={cn("display", size === "lg" ? "text-pretty text-[clamp(30px,4vw,48px)]" : "text-balance text-[clamp(26px,3vw,38px)]")}>
        {title}
      </h2>
      {caption ? <p className="text-pretty text-[16px] text-muted">{caption}</p> : null}
    </div>
  );
}

export function Section({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("mt-8 border-t border-line pt-14", className)}>{children}</section>;
}

export function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 pr-6">
      <span className="label">{label}</span>
      <span className="display text-[clamp(44px,5vw,72px)]">{value}</span>
      {note ? <span className="text-[14px]">{note}</span> : null}
    </div>
  );
}

export function Placeholder({ title, need }: { title: string; need: string }) {
  return (
    <div className="flex min-h-[260px] flex-col justify-center gap-2 border-[3px] border-dashed border-ink p-6">
      <span className="label text-[#D9480F]">Not loaded yet</span>
      <span className="display text-[clamp(28px,3vw,40px)]">{title}</span>
      <span className="text-[15px] text-muted">{need}</span>
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ink text-white">
      <Wrap className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
        <span className="label bg-white px-2 py-0.5 text-ink">Note</span>
        <span className="text-[15px]">{children}</span>
      </Wrap>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border-[3px] border-ink p-6 text-[16px] text-muted">{children}</div>;
}
