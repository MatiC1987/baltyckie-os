import { useState, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, getDay, addDays, isSameDay, isToday as checkIsToday } from "date-fns";
import { pl } from "date-fns/locale";
import { Star, Moon, Package, X, ChevronLeft, ChevronRight, Bell, Clock } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface WhenPopoverProps {
  children: React.ReactNode;
  currentDate?: string | null;
  evening?: boolean;
  someday?: boolean;
  reminderDate?: string | null;
  reminderTime?: string | null;
  onSelectToday: () => void;
  onSelectEvening: () => void;
  onSelectDate: (date: string) => void;
  onSelectSomeday: () => void;
  onClear: () => void;
  onSetReminder?: (date: string | null, time: string | null) => void;
}

export function WhenPopover({
  children,
  currentDate,
  evening,
  someday,
  reminderDate,
  reminderTime,
  onSelectToday,
  onSelectEvening,
  onSelectDate,
  onSelectSomeday,
  onClear,
  onSetReminder,
}: WhenPopoverProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [showReminder, setShowReminder] = useState(!!reminderDate);
  const [localReminderDate, setLocalReminderDate] = useState(reminderDate || "");
  const [localReminderTime, setLocalReminderTime] = useState(reminderTime || "09:00");

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const startDay = getDay(monthStart);
    const adjustedStart = startDay === 0 ? 6 : startDay - 1;

    const days: (Date | null)[] = [];
    for (let i = 0; i < adjustedStart; i++) days.push(null);

    let current = monthStart;
    while (current <= monthEnd) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }

    return days;
  }, [viewMonth]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const handleReminderSave = () => {
    if (onSetReminder && localReminderDate) {
      onSetReminder(localReminderDate, localReminderTime || null);
    }
  };

  const handleReminderClear = () => {
    setLocalReminderDate("");
    setLocalReminderTime("09:00");
    setShowReminder(false);
    if (onSetReminder) onSetReminder(null, null);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) { setShowReminder(!!reminderDate); setLocalReminderDate(reminderDate || ""); setLocalReminderTime(reminderTime || "09:00"); } }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0 border-zinc-700 shadow-xl"
        style={{ backgroundColor: "#2C2C2E", color: "#fff" }}
        align="start"
        side="top"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
          <span className="text-[13px] font-semibold">When?</span>
          <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-zinc-600 rounded" data-testid="when-close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-2 py-1.5 space-y-0.5">
          <button
            onClick={() => { onSelectToday(); setOpen(false); }}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] hover:bg-zinc-700 transition-colors ${currentDate === todayStr && !evening ? "bg-zinc-700" : ""}`}
            data-testid="when-today"
          >
            <Star className="h-4 w-4 text-amber-400" />
            <span>Today</span>
          </button>
          <button
            onClick={() => { onSelectEvening(); setOpen(false); }}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] hover:bg-zinc-700 transition-colors ${evening ? "bg-zinc-700" : ""}`}
            data-testid="when-evening"
          >
            <Moon className="h-4 w-4 text-indigo-400" />
            <span>This Evening</span>
          </button>
        </div>

        <div className="border-t border-zinc-700 px-2 py-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1 hover:bg-zinc-700 rounded" data-testid="when-prev-month">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px] font-medium capitalize">
              {format(viewMonth, "LLLL yyyy", { locale: pl })}
            </span>
            <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1 hover:bg-zinc-700 rounded" data-testid="when-next-month">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[10px] text-zinc-500 py-1">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dateStr = format(day, "yyyy-MM-dd");
              const isSelected = currentDate === dateStr;
              const isCurrentDay = checkIsToday(day);
              return (
                <button
                  key={dateStr}
                  onClick={() => { onSelectDate(dateStr); setOpen(false); }}
                  className={`h-7 w-7 mx-auto text-[11px] rounded-full flex items-center justify-center transition-colors ${
                    isSelected ? "bg-blue-500 text-white" : isCurrentDay ? "text-blue-400 font-bold" : "text-zinc-300 hover:bg-zinc-700"
                  }`}
                  data-testid={`when-day-${dateStr}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-zinc-700 px-2 py-1.5 space-y-0.5">
          <button
            onClick={() => { onSelectSomeday(); setOpen(false); }}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] hover:bg-zinc-700 transition-colors ${someday ? "bg-zinc-700" : ""}`}
            data-testid="when-someday"
          >
            <Package className="h-4 w-4 text-purple-400" />
            <span>Someday</span>
          </button>
          <button
            onClick={() => setShowReminder(!showReminder)}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] hover:bg-zinc-700 transition-colors ${reminderDate ? "text-amber-400" : "text-zinc-500"}`}
            data-testid="when-reminder"
          >
            <Bell className="h-4 w-4" />
            <span>{reminderDate ? "Przypomnienie ustawione" : "+ Dodaj przypomnienie"}</span>
          </button>

          {showReminder && (
            <div className="px-2.5 py-2 space-y-2 bg-zinc-800/50 rounded-lg" data-testid="reminder-fields">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <input
                  type="date"
                  value={localReminderDate}
                  onChange={(e) => setLocalReminderDate(e.target.value)}
                  className="flex-1 bg-zinc-700 text-white text-[12px] px-2 py-1.5 rounded border border-zinc-600 focus:outline-none focus:border-blue-500"
                  data-testid="input-reminder-date"
                />
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <input
                  type="time"
                  value={localReminderTime}
                  onChange={(e) => setLocalReminderTime(e.target.value)}
                  className="flex-1 bg-zinc-700 text-white text-[12px] px-2 py-1.5 rounded border border-zinc-600 focus:outline-none focus:border-blue-500"
                  data-testid="input-reminder-time"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleReminderSave}
                  disabled={!localReminderDate}
                  className="flex-1 text-[11px] font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-1.5 rounded transition-colors"
                  data-testid="button-save-reminder"
                >
                  Zapisz
                </button>
                {reminderDate && (
                  <button
                    onClick={handleReminderClear}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 px-2 py-1.5 transition-colors"
                    data-testid="button-clear-reminder"
                  >
                    Usuń
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {(currentDate || evening || someday) && (
          <div className="border-t border-zinc-700 px-2 py-1.5">
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
              data-testid="when-clear"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
