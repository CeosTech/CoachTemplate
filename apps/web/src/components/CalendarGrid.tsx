import { useMemo, useState } from "react";

export type CalendarGridEvent = {
  id: string;
  startAt: string;
  endAt: string;
  title?: string | null;
  subtitle?: string | null;
  status?: string;
  statusLabel?: string | null;
  color?: string | null;
  background?: string | null;
  tooltip?: string | null;
};

type StatusStyle = {
  label?: string;
  color: string;
  background?: string;
};

type ResolvedStatus = {
  label: string;
  color: string;
  background: string;
};

type CalendarGridProps = {
  events: CalendarGridEvent[];
  emptyLabel?: string;
  statusStyles?: Record<string, StatusStyle>;
  defaultView?: "MONTH" | "WEEK";
  onEventClick?: (event: CalendarGridEvent) => void;
};

const weekdayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function shiftWeeks(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount * 7);
  return copy;
}

function formatKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isToday(date: Date) {
  const now = new Date();
  return now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth() && now.getDate() === date.getDate();
}

export function CalendarGrid({ events, emptyLabel = "Aucune session", statusStyles, defaultView = "MONTH", onEventClick }: CalendarGridProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"MONTH" | "WEEK">(defaultView);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarGridEvent[]> = {};
    events.forEach((event) => {
      const key = formatKey(new Date(event.startAt));
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
    return map;
  }, [events]);

  const { weeks, monthLabel } = useMemo(() => {
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const calendarStart = startOfWeek(firstDay);
    const calendarEnd = endOfWeek(lastDay);
    const days: Date[] = [];
    for (let day = new Date(calendarStart); day <= calendarEnd; day = addDays(day, 1)) {
      days.push(new Date(day));
    }
    const sections: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) sections.push(days.slice(i, i + 7));
    const formatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
    return { weeks: sections, monthLabel: formatter.format(firstDay) };
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [cursor]);

  const weekLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    return `Semaine du ${formatter.format(start)} au ${formatter.format(end)}`;
  }, [cursor]);

  function resolveStatus(event: CalendarGridEvent): ResolvedStatus {
    const fallback: StatusStyle | undefined = event.status ? statusStyles?.[event.status] : undefined;
    return {
      color: event.color ?? fallback?.color ?? "#0f172a",
      background: event.background ?? fallback?.background ?? "rgba(0,0,0,0.1)",
      label: event.statusLabel ?? fallback?.label ?? event.status ?? ""
    };
  }

  function handleEventClick(event: CalendarGridEvent) {
    if (onEventClick) onEventClick(event);
  }

  function renderEvent(event: CalendarGridEvent, mode: "month" | "week") {
    const status = resolveStatus(event);
    const timeLabel =
      mode === "month"
        ? new Date(event.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : `${new Date(event.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} → ${new Date(event.endAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
          })}`;

    return (
      <div
        key={event.id}
        className={`calendar-grid__event${mode === "week" ? " calendar-grid__event--week" : ""}`}
        style={{ borderLeftColor: status.color }}
        role={onEventClick ? "button" : undefined}
        tabIndex={onEventClick ? 0 : undefined}
        onClick={onEventClick ? () => handleEventClick(event) : undefined}
        onKeyDown={
          onEventClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleEventClick(event);
                }
              }
            : undefined
        }
        title={event.tooltip ?? [event.title, status.label, timeLabel].filter(Boolean).join(" • ")}
      >
        <span className="calendar-grid__event-time">{timeLabel}</span>
        <div className="calendar-grid__event-body">
          <strong>{event.title ?? "Séance"}</strong>
          {event.subtitle && <small>{event.subtitle}</small>}
          {status.label && (
            <span className="calendar-grid__event-status" style={{ background: status.background, color: status.color }}>
              {status.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  function renderMonthDay(day: Date) {
    const key = formatKey(day);
    const dayEvents = eventsByDay[key] ?? [];
    if (dayEvents.length === 0) return <span className="calendar-grid__empty">—</span>;
    return (
      <>
        {dayEvents.slice(0, 3).map((event) => renderEvent(event, "month"))}
        {dayEvents.length > 3 && (
          <span className="calendar-grid__more">
            +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? "s" : ""}
          </span>
        )}
      </>
    );
  }

  function renderWeekDay(day: Date) {
    const key = formatKey(day);
    const dayEvents = eventsByDay[key] ?? [];
    if (dayEvents.length === 0) return <span className="calendar-grid__empty">—</span>;
    return dayEvents.map((event) => renderEvent(event, "week"));
  }

  function goPrevious() {
    setCursor((prev) => (view === "MONTH" ? addMonths(prev, -1) : shiftWeeks(prev, -1)));
  }

  function goNext() {
    setCursor((prev) => (view === "MONTH" ? addMonths(prev, 1) : shiftWeeks(prev, 1)));
  }

  function goToday() {
    setCursor(new Date());
  }

  return (
    <div className="calendar-grid">
      <header className="calendar-grid__header">
          <div>
            <p className="eyebrow">Calendrier</p>
            <strong>{view === "MONTH" ? monthLabel : weekLabel}</strong>
          </div>
          <div className="calendar-grid__actions">
            <div className="calendar-grid__view-toggle">
              <button type="button" className={`btn btn--ghost btn--small${view === "MONTH" ? " is-active" : ""}`} onClick={() => setView("MONTH")}>
                Mois
              </button>
              <button type="button" className={`btn btn--ghost btn--small${view === "WEEK" ? " is-active" : ""}`} onClick={() => setView("WEEK")}>
                Semaine
              </button>
            </div>
            <div className="calendar-grid__nav">
              <button type="button" className="btn btn--ghost btn--small" onClick={goPrevious}>
                ← {view === "MONTH" ? "Mois préc." : "Semaine préc."}
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={goToday}>
                Aujourd'hui
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={goNext}>
                {view === "MONTH" ? "Mois suiv." : "Semaine suiv."} →
              </button>
            </div>
          </div>
      </header>

      {view === "MONTH" ? (
        <div className="calendar-grid__body">
          {weekdayLabels.map((label) => (
            <div key={label} className="calendar-grid__weekday">
              {label}
            </div>
          ))}
          {weeks.map((week, index) => (
            <div key={index} className="calendar-grid__week">
              {week.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`calendar-grid__day${day.getMonth() !== cursor.getMonth() ? " calendar-grid__day--muted" : ""}${isToday(day) ? " calendar-grid__day--today" : ""}`}
                >
                  <span className="calendar-grid__date">{day.getDate()}</span>
                  <div className="calendar-grid__events">{renderMonthDay(day)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="calendar-week">
          <div className="calendar-week__grid">
            {weekDays.map((day) => (
              <div key={day.toISOString()} className={`calendar-week__day${isToday(day) ? " calendar-week__day--today" : ""}`}>
                <div className="calendar-week__day-header">
                  <strong>{weekdayLabels[(day.getDay() + 6) % 7]}</strong>
                  <span>{day.getDate()}</span>
                </div>
                <div className="calendar-week__events">{renderWeekDay(day)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && <div className="calendar-grid__placeholder">{emptyLabel}</div>}
    </div>
  );
}
