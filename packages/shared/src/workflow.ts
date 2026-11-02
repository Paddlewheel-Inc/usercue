import type { BuiltinStatus } from "./index";

export const WORKFLOW_ICONS = [
  "default",
  "circle",
  "circle-dashed",
  "circle-half",
  "circle-check",
  "circle-dot",
  "play",
  "star",
  "progress",
  "check",
  "close",
  "bolt",
  "pause",
  "flag",
  "heart",
  "clock",
  "review",
  "inbox",
  "calendar",
  "target",
  "rocket",
  "archive",
  "blocked",
  "sparkles",
] as const;
export type WorkflowIcon = (typeof WORKFLOW_ICONS)[number];
export const WORKFLOW_ICON_LABELS: Record<WorkflowIcon, string> = {
  default: "Original icons",
  circle: "Planned circle",
  "circle-dashed": "Review ring",
  "circle-half": "In progress",
  "circle-check": "Completed circle",
  "circle-dot": "Ready",
  play: "Play",
  star: "Star badge",
  progress: "Progress clock",
  check: "Checked box",
  close: "Closed",
  bolt: "Lightning",
  pause: "Paused",
  flag: "Milestone",
  heart: "Heart",
  clock: "Waiting",
  review: "Review",
  inbox: "Inbox",
  calendar: "Scheduled",
  target: "Goal",
  rocket: "Launch",
  archive: "Archived",
  blocked: "Blocked",
  sparkles: "Sparkles",
};
export const WORKFLOW_ICON_GROUPS = [
  { label: "Original", icons: ["default"] },
  {
    label: "Status and progress",
    icons: [
      "circle",
      "circle-dashed",
      "circle-half",
      "circle-check",
      "circle-dot",
      "progress",
      "clock",
      "play",
      "pause",
      "check",
      "close",
      "blocked",
    ],
  },
  {
    label: "Work and milestones",
    icons: [
      "review",
      "inbox",
      "calendar",
      "target",
      "flag",
      "rocket",
      "star",
      "sparkles",
      "bolt",
      "heart",
      "archive",
    ],
  },
] as const satisfies readonly { label: string; icons: readonly WorkflowIcon[] }[];
export interface WorkflowStatus {
  id: string;
  name: string;
  icon: WorkflowIcon;
  color: string;
  category: BuiltinStatus;
}
export const DEFAULT_WORKFLOW: WorkflowStatus[] = [
  { id: "open", name: "Open", icon: "default", color: "#a8a29e", category: "open" },
  { id: "planned", name: "Planned", icon: "default", color: "#0ea5e9", category: "planned" },
  {
    id: "in_progress",
    name: "In Progress",
    icon: "default",
    color: "#8b5cf6",
    category: "in_progress",
  },
  { id: "complete", name: "Complete", icon: "default", color: "#10b981", category: "complete" },
  { id: "closed", name: "Closed", icon: "default", color: "#fb7185", category: "closed" },
];
