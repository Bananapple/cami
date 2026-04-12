import { ChevronRight } from "lucide-react";

interface DateStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const DateStrip = ({ selectedDate, onSelectDate }: DateStripProps) => {
  const today = new Date();
  const dates = Array.from({ length: 9 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const isSelected = (d: Date) =>
    d.toDateString() === selectedDate.toDateString();

  const isToday = (d: Date) => d.toDateString() === today.toDateString();

  const dayLabel = (d: Date) =>
    isToday(d) ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

  const dateNum = (d: Date) => d.getDate();
  const monthLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short" });

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
      {dates.map((d, i) => (
        <button
          key={i}
          onClick={() => onSelectDate(d)}
          className={`flex-shrink-0 snap-start flex flex-col items-center px-4 py-3 rounded-lg transition-all min-w-[72px] ${
            isSelected(d)
              ? "bg-primary text-primary-foreground border-2 border-primary"
              : "bg-card text-card-foreground border border-border hover:border-primary/50"
          }`}
        >
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider">
            {dayLabel(d)}
          </span>
          <span className="text-lg font-serif mt-0.5">{dateNum(d)}</span>
          <span className="text-[10px] font-sans text-current/70">
            {monthLabel(d)}
          </span>
        </button>
      ))}
      <div className="flex-shrink-0 flex items-center px-1">
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
};

export default DateStrip;
