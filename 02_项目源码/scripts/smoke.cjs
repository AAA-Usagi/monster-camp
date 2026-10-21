'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const D=require('../src/domain.js');
const root=path.resolve(__dirname,'..');
const dataPath=path.join(root,'output',`desktop-test-${Date.now()}`);
const shots=path.join(root,'output','playwright');
const results=[];
let app,panel;
const errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function open(){
  const env={...process.env,CAMP_TEST_DATA:dataPath};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:process.env.CAMP_EXECUTABLE||require('electron'),args:[...(process.env.CAMP_EXECUTABLE?[]:[root]),'--test-mode'],cwd:root,env,timeout:30000});
  app.on('window',w=>w.on('pageerror',e=>errors.push(e.message)));
  for(let i=0;i<100;i++){panel=app.windows().find(w=>w.url().endsWith('/index.html'));if(panel)break;await delay(100);}
  assert.ok(panel,'Main window exists');await panel.waitForSelector('#capture-input');await panel.evaluate(()=>document.fonts.ready);
}
async function screenshot(name){await panel.screenshot({path:path.join(shots,`${name}.png`)});}
async function add(text){await panel.locator('#capture-input').fill(text);await panel.locator('#capture-input').press('Enter');await panel.waitForFunction(()=>document.querySelector('#capture-input').value==='');}
async function data(){return panel.evaluate(async()=>(await window.camp.get()).state);}
function row(title){return panel.locator('.task-row').filter({has:panel.locator('.task-title',{hasText:title})});}
async function coins(expected){await panel.waitForFunction(n=>document.querySelector('#coin-count').textContent===String(n),expected);}
async function main(){
  await fs.mkdir(path.join(dataPath,'data'),{recursive:true});await fs.mkdir(shots,{recursive:true});
  const seed=D.initialState();seed.settings.reviewEnabled=false;await fs.writeFile(path.join(dataPath,'data','camp.json'),JSON.stringify(seed));
  await open();await screenshot('01-empty');
  assert.equal(await panel.evaluate(()=>typeof require),'undefined');
  assert.equal(await panel.evaluate(()=>typeof window.camp),'object');
  results.push('Renderer isolated; local fonts and SVG render');
  await add('跟进培训名单');assert.equal((await data()).tasks[0].scheduledDate,null);assert.equal(await row('跟进培训名单').count(),1);
  await add('明天下午三点确认讲师安排');let task=(await data()).tasks.find(t=>t.title==='确认讲师安排');assert.equal(D.timeKey(task.remindAt),'15:00');assert.equal(await panel.locator('[data-filter=next]').getAttribute('class'),'selected');
  await add('今天核对报名信息');await row('核对报名信息').getByRole('button',{name:'击败',exact:true}).dblclick({delay:10}).catch(()=>{});await coins(10);
  await panel.locator('[data-filter=done]').click();await row('核对报名信息').getByRole('button',{name:'撤销',exact:true}).click();await coins(0);
  await panel.locator('[data-filter=today]').click();await row('核对报名信息').getByRole('button',{name:'击败',exact:true}).click();await coins(10);
  results.push('Quick capture, Chinese schedule, grouping, double completion and reopen');
  await panel.locator('#search-toggle').click();await panel.locator('#search-input').fill('讲师');await row('确认讲师安排').locator('.task-title').click();
  await panel.locator('#edit-title').fill('确认讲师和场地安排');await panel.locator('#edit-date').fill('2020-01-01');await panel.locator('#edit-time').fill('10:00');await panel.locator('#edit-save').click();await panel.waitForFunction(()=>document.querySelector('#edit-error').textContent.includes('过去'));
  await panel.locator('#edit-clear-time').click();await panel.locator('#edit-save').click();await panel.waitForFunction(()=>!document.querySelector('#edit-dialog').open);
  assert.equal((await data()).tasks.find(t=>t.title==='确认讲师和场地安排').remindAt,null);
  await row('确认讲师和场地安排').locator('.task-title').click();await panel.locator('#edit-delete').click();await panel.locator('#toast button').click();await panel.waitForFunction(async()=>(await window.camp.get()).state.tasks.find(t=>t.title==='确认讲师和场地安排').deletedAt===null);
  results.push('Search across views, edit validation, remove schedule, delete and undo');
  await panel.locator('#search-clear').click();await panel.locator('#search-toggle').click();
  const file=path.join(dataPath,'data','camp.json'),held=path.join(dataPath,'data','save-failure.json');await fs.rename(file,held);
  await panel.locator('#capture-input').fill('保存失败时也不能丢的事情');await panel.locator('#capture-input').press('Enter');await panel.waitForSelector('#error:not([hidden])');assert.equal(await panel.locator('#capture-input').inputValue(),'保存失败时也不能丢的事情');await fs.rename(held,file);await panel.locator('#capture-input').press('Enter');await panel.waitForFunction(()=>document.querySelector('#capture-input').value==='');
  assert.equal((await data()).tasks.filter(t=>t.title==='保存失败时也不能丢的事情').length,1);
  results.push('Real persistence failure preserves draft; retry stores exactly once');
  await add('今天发出培训通知');await row('发出培训通知').getByRole('button',{name:'击败',exact:true}).click();await coins(20);
  await add('今天整理活动复盘');await row('整理活动复盘').getByRole('button',{name:'击败',exact:true}).click();await coins(30);
  assert.deepEqual((await data()).unlocked,[30]);await panel.locator('[data-tab=camp]').click();await panel.waitForSelector('#toast[hidden]',{state:'attached',timeout:10000});await screenshot('03-camp-unlocked');
  await panel.locator('[data-tab=tasks]').click();await panel.locator('[data-filter=unscheduled]').click();await screenshot('02-task-list');
  await panel.locator('#settings-button').click();await panel.locator('#setting-animations').uncheck();await panel.locator('#settings-save').click();assert.equal((await data()).settings.animations,false);
  await panel.locator('#hide-button').click();await delay(200);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='小怪营地').isVisible()),false);
  const float=app.windows().find(w=>w.url().endsWith('/float.html'));await float.locator('#float').click();await delay(250);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='小怪营地').isVisible()),true);
  results.push('Camp unlock, settings, panel hide and floating entry');
  const before=await data();await app.close();app=null;await open();assert.equal((await data()).tasks.length,before.tasks.length);assert.equal((await data()).settings.animations,false);assert.deepEqual((await data()).unlocked,[30]);
  results.push('Actual process restart retains tasks, settings and camp');
  await app.close();app=null;
  const reminderState=JSON.parse(await fs.readFile(file,'utf8'));reminderState.settings.reviewEnabled=true;reminderState.settings.reviewTime='00:00';reminderState.lastReviewDate=null;
  const past=new Date(Date.now()-60000);
  for(let i=0;i<2;i++){const created=new Date(Date.now()-120000);D.applyAction(reminderState,{type:'create',id:`reminder-fixture-${i}`,input:{title:`到点提醒测试${i+1}`,rawInput:`到点提醒测试${i+1}`,scheduledDate:D.dayKey(past),remindAt:past.toISOString()}},created);}
  await fs.writeFile(file,JSON.stringify(reminderState));await open();await panel.waitForFunction(async()=>(await window.camp.get()).state.notices.length>=2);
  const delivered=await data();assert.equal(delivered.notices.filter(n=>n.kind==='reminder').length,1);assert.equal(delivered.notices.filter(n=>n.kind==='review').length,1);
  await panel.locator('#notices-button').click();await screenshot('04-notices');await panel.locator('.notice-task [data-action=snooze]').first().click();await panel.waitForFunction(async()=>(await window.camp.get()).state.tasks.some(t=>t.id.startsWith('reminder-fixture')&&new Date(t.remindAt)>new Date()));
  await panel.locator('.notice-task [data-action=complete]').first().click();await coins(40);await panel.locator('#read-all').click();await panel.waitForFunction(async()=>(await window.camp.get()).state.notices.every(n=>n.readAt));
  results.push('Startup merges overdue reminders, persists daily recap, snoozes and acknowledges');
  await app.close();app=null;await open();assert.equal((await data()).notices.filter(n=>n.kind==='review').length,1);results.push('No duplicate recap after restart');
  assert.deepEqual(errors,[]);results.push('No renderer JavaScript errors');
  await app.close();app=null;
  await fs.writeFile(path.join(root,'output','desktop-test-results.json'),JSON.stringify({passed:results,dataPath,screenshots:shots,testedAt:new Date().toISOString(),executable:process.env.CAMP_EXECUTABLE||'development'},null,2));
  console.log(JSON.stringify({passed:results.length,checks:results,screenshots:shots},null,2));
}
main().catch(async error=>{console.error(error);if(panel)try{await screenshot('failure');}catch{}process.exitCode=1;}).finally(async()=>{if(app)await app.close();});
