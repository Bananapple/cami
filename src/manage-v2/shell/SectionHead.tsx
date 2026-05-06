import type { ReactNode } from "react";
import { Button } from "../components/Button";

export function SectionHead({
  title,
  cta,
  onClick,
  rightSlot,
}: {
  title: string;
  cta?: string;
  onClick?: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="sm-section-head">
      <h2>{title}</h2>
      {rightSlot}
      {cta && onClick && (
        <Button variant="ghost" size="sm" onClick={onClick}>+ {cta}</Button>
      )}
    </div>
  );
}
