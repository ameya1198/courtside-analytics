import { TrendingDown, TrendingUp } from "lucide-react";
import { Legend, type LegendItem } from "@/components/charts/html";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** A chart in a card: takeaway title, what the chart shows, the chart, then a one-line trend and a note. */
export function ChartCard({
  title, description, trend, direction, note, children, className, legend,
}: {
  title: string;
  description?: string;
  trend?: string;
  direction?: "up" | "down";
  note?: string;
  children: React.ReactNode;
  /** e.g. "h-full", so two cards in a row stretch to the same height. */
  className?: string;
  /** What each colour, line and dot in the chart means. Shown under the description. */
  legend?: LegendItem[];
}) {
  const Icon = direction === "down" ? TrendingDown : TrendingUp;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {legend?.length ? <Legend items={legend} className="pt-1.5" /> : null}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
      {trend || note ? (
        <CardFooter className="flex-col items-start gap-2 text-[14px]">
          {trend ? (
            <div className="flex items-center gap-2 font-medium leading-none">
              {trend} {direction ? <Icon className="h-4 w-4" style={{ color: direction === "down" ? "var(--warn)" : "var(--accent)" }} /> : null}
            </div>
          ) : null}
          {note ? <div className="leading-none text-muted">{note}</div> : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
