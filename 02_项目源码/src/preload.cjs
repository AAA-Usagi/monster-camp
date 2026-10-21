'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (channel, value) => {
  const reply = await ipcRenderer.invoke(channel, value);
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
};
const listen = (channel, fn) => { const listener = (_event, value) => fn(value); ipcRenderer.on(channel,listener); return ()=>ipcRenderer.removeListener(channel,listener); };
contextBridge.exposeInMainWorld('camp', {
  get:()=>invoke('camp:get'),
  action:value=>invoke('camp:action',value),
  window:value=>invoke('camp:window',value),
  onState:fn=>listen('camp:state',fn),
  onOpen:fn=>listen('camp:open',fn),
  onError:fn=>listen('camp:error',fn)
});
