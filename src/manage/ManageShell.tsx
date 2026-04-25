import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { NavRail } from "./components/NavRail";
import { TopBar } from "./components/TopBar";
import { CommandPalette } from "./components/CommandPalette";
import { DrawerStackProvider } from "./hooks/useDrawerStack";
import { DrawerLayer } from "./drawers/DrawerLayer";

export function ManageShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DrawerStackProvider>
      <div className="min-h-screen flex bg-background text-foreground">
        <NavRail />
        <div className="flex-1 flex flex-col">
          <TopBar onOpenPalette={() => setPaletteOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
        <DrawerLayer />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </DrawerStackProvider>
  );
}
