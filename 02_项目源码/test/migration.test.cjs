'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {Store,RecoveryRequired}=require('../src/store.cjs');
const D=require('../src/domain.js');

function legacyState(){
  const time='2026-10-20T10:00:00.000Z';
  return {version:1,tasks:[0,1,2].map(n=>({id:`old-${n}`,title:`旧任务${n}`,rawInput:`旧任务${n}`,appearance:n===2?5:n,
    scheduledDate:null,remindAt:null,createdAt:time,updatedAt:time,completedAt:n<2?time:null,deletedAt:n===1?time:null,reminderDeliveredAt:null})),
    notices:[{id:'old-note',kind:'review',title:'原回顾',body:'保留的提醒',taskIds:['old-2'],createdAt:time,readAt:null}],
    unlocked:[30,100],lastReviewDate:'2026-10-20',settings:{autoLaunch:false,reviewEnabled:false,reviewTime:'08:30',animations:false,floatPosition:{x:18,y:88}}};
}
async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'monster-migration-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const store=new Store(path.join(root,'data'));await fs.mkdir(store.directory);
  const raw=JSON.stringify(legacyState(),null,2);
  await fs.writeFile(store.file,raw);await fs.writeFile(store.backup,raw);
  return {root,store,raw};
}
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');

test('legacy migration preserves every old field, rewards and deleted completed records',()=>{
  const old=legacyState(),original=structuredClone(old),next=D.migrateState(old);
  assert.deepEqual(old,original);assert.equal(next.version,2);assert.equal(D.stats(next).coins,20);
  for(let i=0;i<old.tasks.length;i++){
    const {difficulty,rewardEarned,...unchanged}=next.tasks[i];assert.deepEqual(unchanged,old.tasks[i]);
    assert.equal(difficulty,'easy');assert.equal(rewardEarned,i<2?10:0);
  }
  for(const key of ['notices','settings','unlocked','lastReviewDate'])assert.deepEqual(next[key],old[key]);
  assert.deepEqual(D.migrateState(next),next);
  const invalid=legacyState();invalid.tasks[0].appearance=8;assert.throws(()=>D.migrateState(invalid));
  assert.throws(()=>D.migrateState({...old,version:3}));
});
test('first load creates a verified immutable backup before committing v2; restart does not migrate twice',async t=>{
  const {root,store,raw}=await fixture(t);await store.load();
  assert.equal(store.state.version,2);assert.equal(D.stats(store.state).coins,20);
  const folder=store.lastMigrationBackup;assert.ok(folder.startsWith(path.join(root,'backups','pre-v1.1.0-')));
  for(const name of ['camp.json','camp.backup.json'])assert.equal(await fs.readFile(path.join(folder,name),'utf8'),raw);
  const hashes=JSON.parse(await fs.readFile(path.join(folder,'SHA256.json'),'utf8'));
  assert.equal(hashes['camp.json'],digest(raw));assert.equal(hashes['camp.backup.json'],digest(raw));
  assert.equal(JSON.parse(await fs.readFile(store.file,'utf8')).version,2);
  const reloaded=new Store(store.directory);await reloaded.load();
  assert.equal((await fs.readdir(path.join(root,'backups'))).length,1);
  await reloaded.transact(s=>D.applyAction(s,{type:'complete',id:'old-2'}));
  assert.equal(await fs.readFile(path.join(folder,'camp.json'),'utf8'),raw);
  assert.equal(D.stats(reloaded.state).coins,30);
});
test('missing optional backup still preserves the main legacy file',async t=>{
  const {store,raw}=await fixture(t);await fs.unlink(store.backup);await store.load();
  assert.equal(await fs.readFile(path.join(store.lastMigrationBackup,'camp.json'),'utf8'),raw);
  assert.equal(D.stats(store.state).coins,20);
});
test('backup write failure stops migration and leaves source data and live state untouched',async t=>{
  const {store,raw}=await fixture(t);const write=store.durableWrite.bind(store);
  store.durableWrite=async(file,content)=>{if(file.includes(`${path.sep}backups${path.sep}`))throw Object.assign(new Error('backup disk full'),{code:'ENOSPC'});return write(file,content);};
  await assert.rejects(store.load(),/backup disk full/);
  assert.equal(store.state,null);assert.equal(await fs.readFile(store.file,'utf8'),raw);assert.equal(await fs.readFile(store.backup,'utf8'),raw);
});
test('backup verification failure stops migration without altering original files',async t=>{
  const {store,raw}=await fixture(t);const write=store.durableWrite.bind(store);
  store.durableWrite=(file,content)=>write(file,file.includes(`${path.sep}backups${path.sep}`)?'corrupt copy':content);
  await assert.rejects(store.load(),/备份核对失败/);
  assert.equal(store.state,null);assert.equal(await fs.readFile(store.file,'utf8'),raw);
});
test('migration replacement failure preserves original plus recovery snapshot; next launch retries safely',async t=>{
  const {store,raw}=await fixture(t);store.replace=async()=>{throw Object.assign(new Error('file busy'),{code:'EBUSY'});};
  await assert.rejects(store.load(),/file busy/);assert.equal(store.state,null);
  assert.equal(await fs.readFile(store.file,'utf8'),raw);
  assert.equal(await fs.readFile(path.join(store.lastMigrationBackup,'camp.json'),'utf8'),raw);
  const retry=new Store(store.directory);await retry.load();assert.equal(D.stats(retry.state).coins,20);
});
test('a legacy backup can recover a damaged main file with both originals preserved',async t=>{
  const {store,raw}=await fixture(t);await fs.writeFile(store.file,'broken main');
  await assert.rejects(store.load(),e=>e instanceof RecoveryRequired&&e.backupAvailable);
  await store.recover();assert.equal(store.state.version,2);assert.equal(D.stats(store.state).coins,20);
  assert.equal(await fs.readFile(path.join(store.lastMigrationBackup,'camp.json'),'utf8'),'broken main');
  assert.equal(await fs.readFile(path.join(store.lastMigrationBackup,'camp.backup.json'),'utf8'),raw);
  assert.ok((await fs.readdir(store.directory)).some(name=>name.startsWith('camp.damaged-')));
});
test('corrupt legacy records are rejected without being normalized or overwritten',async t=>{
  const {store}=await fixture(t);const broken=legacyState();broken.tasks[0].completedAt='not-a-date';
  const raw=JSON.stringify(broken);await fs.writeFile(store.file,raw);await fs.unlink(store.backup);
  await assert.rejects(store.load(),e=>e instanceof RecoveryRequired&&!e.backupAvailable);
  assert.equal(await fs.readFile(store.file,'utf8'),raw);
});
