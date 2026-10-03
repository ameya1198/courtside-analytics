import { Wrap } from "./blocks";
import { RemoteImage } from "./remote-image";

/** The coloured band at the top of each page. Takes the colour of the team on screen. */
export function Hero({
  eyebrow, title, controls, children, watermark, side,
}: {
  eyebrow: string;
  title: React.ReactNode;
  controls?: React.ReactNode;
  children?: React.ReactNode;
  watermark?: { src: string; alt: string };
  side?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-hero text-hero-ink">
      {watermark ? (
        <div aria-hidden className="pointer-events-none absolute right-[3%] top-1/2 hidden w-[44%] max-w-[560px] -translate-y-1/2 opacity-[0.14] md:block">
          <RemoteImage src={watermark.src} alt="" className="h-auto w-full" />
        </div>
      ) : null}
      <Wrap className="relative flex flex-wrap items-end gap-x-10 gap-y-6 pt-10">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-7 pb-12">
          <div className="flex flex-col gap-2">
            <span className="label text-[13px]">{eyebrow}</span>
            <h1 className="display text-[clamp(52px,8vw,120px)]">{title}</h1>
            {controls ? <div className="mt-3 flex flex-wrap gap-2">{controls}</div> : null}
          </div>
          {children}
        </div>
        {side}
      </Wrap>
    </section>
  );
}

export function KpiRow({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-y-4 border-t-[3px] border-current pt-4 sm:grid-cols-4 sm:justify-start">
      {items.map((k) => (
        <div key={k.label} className="flex flex-col gap-0.5 pr-6">
          <span className="label">{k.label}</span>
          <span className="display text-[clamp(44px,5vw,72px)]">{k.value}</span>
          {k.note ? <span className="text-[14px]">{k.note}</span> : null}
        </div>
      ))}
    </div>
  );
}
