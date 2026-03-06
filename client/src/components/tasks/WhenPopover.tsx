import { useState, useMemo, useEffect, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, getDay, addDays, isSameDay, isToday as checkIsToday } from "date-fns";
import { pl } from "date-fns/locale";
import { Star, Moon, Package, X, ChevronLeft, ChevronRight, Bell, Clock, Check } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

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

function WhenContent({
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
  onClose,
  isMobile,
}: Omit<WhenPopoverProps, "children"> & { onClose: () => void; isMobile: boolean }) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const [showReminder, setShowReminder] = useState(!!reminderDate);
  const [localReminderDate, setLocalReminderDate] = useState(reminderDate || "");
  const [localReminderTime, setLocalReminderTime] = useState(reminderTime || "09:00");

  useEffect(() => {
    setShowReminder(!!reminderDate);
    setLocalReminderDate(reminderDate || "");
    setLocalReminderTime(reminderTime || "09:00");
  }, [reminderDate, reminderTime]);

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

  const isSelectedToday = currentDate === todayStr && !evening;

  if (isMobile) {
    return (
      <div className="w-full max-w-[340px] mx-auto" style={{ backgroundColor: "#2C2C2E", borderRadius: "16px" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-8" />
          <span className="text-[16px] font-semibold text-white">When?</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} data-testid="when-close">
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>

        <div className="px-3 pb-2 space-y-1">
          <button
            onClick={() => { onSelectToday(); onClose(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[15px] text-white transition-colors"
            style={{ backgroundColor: isSelectedToday ? "rgba(255,255,255,0.08)" : "transparent" }}
            data-testid="when-today"
          >
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            <span className="flex-1 text-left">Today</span>
            {isSelectedToday && <Check className="h-4 w-4 text-blue-400" />}
          </button>
          <button
            onClick={() => { onSelectEvening(); onClose(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[15px] text-white transition-colors"
            style={{ backgroundColor: evening ? "rgba(255,255,255,0.08)" : "transparent" }}
            data-testid="when-evening"
          >
            <Moon className="h-5 w-5 text-indigo-400" />
            <span className="flex-1 text-left">This Evening</span>
            {evening && <Check className="h-4 w-4 text-blue-400" />}
          </button>
        </div>

        <div className="mx-3 mb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between py-2.5 px-1">
            <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} data-testid="when-prev-month">
              <ChevronLeft className="h-4 w-4 text-white/60" />
            </button>
            <span className="text-[14px] font-medium capitalize text-white">
              {format(viewMonth, "LLLL yyyy", { locale: pl })}
            </span>
            <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1.5 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} data-testid="when-next-month">
              <ChevronRight className="h-4 w-4 text-white/60" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0 mb-1">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[11px] py-1" style={{ color: "rgba(255,255,255,0.35)" }}>{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dateStr = format(day, "yyyy-MM-dd");
              const isSelected = currentDate === dateStr;
              const isCurrentDay = checkIsToday(day);
              return (
                <button
                  key={dateStr}
                  onClick={() => { onSelectDate(dateStr); onClose(); }}
                  className="h-9 w-9 mx-auto text-[13px] rounded-full flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: isSelected ? "#007AFF" : "transparent",
                    color: isSelected ? "#fff" : isCurrentDay ? "#007AFF" : "rgba(255,255,255,0.8)",
                    fontWeight: isCurrentDay || isSelected ? 600 : 400,
                  }}
                  data-testid={`when-day-${dateStr}`}
                >
                  {isCurrentDay && !isSelected ? (
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ) : (
                    day.getDate()
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-3 space-y-1 pb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="pt-2">
            <button
              onClick={() => { onSelectSomeday(); onClose(); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[15px] text-white transition-colors"
              style={{ backgroundColor: someday ? "rgba(255,255,255,0.08)" : "transparent" }}
              data-testid="when-someday"
            >
              <Package className="h-5 w-5 text-purple-400" />
              <span className="flex-1 text-left">Someday</span>
              {someday && <Check className="h-4 w-4 text-blue-400" />}
            </button>
          </div>
          <button
            onClick={() => setShowReminder(!showReminder)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[15px] transition-colors"
            style={{ color: reminderDate ? "#fbbf24" : "rgba(255,255,255,0.4)" }}
            data-testid="when-reminder"
          >
            <Bell className="h-5 w-5" />
            <span>{reminderDate ? "Reminder set" : "+ Add Reminder"}</span>
          </button>

          {showReminder && (
            <div className="px-3 py-2.5 space-y-2 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} data-testid="reminder-fields">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-400 shrink-0" />
                <input
                  type="date"
                  value={localReminderDate}
                  onChange={(e) => setLocalReminderDate(e.target.value)}
                  className="flex-1 text-[13px] px-2.5 py-2 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                  data-testid="input-reminder-date"
                />
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                <input
                  type="time"
                  value={localReminderTime}
                  onChange={(e) => setLocalReminderTime(e.target.value)}
                  className="flex-1 text-[13px] px-2.5 py-2 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                  data-testid="input-reminder-time"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReminderSave}
                  disabled={!localReminderDate}
                  className="flex-1 text-[13px] font-medium text-white py-2 rounded-lg transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "#007AFF" }}
                  data-testid="button-save-reminder"
                >
                  Save
                </button>
                {reminderDate && (
                  <button
                    onClick={handleReminderClear}
                    className="text-[13px] px-3 py-2 transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    data-testid="button-clear-reminder"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {(currentDate || evening || someday) && (
          <div className="px-3 pb-3">
            <button
              onClick={() => { onClear(); onClose(); }}
              className="w-full text-center text-[15px] font-medium text-white py-3 rounded-xl transition-colors"
              style={{ backgroundColor: "#e11d48" }}
              data-testid="when-clear"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <span className="text-[13px] font-semibold">When?</span>
        <button onClick={onClose} className="p-0.5 hover:bg-zinc-600 rounded" data-testid="when-close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-2 py-1.5 space-y-0.5">
        <button
          onClick={() => { onSelectToday(); onClose(); }}
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] hover:bg-zinc-700 transition-colors ${isSelectedToday ? "bg-zinc-700" : ""}`}
          data-testid="when-today"
        >
          <Star className="h-4 w-4 text-amber-400" />
          <span>Today</span>
        </button>
        <button
          onClick={() => { onSelectEvening(); onClose(); }}
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
                onClick={() => { onSelectDate(dateStr); onClose(); }}
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
          onClick={() => { onSelectSomeday(); onClose(); }}
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
            onClick={() => { onClear(); onClose(); }}
            className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
            data-testid="when-clear"
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
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
  const isMobile = useIsMobile();

  const handleClose = useCallback(() => setOpen(false), []);

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>
          {children}
        </div>
        {open && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            data-testid="when-mobile-backdrop"
          >
            <WhenContent
              currentDate={currentDate}
              evening={evening}
              someday={someday}
              reminderDate={reminderDate}
              reminderTime={reminderTime}
              onSelectToday={onSelectToday}
              onSelectEvening={onSelectEvening}
              onSelectDate={onSelectDate}
              onSelectSomeday={onSelectSomeday}
              onClear={onClear}
              onSetReminder={onSetReminder}
              onClose={handleClose}
              isMobile={true}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0 border-zinc-700 shadow-xl"
        style={{ backgroundColor: "#2C2C2E", color: "#fff" }}
        align="start"
        side="top"
      >
        <WhenContent
          currentDate={currentDate}
          evening={evening}
          someday={someday}
          reminderDate={reminderDate}
          reminderTime={reminderTime}
          onSelectToday={onSelectToday}
          onSelectEvening={onSelectEvening}
          onSelectDate={onSelectDate}
          onSelectSomeday={onSelectSomeday}
          onClear={onClear}
          onSetReminder={onSetReminder}
          onClose={handleClose}
          isMobile={false}
        />
      </PopoverContent>
    </Popover>
  );
}
