import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Verification } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  pending: "bg-blue-50 text-blue-700",
  processing: "bg-yellow-50 text-yellow-700",
  complete: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

const USE_CASE_LABEL: Record<string, string> = {
  room: "Room",
  property: "Property",
  car: "Vehicle",
  item: "Item",
  generic: "General",
};

export function VerificationCard({ verification }: { verification: Verification }) {
  const date = new Date(verification.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/verify/${verification.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="font-medium text-neutral-900 truncate">
            {verification.title ?? `${USE_CASE_LABEL[verification.use_case]} verification`}
          </p>
          <p className="text-sm text-neutral-500">{date}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[verification.status]}`}
          >
            {verification.status}
          </span>
          <Badge variant="secondary" className="text-xs">
            {USE_CASE_LABEL[verification.use_case]}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
