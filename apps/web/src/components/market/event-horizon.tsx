"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

type CalEvent = {
  id: string;
  symbol: string | null;
  title: string;
  body: string;
  eventType: string | null;
  publishedAt: string | null;
};

export function EventHorizon({ symbol }: { symbol?: string }) {
  const [events, setEvents] = useState<CalEvent[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ days: "7" });
    if (symbol) params.set("symbol", symbol);
    fetch(`/api/intel/calendar?${params}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {});
  }, [symbol]);

  return (
    <section className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-indigo-400" />
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Event Horizon — 7 days</h3>
      </div>
      {events.length === 0 ? (
        <p className="text-[10px] text-zinc-600">No upcoming events in calendar feed.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="text-[10px] border-b border-zinc-900/40 pb-2">
              <span className="font-mono font-bold text-indigo-300">{e.symbol ?? "MACRO"}</span>
              <span className="text-zinc-500 ml-2">{e.publishedAt?.slice(0, 10)}</span>
              <p className="text-zinc-400 mt-0.5">{e.title}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
