// Pure provider projection. The caller must authenticate the member, load only
// their connection, and fetch only their explicitly selected calendars.
const text = (value, max = 500) => typeof value === 'string' && value.length <= max;
function date(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
function instant(value) {
  if (!text(value, 50) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !date(value.slice(0, 10))) return null;
  const time=value.slice(11,19).split(':').map(Number);
  if(time[0]>23||time[1]>59||time[2]>59) return null;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
}
function googleTimes(event) {
  if (event.start?.date && event.end?.date) return {start:event.start.date,end:event.end.date,allDay:true};
  return {start:instant(event.start?.dateTime),end:instant(event.end?.dateTime),allDay:false};
}
function microsoftTimes(event) {
  // Graph reads must use Prefer: outlook.timezone="UTC". Never interpret a
  // floating provider timestamp using the server's local timezone.
  const utc = point => point?.timeZone === 'UTC' && text(point.dateTime, 50) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?$/.test(point.dateTime) ? instant(point.dateTime + 'Z') : null;
  const start=utc(event.start),end=utc(event.end);
  if (event.isAllDay === true) {
    // All-day dates retain the calendar-local dates. Graph UTC conversion can
    // shift dates; callers must fetch all-day fields in the calendar timezone.
    if (event.start?.timeZone !== event.end?.timeZone || !text(event.start?.timeZone,100)) return {start:null,end:null,allDay:true};
    const midnight = point => /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0{1,7})?$/.test(point?.dateTime || '') ? point.dateTime.slice(0,10) : null;
    return {start:midnight(event.start),end:midnight(event.end),allDay:true};
  }
  return {start,end,allDay:false};
}
export function projectPersonalSchedule({provider,calendarId,calendarLabel,events}) {
  if (!['google','microsoft'].includes(provider) || !text(calendarId,1024) || !calendarId || !text(calendarLabel,200) || !Array.isArray(events) || events.length>2000) throw new Error('PERSONAL_SCHEDULE_INVALID');
  const result=[],seen=new Set();
  for (const event of events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('PERSONAL_SCHEDULE_INVALID');
    if (event.status==='cancelled' || event.isCancelled===true) continue;
    const times=provider==='google'?googleTimes(event):microsoftTimes(event);
    const valid=times.allDay ? date(times.start)&&date(times.end) : times.start&&times.end;
    if (!valid || times.end<=times.start || !text(event.id,1024) || !event.id || seen.has(event.id)) throw new Error('PERSONAL_SCHEDULE_INVALID');
    seen.add(event.id);
    const title=provider==='google'?event.summary:event.subject;
    if (title!==undefined && !text(title)) throw new Error('PERSONAL_SCHEDULE_INVALID');
    result.push({id:event.id,calendarId,calendarLabel,title:title||'Untitled event',...times});
  }
  return result.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
