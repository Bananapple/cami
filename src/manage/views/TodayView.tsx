import { useTodayClasses } from "../hooks/useTodayClasses";
import { ClassCard } from "../components/ClassCard";

export function TodayView() {
  const { data: classes = [], isLoading } = useTodayClasses();

  const dateLabel = new Date().toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-serif capitalize">{dateLabel}</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${classes.length} classes today`}
        </p>
      </header>

      {!isLoading && classes.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No classes scheduled today.
        </p>
      )}

      <div className="space-y-3">
        {classes.map((c) => (
          <ClassCard key={c.id} classInstance={c} />
        ))}
      </div>
    </div>
  );
}
