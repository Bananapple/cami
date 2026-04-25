import { useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCommandSearch } from "../hooks/useCommandSearch";
import { useDrawerStack } from "../hooks/useDrawerStack";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const { data: results = [] } = useCommandSearch(query);
  const { push } = useDrawerStack();

  const members = results.filter((r) => r.kind === "member");
  const classes = results.filter((r) => r.kind === "class");

  const handleSelect = (result: (typeof results)[number]) => {
    push({ type: result.kind, id: result.id });
    onOpenChange(false);
    setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search members, classes..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.length < 2 ? "Type to search..." : "No results."}
        </CommandEmpty>

        {members.length > 0 && (
          <CommandGroup heading="Members">
            {members.map((r) => (
              <CommandItem
                key={`m-${r.id}`}
                value={`member-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r)}
              >
                <div className="flex flex-col">
                  <span className="text-sm">{r.label}</span>
                  {r.subtitle && (
                    <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {classes.length > 0 && (
          <CommandGroup heading="Classes">
            {classes.map((r) => (
              <CommandItem
                key={`c-${r.id}`}
                value={`class-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r)}
              >
                <div className="flex flex-col">
                  <span className="text-sm">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
