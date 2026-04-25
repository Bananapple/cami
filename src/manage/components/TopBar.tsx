import { Search, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const initials =
    profile?.avatar_initials ||
    profile?.full_name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  const displayName = profile?.full_name || user?.email || "";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 gap-4">
      <div className="font-serif text-lg shrink-0">Studio Manager</div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 text-sm text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-muted transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="ml-2 text-[10px] bg-background border border-border rounded px-1.5 py-0.5 font-mono">
            ⌘K
          </kbd>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-serif text-primary">
                {initials}
              </div>
              <span className="text-sm text-foreground/80 max-w-[140px] truncate hidden sm:block">
                {displayName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive">
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
