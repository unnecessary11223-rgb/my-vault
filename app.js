console.log('app.js loaded OK');
(async () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
  }

  let installPrompt = null; const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; installBtn.hidden = false; });
  installBtn?.addEventListener('click', async ()=>{ if(!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installBtn.hidden = true; installPrompt=null; });

  const tree = document.getElementById('tree');
  const search = document.getElementById('search');
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const status = document.getElementById('status');
  const fileTitle = document.getElementById('fileTitle');
  const crumbs = document.getElementById('crumbs');
  const langBadge = document.getElementById('langBadge');
  const copyBtn = document.getElementById('copyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const newFolderBtn = document.getElementById('newFolder');
  const newFileBtn = document.getElementById('newFile');
  const importFile = document.getElementById('importFile');
  const importJsonBtn = document.getElementById('importJson');
  const exportAll = document.getElementById('exportAll');
  const openRawBtn = document.getElementById('openRaw');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const roleTag = document.getElementById('roleTag');

  const authModal = document.getElementById('authModal');
  const authTitle = document.getElementById('authTitle');
  const authText = document.getElementById('authText');
  const setupBox = document.getElementById('setupBox');
  const loginBox = document.getElementById('loginBox');
  const setupBtn = document.getElementById('setupBtn');
  const loginDo = document.getElementById('loginDo');
  const newPass = document.getElementById('newPass');
  const newPass2 = document.getElementById('newPass2');
  const loginPass = document.getElementById('loginPass');

  let folders = await DB.list('folders');
  let files = await DB.list('files');
  if (folders.length===0){
    await DB.put('folders', { id:'root', name:'Home', parent:null });
    folders = await DB.list('folders');
  }
  let currentFileId = null;

  function setAdminUI(on){
    document.querySelectorAll('.adminOnly').forEach(el=> el.classList.toggle('hidden', !on));
    loginBtn.classList.toggle('hidden', on);
    logoutBtn.classList.toggle('hidden', !on);
    roleTag.textContent = on ? 'Admin mode' : 'Guest mode';
    editor.readOnly = !on;
  }

  async function initAuth(){
    if (await Auth.ensureSetup()){
      openModal(true);
    } else {
      setAdminUI(Auth.isAdmin());
    }
  }

  function openModal(setup){
    authModal.classList.remove('hidden');
    setupBox.classList.toggle('hidden', !setup);
    loginBox.classList.toggle('hidden', setup);
    authTitle.textContent = setup ? 'Admin setup' : 'Admin login';
    authText.textContent = setup ? 'Create the admin password for this device.' : 'Enter the admin password.';
  }
  function closeModal(){ authModal.classList.add('hidden'); }

  setupBtn.addEventListener('click', async ()=>{
    if(!newPass.value || newPass.value!==newPass2.value){ alert('Passwords do not match'); return; }
    await Auth.setup(newPass.value);
    newPass.value = newPass2.value = '';
    closeModal();
    setAdminUI(true);
  });
  loginDo.addEventListener('click', async ()=>{
    const ok = await Auth.login(loginPass.value);
    loginPass.value='';
    if(!ok){ alert('Wrong password'); return; }
    closeModal();
    setAdminUI(true);
  });
  loginBtn.addEventListener('click', ()=> openModal(false));
  logoutBtn.addEventListener('click', ()=>{ Auth.logout(); setAdminUI(false); });

  function extToLang(name){
    const ext = (name.split('.').pop()||'').toLowerCase();
    if(['py'].includes(ext)) return 'python';
    if(['js','mjs','cjs'].includes(ext)) return 'javascript';
    if(['txt','md'].includes(ext)) return 'text';
    if(['png','jpg','jpeg','gif','webp'].includes(ext)) return 'image';
    if(['mp4','webm'].includes(ext)) return 'video';
    return 'other';
  }

  function renderTree(){
    const q = (search.value||'').toLowerCase();
    const byFolder = {};
    for(const f of folders) byFolder[f.id] = { ...f, children: [] };
    for(const file of files){ (byFolder[file.folderId] ||= byFolder['root']).children.push(file); }
    function renderFolder(id, depth=0){
      const node = byFolder[id]; if(!node) return '';
      const childFiles = (node.children||[]).filter(x=> x.name.toLowerCase().includes(q));
      const subFolders = folders.filter(f=>f.parent===id && f.name.toLowerCase().includes(q));
      const indent = '&nbsp;'.repeat(depth*2);
      let html = `<div class="folder"><span>${indent}📁 ${node.name}</span><span class="muted">${childFiles.length}</span></div>`;
      for(const sf of subFolders){ html += renderFolder(sf.id, depth+1); }
      for(const file of childFiles){ html += `<div class="file" data-id="${file.id}">${indent} &nbsp;&nbsp;📄 ${file.name}<span class="muted">${file.lang||''}</span></div>`; }
      return html;
    }
    tree.innerHTML = renderFolder('root');
    tree.querySelectorAll('.file').forEach(el=> el.addEventListener('click',()=> selectFile(el.dataset.id)) );
  }

  function selectFile(id){
    const f = files.find(x=>x.id===id); if(!f) return;
    currentFileId = f.id;
    fileTitle.textContent = f.name;
    editor.value = f.content || '';
    crumbs.textContent = `Home ▸ ${folders.find(x=>x.id===f.folderId)?.name || 'Home'} ▸ ${f.name}`;
    langBadge.textContent = f.lang || extToLang(f.name); langBadge.classList.remove('hidden');
    renderPreview(f);
  }

  function renderPreview(file){
    preview.innerHTML = '';
    if(file.content?.startsWith('data:image')){
      const img = document.createElement('img'); img.src = file.content; img.style.maxWidth='100%'; preview.appendChild(img);
    } else if(file.content?.startsWith('data:video')){
      const v = document.createElement('video'); v.src=file.content; v.controls=true; v.style.maxWidth='100%'; preview.appendChild(v);
    } else {
      const pre=document.createElement('pre'); pre.textContent = file.content||editor.value; preview.appendChild(pre);
    }
  }

  async function save(){
    if(!Auth.isAdmin()) return alert('Admin only');
    const name = fileTitle.textContent==='No file selected' ? prompt('File name (e.g. notes.txt)') : fileTitle.textContent;
    if(!name) return;
    const rec = currentFileId ? files.find(x=>x.id===currentFileId) : { id: crypto.randomUUID(), folderId:'root' };
    rec.name = name; rec.lang = extToLang(name); rec.content = editor.value;
    await DB.put('files', rec);
    files = await DB.list('files');
    renderTree();
    selectFile(rec.id);
    status.textContent = 'Saved'; setTimeout(()=>status.textContent='',1200);
  }

  async function createFolder(){
    if(!Auth.isAdmin()) return alert('Admin only');
    const name = prompt('Folder name'); if(!name) return;
    const id = crypto.randomUUID();
    await DB.put('folders',{ id, name, parent:'root' });
    folders = await DB.list('folders');
    renderTree();
  }

  async function createFile(){
    if(!Auth.isAdmin()) return alert('Admin only');
    const name = prompt('File name (e.g. notes.txt)'); if(!name) return;
    const id = crypto.randomUUID();
    const lang = extToLang(name);
    await DB.put('files',{ id, name, lang, content:'', folderId:'root' });
    files = await DB.list('files');
    renderTree();
    selectFile(id);
  }

  copyBtn.addEventListener('click', async ()=>{
    try { await navigator.clipboard.writeText(editor.value); copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy',1000);} catch{ alert('Clipboard blocked'); }
  });

  saveBtn.addEventListener('click', save);
  deleteBtn.addEventListener('click', async ()=>{
    if(!Auth.isAdmin()) return alert('Admin only');
    if(!currentFileId) return;
    if(!confirm('Delete this file?')) return;
    await DB.del('files', currentFileId);
    files = await DB.list('files'); currentFileId=null; editor.value=''; preview.innerHTML=''; fileTitle.textContent='No file selected'; renderTree();
  });

  importFile.addEventListener('change', async (e)=>{
    if(!Auth.isAdmin()) return alert('Admin only');
    const f = e.target.files[0]; if(!f) return;
    const id = crypto.randomUUID();
    if(f.type.startsWith('text') || ['','application/json'].includes(f.type)){
      const text = await f.text();
      await DB.put('files',{ id, name:f.name, lang:extToLang(f.name), content:text, folderId:'root' });
    } else {
      const url = await fileToDataURL(f);
      await DB.put('files',{ id, name:f.name, lang:extToLang(f.name), content:url, folderId:'root' });
    }
    files = await DB.list('files'); renderTree(); selectFile(id);
    e.target.value='';
  });

  exportAll.addEventListener('click', ()=>{
    const data = { folders, files };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='vault-export.json'; a.click();
  });

  importJsonBtn.addEventListener('click', async ()=>{
    if(!Auth.isAdmin()) return alert('Admin only');
    const input = document.createElement('input'); input.type='file'; input.accept='application/json';
    input.onchange = async ev => {
      const f = ev.target.files[0]; if(!f) return; const json = JSON.parse(await f.text());
      if(json.folders && json.files){
        for(const fo of json.folders) await DB.put('folders', fo);
        for(const fi of json.files) await DB.put('files', fi);
        folders = await DB.list('folders'); files = await DB.list('files'); renderTree();
      } else alert('Invalid export file');
    };
    input.click();
  });

  async function fileToDataURL(file){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); }

  openRawBtn.addEventListener('click', ()=>{
    const f = files.find(x=>x.id===currentFileId); if(!f) return;
    if(f.content?.startsWith('data:')){
      const w=window.open();
      if(w) w.document.write(f.content.startsWith('data:image')?`<img style="max-width:100%" src="${f.content}">`:`<video controls style="max-width:100%" src="${f.content}"></video>`);
    } else {
      const blob=new Blob([f.content||''],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=f.name; a.click();
    }
  });

  search.addEventListener('input', renderTree);

  renderTree();
  initAuth();

})();
