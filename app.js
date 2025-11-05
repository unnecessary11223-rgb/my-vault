// app.js - main UI wiring: sidebar toggle, admin/guest logic, render/runC# hooks, auto-run on select/import
console.log('app.js loaded');

(async () => {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));

  // Install prompt
  let installPrompt = null; const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; installBtn.hidden = false; });
  installBtn?.addEventListener('click', async () => { if(!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installBtn.hidden = true; installPrompt = null; });

  // DOM nodes
  const app = document.getElementById('app');
  const toggleSidebar = document.getElementById('toggleSidebar');
  const tree = document.getElementById('tree');
  const search = document.getElementById('search');
  const editor = document.getElementById('editor');
  const output = document.getElementById('output');
  const status = document.getElementById('status');
  const fileTitle = document.getElementById('fileTitle');
  const fileName = document.getElementById('fileName');
  const crumbs = document.getElementById('crumbs');
  const roleBadge = document.getElementById('roleBadge');

  const copyBtn = document.getElementById('copyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const newFolderBtn = document.getElementById('newFolder');
  const importFile = document.getElementById('importFile');
  const importJsonBtn = document.getElementById('importJson');
  const exportAll = document.getElementById('exportAll');
