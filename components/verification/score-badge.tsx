import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const level = score >= 80 ? "high" : score >= 60 ? "moderate" : "low";

  const config = {
    high: { label: "High match", color: "text-green-700 bg-green-50 border-green-200" },
    moderate: { label: "Moderate match", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
    low: { label: "Low match", color: "text-red-700 bg-red-50 border-red-200" },
  }[level];

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1", config.color, className)}>
      <span className="text-lg font-bold">{score}</span>
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
}
