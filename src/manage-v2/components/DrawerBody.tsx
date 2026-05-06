import type { ReactNode } from "react";

export function DrawerBody({
  children,
  gap = 16,
  padding = "20px 24px",
}: {
  children: ReactNode;
  gap?: number;
  padding?: string;
}) {
  return (
    <div style={{ padding, display: "flex", flexDirection: "column", gap }}>
      {children}
    </div>
  );
}
