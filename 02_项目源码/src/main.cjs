'use strict';
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, Notification, nativeImage, powerMonitor, dialog, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');
const { Store, RecoveryRequired } = require('./store.cjs');
const { applyAction, reminderSweep, clampFloat, stats } = require('./domain.js');

const TEST = process.argv.includes('--test-mode');
if (TEST && process.env.CAMP_TEST_DATA) app.setPath('userData', path.resolve(process.env.CAMP_TEST_DATA));
app.setName('小怪营地');
app.setAppUserModelId('io.monstercamp.desktop');
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let panel, floater, tray, store, timer, drag, quitting = false, shutdownReady = false, busySweep = false;
const liveNotifications = new Set();
const iconPath = path.join(__dirname, '../assets/icon.png');
const windows = () => [panel, floater].filter(w => w && !w.isDestroyed());
function broadcast(state) {
  windows().forEach(w => w.webContents.send('camp:state', state));
  if (tray) tray.setToolTip(`小怪营地 · ${stats(state).pending} 只小怪待处理`);
}
function positionPanel() {
  if (!panel || !floater) return;
  const f = floater.getBounds(), area = screen.getDisplayMatching(f).workArea;
  const width = Math.min(452, area.width - 16), height = Math.min(740, area.height - 20);
  const onRight = f.x + f.width / 2 > area.x + area.width / 2;
  const desired = onRight ? f.x - width - 6 : f.x + f.width + 6;
  panel.setBounds({ x: Math.round(Math.max(area.x + 8, Math.min(desired, area.x + area.width - width - 8))), y: Math.round(Math.max(area.y + 10, Math.min(f.y - 70, area.y + area.height - height - 10))), width, height });
}
function openPanel(target = null) {
  if (!panel) return;
  positionPanel(); panel.show(); panel.focus();
  panel.webContents.send('camp:open', target);
}
async function snapFloat(persist = true) {
  const point = clampFloat(floater.getBounds(), screen.getAllDisplays().map(d => d.workArea));
  floater.setPosition(point.x, point.y); positionPanel();
  if (persist) {
    try { const { state } = await store.transact(s => applyAction(s, {type:'settings',patch:{floatPosition:point}})); broadcast(state); }
    catch { panel.webContents.send('camp:error', '浮标位置暂未保存，任务记录不受影响。'); }
  }
}
function syncAutoLaunch(enabled) {
  if (app.isPackaged && !TEST) app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--autostart'] });
}
function notify(notice) {
  // The durable in-app notice always remains available, including when Windows silences toasts.
  if (!Notification.isSupported() || TEST) return;
  try {
    const n = new Notification({ title: notice.title, body: notice.body, icon: iconPath, silent: true });
    liveNotifications.add(n);
    n.on('click', () => openPanel({ taskId: notice.taskIds[0] || null, notices: true }));
    n.on('close', () => liveNotifications.delete(n));
    n.on('failed', () => liveNotifications.delete(n));
    n.show();
  } catch {}
}
async function sweep() {
  if (busySweep || quitting || !store) return;
  busySweep = true;
  try {
    const {state, result} = await store.transact(s => reminderSweep(s));
    if (result.changed) broadcast(state);
    result.notices.forEach(notify);
  } catch { windows().forEach(w => w.webContents.send('camp:error', '提醒暂未保存，请检查磁盘空间。任务仍在营地里。')); }
  finally { busySweep = false; }
}
function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}
function registerIPC() {
  const validURLs = ['index.html','float.html'].map(f => pathToFileURL(path.join(__dirname, f)).href);
  function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!windows().some(w => w.webContents === event.sender) || !event.senderFrame || !validURLs.includes(event.senderFrame.url.split('?')[0])) return {ok:false,error:'无效窗口。'};
      try { return {ok:true,value:await fn(event, ...args)}; }
      catch (e) { return {ok:false,error: e.code ? '保存失败，请检查磁盘空间或文件权限后重试。' : e.message}; }
    });
  }
  handle('camp:get', async () => { await store.idle(); return { state:store.snapshot(), dataPath:store.directory, packaged:app.isPackaged }; });
  handle('camp:action', async (event, action) => {
    if (event.sender !== panel.webContents || !action || typeof action !== 'object' || !['create','edit','complete','reopen','delete','restore','snooze','settings','read-notices'].includes(action.type)) throw new Error('无效操作。');
    if (action.type === 'create') action.id = typeof action.id === 'string' && /^[\w-]{1,80}$/.test(action.id) ? action.id : crypto.randomUUID();
    if (action.type === 'settings' && action.patch?.floatPosition !== undefined) throw new Error('请拖动浮标调整位置。');
    const oldAuto = store.state.settings.autoLaunch;
    let autoChanged = false;
    if (action.type === 'settings' && typeof action.patch?.autoLaunch === 'boolean' && action.patch.autoLaunch !== oldAuto) {
      syncAutoLaunch(action.patch.autoLaunch); autoChanged = true;
    }
    try {
      const output = await store.transact(s => applyAction(s, action));
      broadcast(output.state); return output;
    } catch (e) { if (autoChanged) { try { syncAutoLaunch(oldAuto); } catch {} } throw e; }
  });
  handle('camp:window', async (event, action) => {
    if (action === 'hide') { panel.hide(); return; }
    if (action === 'toggle') { panel.isVisible() ? panel.hide() : openPanel(); return; }
    if (event.sender !== floater.webContents) return;
    if (action === 'drag-start') drag = { cursor:screen.getCursorScreenPoint(), origin:floater.getBounds() };
    if (action === 'drag-move' && drag) {
      const cursor = screen.getCursorScreenPoint();
      floater.setPosition(drag.origin.x + cursor.x - drag.cursor.x, drag.origin.y + cursor.y - drag.cursor.y);
    }
    if (action === 'drag-end') { drag = null; await snapFloat(); }
  });
}
async function boot() {
  store = new Store(path.join(app.getPath('userData'), 'data'));
  try { await store.load(); }
  catch (e) {
    if (e instanceof RecoveryRequired && e.backupAvailable) {
      const response = await dialog.showMessageBox({ type:'warning',title:'小怪营地 · 恢复记录',message:e.message,detail:`可恢复最近一次有效备份，最近一次保存的修改可能需要重新记录。\n文件位置：${store.directory}`,buttons:['恢复备份','退出并保留文件'],defaultId:0,cancelId:1 });
      if (response.response === 0) { try { await store.recover(); } catch (recoveryError) { dialog.showErrorBox('恢复失败', `${recoveryError.message}\n${store.directory}`); app.quit(); return; } }
      else { app.quit(); return; }
    } else { dialog.showErrorBox('无法打开营地记录', `${e.message}\n请保留此目录中的文件：\n${store.directory}`); app.quit(); return; }
  }
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']}, (_details, callback) => callback({cancel:true}));
  const webPreferences = { preload:path.join(__dirname, 'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true, spellcheck:false, backgroundThrottling:false };
  const point = clampFloat(store.state.settings.floatPosition, screen.getAllDisplays().map(d => d.workArea));
  floater = new BrowserWindow({ ...point, width:78, height:78, frame:false, transparent:true, resizable:false, hasShadow:false, skipTaskbar:true, alwaysOnTop:true, show:false, title:'小怪营地 · 浮标', icon:iconPath, webPreferences });
  panel = new BrowserWindow({ width:452,height:740,frame:false,transparent:true,resizable:false,hasShadow:true,skipTaskbar:true,alwaysOnTop:true,show:false,title:'小怪营地',icon:iconPath,webPreferences });
  windows().forEach(secureWindow);
  panel.on('blur', () => { if (!TEST) panel.hide(); });
  panel.on('close', event => { if (!quitting) { event.preventDefault(); panel.hide(); } });
  registerIPC();
  await Promise.all([floater.loadFile(path.join(__dirname,'float.html')),panel.loadFile(path.join(__dirname,'index.html'))]);
  positionPanel(); floater.showInactive();
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({width:32,height:32}));
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'打开小怪营地',click:()=>openPanel()},
    {label:'设置',click:()=>openPanel({settings:true})},
    {type:'separator'}, {label:'退出（暂停提醒）',click:()=>app.quit()}
  ]));
  tray.on('click',()=>panel.isVisible()?panel.hide():openPanel());
  broadcast(store.snapshot());
  try { syncAutoLaunch(store.state.settings.autoLaunch); } catch { panel.webContents.send('camp:error','开机启动设置未成功，请在设置中重试。'); }
  if (!process.argv.includes('--autostart')) openPanel();
  screen.on('display-removed',()=>snapFloat());
  screen.on('display-metrics-changed',()=>snapFloat());
  screen.on('display-added',()=>snapFloat());
  powerMonitor.on('resume',()=>{ snapFloat(); sweep(); });
  timer = setInterval(sweep,15000);
  await sweep();
}
if (locked) app.whenReady().then(boot).catch(error=>{ dialog.showErrorBox('营地未能启动',error.message); app.quit(); });
app.on('second-instance',()=>openPanel());
app.on('activate',()=>openPanel());
app.on('window-all-closed',()=>{});
app.on('before-quit',event=>{
  if (shutdownReady || !store?.state) return;
  event.preventDefault(); if (quitting) return; quitting = true; clearInterval(timer);
  store.idle().finally(()=>{ shutdownReady = true; app.quit(); });
});
