'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/domain.js');
const now = new Date('2026-10-21T10:00:00+08:00');
const input = difficulty => ({ title:'准备方案', rawInput:'准备方案', scheduledDate:null, remindAt:null, ...(difficulty === undefined ? {} : { difficulty }) });
const create = (s, id, difficulty) => D.applyAction(s, { type:'create', id, input:input(difficulty) }, now);

test('each difficulty settles and reverses its actual reward exactly once', () => {
  for (const [difficulty, reward] of [['easy',10],['normal',20],['hard',40]]) {
    const s = D.initialState(); create(s, 'a', difficulty);
    assert.equal(D.applyAction(s,{type:'complete',id:'a'},now).coinsDelta,reward);
    assert.equal(s.tasks[0].rewardEarned,reward);
    assert.equal(D.applyAction(s,{type:'complete',id:'a'},now).coinsDelta,0);
    assert.equal(D.applyAction(s,{type:'reopen',id:'a'},now).coinsDelta,-reward);
    assert.equal(s.tasks[0].rewardEarned,0);
    assert.equal(D.applyAction(s,{type:'reopen',id:'a'},now).coinsDelta,0);
    D.applyAction(s,{type:'complete',id:'a'},now);
    assert.equal(D.stats(s).coins,reward); D.validateState(s);
  }
});
test('difficulty edits preserve appearance and completed rewards are locked', () => {
  const s=D.initialState(); create(s,'a');
  const original=s.tasks[0].appearance;
  D.applyAction(s,{type:'edit',id:'a',input:input('hard')},now);
  assert.equal(s.tasks[0].appearance,original);
  D.applyAction(s,{type:'complete',id:'a'},now);
  assert.throws(()=>D.applyAction(s,{type:'edit',id:'a',input:input('easy')},now),/撤销完成/);
  D.applyAction(s,{type:'edit',id:'a',input:{...input(),title:'改标题'}},now);
  assert.equal(D.stats(s).coins,40);
  assert.equal(D.applyAction(s,{type:'reopen',id:'a'},now).coinsDelta,-40);
  D.applyAction(s,{type:'edit',id:'a',input:input('normal')},now);
  assert.equal(D.applyAction(s,{type:'complete',id:'a'},now).coinsDelta,20);
  assert.equal(D.stats(s).coins,20); assert.equal(s.tasks[0].appearance,original);
});
test('mixed rewards, deletion and restoration keep coins and camp milestones consistent', () => {
  const s=D.initialState();
  for(const [id,difficulty] of [['a','easy'],['b','normal'],['c','hard']]){
    create(s,id,difficulty); D.applyAction(s,{type:'complete',id},now);
  }
  assert.equal(D.stats(s).coins,70); assert.deepEqual(s.unlocked,[30]);
  assert.equal(D.applyAction(s,{type:'delete',id:'c'},now).coinsDelta,0);
  assert.equal(D.stats(s).coins,70);
  assert.equal(D.applyAction(s,{type:'restore',id:'c'},now).coinsDelta,0);
  D.applyAction(s,{type:'reopen',id:'c'},now); D.applyAction(s,{type:'reopen',id:'b'},now);
  assert.equal(D.stats(s).coins,10); assert.deepEqual(s.unlocked,[30]);
  D.validateState(s);
});
test('default is easy and callers cannot inject rewards or appearances', () => {
  const s=D.initialState();
  D.applyAction(s,{type:'create',id:'a',input:{...input(),rewardEarned:99999,appearance:999}},now);
  assert.equal(s.tasks[0].difficulty,'easy'); assert.equal(s.tasks[0].rewardEarned,0);
  assert.ok(s.tasks[0].appearance>=0&&s.tasks[0].appearance<12);
  D.applyAction(s,{type:'complete',id:'a',rewardEarned:99999},now);
  assert.equal(D.stats(s).coins,10);
});
test('invalid difficulty and reward state are rejected before persistence', () => {
  for(const difficulty of ['boss','__proto__','constructor',null,{},3]){
    const s=D.initialState(); assert.throws(()=>create(s,'a',difficulty)); assert.equal(s.tasks.length,0);
  }
  const s=D.initialState();create(s,'a','hard');
  for(const patch of [{rewardEarned:40},{difficulty:'boss'},{appearance:12},{appearance:-1}]){
    const invalid=structuredClone(s);Object.assign(invalid.tasks[0],patch);assert.throws(()=>D.validateState(invalid));
  }
  D.applyAction(s,{type:'complete',id:'a'},now);s.tasks[0].rewardEarned=10;
  assert.throws(()=>D.validateState(s),/奖励/);
});
test('all twelve appearances are reachable and independent of difficulty', () => {
  const seen=new Set();
  for(let n=0;n<200;n++){
    const a=D.initialState(),b=D.initialState();create(a,`monster-${n}`,'easy');create(b,`monster-${n}`,'hard');
    assert.equal(a.tasks[0].appearance,b.tasks[0].appearance);seen.add(a.tasks[0].appearance);
  }
  assert.equal(seen.size,12);
});
