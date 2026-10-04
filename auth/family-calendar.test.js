import test from 'node:test';
import assert from 'node:assert/strict';
import {compileFamilyCalendar} from './family-calendar.js';
const event = overrides => ({shareId:'share-1',householdId:'home',ownerUserId:'member-a',participantIds:['member-a'],sharing:'details',title:'School pickup',sourceLabel:'Shared family calendar',start:'2026-10-05T15:00:00-05:00',end:'2026-10-05T16:00:00-05:00',...overrides});
const compile = events => compileFamilyCalendar({householdId:'home',activeMemberIds:['member-a','member-b'],events});
test('explicitly shared household events only, with no provider or email payload',()=>{
 const result=compile([event({providerId:'PRIVATE',emailBody:'PRIVATE'}),event({shareId:'private',sharing:'private'}),event({shareId:'foreign',householdId:'other'}),event({shareId:'revoked',ownerUserId:'revoked'}),event({shareId:'cancelled',status:'cancelled'})]);
 assert.deepEqual(result,{events:[{id:'share-1',title:'School pickup',start:'2026-10-05T20:00:00.000Z',end:'2026-10-05T21:00:00.000Z',allDay:false,sharing:'details',sourceLabel:'Shared family calendar'}],conflicts:[]});
});
test('busy suppresses title, calendar name, location, attendees and notes',()=>{
 const result=compile([event({sharing:'busy',title:'PRIVATE',sourceLabel:'PRIVATE',location:'PRIVATE',notes:'PRIVATE',attendees:['PRIVATE']})]);
 assert.equal(result.events[0].title,'Busy');assert.equal(result.events[0].sourceLabel,'Private calendar');assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('email suggestions never enter family view before explicit confirmation',()=>{
 assert.equal(compile([event({origin:'email'})]).events.length,0);
 assert.equal(compile([event({origin:'email',confirmed:true})]).events.length,1);
});
test('conflicts require overlap for the same participant, with offset normalization',()=>{
 const result=compile([event(),event({shareId:'overlap',start:'2026-10-05T20:30:00Z',end:'2026-10-05T21:30:00Z'}),event({shareId:'other-person',participantIds:['member-b']}),event({shareId:'adjacent',start:'2026-10-05T21:30:00Z',end:'2026-10-05T22:00:00Z'})]);
 assert.deepEqual(result.conflicts,[{eventIds:['share-1','overlap']}]);
});
test('all-day end dates are exclusive and never mixed with timed events',()=>{
 const result=compile([event({allDay:true,start:'2026-10-05',end:'2026-10-06'}),event({shareId:'next',allDay:true,start:'2026-10-06',end:'2026-10-07'}),event({shareId:'timed'})]);
 assert.equal(result.conflicts.length,0);assert.equal(result.events.length,3);
});
test('invalid time, missing timezone, duplicate IDs and unknown participants fail closed',()=>{
 for(const overrides of [{start:'2026-02-30T15:00:00Z',end:'2026-03-03T16:00:00Z'},{start:'2026-10-05T15:00:00'},{end:'2026-10-05T14:00:00-05:00'},{participantIds:['revoked']},{allDay:true,start:'2026-02-30',end:'2026-03-03'}]) assert.throws(()=>compile([event(overrides)]),/INVALID_SHARED_EVENT/);
 assert.throws(()=>compile([event(),event()]),/DUPLICATE_SHARED_EVENT/);
});
test('revocation also removes Busy blocks without leaking stale owner information',()=>{
 const result=compileFamilyCalendar({householdId:'home',activeMemberIds:['member-b'],events:[event({sharing:'busy'})]});assert.deepEqual(result,{events:[],conflicts:[]});
});
