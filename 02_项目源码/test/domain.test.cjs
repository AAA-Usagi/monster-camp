'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../src/domain.js');
const now=new Date(2026,9,21,10,0,0);
const input=(title='核对名单',extra={})=>({title,rawInput:title,scheduledDate:null,remindAt:null,...extra});
function create(state,id='task-1',extra={}){D.applyAction(state,{type:'create',id,input:input('核对名单',extra)},now);return state.tasks.find(t=>t.id===id);}

test('Chinese date/time parsing is offline and preserves the original',()=>{
  const p=D.parseInput('明天下午三点跟进培训名单',now);
  assert.equal(p.title,'跟进培训名单');assert.equal(p.scheduledDate,'2026-10-22');assert.equal(D.timeKey(p.remindAt),'15:00');assert.equal(p.rawInput,'明天下午三点跟进培训名单');assert.equal(p.warning,'');
});
test('date-only, vague input, weekday and next weekday',()=>{
  const date=D.parseInput('明天发通知',now);assert.equal(date.remindAt,null);
  for(const text of ['过两天看一下','有空时整理桌面','回复同事']){const p=D.parseInput(text,now);assert.equal(p.remindAt,null);assert.equal(p.scheduledDate,null);}
  assert.equal(D.parseInput('周五交周报',now).scheduledDate,'2026-10-23');
  assert.equal(D.parseInput('下周一讨论',now).scheduledDate,'2026-10-26');
  assert.equal(D.parseInput('星期日整理',now).scheduledDate,'2026-10-25');
});
test('year/month rollover, leap years and invalid dates',()=>{
  assert.equal(D.parseInput('明天拜访',new Date(2026,11,31,10)).scheduledDate,'2027-01-01');
  assert.equal(D.parseInput('10月25日回顾',now).scheduledDate,'2026-10-25');
  assert.equal(D.parseInput('1月3日回顾',now).scheduledDate,'2027-01-03');
  assert.equal(D.parseInput('2028年2月29日回顾',now).scheduledDate,'2028-02-29');
  assert.match(D.parseInput('2027年2月29日回顾',now).warning,/不存在/);
  assert.match(D.parseInput('2026-02-31 整理',now).warning,/不存在/);
});
test('time-only uses today and past time is explicitly flagged',()=>{
  const p=D.parseInput('15:30回复',now);assert.equal(p.scheduledDate,'2026-10-21');assert.equal(D.timeKey(p.remindAt),'15:30');
  assert.match(D.parseInput('上午九点回复',now).warning,/过去/);
  assert.equal(D.timeKey(D.parseInput('下午两点半整理',now).remindAt),'14:30');
  assert.equal(D.timeKey(D.parseInput('下午三点二十分整理',now).remindAt),'15:20');
  assert.match(D.parseInput('25:70整理',now).warning,/不正确/);
});
test('colloquial 一点 is not mistaken for a reminder',()=>{
  for(const text of ['这件事有一点难','明天把问题说清楚一点','晚一点再回复','记一点点想法'])assert.equal(D.parseInput(text,now).remindAt,null);
  assert.equal(D.timeKey(D.parseInput('明天下午一点回复',now).remindAt),'13:00');
});
test('unscheduled/today/overdue/future/done grouping',()=>{
  assert.equal(D.category({scheduledDate:null},now),'unscheduled');assert.equal(D.category({scheduledDate:'2026-10-20'},now),'today');assert.equal(D.category({scheduledDate:'2026-10-21'},now),'today');assert.equal(D.category({scheduledDate:'2026-10-22'},now),'next');assert.equal(D.category({completedAt:now.toISOString()},now),'done');
});
test('duplicate creation and double completion are idempotent',()=>{
  const s=D.initialState();create(s);create(s);assert.equal(s.tasks.length,1);
  D.applyAction(s,{type:'complete',id:'task-1'},now);
  assert.equal(D.applyAction(s,{type:'complete',id:'task-1'},now).changed,false);
  assert.equal(D.stats(s,now).coins,10);assert.equal(D.stats(s,now).today,1);
});
test('reopen restores exactly one reward on recompletion',()=>{
  const s=D.initialState();create(s);D.applyAction(s,{type:'complete',id:'task-1'},now);D.applyAction(s,{type:'reopen',id:'task-1'},now);assert.equal(D.stats(s).coins,0);D.applyAction(s,{type:'complete',id:'task-1'},now);assert.equal(D.stats(s).coins,10);
});
test('all milestone thresholds persist after reopen and soft deletion',()=>{
  const s=D.initialState();
  for(let n=1;n<=50;n++){create(s,`t${n}`);D.applyAction(s,{type:'complete',id:`t${n}`},now);assert.deepEqual(s.unlocked,D.MILESTONES.filter(m=>m.coins<=n*10).map(m=>m.coins));}
  D.applyAction(s,{type:'reopen',id:'t50'},now);assert.equal(D.stats(s).coins,490);assert.deepEqual(s.unlocked,[30,100,250,500]);
  D.applyAction(s,{type:'delete',id:'t1'},now);assert.equal(D.stats(s).coins,490);D.applyAction(s,{type:'restore',id:'t1'},now);assert.equal(D.stats(s).coins,490);D.validateState(s);
});
test('overnight counts reset without affecting accumulated rewards',()=>{
  const s=D.initialState();create(s);D.applyAction(s,{type:'complete',id:'task-1'},now);assert.equal(D.stats(s,new Date(2026,9,22,1)).today,0);assert.equal(D.stats(s).coins,10);
});
test('reject invalid task and settings data',()=>{
  const s=D.initialState();assert.throws(()=>create(s,'bad',{scheduledDate:'2026-02-31'}));assert.throws(()=>create(s,'bad',{remindAt:now.toISOString()}));assert.throws(()=>D.applyAction(s,{type:'settings',patch:{reviewTime:'25:00'}},now));assert.throws(()=>D.applyAction(s,{type:'settings',patch:{animations:'yes'}},now));
});
test('overdue reminders merge once, stay readable and survive restart',()=>{
  const s=D.initialState();s.settings.reviewEnabled=false;
  for(let i=1;i<=3;i++)create(s,`t${i}`,{scheduledDate:'2026-10-21',remindAt:new Date(2026,9,21,10,i).toISOString()});
  const later=new Date(2026,9,21,11);const first=D.reminderSweep(s,later);assert.equal(first.notices.length,1);assert.equal(first.notices[0].taskIds.length,3);assert.equal(first.notices[0].readAt,null);
  const loaded=JSON.parse(JSON.stringify(s));assert.equal(D.reminderSweep(loaded,new Date(2026,9,21,12)).notices.length,0);D.validateState(loaded);
});
test('completion and deletion cancel pending reminders',()=>{
  const s=D.initialState();s.settings.reviewEnabled=false;
  create(s,'a',{scheduledDate:'2026-10-21',remindAt:new Date(2026,9,21,11).toISOString()});create(s,'b',{scheduledDate:'2026-10-21',remindAt:new Date(2026,9,21,11).toISOString()});
  D.applyAction(s,{type:'complete',id:'a'},now);D.applyAction(s,{type:'delete',id:'b'},now);assert.equal(D.reminderSweep(s,new Date(2026,9,21,12)).notices.length,0);
});
test('editing cancels old schedule and snooze delivers ten minutes later',()=>{
  const s=D.initialState();s.settings.reviewEnabled=false;
  create(s,'a',{scheduledDate:'2026-10-21',remindAt:new Date(2026,9,21,11).toISOString()});
  D.applyAction(s,{type:'edit',id:'a',input:input('更新名单',{scheduledDate:'2026-10-21',remindAt:new Date(2026,9,21,12).toISOString()})},now);
  assert.equal(D.reminderSweep(s,new Date(2026,9,21,11,1)).notices.length,0);
  assert.equal(D.reminderSweep(s,new Date(2026,9,21,12,0)).notices.length,1);
  D.applyAction(s,{type:'snooze',id:'a'},new Date(2026,9,21,12));
  assert.ok(s.notices[0].readAt);assert.equal(D.reminderSweep(s,new Date(2026,9,21,12,9)).notices.length,0);assert.equal(D.reminderSweep(s,new Date(2026,9,21,12,10)).notices.length,1);
});
test('daily recap is once per local day, even after changing review time',()=>{
  const s=D.initialState();create(s);
  assert.equal(D.reminderSweep(s,new Date(2026,9,21,8)).notices.length,0);
  const result=D.reminderSweep(s,now);assert.equal(result.notices[0].kind,'review');assert.match(result.notices[0].body,/未定时间 1/);
  D.applyAction(s,{type:'settings',patch:{reviewTime:'11:00'}},now);
  assert.equal(D.reminderSweep(s,new Date(2026,9,21,12)).notices.length,0);
  assert.equal(D.reminderSweep(s,new Date(2026,9,22,12)).notices.length,1);
});
test('notification acknowledgement and edits prevent stale task targets',()=>{
  const s=D.initialState();s.settings.reviewEnabled=false;create(s,'a',{scheduledDate:'2026-10-21',remindAt:new Date(2026,9,21,11).toISOString()});D.reminderSweep(s,new Date(2026,9,21,12));D.applyAction(s,{type:'edit',id:'a',input:input('更新')},new Date(2026,9,21,12));assert.ok(s.notices[0].readAt);assert.deepEqual(s.notices[0].taskIds,[]);
});
test('floating icon remains visible after monitor removal and negative-coordinate displays',()=>{
  const primary={x:0,y:0,width:1920,height:1040},left={x:-1280,y:0,width:1280,height:900};
  assert.deepEqual(D.clampFloat({x:3000,y:1800},[primary]),{x:1842,y:962});
  assert.deepEqual(D.clampFloat({x:-1200,y:500},[primary,left]),{x:-1280,y:500});
  const reset=D.clampFloat({x:-1200,y:500},[primary]);assert.equal(reset.x,0);assert.equal(reset.y,500);
});
test('structured validation detects malformed stored values',()=>{
  const s=D.initialState();create(s);D.validateState(s);
  s.tasks[0].completedAt='bad';assert.throws(()=>D.validateState(s),/损坏/);
});
