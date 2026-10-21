'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const crypto=require('node:crypto');
const D=require('../src/domain.js');
const root=path.resolve(__dirname,'..');
const kind=process.env.CAMP_EXECUTABLE?'packaged':'development';
const dataPath=path.join(root,'output',`upgrade-test-${Date.now()}`);
const file=path.join(dataPath,'data','camp.json');
const shots=path.join(root,'output','playwright','v1.1.0',kind);
const results=[],errors=[];
let app,panel;
const assertNear=(a,b)=>assert.ok(Math.abs(a-b)<1,`${a} differs from ${b}`);
async function open(){
  const env={...process.env,CAMP_TEST_DATA:dataPath};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:process.env.CAMP_EXECUTABLE||require('electron'),args:[...(process.env.CAMP_EXECUTABLE?[]:[root]),'--test-mode'],cwd:root,env,timeout:30000});
  app.on('window',w=>w.on('pageerror',e=>errors.push(e.message)));
  for(let n=0;n<100;n++){
    panel=app.windows().find(w=>w.url().endsWith('/index.html'));if(panel)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(panel,'Main window exists');panel.setDefaultTimeout(10000);
  await panel.waitForSelector('#capture-input');await panel.evaluate(()=>document.fonts.ready);
}
async function close(){if(app){await app.close();app=null;}}
const data=()=>panel.evaluate(async()=>(await window.camp.get()).state);
const row=title=>panel.locator('.task-row').filter({has:panel.locator('.task-title',{hasText:title})});
const radio=(prefix,value)=>panel.locator(`input[name="${prefix}-difficulty"][value="${value}"]`);
async function screenshot(name){
  if(name!=='failure')await panel.waitForSelector('#toast[hidden]',{state:'attached',timeout:10000});
  await panel.screenshot({path:path.join(shots,`${name}.png`)});
}
async function coins(amount){await panel.waitForFunction(n=>Number(document.querySelector('#coin-count').textContent)===n,amount);}
async function expectToast(text){await panel.waitForFunction(text=>document.querySelector('#toast').textContent.includes(text),text);}
async function add(title,difficulty='easy'){
  await radio('draft',difficulty).check();await panel.locator('#capture-input').fill(title);await panel.locator('#capture-input').press('Enter');
  await panel.waitForFunction(()=>document.querySelector('#capture-input').value==='');
  assert.equal(await radio('draft','easy').isChecked(),true,'Each new draft defaults to easy');
}
async function directAction(action){return panel.evaluate(value=>window.camp.action(value),action);}
async function setSize(width,height){await app.evaluate(({BrowserWindow},{width,height})=>{
  const win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='小怪营地');win.setBounds({x:0,y:0,width,height});
},{width,height});await panel.waitForFunction(w=>innerWidth===w,width);}
function legacy(){
  const time='2026-10-20T10:00:00.000Z';
  return {version:1,tasks:[
    {id:'legacy-pending',title:'升级前的待办',rawInput:'升级前的待办',appearance:5,createdAt:time,updatedAt:time,scheduledDate:null,remindAt:null,completedAt:null,deletedAt:null,reminderDeliveredAt:null},
    {id:'legacy-done',title:'升级前完成的事情',rawInput:'升级前完成的事情',appearance:0,createdAt:time,updatedAt:time,scheduledDate:null,remindAt:null,completedAt:time,deletedAt:null,reminderDeliveredAt:null}
  ],notices:[],unlocked:[30],lastReviewDate:null,settings:{autoLaunch:false,reviewEnabled:false,reviewTime:'08:30',animations:true,floatPosition:null}};
}
async function gallery(){
  const {monster,monsterNames}=await import(pathToFileURL(path.join(root,'src','art.mjs')).href);
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>十二种小怪 · 三档体型</title><style>
  @import url('${pathToFileURL(path.join(root,'assets','fonts','noto.css')).href}');
  *{box-sizing:border-box}body{margin:0;padding:36px;background:#fffaf0;color:#34432e;font:14px 'Camp Sans',sans-serif}h1{font-size:27px;margin:0 0 8px;font-weight:650}header p{color:#7b856e;margin:0 0 28px;line-height:1.8}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.creature{border-top:1px solid #d9dec9;padding:17px 0 9px}.creature h2{font-size:16px;margin:0 0 12px;font-weight:550}.creature h2 small{font-size:11px;font-weight:400;color:#7b856e;margin-left:10px}.sizes{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.size{text-align:center;color:#7b856e;font-size:11px}.art{height:80px;display:flex;align-items:center;justify-content:center}.art svg{width:var(--size);height:var(--size)}.size:last-child .art{opacity:.6}.size p{margin:5px 0}footer{font-size:12px;color:#7b856e;margin-top:24px}</style>
  <header><h1>营地的新伙伴</h1><p>12 种外形自动分配，同一种小怪也有三种体型。<br>轻松 10 金币 · 普通 20 金币 · 挑战 40 金币</p></header><div class="grid">${monsterNames.map((name,i)=>`<section class="creature"><h2>${name}<small>${i<6?'原有伙伴':'本次新增'}</small></h2><div class="sizes">${[[40,'轻松',false],[54,'普通',false],[68,'挑战',false],[54,'已完成',true]].map(([size,label,done])=>`<div class="size"><div class="art" style="--size:${size}px">${monster(i,done)}</div><p>${label}</p></div>`).join('')}</div></section>`).join('')}</div><footer>小怪营地 v1.1.0 · 示例展示，未使用个人待办数据</footer></html>`;
  const previewFile=path.join(shots,'monster-gallery.html');await fs.writeFile(previewFile,html);
  const windowEvent=app.waitForEvent('window');
  await app.evaluate(({BrowserWindow},previewFile)=>{
    const win=new BrowserWindow({width:1120,height:1080,show:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
    return win.loadFile(previewFile);
  },previewFile);
  const page=await windowEvent;await page.waitForSelector('.creature');await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.creature').count(),12);assert.equal(await page.locator('.art svg').count(),48);
  for(const entry of await page.locator('.art').evaluateAll(els=>els.map(e=>({expected:parseFloat(e.style.getPropertyValue('--size')),width:e.querySelector('svg').getBoundingClientRect().width}))))assertNear(entry.width,entry.expected);
  await page.screenshot({path:path.join(shots,'12-monsters-and-sizes.png'),fullPage:true});
  await page.close();results.push('All 12 SVG species render in three sizes and completed state');
}
async function main(){
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.mkdir(shots,{recursive:true});
  const old=legacy(),raw=JSON.stringify(old,null,2);await fs.writeFile(file,raw);await fs.writeFile(path.join(path.dirname(file),'camp.backup.json'),raw);
  await open();const migrated=await data();assert.equal(migrated.version,2);assert.equal(D.stats(migrated).coins,10);
  assert.deepEqual(migrated.settings,old.settings);assert.deepEqual(migrated.unlocked,[30]);assert.equal(migrated.tasks[0].appearance,5);
  assert.ok(migrated.tasks.every(t=>t.difficulty==='easy'));
  const folders=await fs.readdir(path.join(dataPath,'backups'));assert.equal(folders.length,1);
  const backup=path.join(dataPath,'backups',folders[0]);assert.equal(await fs.readFile(path.join(backup,'camp.json'),'utf8'),raw);
  const hashes=JSON.parse(await fs.readFile(path.join(backup,'SHA256.json'),'utf8'));assert.equal(hashes['camp.json'],crypto.createHash('sha256').update(raw).digest('hex'));
  await panel.locator('#settings-button').click();assert.equal(await panel.locator('.version').textContent(),'小怪营地 1.1.0');await panel.locator('[data-close=settings-dialog]').click();
  results.push('Real process upgrades isolated v1 data; preserves coins/settings/appearance and verified originals');

  await add('回复一条消息');await add('整理本周资料','normal');await add('完成一个复杂方案','hard');
  const tasks=(await data()).tasks;assert.equal(tasks.find(t=>t.title==='整理本周资料').difficulty,'normal');assert.equal(tasks.find(t=>t.title==='完成一个复杂方案').difficulty,'hard');
  const sizes=await panel.locator('.task-monster').evaluateAll(els=>els.map(e=>({difficulty:e.dataset.difficulty,width:e.querySelector('svg').getBoundingClientRect().width,slot:e.getBoundingClientRect().width})));
  for(const size of sizes){assertNear(size.width,{easy:40,normal:54,hard:68}[size.difficulty]);assertNear(size.slot,72);}
  results.push('Manual three-tier capture, default reset and 40/54/68 px sizes');
  await setSize(452,820);await screenshot('three-difficulties');

  await row('完成一个复杂方案').locator('.task-title').click();await screenshot('edit-difficulty');
  const beforeAppearance=(await data()).tasks.find(t=>t.title==='完成一个复杂方案').appearance;
  await radio('edit','normal').check();await panel.locator('#edit-save').click();await panel.waitForFunction(()=>!document.querySelector('#edit-dialog').open);
  assert.equal((await data()).tasks.find(t=>t.title==='完成一个复杂方案').appearance,beforeAppearance);
  await row('完成一个复杂方案').locator('.task-title').click();await radio('edit','hard').check();await panel.locator('#edit-save').click();
  await row('完成一个复杂方案').getByRole('button',{name:'击败',exact:true}).dblclick({delay:10});await coins(50);
  await panel.waitForFunction(()=>document.querySelector('#toast').textContent.includes('+40 金币'));
  assert.equal((await data()).tasks.find(t=>t.title==='整理本周资料').completedAt,null,'Double click must not complete the neighboring task');
  await panel.locator('[data-filter=done]').click();await row('完成一个复杂方案').locator('.task-title').click();assert.equal(await radio('edit','easy').isDisabled(),true);
  assert.equal(await panel.locator('#difficulty-locked').isVisible(),true);await panel.locator('[data-close=edit-dialog]').click();
  await row('完成一个复杂方案').getByRole('button',{name:'撤销',exact:true}).click();await coins(10);await expectToast('40 枚金币');
  await panel.locator('[data-filter=unscheduled]').click();await row('完成一个复杂方案').locator('.task-title').click();await radio('edit','normal').check();await panel.locator('#edit-save').click();
  await row('完成一个复杂方案').getByRole('button',{name:'击败',exact:true}).click();await coins(30);await expectToast('+20 金币');
  await panel.locator('[data-filter=done]').click();await row('完成一个复杂方案').locator('.task-title').click();await panel.locator('#edit-delete').click();await coins(30);await panel.locator('#toast button').click();await coins(30);
  results.push('Difficulty editing keeps species; completion lock, 40-coin undo, 20-coin redo and delete/restore');

  await panel.locator('[data-filter=unscheduled]').click();
  const held=path.join(path.dirname(file),'held-for-save-failure.json');await fs.rename(file,held);
  try{
    await radio('draft','hard').check();await panel.locator('#capture-input').fill('重试后仍是挑战');await panel.locator('#capture-input').press('Enter');
    await panel.waitForSelector('#error:not([hidden])');assert.equal(await radio('draft','hard').isChecked(),true);assert.equal(await panel.locator('#capture-input').inputValue(),'重试后仍是挑战');
  }finally{await fs.rename(held,file);}
  await panel.locator('#capture-input').press('Enter');await panel.waitForFunction(()=>document.querySelector('#capture-input').value==='');
  assert.equal((await data()).tasks.filter(t=>t.title==='重试后仍是挑战').length,1);
  assert.equal((await data()).tasks.find(t=>t.title==='重试后仍是挑战').difficulty,'hard');
  results.push('Real save failure preserves task text and hard selection; retry creates once');

  await add('检查长标题能否正常显示并且不会挤压小怪和击败按钮'.repeat(6),'hard');await setSize(360,620);
  const narrow=await panel.locator('.task-row').evaluateAll(els=>els.map(e=>{
    const monster=e.querySelector('.task-monster'),copy=e.querySelector('.task-copy').getBoundingClientRect(),button=e.querySelector('.defeat-button').getBoundingClientRect();
    return {difficulty:monster.dataset.difficulty,size:monster.querySelector('svg').getBoundingClientRect().width,slot:monster.getBoundingClientRect().width,copyRight:copy.right,buttonLeft:button.left,buttonRight:button.right};
  }));
  for(const item of narrow){assertNear(item.size,{easy:36,normal:48,hard:60}[item.difficulty]);assertNear(item.slot,64);assert.ok(item.copyRight<=item.buttonLeft);assert.ok(item.buttonRight<=360);}
  assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await screenshot('narrow-window');
  await setSize(452,740);results.push('Narrow 360 px window, 36/48/60 px sizes and long titles avoid overlap');
  const snapshot=await data();await close();await open();assert.deepEqual(await data(),snapshot);assert.equal((await fs.readdir(path.join(dataPath,'backups'))).length,1);
  results.push('Restart preserves mixed difficulty/reward state without repeating migration');

  await close();const reminderState=JSON.parse(await fs.readFile(file,'utf8')),past=new Date(Date.now()-60000);
  for(const [id,difficulty] of [['notice-normal','normal'],['notice-hard','hard']])D.applyAction(reminderState,{type:'create',id,input:{title:id,rawInput:id,scheduledDate:D.dayKey(past),remindAt:past.toISOString(),difficulty}},new Date(Date.now()-120000));
  await fs.writeFile(file,JSON.stringify(reminderState));await open();await panel.waitForFunction(async()=>(await window.camp.get()).state.notices.some(n=>n.kind==='reminder'));
  await panel.locator('#notices-button').click();
  for(const [id,total,reward] of [['notice-normal',50,20],['notice-hard',90,40]]){
    const button=panel.locator('.notice-task').filter({hasText:id}).locator('[data-action=complete]');
    if(id==='notice-normal')await button.dblclick({delay:10});else await button.click();
    await coins(total);await expectToast(`+${reward} 金币`);
    if(id==='notice-normal')assert.equal((await data()).tasks.find(t=>t.id==='notice-hard').completedAt,null,'Notice double click must not complete its neighbor');
  }
  await panel.locator('[data-close=notices-dialog]').click();await panel.locator('[data-tab=camp]').click();assert.match(await panel.locator('#next-caption').textContent(),/还差 10 金币/);await screenshot('camp-reward-progress');
  results.push('Notification completion uses 20/40 coins and camp shows remaining coins');

  // Render every shape through the real task list, not only a standalone picture.
  await panel.locator('[data-tab=tasks]').click();
  for(let i=0;i<12;i++){
    let suffix=0,id;do{id=`appearance-${i}-${suffix++}`;}while(D.appearance(id)!==i);
    await directAction({type:'create',id,input:{title:`外形检查 ${i}`,rawInput:`外形检查 ${i}`,scheduledDate:null,remindAt:null,difficulty:'hard'}});
  }
  await panel.locator('[data-filter=unscheduled]').click();
  const shapes=await panel.locator('.task-row').filter({hasText:'外形检查'}).locator('.task-monster svg').evaluateAll(els=>els.map(e=>e.outerHTML));assert.equal(shapes.length,12);assert.equal(new Set(shapes).size,12);
  await gallery();
  assert.deepEqual(errors,[]);results.push('No renderer errors across upgrade and new UI flows');
  await close();await fs.writeFile(path.join(root,'output',`upgrade-test-results-${kind}.json`),JSON.stringify({passed:results,checks:results.length,kind,dataPath,screenshots:shots,testedAt:new Date().toISOString()},null,2));
  console.log(JSON.stringify({passed:results.length,checks:results,screenshots:shots},null,2));
}
main().catch(async error=>{console.error(error);if(panel)try{await screenshot('failure');}catch{}process.exitCode=1;}).finally(close);
