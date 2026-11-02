import type { WorkflowIcon as IconName } from "@usercue/shared";
import { useWorkflowStatus } from "../lib/workflow";
import { Heart } from "./icons";

export function WorkflowGlyph({
  icon,
  color,
  size = 14,
  filled = false,
}: {
  icon: IconName;
  color: string;
  size?: number;
  filled?: boolean;
}) {
  if (icon === "default") {
    return (
      <Heart
        width={size}
        height={size}
        style={{ color }}
        className="shrink-0"
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color }}
      className="shrink-0"
      aria-hidden="true"
    >
      {icon === "circle" && <circle cx="10" cy="10" r="6.5" />}
      {icon === "circle-dashed" && (
        <circle cx="10" cy="10" r="6.5" strokeDasharray="7.2 3" transform="rotate(-75 10 10)" />
      )}
      {icon === "circle-half" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="M10 5.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" stroke="none" />
        </>
      )}
      {icon === "circle-check" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="m6.8 10 2.1 2.2 4.3-4.4" />
        </>
      )}
      {icon === "circle-dot" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="2.3" fill="currentColor" stroke="none" />
        </>
      )}
      {icon === "play" && (
        <>
          <circle cx="10" cy="10" r="7" />
          <path d="m8.5 6.8 4.5 3.2-4.5 3.2z" fill="currentColor" stroke="none" />
        </>
      )}
      {icon === "star" && (
        <>
          <circle cx="10" cy="10" r="8" fill="currentColor" stroke="none" />
          <path
            d="m10 5 1.5 3.1 3.5.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4L5 8.6l3.5-.5z"
            fill="var(--surface)"
            stroke="none"
          />
        </>
      )}
      {icon === "progress" && (
        <>
          <circle cx="10" cy="10" r="6.5" opacity=".25" />
          <path d="M10 3.5a6.5 6.5 0 0 1 6.5 6.5" strokeWidth="2.4" />
          <path d="M10 6.5V10l2.5 1.5" />
        </>
      )}
      {icon === "check" && (
        <>
          <rect x="3.5" y="3.5" width="13" height="13" rx="4" />
          <path d="m6.5 10 2.3 2.5 4.7-5" />
        </>
      )}
      {icon === "close" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="m7.5 7.5 5 5m0-5-5 5" />
        </>
      )}
      {icon === "bolt" && <path d="m11.5 2.5-7 8.5h5l-1 6.5 7-9h-5z" />}
      {icon === "pause" && (
        <>
          <rect x="4" y="4" width="4" height="12" rx="1.5" fill="currentColor" stroke="none" />
          <rect x="12" y="4" width="4" height="12" rx="1.5" fill="currentColor" stroke="none" />
        </>
      )}
      {icon === "flag" && (
        <>
          <path d="M5 17V3m0 1c4-3 6 3 10 0v8c-4 3-6-3-10 0" />
          <path d="M3 17h4" />
        </>
      )}
      {icon === "heart" && (
        <path d="M10 16s-6.5-4-6.5-8A3.7 3.7 0 0 1 10 5.5 3.7 3.7 0 0 1 16.5 8c0 4-6.5 8-6.5 8Z" />
      )}
      {icon === "clock" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="M10 6v4l2.7 1.6" />
        </>
      )}
      {icon === "review" && (
        <>
          <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
          <circle cx="10" cy="10" r="2.3" />
        </>
      )}
      {icon === "inbox" && (
        <>
          <path d="M3 11 5 4h10l2 7v5H3z" />
          <path d="M3 11h4l1.5 2h3l1.5-2h4" />
        </>
      )}
      {icon === "calendar" && (
        <>
          <rect x="3.5" y="4.5" width="13" height="12" rx="2.5" />
          <path d="M7 3v3m6-3v3M3.5 8.5h13m-9 3h2m2 0h1m-5 2.5h2" />
        </>
      )}
      {icon === "target" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="3.5" />
          <circle cx="10" cy="10" r=".8" fill="currentColor" stroke="none" />
        </>
      )}
      {icon === "rocket" && (
        <>
          <path d="M7 12c1-5 4.5-8 10-9-.3 5.5-3.5 9-9 10zm.5-4.5L4 8l-1 5 4-1m5.5.5L12 16l-5 1 1-4" />
          <circle cx="12.5" cy="7.5" r="1.4" />
          <path d="m5.5 14.5-2 2" />
        </>
      )}
      {icon === "archive" && (
        <>
          <rect x="3" y="3.5" width="14" height="4" rx="1.3" />
          <path d="M4.5 7.5v9h11v-9M8 11h4" />
        </>
      )}
      {icon === "blocked" && (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="m5.4 5.4 9.2 9.2" />
        </>
      )}
      {icon === "sparkles" && (
        <>
          <path d="m8 3 1.8 4.8L14.5 9.5l-4.7 1.8L8 16l-1.8-4.7-4.7-1.8 4.7-1.7zM15.5 2.5v4m-2-2h4M16 13v4m-2-2h4" />
        </>
      )}
    </svg>
  );
}

export function StatusIcon({
  status,
  size = 14,
  filled = false,
}: {
  status: string;
  size?: number;
  filled?: boolean;
}) {
  const item = useWorkflowStatus(status);
  return <WorkflowGlyph icon={item.icon} color={item.color} size={size} filled={filled} />;
}

export function StatusName({ status }: { status: string }) {
  return <>{useWorkflowStatus(status).name}</>;
}
