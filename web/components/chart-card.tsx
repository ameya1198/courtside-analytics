import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** A chart in a card: takeaway title, what the chart shows, the chart, then a one-line trend and a note. */
export function ChartCard({
  title, description, trend, direction, note, children,
}: {
  title: string;
  description?: string;
  trend?: string;
  direction?: "up" | "down";
  note?: string;
  children: React.ReactNode;
}) {
  const Icon = direction === "down" ? TrendingDown : TrendingUp;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
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
