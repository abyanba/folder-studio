/**
 * Titled group inside a docked panel. Keeps panel layout consistent across the
 * 11 panels: uppercase micro-label, optional right-aligned action, spaced body.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PanelSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  /** Optional control rendered on the same row as the title (e.g. a Switch). */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {(title || action) && (
        <div className="flex h-5 items-center justify-between">
          {title && (
            <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
