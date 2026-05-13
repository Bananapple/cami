import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type DrawerEntry =
  | { type: "member"; id: string }
  | { type: "class"; id: string };

type DrawerStackContextValue = {
  stack: DrawerEntry[];
  push: (entry: DrawerEntry) => void;
  pop: () => void;
  closeAll: () => void;
};

const DrawerStackContext = createContext<DrawerStackContextValue | null>(null);

const MAX_DEPTH = 2;

export function DrawerStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<DrawerEntry[]>([]);

  const push = useCallback((entry: DrawerEntry) => {
    setStack((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_DEPTH ? next.slice(next.length - MAX_DEPTH) : next;
    });
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const closeAll = useCallback(() => setStack([]), []);

  const value = useMemo(() => ({ stack, push, pop, closeAll }), [stack, push, pop, closeAll]);

  return <DrawerStackContext.Provider value={value}>{children}</DrawerStackContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDrawerStack() {
  const ctx = useContext(DrawerStackContext);
  if (!ctx) throw new Error("useDrawerStack must be used inside DrawerStackProvider");
  return ctx;
}
