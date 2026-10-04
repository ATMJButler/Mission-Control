// Server-side projection. Input events and participant IDs must come from a
// trusted, household-scoped store, never browser-supplied sharing assertions.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
function interval(event) {
  if (event.allDay === true) {
    try { return date(event.start) && date(event.end) && event.end > event.start ? [event.start,event.end] : null; } catch { return null; }
  }
  const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  try { if (!instant(event.start) || !instant(event.end) || !date(event.start.slice(0,10)) || !date(event.end.slice(0,10))) return null; } catch { return null; }
  const start = Date.parse(event.start), end = Date.parse(event.end);
  return end > start ? [start,end] : null;
}

export function compileFamilyCalendar({householdId, events, activeMemberIds}) {
  if (!string(householdId) || !Array.isArray(events) || events.length > 2000 || !Array.isArray(activeMemberIds) || !activeMemberIds.every(string)) throw new Error('INVALID_CALENDAR_INPUT');
  const active = new Set(activeMemberIds);
  const selected = [], keys = new Set();
  for (const event of events) {
    if (!object(event) || event.householdId !== householdId) continue;
    // Removing a member immediately removes their previously shared material.
    if (!active.has(event.ownerUserId) || !['details','busy'].includes(event.sharing) || event.status === 'cancelled') continue;
    if (event.origin === 'email' && event.confirmed !== true) continue;
    const times = interval(event);
    if (!times || !string(event.shareId) || !Array.isArray(event.participantIds) || !event.participantIds.length || !event.participantIds.every(id => active.has(id))) throw new Error('INVALID_SHARED_EVENT');
    // shareId is an opaque stored sharing-record ID, not a provider/event ID.
    if (keys.has(event.shareId)) throw new Error('DUPLICATE_SHARED_EVENT');
    keys.add(event.shareId);
    const busy = event.sharing === 'busy';
    if (!busy && (!string(event.title) || !string(event.sourceLabel))) throw new Error('INVALID_SHARED_EVENT');
    selected.push({times, participants: new Set(event.participantIds), event: {
      id: event.shareId, title: busy ? 'Busy' : event.title,
      start: event.allDay === true ? event.start : new Date(times[0]).toISOString(),
      end: event.allDay === true ? event.end : new Date(times[1]).toISOString(),
      allDay: event.allDay === true, sharing: event.sharing,
      sourceLabel: busy ? 'Private calendar' : event.sourceLabel
    }});
  }
  selected.sort((a,b) => a.event.start.localeCompare(b.event.start) || a.event.id.localeCompare(b.event.id));
  const conflicts = [];
  for (let i=0;i<selected.length;i++) for (let j=i+1;j<selected.length;j++) {
    const a=selected[i], b=selected[j];
    // All-day dates are floating local dates. Do not compare them with UTC
    // instants until a provider adapter supplies the owning calendar timezone.
    if (a.event.allDay !== b.event.allDay) continue;
    if (a.times[0] < b.times[1] && b.times[0] < a.times[1] && [...a.participants].some(id => b.participants.has(id))) conflicts.push({eventIds:[a.event.id,b.event.id]});
  }
  return {events:selected.map(row=>row.event),conflicts};
}
