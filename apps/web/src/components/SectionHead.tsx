import type { ReactNode } from "react";

export function SectionHead({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-medium">{title}</h2>
      <p className="mt-1 text-[12px] text-muted">{children}</p>
    </div>
  );
}
