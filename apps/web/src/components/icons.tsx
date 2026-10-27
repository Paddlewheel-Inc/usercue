import type { SVGProps } from "react";

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

type P = SVGProps<SVGSVGElement>;

export const ArrowUp = (p: P) => (
  <Icon {...p}>
    <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
  </Icon>
);
export const Heart = (p: P) => (
  <Icon {...p}>
    <path d="M8 13.4S2.4 9.85 2.4 6.2A3.2 3.2 0 0 1 8 3.7 3.2 3.2 0 0 1 13.6 6.2C13.6 9.85 8 13.4 8 13.4z" />
  </Icon>
);
export const More = (p: P) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <circle cx="4" cy="8" r="1.35" />
    <circle cx="8" cy="8" r="1.35" />
    <circle cx="12" cy="8" r="1.35" />
  </Icon>
);
export const Menu = (p: P) => (
  <Icon {...p}>
    <path d="M3 4.5h10M3 8h10M3 11.5h10" />
  </Icon>
);
export const Close = (p: P) => (
  <Icon {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);
export const Hash = (p: P) => (
  <Icon {...p}>
    <path d="M6.2 3.5 5 12.5M11 3.5 9.8 12.5M3.5 6.2h10M3.5 9.8h10" />
  </Icon>
);
export const At = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2.4" />
    <path d="M10.4 8v1.1a1.5 1.5 0 0 0 3 0V8a5.4 5.4 0 1 0-2.1 4.3" />
  </Icon>
);
export const Bell = (p: P) => (
  <Icon {...p}>
    <path d="M3.8 11.2h8.4c-.9-.9-1.4-1.9-1.4-3.4V6.6a2.8 2.8 0 0 0-5.6 0v1.2c0 1.5-.5 2.5-1.4 3.4z" />
    <path d="M6.6 13.2a1.5 1.5 0 0 0 2.8 0" />
  </Icon>
);
export const Search = (p: P) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.5 10.5 3 3" />
  </Icon>
);
export const Comment = (p: P) => (
  <Icon {...p}>
    <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7l-3 2.5V10.5a2 2 0 0 1-1.5-2z" />
  </Icon>
);
export const Plus = (p: P) => (
  <Icon {...p}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);
