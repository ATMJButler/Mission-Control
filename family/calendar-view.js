// Render only the server-projected calendar contract, never provider payloads.
export function renderFamilyCalendar(root, calendar, {timeZone='America/Chicago'}={}) {
  root.replaceChildren();
  const doc=root.ownerDocument;
  const line=(parent,tag,text)=>{const node=doc.createElement(tag);node.textContent=text;parent.append(node);return node;};
  if(!calendar.events.length){line(root,'p','No shared events yet. Connect a calendar and choose what to share.');return;}
  const formatter=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const conflicts=new Set(calendar.conflicts.flatMap(row=>row.eventIds));
  const list=doc.createElement('ul');list.className='events';root.append(list);
  for(const event of calendar.events){
    const row=doc.createElement('li');list.append(row);
    line(row,'h2',event.title);
    line(row,'p',event.allDay ? `${event.start} · All day (ends before ${event.end})` : `${formatter.format(new Date(event.start))} — ${formatter.format(new Date(event.end))}`);
    line(row,'small',event.sourceLabel);
    if(conflicts.has(event.id)){const warning=line(row,'p','Scheduling conflict — review these commitments.');warning.className='conflict';}
  }
}
