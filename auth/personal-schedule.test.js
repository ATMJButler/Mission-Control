import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPersonalSchedule} from './personal-schedule.js';
const google = overrides => ({id:'event',summary:'Pickup',start:{dateTime:'2026-10-05T15:00:00-05:00'},end:{dateTime:'2026-10-05T16:00:00-05:00'},...overrides});
const project = (events,provider='google') => projectPersonalSchedule({provider,calendarId:'selected',calendarLabel:'Personal',events});
test('Google offset events normalize to UTC and omit email bodies, attendees and credentials',()=>{
  const result=project([google({description:'SECRET',attendees:['SECRET'],access_token:'SECRET'})]);
  assert.deepEqual(result,[{id:'event',calendarId:'selected',calendarLabel:'Personal',title:'Pickup',start:'2026-10-05T20:00:00.000Z',end:'2026-10-05T21:00:00.000Z',allDay:false}]);
});
test('calendar all-day end dates remain exclusive; cancellations are removed',()=>{
  assert.deepEqual(project([google({start:{date:'2026-10-05'},end:{date:'2026-10-06'}}),google({status:'cancelled'})])[0].end,'2026-10-06');
});
test('Graph floating UTC is explicit, while a non-UTC timed result fails closed',()=>{
  const event={id:'graph',subject:'Meeting',start:{dateTime:'2026-10-05T20:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2026-10-05T21:00:00.0000000',timeZone:'UTC'}};
  assert.equal(project([event],'microsoft')[0].start,'2026-10-05T20:00:00.000Z');
  assert.throws(()=>project([{...event,start:{...event.start,timeZone:'Central Standard Time'}}],'microsoft'),/PERSONAL_SCHEDULE_INVALID/);
});
test('Graph all-day local midnight retains dates without UTC conversion',()=>{
  const event={id:'day',isAllDay:true,start:{dateTime:'2026-10-05T00:00:00',timeZone:'Central Standard Time'},end:{dateTime:'2026-10-06T00:00:00',timeZone:'Central Standard Time'}};
  assert.equal(project([event],'microsoft')[0].start,'2026-10-05');
  assert.throws(()=>project([{...event,start:{...event.start,dateTime:'2026-10-05T05:00:00'}}],'microsoft'),/PERSONAL_SCHEDULE_INVALID/);
});
test('invalid dates, missing offsets, duplicate provider IDs and reversed intervals fail closed',()=>{
  for(const event of [google({start:{dateTime:'2026-02-30T15:00:00Z'}}),google({start:{dateTime:'2026-10-05T24:00:00Z'}}),google({start:{dateTime:'2026-10-05T15:00:00'}}),google({end:{dateTime:'2026-10-05T10:00:00Z'}}),google({start:{date:'2026-02-30'},end:{date:'2026-03-03'}})]) assert.throws(()=>project([event]),/PERSONAL_SCHEDULE_INVALID/);
  assert.throws(()=>project([google(),google()]),/PERSONAL_SCHEDULE_INVALID/);
});