export const Inbox = (p: P) => (
  <Icon {...p}>
    <path d="M2.5 9.5 4 3.5h8l1.5 6M2.5 9.5v3h11v-3M2.5 9.5H6a2 2 0 0 0 4 0h3.5" />
  </Icon>
);
export const Roadmap = (p: P) => (
  <Icon {...p}>
    <path d="M2 4v9l4-1.5 4 1.5 4-1.5v-9L10 5.5 6 4z" />
    <path d="M6 4v7.5M10 5.5V13" />
  </Icon>
);
export const Globe = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8h11M8 2.5c1.7 1.6 2.5 3.4 2.5 5.5S9.7 11.9 8 13.5C6.3 11.9 5.5 10.1 5.5 8S6.3 4.1 8 2.5z" />
  </Icon>
);
export const Trash = (p: P) => (
  <Icon {...p}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5" />
  </Icon>
);
export const ChevronDown = (p: P) => (
  <Icon {...p}>
    <path d="m4 6.5 4 4 4-4" />
  </Icon>
);
export const ChevronLeft = (p: P) => (
  <Icon {...p}>
    <path d="m10 3.5-4.5 4.5L10 12.5" />
  </Icon>
);
export const LogOut = (p: P) => (
  <Icon {...p}>
    <path d="M6.5 2.5h-3v11h3M10 5l3 3-3 3M13 8H6.5" />
  </Icon>
);
export const Pen = (p: P) => (
  <Icon {...p}>
    <path d="M10 3.2 12.8 6 6.4 12.4 3.5 13l.6-2.9z" />
    <path d="M8.8 4.4 11.6 7.2" />
  </Icon>
);
export const Home = (p: P) => (
  <Icon {...p}>
    <path d="M2.5 8 8 3.2 13.5 8" />
    <path d="M4.5 7.2V13h7V7.2" />
  </Icon>
);
export const Sun = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2.6" />
    <path d="M8 2.4v1.4M8 12.2v1.4M2.4 8h1.4M12.2 8h1.4M3.9 3.9l1 1M11.1 11.1l1 1M3.9 12.1l1-1M11.1 4.9l1-1" />
  </Icon>
);
export const Moon = (p: P) => (
  <Icon {...p}>
    <path d="M10.4 2.8A5.4 5.4 0 1 0 13 10.6 4.2 4.2 0 0 1 10.4 2.8z" />
  </Icon>
);
export const Layers = (p: P) => (
  <Icon {...p}>
    <path d="m2.5 6 5.5-3 5.5 3-5.5 3z" />
    <path d="m2.5 10 5.5 3 5.5-3" />
    <path d="m2.5 8 5.5 3 5.5-3" />
  </Icon>
);
export const Discord = (p: P) => (
  <Icon {...p} fill="currentColor" stroke="none" viewBox="-3.11 -3.11 30.22 30.22">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </Icon>
);
export const Google = (p: P) => (
  <Icon {...p}>
    <path d="M8 3.5A4.5 4.5 0 1 0 12.2 8H8" />
    <path d="M12.2 8A4.5 4.5 0 0 1 8 12.5 4.5 4.5 0 0 1 4.3 6.4" />
  </Icon>
);
export const Copy = (p: P) => (
  <Icon {...p}>
    <rect x="5.5" y="5.5" width="7" height="7" rx="1.2" />
    <path d="M3.5 10.5V4.2A.7.7 0 0 1 4.2 3.5h6.3" />
  </Icon>
);
export const Check = (p: P) => (
  <Icon {...p}>
    <path d="m3.5 8.2 3 3 6-6.4" />
  </Icon>
);
export const Shield = (p: P) => (
  <Icon {...p}>
    <path d="M8 2.5 3.5 4.5v4c0 2.8 1.9 4.8 4.5 5.5 2.6-.7 4.5-2.7 4.5-5.5v-4z" />
  </Icon>
);
export const Gear = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 2.6v1.4M8 12v1.4M2.6 8h1.4M12 8h1.4M4.1 4.1l1 1M10.9 10.9l1 1M4.1 11.9l1-1M10.9 5.1l1-1" />
  </Icon>
);
export const GitHub = (p: P) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <path d="M8 1.4a6.6 6.6 0 0 0-2.09 12.86c.33.06.45-.14.45-.32v-1.13c-1.83.4-2.22-.88-2.22-.88-.3-.76-.73-.96-.73-.96-.6-.41.05-.4.05-.4.67.04 1.02.68 1.02.68.59 1 1.55.71 1.93.54.06-.43.23-.71.42-.87-1.46-.17-3-.73-3-3.25 0-.72.25-1.3.68-1.76-.07-.17-.3-.84.06-1.75 0 0 .56-.18 1.83.68a6.4 6.4 0 0 1 3.33 0c1.27-.86 1.83-.68 1.83-.68.36.91.13 1.58.06 1.75.43.46.68 1.04.68 1.76 0 2.53-1.54 3.08-3.01 3.24.24.21.46.62.46 1.26v1.87c0 .18.12.38.45.32A6.6 6.6 0 0 0 8 1.4z" />
  </Icon>
);
export const ArrowUpRight = (p: P) => (
  <Icon {...p}>
    <path d="M5 11 11 5M6.5 5H11v4.5" />
  </Icon>
);
export const Pencil = (p: P) => (
  <Icon {...p}>
    <path d="m10.4 3.1 2.5 2.5-6.7 6.7-3 .7.7-3z" />
  </Icon>
);
export const Heading = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 3.5v9M9.5 3.5v9M3.5 8h6" />
  </Icon>
);
export const Bold = (p: P) => (
  <Icon {...p}>
    <path d="M4.5 3.5h5a2.5 2.5 0 0 1 0 5h-5zM4.5 8.5h5.5a2.5 2.5 0 0 1 0 5H4.5z" />
  </Icon>
);
export const Italic = (p: P) => (
  <Icon {...p}>
    <path d="M7 3.5h5M4 12.5h5M9.5 3.5 6.5 12.5" />
  </Icon>
);
export const Underline = (p: P) => (
  <Icon {...p}>
    <path d="M4.5 3.5v5a3.5 3.5 0 0 0 7 0v-5M3.5 13.5h9" />
  </Icon>
);
export const Highlight = (p: P) => (
  <Icon {...p}>
    <path d="M4 13.5h8M5.5 10.5 9 3.5h1.5L7 10.5zM5.5 10.5 4 13.5" />
  </Icon>
);
export const LinkIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6.5 9.5 5 11a2.2 2.2 0 0 1-3-3l2-2a2.2 2.2 0 0 1 3 0" />
    <path d="M9.5 6.5 11 5a2.2 2.2 0 1 1 3 3l-2 2a2.2 2.2 0 0 1-3 0" />
  </Icon>
);
export const BulletList = (p: P) => (
  <Icon {...p}>
    <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
    <circle cx="3" cy="4" r="0.6" fill="currentColor" />
    <circle cx="3" cy="8" r="0.6" fill="currentColor" />
    <circle cx="3" cy="12" r="0.6" fill="currentColor" />
  </Icon>
);
export const NumberedList = (p: P) => (
  <Icon {...p}>
    <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
    <path
      d="M2.5 3 3.5 2.5v3M2.3 7.3a.9.9 0 0 1 1.6.4c0 .6-1.6 1.3-1.6 1.8h1.7"
      strokeWidth="1.1"
    />
    <path d="M2.4 11h1.4l-.8 1a.8.8 0 1 1-.7 1.1" strokeWidth="1.1" />
  </Icon>
);
export const ImageIcon = (p: P) => (
  <Icon {...p}>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
    <circle cx="6" cy="7" r="1" />
    <path d="m5 12.5 3.2-3.2 2 2L12.5 9" />
  </Icon>
);

export const StatusOpen = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5" />
  </Icon>
);
export const StatusPlanned = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5" />
    <circle cx="8" cy="8" r="2" />
  </Icon>
);
export const StatusProgress = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5" />
    <path d="M8 3a5 5 0 0 1 0 10" />
  </Icon>
);
export const StatusComplete = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5" />
    <path d="m5.5 8.2 1.8 1.8 3.4-3.6" />
  </Icon>
);
export const StatusClosed = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5" />
    <path d="m6 6 4 4M10 6l-4 4" />
  </Icon>
);
