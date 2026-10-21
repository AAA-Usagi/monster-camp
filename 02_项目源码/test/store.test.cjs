'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {Store,RecoveryRequired}=require('../src/store.cjs');
const {applyAction,stats}=require('../src/domain.js');
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'monster-camp-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=new Store(dir);await store.load();return store;}
const add=(store,id)=>store.transact(s=>applyAction(s,{type:'create',id,input:{title:`任务${id}`,rawInput:`任务${id}`,scheduledDate:null,remindAt:null}}));
test('serialized concurrent writes persist every task and survive reload',async t=>{
  const store=await fixture(t);await Promise.all(Array.from({length:20},(_,i)=>add(store,String(i))));const loaded=new Store(store.directory);await loaded.load();assert.equal(loaded.state.tasks.length,20);assert.equal((await loaded.read(loaded.backup)).tasks.length,19);
});
test('rapid completion contributes one reward, persisted across restart',async t=>{
  const store=await fixture(t);await add(store,'a');await Promise.all(Array.from({length:12},()=>store.transact(s=>applyAction(s,{type:'complete',id:'a'}))));const loaded=new Store(store.directory);await loaded.load();assert.equal(stats(loaded.state).coins,10);
});
test('write failure does not publish changed state; retry succeeds',async t=>{
  const store=await fixture(t);const write=store.write.bind(store);store.write=async()=>{throw Object.assign(new Error('disk full'),{code:'ENOSPC'});};await assert.rejects(add(store,'a'),/disk full/);assert.equal(store.state.tasks.length,0);store.write=write;await add(store,'a');assert.equal(store.state.tasks.length,1);
});
test('corruption requires explicit recovery and preserves damaged file',async t=>{
  const store=await fixture(t);await add(store,'a');await add(store,'b');await fs.writeFile(store.file,'{"broken":');const loaded=new Store(store.directory);await assert.rejects(loaded.load(),e=>e instanceof RecoveryRequired&&e.backupAvailable);assert.equal(await fs.readFile(store.file,'utf8'),'{"broken":');await loaded.recover();assert.equal(loaded.state.tasks.length,1);assert.ok((await fs.readdir(store.directory)).some(f=>f.startsWith('camp.damaged-')));
});
test('corruption without backup and interrupted initial writes never reset silently',async t=>{
  const store=await fixture(t);await fs.writeFile(store.file,'bad');await assert.rejects(new Store(store.directory).load(),e=>e instanceof RecoveryRequired&&!e.backupAvailable);await fs.unlink(store.file);await fs.writeFile(`${store.file}.tmp`,'partial');await assert.rejects(new Store(store.directory).load(),RecoveryRequired);
});
test('uncommitted valid temporary file never replaces last committed data',async t=>{
  const store=await fixture(t);await add(store,'a');const next=store.snapshot();applyAction(next,{type:'delete',id:'a'});await fs.writeFile(`${store.file}.tmp`,JSON.stringify(next));const loaded=new Store(store.directory);await loaded.load();assert.equal(loaded.state.tasks[0].deletedAt,null);
});
