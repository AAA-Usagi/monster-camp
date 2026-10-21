import {monster,monsterNames,coin,icon,campScene} from './art.mjs';
const D=window.CampDomain;
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$$('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('.coin-icon').innerHTML=coin;
$('#greeting-monster').innerHTML=monster(0);
for(const prefix of ['draft','edit']){
  $(`#${prefix}-difficulty .difficulty-options`).innerHTML=Object.entries(D.DIFFICULTIES).map(([value,option])=>`<label class="difficulty-option"><input type="radio" name="${prefix}-difficulty" value="${value}" aria-label="${option.label}，${option.reward} 金币" ${value==='easy'?'checked':''}><span><strong>${option.label}</strong><small>${option.reward} 金币</small></span></label>`).join('');
}
const selectedDifficulty=prefix=>$(`input[name="${prefix}-difficulty"]:checked`).value;
let state=D.initialState(), filter='today', tab='tasks', query='', draftOverride=null, draftId=crypto.randomUUID(), editingId=null, saving=false, toastTimer;
let dataPath='', lastSave=null;
const working=new Set();
const motion=()=>state.settings.animations&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
function showError(message){$('#error span').textContent=message;$('#error').hidden=false;}
$('#error button').onclick=()=>$('#error').hidden=true;
function toast(message,{action,label,duration=4200,celebration=false}={}){
  clearTimeout(toastTimer);const el=$('#toast');el.className=`toast${celebration?' celebration':''}`;el.replaceChildren();
  const text=document.createElement('span');text.textContent=message;el.append(text);
  if(action){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{el.hidden=true;try{await action();}catch(e){showError(e.message);}};el.append(button);}
  el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,duration);
}
function dateLabel(date){if(!date)return '未定时间';const today=D.dayKey(new Date());const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);if(date===today)return '今天';if(date===D.dayKey(tomorrow))return '明天';const d=new Date(`${date}T12:00:00`);return `${d.getFullYear()===new Date().getFullYear()?'':`${d.getFullYear()}年`}${d.getMonth()+1}月${d.getDate()}日`;}
function timeLabel(task){return `${dateLabel(task.scheduledDate)}${task.remindAt?` ${D.timeKey(task.remindAt)}`:''}`;}
function getDraft(){
  const parsed=D.parseInput($('#capture-input').value);
  if(!draftOverride)return parsed;
  const {date,time}=draftOverride;
  const scheduledDate=date||(time?D.dayKey(new Date()):null);
  let remindAt=null,warning='';
  if(time&&scheduledDate){const d=new Date(`${scheduledDate}T${time}:00`);if(Number.isFinite(+d)){remindAt=d.toISOString();if(+d<=Date.now())warning='提醒时间已经过去，请调整时间或移除提醒。';}else warning='请选择有效日期和时间。';}
  return {...parsed,scheduledDate,remindAt,warning,recognized:Boolean(scheduledDate)};
}
function renderDraft(){
  const draft=getDraft(),preview=$('#parse-preview');
  preview.hidden=!draft.recognized&&!draft.warning;preview.classList.toggle('warning',Boolean(draft.warning));
  preview.innerHTML=`${icon(draft.warning?'clock':'calendar')}<span>${escape(draft.warning||(draft.remindAt?`提醒：${draft.scheduledDate} ${D.timeKey(draft.remindAt)}`:`安排到 ${draft.scheduledDate}，不设到点提醒`))}</span><button type="button" class="text-button" id="preview-edit">修改</button><button type="button" class="text-button" id="preview-clear">移除</button>`;
  $('#preview-edit').onclick=()=>openDraftSchedule();$('#preview-clear').onclick=()=>clearDraftSchedule();
  $('#capture-submit').disabled=saving||!draft.rawInput.trim()||Boolean(draft.warning);
  $('#draft-difficulty').disabled=saving;
  if(!$('#draft-schedule').hidden&&!draftOverride){$('#draft-date').value=draft.scheduledDate||'';$('#draft-time').value=draft.remindAt?D.timeKey(draft.remindAt):'';}
}
function openDraftSchedule(){const draft=getDraft();$('#draft-schedule').hidden=false;$('#draft-date').value=draft.scheduledDate||'';$('#draft-time').value=draft.remindAt?D.timeKey(draft.remindAt):'';}
function clearDraftSchedule(){draftOverride={date:null,time:null};$('#draft-date').value='';$('#draft-time').value='';$('#draft-schedule').hidden=true;renderDraft();}
$('#capture-input').addEventListener('input',renderDraft);
$('#capture-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#capture-form').requestSubmit();}});
$('#schedule-toggle').onclick=()=>$('#draft-schedule').hidden?openDraftSchedule():$('#draft-schedule').hidden=true;
$('#clear-schedule').onclick=clearDraftSchedule;
for(const id of ['#draft-date','#draft-time'])$(id).onchange=()=>{draftOverride={date:$('#draft-date').value||null,time:$('#draft-time').value||null};if(draftOverride.time&&!draftOverride.date){draftOverride.date=D.dayKey(new Date());$('#draft-date').value=draftOverride.date;}renderDraft();};
async function act(action){
  $('#save-status').textContent='正在保存…';
  try{const output=await window.camp.action(action);state=output.state;lastSave=new Date();render();return output.result;}
  catch(e){$('#save-status').textContent='未能保存，请重试';throw e;}
}
$('#capture-form').onsubmit=async event=>{
  event.preventDefault();if(saving)return;
  const draft=getDraft();if(!draft.rawInput.trim())return;
  if(draft.warning){showError(draft.warning);return;}
  saving=true;renderDraft();
  try{
    const result=await act({type:'create',id:draftId,input:{title:draft.title,rawInput:draft.rawInput,scheduledDate:draft.scheduledDate,remindAt:draft.remindAt,difficulty:selectedDifficulty('draft')}});
    const task=state.tasks.find(t=>t.id===result.taskId)||state.tasks.find(t=>t.id===draftId);
    $('#capture-input').value='';draftOverride=null;draftId=crypto.randomUUID();$('#draft-schedule').hidden=true;query='';$('#search-input').value='';
    $('input[name="draft-difficulty"][value="easy"]').checked=true;
    if(task)filter=D.category(task);renderList();toast('记住了，这只小怪交给营地保管。',{duration:2200});$('#error').hidden=true;
  }catch(e){showError(e.message);}finally{saving=false;renderDraft();$('#capture-input').focus();}
};
function setTab(next){tab=next;$('.shell').classList.toggle('camp-view',tab==='camp');$('#tasks-page').hidden=tab!=='tasks';$('#camp-page').hidden=tab!=='camp';$$('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(tab==='camp'){$('#new-unlock').hidden=true;renderCamp();}}
$$('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;query='';$('#search-input').value='';renderList();});
$('#search-toggle').onclick=()=>{const box=$('#search-box');box.hidden=!box.hidden;if(!box.hidden)$('#search-input').focus();else{query='';$('#search-input').value='';renderList();}};
$('#search-input').oninput=()=>{query=$('#search-input').value.trim().toLocaleLowerCase();renderList();};
$('#search-clear').onclick=()=>{query='';$('#search-input').value='';renderList();$('#search-input').focus();};
function renderList(){
  const now=new Date(),today=D.dayKey(now),visible=state.tasks.filter(t=>!t.deletedAt);
  $$('[data-filter]').forEach(b=>{const count=visible.filter(t=>D.category(t,now)===b.dataset.filter).length;b.classList.toggle('selected',filter===b.dataset.filter&&!query);b.querySelector('span').textContent=count||'';});
  const tasks=visible.filter(t=>query?`${t.title} ${t.rawInput}`.toLocaleLowerCase().includes(query):D.category(t,now)===filter);
  tasks.sort((a,b)=>{if(a.completedAt&&b.completedAt)return b.completedAt.localeCompare(a.completedAt);if(Boolean(a.completedAt)!==Boolean(b.completedAt))return a.completedAt?1:-1;return (a.scheduledDate||'9999').localeCompare(b.scheduledDate||'9999')||(a.remindAt||'9999').localeCompare(b.remindAt||'9999')||b.createdAt.localeCompare(a.createdAt);});
  if(!tasks.length){
    const empty=query?['没有找到这只小怪','试试任务里的其他关键词。']:({today:['今天的营地，很安静','记下一件想做的事，或者去「未定时间」看看。'],next:['未来，慢慢安排','写下“明天”或选个日期，小怪就会在这里等你。'],unscheduled:['零散的小事，都有去处','没有写时间的事情会放在这里，随时回来安排。'],done:['第一场小胜利，等你开启','完成一件事，点一下「击败」，留下今天的战绩。']}[filter]);
    $('#task-list').innerHTML=`<div class="empty-state"><div>${monster(filter==='done'?1:0,true)}</div><h3>${escape(empty[0])}</h3><p>${escape(empty[1])}</p></div>`;return;
  }
  const labels={today:'今天',next:'接下来',unscheduled:'未定时间',done:'已完成'};
  $('#task-list').innerHTML=tasks.map(t=>{
    const overdue=!t.completedAt&&t.scheduledDate&&t.scheduledDate<today;
    const meta=t.completedAt?`${dateLabel(D.dayKey(t.completedAt))} ${D.timeKey(t.completedAt)} 已击败`:`${overdue?'逾期 · ':''}${timeLabel(t)}`;
    const difficulty=D.DIFFICULTIES[t.difficulty];
    return `<article class="task-row ${t.completedAt?'completed':''}" data-task-id="${escape(t.id)}"><div class="task-monster" data-difficulty="${t.difficulty}" title="${monsterNames[t.appearance]}">${monster(t.appearance,Boolean(t.completedAt))}</div><div class="task-copy"><button class="task-title" data-action="edit" data-id="${escape(t.id)}" title="编辑这件事">${escape(t.title)}</button><div class="task-meta ${overdue?'overdue':''}">${icon(t.completedAt?'check':t.remindAt?'clock':'calendar')}<span>${escape(meta)}</span>${query?`<span class="category-label">${labels[D.category(t)]}</span>`:''}</div><div class="task-difficulty"><span class="difficulty-badge" data-difficulty="${t.difficulty}">${difficulty.label}</span><span class="task-reward">${t.completedAt?'已获 ':'+'}${t.completedAt?t.rewardEarned:difficulty.reward} 金币</span></div></div><button class="defeat-button" data-action="${t.completedAt?'reopen':'complete'}" data-id="${escape(t.id)}" ${working.has(t.id)?'disabled':''}>${icon(t.completedAt?'back':'sword')}${t.completedAt?'撤销':'击败'}</button></article>`;
  }).join('');
}
function celebrate(rect){
  if(!motion()||!rect)return;
  const effects=$('#effects'),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  for(let i=0;i<8;i++){const el=document.createElement('span');el.className='particle';el.textContent=i%2?'✦':'✧';el.style.left=`${cx}px`;el.style.top=`${cy}px`;effects.append(el);const a=i*Math.PI/4;el.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:1},{transform:`translate(${Math.cos(a)*48-10}px,${Math.sin(a)*42-10}px) scale(1.2) rotate(30deg)`,opacity:0}],{duration:520,easing:'ease-out'}).finished.finally(()=>el.remove());}
  const token=document.createElement('span');token.className='flying-coin';token.innerHTML=coin;token.style.left=`${cx}px`;token.style.top=`${cy}px`;effects.append(token);const target=$('#coin-counter').getBoundingClientRect();token.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${target.left-cx}px,${target.top-cy}px) scale(.6)`,opacity:.2}],{duration:520,easing:'cubic-bezier(.3,.1,.6,1)'}).finished.finally(()=>token.remove());
}
async function completeTask(id,rect){
  if(working.has(id))return;working.add(id);
  try{const result=await act({type:'complete',id});if(result.changed){celebrate(rect);if(result.unlockedNow?.length){$('#new-unlock').hidden=false;toast(`+${result.coinsDelta} 金币！营地解锁了${result.unlockedNow.map(m=>m.name).join('、')}。`,{label:'去看看',action:async()=>setTab('camp'),duration:6500,celebration:true});}else toast(`+${result.coinsDelta} 金币。又一件事，被你好好完成了。`,{duration:3000});}}
  catch(e){showError(e.message);}finally{working.delete(id);renderList();renderNotices();}
}
async function deleteTask(id){await act({type:'delete',id});toast('这只小怪已移走。',{label:'撤销',action:()=>act({type:'restore',id}),duration:10000});}
$('#task-list').onclick=async event=>{
  if(event.detail>1)return;
  const b=event.target.closest('[data-action]');if(!b)return;const id=b.dataset.id;
  if(b.dataset.action==='edit'){openEdit(id);return;}
  if(b.dataset.action==='complete'){const rect=b.closest('.task-row').querySelector('.task-monster').getBoundingClientRect();await completeTask(id,rect);return;}
  if(b.dataset.action==='reopen'){if(working.has(id))return;working.add(id);try{const result=await act({type:'reopen',id});if(result.changed)toast(`小怪回到清单，对应的 ${-result.coinsDelta} 枚金币已收回。`);}catch(e){showError(e.message);}finally{working.delete(id);renderList();}}
};
function openDialog(id){$$('dialog[open]').forEach(d=>d.close());$(id).showModal();}
function openEdit(id){const t=state.tasks.find(t=>t.id===id&&!t.deletedAt);if(!t)return;editingId=id;$('#edit-title').value=t.title;$('#edit-date').value=t.scheduledDate||'';$('#edit-time').value=t.remindAt?D.timeKey(t.remindAt):'';$('#edit-original').textContent=`最初记下：${t.rawInput}`;$(`input[name="edit-difficulty"][value="${t.difficulty}"]`).checked=true;$('#edit-difficulty').disabled=Boolean(t.completedAt);$('#difficulty-locked').hidden=!t.completedAt;$('#edit-error').textContent='';openDialog('#edit-dialog');}
$('#edit-clear-time').onclick=()=>{$('#edit-date').value='';$('#edit-time').value='';};
$('#edit-form').onsubmit=async event=>{
  event.preventDefault();if($('#edit-save').disabled)return;const task=state.tasks.find(t=>t.id===editingId);if(!task)return;
  const time=$('#edit-time').value,date=$('#edit-date').value||(time?D.dayKey(new Date()):null);
  let remindAt=null;
  try{if(time)remindAt=task.remindAt&&date===task.scheduledDate&&time===D.timeKey(task.remindAt)?task.remindAt:new Date(`${date}T${time}:00`).toISOString();}catch{$('#edit-error').textContent='请选择有效日期和时间。';return;}
  $('#edit-save').disabled=true;
  try{await act({type:'edit',id:editingId,input:{title:$('#edit-title').value,rawInput:task.rawInput,scheduledDate:date,remindAt,difficulty:selectedDifficulty('edit')}});$('#edit-dialog').close();toast('改好了，营地已经记住。');}catch(e){$('#edit-error').textContent=e.message;}finally{$('#edit-save').disabled=false;}
};
$('#edit-delete').onclick=async()=>{if($('#edit-delete').disabled)return;$('#edit-delete').disabled=true;try{await deleteTask(editingId);$('#edit-dialog').close();}catch(e){$('#edit-error').textContent=e.message;}finally{$('#edit-delete').disabled=false;}};
$$('[data-close]').forEach(b=>b.onclick=()=>$(`#${b.dataset.close}`).close());
function openSettings(){
  $('#setting-autolaunch').checked=state.settings.autoLaunch;$('#setting-review').checked=state.settings.reviewEnabled;$('#setting-review-time').value=state.settings.reviewTime;$('#setting-review-time').disabled=!state.settings.reviewEnabled;$('#setting-animations').checked=state.settings.animations;$('#data-path').textContent=dataPath;$('#settings-error').textContent='';openDialog('#settings-dialog');
}
$('#settings-button').onclick=openSettings;
$('#setting-review').onchange=()=>$('#setting-review-time').disabled=!$('#setting-review').checked;
$('#settings-form').onsubmit=async event=>{
  event.preventDefault();$('#settings-save').disabled=true;
  try{await act({type:'settings',patch:{autoLaunch:$('#setting-autolaunch').checked,reviewEnabled:$('#setting-review').checked,reviewTime:$('#setting-review-time').value,animations:$('#setting-animations').checked}});$('#settings-dialog').close();toast('营地设置已保存。');}catch(e){$('#settings-error').textContent=e.message;}finally{$('#settings-save').disabled=false;}
};
function renderCamp(){
  const {coins,completed}=D.stats(state),next=D.MILESTONES.find(m=>!state.unlocked.includes(m.coins));
  $('#camp-scene').innerHTML=campScene(state.unlocked);
  $('#camp-caption').textContent=completed?`已经完成 ${completed} 件事，营地记得你的每一点努力。`:'先安营，再慢慢长成喜欢的样子。';
  $('#next-title').textContent=next?`下一站，解锁${next.name}`:'花园已经盛开，故事还在继续';
  $('#next-count').textContent=next?`${coins} / ${next.coins} 金币`:`累计 ${coins} 金币`;
  $('#camp-progress').max=next?.coins||500;$('#camp-progress').value=Math.min(coins,next?.coins||500);
  $('#next-caption').textContent=next?`还差 ${Math.max(0,next.coins-coins)} 金币，${next.caption}。`:'每完成一件事，都会继续留下你的战绩。';
  $('#milestones').innerHTML=D.MILESTONES.map((m,i)=>`<div class="milestone ${state.unlocked.includes(m.coins)?'unlocked':''}"><div class="milestone-art">${i===0?icon('tent'):i===1?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 20C0 13 12 11 11 2c9 7 12 13 5 18ZM4 22l16-3M4 19l16 3"/></svg>':i===2?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m2 11 10-9 10 9M5 9v13h14V9M10 22v-8h5v8"/></svg>':icon('leaf')}</div><strong>${m.name}</strong><small>${state.unlocked.includes(m.coins)?'已入驻':`${m.coins} 金币`}</small></div>`).join('');
}
function renderNotices(){
  $('#notice-dot').hidden=!state.notices.some(n=>!n.readAt);
  const notices=[...state.notices].sort((a,b)=>Number(Boolean(a.readAt))-Number(Boolean(b.readAt))||b.createdAt.localeCompare(a.createdAt));
  $('#notices-list').innerHTML=notices.length?notices.map(n=>`<article class="notice-card ${n.readAt?'read':''}"><h3>${escape(n.title)}</h3><p>${escape(n.body)}</p><small>${escape(dateLabel(D.dayKey(n.createdAt)))} ${D.timeKey(n.createdAt)}${n.readAt?' · 已读':''}</small>${n.taskIds.map(id=>{const t=state.tasks.find(t=>t.id===id&&!t.deletedAt&&!t.completedAt);return t?`<div class="notice-task"><button data-action="locate" data-id="${escape(id)}">${escape(t.title)}</button><button data-action="snooze" data-id="${escape(id)}">延后10分</button><button data-action="complete" data-id="${escape(id)}">击败</button></div>`:'';}).join('')}${!n.readAt?`<button class="quiet-button" data-action="read" data-id="${escape(n.id)}">知道了</button>`:''}</article>`).join(''):`<div class="empty-state"><div>${monster(2,true)}</div><h3>暂时没有来信</h3><p>到点提醒和每日回顾都会留在这里。</p></div>`;
  $('#read-all').hidden=!state.notices.some(n=>!n.readAt);
}
function locateTask(id){const t=state.tasks.find(t=>t.id===id&&!t.deletedAt);if(!t)return;$$('dialog[open]').forEach(d=>d.close());setTab('tasks');filter=D.category(t);query='';$('#search-input').value='';renderList();const row=$(`[data-task-id="${CSS.escape(id)}"]`);if(row){row.classList.add('highlight');row.scrollIntoView({block:'nearest',behavior:motion()?'smooth':'instant'});setTimeout(()=>row.classList.remove('highlight'),2500);}}
$('#notices-button').onclick=()=>{renderNotices();openDialog('#notices-dialog');};
$('#notices-list').onclick=async event=>{if(event.detail>1)return;const b=event.target.closest('[data-action]');if(!b)return;const id=b.dataset.id;try{if(b.dataset.action==='locate')locateTask(id);else if(b.dataset.action==='complete')await completeTask(id);else if(b.dataset.action==='snooze'){await act({type:'snooze',id});toast('十分钟后再来敲门。');}else await act({type:'read-notices',id});}catch(e){showError(e.message);}};
$('#read-all').onclick=async()=>{try{await act({type:'read-notices'});}catch(e){showError(e.message);}};
$('#hide-button').onclick=()=>window.camp.window('hide');
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('dialog[open]'))window.camp.window('hide');if((event.ctrlKey||event.metaKey)&&event.key==='f'){event.preventDefault();setTab('tasks');$('#search-box').hidden=false;$('#search-input').focus();}});
function render(){
  const now=new Date(),counts=D.stats(state,now);$('#date-label').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(now);
  $('#today-count').textContent=counts.today;$('#coin-count').textContent=counts.coins;
  $('#greeting-title').textContent=counts.today?'又向前，走了一小步。':'小小的事，也值得庆祝。';
  $('#today-summary').textContent=counts.today?`今天已经完成 ${counts.today} 件事。给自己一点掌声。`:counts.pending?`${counts.pending} 只小怪在等你，一件一件来。`:'今天从一件小事开始。';
  document.body.classList.toggle('no-motion',!state.settings.animations);
  $('#save-status').innerHTML=`<i></i>${lastSave?`${D.timeKey(lastSave)} 已保存到本机`:'只在本机，安心保存'}`;
  renderList();if(tab==='camp')renderCamp();renderNotices();
}
window.camp.onState(next=>{state=next;render();});
window.camp.onError(showError);
window.camp.onOpen(target=>{
  if(target?.settings){openSettings();return;}
  if(target?.taskId){locateTask(target.taskId);return;}
  if(target?.notices){renderNotices();openDialog('#notices-dialog');return;}
  if($('dialog[open]'))return;
  setTab('tasks');$('#capture-input').focus();
});
try{const initial=await window.camp.get();state=initial.state;dataPath=initial.dataPath;render();renderDraft();$('#capture-input').focus();}catch(e){showError(`暂时无法读取营地：${e.message}`);}
setInterval(()=>{render();renderDraft();},60000);
