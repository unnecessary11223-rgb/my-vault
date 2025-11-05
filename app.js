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
  const openRawBtn = document.getElementById('openRaw');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const renderBtn = document.getElementById('renderBtn');
  const runCsBtn = document.getElementById('runCsBtn');

  // Auth modal nodes
  const authModal = document.getElementById('authModal');
  const setupBox = document.getElementById('setupBox');
  const loginBox = document.getElementById('loginBox');
  const setupBtn = document.getElementById('setupBtn');
  const loginDo = document.getElementById('loginDo');
  const newPass = document.getElementById('newPass');
  const newPass2 = document.getElementById('newPass2');
  const loginPass = document.getElementById('loginPass');

  // --- Permanent toggle wiring + enforce sticky style (prevents it being covered) ---
  if(toggleSidebar){
    Object.assign(toggleSidebar.style, {
      position: 'fixed',
      left: '10px',
      top: '10px',
      zIndex: 2147483647,
      pointerEvents: 'auto',
      display: 'block'
    });
    if(!toggleSidebar._wired){
      toggleSidebar.addEventListener('click', ()=> app.classList.toggle('collapsed'));
      toggleSidebar._wired = true;
    }
  }

  // Sidebar toggle (safe fallback for any other code)
  // ensure the app can also be toggled by keyboard (Ctrl+Alt+M)
  if(!window._vaultHotkeyAdded){
    window.addEventListener('keydown', e => { if(e.ctrlKey && e.altKey && e.key.toLowerCase()==='m'){ app.classList.toggle('collapsed'); }});
    window._vaultHotkeyAdded = true;
  }

  // State
  let folders = await DB.list('folders');
  let files = await DB.list('files');
  if (folders.length === 0) {
    await DB.put('folders', { id:'root', name:'Home', parent:null });
    folders = await DB.list('folders');
  }
  let currentFileId = null;

  function setAdminUI(on) {
    roleBadge.textContent = on ? 'ADMIN' : 'GUEST';
    roleBadge.classList.toggle('admin', on);
    roleBadge.classList.toggle('guest', !on);
    [newFolderBtn, importFile, importJsonBtn, saveBtn, deleteBtn].forEach(b => b.disabled = !on);
    loginBtn.classList.toggle('hidden', on);
    logoutBtn.classList.toggle('hidden', !on);
    editor.readOnly = !on;
    fileName.disabled = !on;
  }

  async function initAuth() {
    if (await Auth.ensureSetup()) openModal(true);
    else setAdminUI(Auth.isAdmin());
  }

  function openModal(setup) {
    authModal.classList.remove('hidden');
    setupBox.classList.toggle('hidden', !setup);
    loginBox.classList.toggle('hidden', setup);
  }
  function closeModal() { authModal.classList.add('hidden'); }

  setupBtn.addEventListener('click', async () => {
    const p1 = (newPass.value||'').trim(), p2 = (newPass2.value||'').trim();
    if(!p1||!p2) return alert('Both fields required');
    if(p1!==p2) return alert('Passwords do not match');
    await Auth.setup(p1); newPass.value = newPass2.value = ''; closeModal(); setAdminUI(true);
  });
  loginDo.addEventListener('click', async () => {
    const ok = await Auth.login((loginPass.value||'').trim()); loginPass.value = '';
    if(!ok) return alert('Wrong password');
    closeModal(); setAdminUI(true);
  });
  loginBtn.addEventListener('click', () => openModal(false));
  logoutBtn.addEventListener('click', () => { Auth.logout(); setAdminUI(false); });

  function extToLang(name) {
    const ext = (name.split('.').pop()||'').toLowerCase();
    if(['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return 'image';
    if(['mp4','webm','mov'].includes(ext)) return 'video';
    if(['py'].includes(ext)) return 'python';
    if(['js','mjs','cjs'].includes(ext)) return 'javascript';
    if(['cs'].includes(ext)) return 'csharp';
    if(['html','htm','xhtml','xml'].includes(ext)) return 'html';
    return 'text';
  }

  function isHtmlLike(nameOrLang) {
    const n = (nameOrLang || '').toLowerCase();
    return n.endsWith('.html') || n.endsWith('.htm') || n.endsWith('.xhtml') || n.endsWith('.xml') || n === 'html' || n === 'xml';
  }
  function isCSharp(nameOrLang) {
    const n = (nameOrLang || '').toLowerCase();
    return n.endsWith('.cs') || n === 'csharp' || n === 'cs';
  }

  function renderTree() {
    const q = (search.value||'').toLowerCase();
    const byFolder = {};
    for(const f of folders) byFolder[f.id] = { ...f, children: [] };
    for(const file of files) { (byFolder[file.folderId] ||= byFolder['root']).children.push(file); }

    function renderFolder(id, depth=0) {
      const node = byFolder[id]; if(!node) return '';
      const childFiles = (node.children||[]).filter(x => x.name.toLowerCase().includes(q));
      const subFolders = folders.filter(f => f.parent===id && f.name.toLowerCase().includes(q));
      const indent = '&nbsp;'.repeat(depth*2);
      let html = `<div class="folder" data-fid="${node.id}"><span>${indent}📁 ${node.name}</span><span class="muted">${childFiles.length}</span></div>`;
      for(const sf of subFolders) html += renderFolder(sf.id, depth+1);
      for(const file of childFiles) html += `<div class="file" data-id="${file.id}">${indent} &nbsp;&nbsp;📄 ${file.name}</div>`;
      return html;
    }

    tree.innerHTML = renderFolder('root');

    tree.querySelectorAll('.folder').forEach(el => {
      el.addEventListener('click', () => {
        const fid = el.getAttribute('data-fid'); const f = folders.find(x => x.id===fid);
        crumbs.textContent = `Home ▸ ${f?.name||'Home'}`;
      });
    });
    tree.querySelectorAll('.file').forEach(el => el.addEventListener('click', () => selectFile(el.getAttribute('data-id')) ));
  }

  function selectFile(id) {
    const f = files.find(x => x.id === id); if(!f) return;
    currentFileId = f.id; fileTitle.textContent = f.name; fileName.value = f.name; editor.value = f.content || '';
    crumbs.textContent = `Home ▸ ${folders.find(x => x.id===f.folderId)?.name||'Home'} ▸ ${f.name}`;
    // enable/disable special buttons based on type
    const guess = f.lang || extToLang(f.name);
    renderBtn.disabled = !isHtmlLike(f.name || guess);
    runCsBtn.disabled = !isCSharp(f.name || guess);
    autoRunIfCode(f);
  }

  function isCodeLang(lang) { return lang === 'python' || lang === 'javascript'; }

  async function autoRunIfCode(file) {
    output.textContent = '';
    const lang = file.lang || extToLang(file.name);
    if(!isCodeLang(lang)) { output.textContent = '[no output: not a runnable code file]'; return; }
    if(lang === 'javascript') return Runner.runJS(file.content || '');
    if(lang === 'python') return Runner.runPy(file.content || '');
  }

  async function save() {
    if(!Auth.isAdmin()) return alert('Admin only');
    const name = (fileName.value||'').trim(); if(!name) return alert('Enter file name');
    const rec = currentFileId ? files.find(x => x.id === currentFileId) : { id: crypto.randomUUID(), folderId:'root' };
    rec.name = name; rec.lang = extToLang(name); rec.content = editor.value;
    await DB.put('files', rec); files = await DB.list('files'); renderTree(); selectFile(rec.id);
    status.textContent = 'Saved'; setTimeout(()=>status.textContent='',1200);
  }

  async function createFolder() {
    if(!Auth.isAdmin()) return alert('Admin only');
    const name = prompt('Folder name'); if(!name) return;
    const id = crypto.randomUUID(); await DB.put('folders',{ id, name, parent:'root' });
    folders = await DB.list('folders'); renderTree();
  }

  // Copy
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(editor.value); copyBtn.textContent = 'Copied'; setTimeout(()=>copyBtn.textContent='Copy',1000); } catch { alert('Clipboard blocked'); }
  });

  saveBtn.addEventListener('click', save);
  deleteBtn.addEventListener('click', async () => {
    if(!Auth.isAdmin()) return alert('Admin only');
    if(!currentFileId) return alert('No file selected');
    if(!confirm('Delete this file?')) return;
    await DB.del('files', currentFileId);
    files = await DB.list('files'); currentFileId = null; editor.value = ''; fileName.value = ''; output.textContent = ''; fileTitle.textContent = 'No file selected'; renderTree();
  });

  importFile.addEventListener('change', async (e) => {
    if(!Auth.isAdmin()) return alert('Admin only');
    const f = e.target.files[0]; if(!f) return;
    const id = crypto.randomUUID(); let rec;
    if(f.type.startsWith('text') || ['','application/json'].includes(f.type)) {
      const text = await f.text();
      rec = { id, name: f.name, lang: extToLang(f.name), content: text, folderId: 'root' };
    } else {
      const url = await fileToDataURL(f);
      rec = { id, name: f.name, lang: extToLang(f.name), content: url, folderId: 'root' };
    }
    await DB.put('files', rec); files = await DB.list('files'); renderTree(); selectFile(id);
    e.target.value = '';
  });

  exportAll.addEventListener('click', () => {
    const data = { folders, files };
    const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vault-export.json'; a.click();
  });

  importJsonBtn.addEventListener('click', async () => {
    if(!Auth.isAdmin()) return alert('Admin only');
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
    input.onchange = async ev => {
      const f = ev.target.files[0]; if(!f) return; const json = JSON.parse(await f.text());
      if(json.folders && json.files) {
        for(const fo of json.folders) await DB.put('folders', fo);
        for(const fi of json.files) await DB.put('files', fi);
        folders = await DB.list('folders'); files = await DB.list('files'); renderTree();
      } else alert('Invalid export file');
    };
    input.click();
  });

  async function fileToDataURL(file) { return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }); }

  search.addEventListener('input', renderTree);

  openRawBtn.addEventListener('click', () => {
    const f = files.find(x => x.id === currentFileId); if(!f) return;
    if(f.content?.startsWith('data:')) {
      const w = window.open(); if(w) w.document.write(f.content.startsWith('data:image')?`<img style="max-width:100%" src="${f.content}">`:`<video controls style="max-width:100%" src="${f.content}"></video>`);
    } else {
      const blob = new Blob([f.content||''], { type:'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f.name; a.click();
    }
  });

  // Render HTML/XML in a new tab
  renderBtn.addEventListener('click', () => {
    const name = (fileName.value||'').trim();
    const content = editor.value || '';
    if(!isHtmlLike(name)) return alert('Open a .html or .xml file first');
    const w = window.open('', '_blank');
    if(!w) return alert('Popup blocked');
    if(name.toLowerCase().endsWith('.xml') && !content.trim().startsWith('<')) {
      w.document.write(`<pre>${content.replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))}</pre>`);
    } else {
      w.document.open(); w.document.write(content); w.document.close();
    }
  });

  // Run C# (stub or WASM if available)
  runCsBtn.addEventListener('click', async () => {
    const name = (fileName.value||'').trim();
    const code = editor.value || '';
    if(!isCSharp(name)) return alert('Open a C# (.cs) file first');
    const w = window.open('', '_blank');
    if(!w) return alert('Popup blocked');
    w.document.write('<pre id="out" style="white-space:pre-wrap"></pre>');
    const post = (msg) => { try { w.document.getElementById('out').textContent += msg + '\n'; } catch(e){} };
    try {
      if(!window.Runner || !Runner.runCSharp) {
        post('C# runtime not installed. To enable, add .NET WASM runtime and update runner.js.');
        return;
      }
      const result = await Runner.runCSharp(code);
      post(result || '[no output]');
    } catch(e) {
      post(String(e));
    }
  });

  // wire create folder
  newFolderBtn.addEventListener('click', createFolder);

  renderTree();
  initAuth();
})();
