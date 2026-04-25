import { useDrawerStack } from "../hooks/useDrawerStack";
import { MemberDrawer } from "./MemberDrawer";
import { ClassDrawer } from "./ClassDrawer";

// V1 — renders up to 2 stacked drawers from local state.
// We render each entry separately; Radix Sheet handles its own portal/overlay per instance.
export function DrawerLayer() {
  const { stack, pop } = useDrawerStack();

  return (
    <>
      {stack.map((entry, i) => {
        const isTop = i === stack.length - 1;
        const onOpenChange = (open: boolean) => {
          if (!open && isTop) pop();
        };

        if (entry.type === "member") {
          return (
            <MemberDrawer
              key={`member-${entry.id}-${i}`}
              userId={entry.id}
              open
              onOpenChange={onOpenChange}
            />
          );
        }
        if (entry.type === "class") {
          return (
            <ClassDrawer
              key={`class-${entry.id}-${i}`}
              classId={entry.id}
              open
              onOpenChange={onOpenChange}
            />
          );
        }
        return null;
      })}
    </>
  );
}
