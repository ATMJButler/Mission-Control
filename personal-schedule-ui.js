export function createPersonalSchedule(){
 let generation=0,controller=null;
 const key=()=>window.Clerk?.isSignedIn?`${window.Clerk.user?.id}:${window.Clerk.session?.id}`:null;
 return{reset(){generation++;controller?.abort();controller=null;},async mount(root,timeZone='America/Chicago'){
  controller?.abort();controller=new AbortController();const requestController=controller,timer=setTimeout(()=>requestController.abort(),45000);
  const mine=++generation,current=key();root.replaceChildren();const doc=root.ownerDocument;
  const node=(parent,tag,text)=>{const item=doc.createElement(tag);item.textContent=text;parent.append(item);return item;};
  node(root,'p','Reading your selected calendars…');
  try{const response=await fetch('/api/v1/member',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},signal:requestController.signal,body:JSON.stringify({operation:'personal_schedule'})});const body=await response.json();if(mine!==generation||key()!==current)return;
   if(!response.ok||body.ok!==true||!Array.isArray(body.schedule))throw Error('Unavailable');root.replaceChildren();
   node(root,'p',`Your private agenda · ${timeZone} · recent and upcoming events`);
   if(!body.schedule.length)node(root,'p','No events in the selected calendars for this period. You can choose calendars in Manage calendars.');
   const list=node(root,'ul','');list.className='list';const format=new Intl.DateTimeFormat(undefined,{timeZone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
   for(const event of body.schedule){const row=node(list,'li','');node(row,'strong',event.title);node(row,'p',event.allDay?`${event.start} · All day${event.end>nextDate(event.start)?` · through ${previousDate(event.end)}`:''}`:`${format.format(new Date(event.start))} – ${format.format(new Date(event.end))}`);node(row,'p',event.calendarLabel);}
  }catch{if(mine!==generation||key()!==current)return;root.replaceChildren();node(root,'p','Your schedule could not be verified. Refresh or check your calendar connections.');}finally{clearTimeout(timer);if(controller===requestController)controller=null;}
 }};
}
function nextDate(value){return new Date(Date.parse(value+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
function previousDate(value){return new Date(Date.parse(value+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
