(() => {
  const KEY='admin-cred', ROLE='is-admin';

  async function hashPassword(password, salt){
    const enc=new TextEncoder();
    const key=await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, key, 256);
    return new Uint8Array(bits);
  }
  function randBytes(n){ const b=new Uint8Array(n); crypto.getRandomValues(b); return b; }
  function toB64(a){ return btoa(String.fromCharCode(...a)); }
  function fromB64(s){ return new Uint8Array(atob(s).split('').map(c=>c.charCodeAt(0))); }

  async function ensureSetup(){ return !localStorage.getItem(KEY); }
  async function setup(password){
    const salt=randBytes(16); const hash=await hashPassword(password, salt);
    localStorage.setItem(KEY, JSON.stringify({ salt: toB64(salt), hash: toB64(hash) }));
    sessionStorage.setItem(ROLE,'1');
  }
  async function login(password){
    const cred=JSON.parse(localStorage.getItem(KEY)||'null'); if(!cred) throw new Error('Not set yet');
    const got=toB64(await hashPassword(password, fromB64(cred.salt)));
    if(got===cred.hash){ sessionStorage.setItem(ROLE,'1'); return true; }
    return false;
  }
  function logout(){ sessionStorage.removeItem(ROLE); }
  function isAdmin(){ return sessionStorage.getItem(ROLE)==='1'; }

  window.Auth={ ensureSetup, setup, login, logout, isAdmin };
})();
