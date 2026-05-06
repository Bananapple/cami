import { useRef, useEffect } from "react";
import { useStudioContext } from "@/context/StudioContext";
import { todayInTimezone, toDateString } from "@/lib/timezone";

interface DateStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const DateStrip = ({ selectedDate, onSelectDate }: DateStripProps) => {
  const studioCtx = useStudioContext();
  const studioTz = studioCtx?.studio?.timezone ?? "Europe/Oslo";

  const today = todayInTimezone(studioTz);
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const todayStr = toDateString(today, studioTz);
  const selectedStr = toDateString(selectedDate, studioTz);

  const isSelected = (d: Date) => toDateString(d, studioTz) === selectedStr;
  const isToday = (d: Date) => toDateString(d, studioTz) === todayStr;

  const dayLabel = (d: Date) =>
    isToday(d) ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

  const dateNum = (d: Date) => d.getDate();
  const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });

  const stripRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mountedRef = useRef(false);

  // Scroll the active date chip to the left edge when it changes (skip mount)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const selectedIndex = dates.findIndex((d) => toDateString(d, studioTz) === selectedStr);
    if (selectedIndex < 0) return;
    const btn = buttonRefs.current[selectedIndex];
    const strip = stripRef.current;
    if (!btn || !strip) return;
    // getBoundingClientRect is accurate regardless of offsetParent
    const newScrollLeft = strip.scrollLeft + (btn.getBoundingClientRect().left - strip.getBoundingClientRect().left);
    strip.scrollTo({ left: newScrollLeft, behavior: "smooth" });
  }, [selectedStr]);

  return (
    <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {dates.map((d, i) => (
        <button
          key={i}
          ref={(el) => { buttonRefs.current[i] = el; }}
          onClick={() => onSelectDate(d)}
          className={`flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-lg transition-all min-w-[72px] ${
            isSelected(d)
              ? "bg-primary text-primary-foreground border-2 border-primary"
              : "bg-card text-card-foreground border border-border hover:border-primary/50"
          }`}
        >
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider">
            {dayLabel(d)}
          </span>
          <span className="text-lg font-serif mt-0.5">{dateNum(d)}</span>
          <span className="text-[10px] font-sans text-current/70">{monthLabel(d)}</span>
        </button>
      ))}
    </div>
  );
};

export default DateStrip;
