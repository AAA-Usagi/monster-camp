import { monster } from './art.mjs';
const button=document.querySelector('#float');
document.querySelector('#mascot').innerHTML=monster(0);
let down=null,moved=false;
button.addEventListener('pointerdown',async e=>{ if(e.button!==0)return;down={x:e.screenX,y:e.screenY};moved=false;button.setPointerCapture(e.pointerId);await window.camp.window('drag-start'); });
button.addEventListener('pointermove',e=>{if(!down)return;if(Math.abs(e.screenX-down.x)+Math.abs(e.screenY-down.y)>4)moved=true;if(moved)window.camp.window('drag-move');});
button.addEventListener('pointerup',async e=>{if(!down)return;down=null;button.releasePointerCapture(e.pointerId);await window.camp.window('drag-end');if(!moved)await window.camp.window('toggle');});
button.addEventListener('pointercancel',()=>{down=null;window.camp.window('drag-end');});
button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.camp.window('toggle');}});
function render(state){const count=state.tasks.filter(t=>!t.completedAt&&!t.deletedAt).length;const badge=document.querySelector('#count');badge.textContent=count>99?'99+':count;badge.hidden=count===0;document.querySelector('#unread').hidden=!state.notices.some(n=>!n.readAt);button.setAttribute('aria-label',`打开小怪营地，${count} 只小怪待处理，拖动可移动`);}
window.camp.onState(render);render((await window.camp.get()).state);
