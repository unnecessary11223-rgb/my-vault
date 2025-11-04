(() => {
  const DB_NAME = 'vault-db';
  const DB_VERSION = 1;
  let db;
  function open(){
    return new Promise((res,rej)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('folders', { keyPath:'id' });
        d.createObjectStore('files', { keyPath:'id' });
      };
      req.onsuccess = () => { db = req.result; res(); };
      req.onerror = () => rej(req.error);
    });
  }
  async function tx(store, mode='readonly'){ if(!db) await open(); return db.transaction(store, mode).objectStore(store); }
  async function list(store){ const s=await tx(store); return new Promise(r=>{ const out=[]; s.openCursor().onsuccess=e=>{const c=e.target.result; if(c){out.push(c.value); c.continue();} else r(out)} }); }
  async function put(store, value){ const s=await tx(store,'readwrite'); return new Promise((r,rej)=>{ const req=s.put(value); req.onsuccess=()=>r(value); req.onerror=()=>rej(req.error) }); }
  async function del(store, id){ const s=await tx(store,'readwrite'); return new Promise((r,rej)=>{ const req=s.delete(id); req.onsuccess=()=>r(); req.onerror=()=>rej(req.error) }); }
  window.DB = { list, put, del };
})();
