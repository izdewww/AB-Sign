import { contextBridge, ipcRenderer } from 'electron';
import type { AccountCommand } from './account-types.cjs';

contextBridge.exposeInMainWorld('localAccounts', {
  request: (command: AccountCommand) => ipcRenderer.invoke('ab-sign:accounts', command),
});
