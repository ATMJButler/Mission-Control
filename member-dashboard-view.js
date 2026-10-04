// Only render the projected member contract. Text never becomes HTML markup.
export function renderMemberDashboard(root,dashboard,tab){
  root.replaceChildren();const doc=root.ownerDocument;
  const node=(parent,tag,text,cls)=>{const item=doc.createElement(tag);item.textContent=text;if(cls)item.className=cls;parent.append(item);return item;};
  const card=title=>{const section=doc.createElement('article');section.className='card';root.append(section);node(section,'h3',title);return section;};
  const money=value=>value===null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
  const missing=(section,label)=>node(section,'p',dashboard.sections[label]==='unavailable'?'This shared data could not be verified. Refresh or ask your household principal to check it.':'Nothing has been shared here yet.','muted');
  if(tab==='schedule'){const section=card('Your schedule');node(section,'p','Calendar and email connections are not activated yet. No personal schedule is being loaded.');const link=node(section,'a','Review your connection choices');link.href='/member-setup.html';return;}
  if(tab==='budget'){
    const section=card('Shared household budget');if(!dashboard.budget){missing(section,'budget');return;}
    node(section,'p','Planned amounts and spending by category.','muted');
    const stats=node(section,'div','','stats');for(const [label,value] of [['Planned',dashboard.budget.planned],['Spent',dashboard.budget.spent],['Remaining',dashboard.budget.remaining]]){const stat=node(stats,'p',label);node(stat,'strong',money(value));}
    if(dashboard.budget.asOf)node(section,'p',`Snapshot: ${dashboard.budget.asOf}`,'muted');
    const list=node(section,'ul','','list');for(const category of dashboard.budget.categories){const row=node(list,'li','');node(row,'strong',category.name);node(row,'p',`${money(category.planned)} planned · ${money(category.spent)} spent · ${money(category.remaining)} remaining`);}
    if(dashboard.budget.spent===null)node(section,'p','Some spending totals are not verified yet. They are shown as unavailable.','muted');return;
  }
  if(tab==='meals'){
    const section=card('Approved meal plan');if(!dashboard.meals){missing(section,'meals');return;}
    if(dashboard.meals.weekStart)node(section,'p',`Week starting ${dashboard.meals.weekStart}`);
    const list=node(section,'ul','','list');for(const day of dashboard.meals.days){const row=node(list,'li','');node(row,'strong',`${day.date} · ${day.meal}`);if(day.prep)node(row,'p',day.prep);}
    const groceries=card('Shared grocery list');node(groceries,'p','Read-only view of the approved list.','muted');const items=node(groceries,'ul','','list');for(const item of dashboard.meals.groceryList)node(items,'li',`${item.done?'✓ ':''}${item.item}${item.qty?' · '+item.qty:''}`);if(!dashboard.meals.groceryList.length)node(groceries,'p','No groceries on this approved plan.');return;
  }
  const section=card('Shared family items');if(dashboard.sections.family!=='available'){missing(section,'family');}else if(!dashboard.family.length)node(section,'p','No active family items have been explicitly shared yet.','muted');else{const list=node(section,'ul','','list');for(const item of dashboard.family)node(list,'li',item.name);}
  const calendar=card('Family Calendar');node(calendar,'p','Shared calendar connections are not activated yet. Private calendars are not included automatically.','muted');
}
