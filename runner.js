// runner.js - JS and Python runners + C# stub
(() => {
  const outEl = () => document.getElementById('output');
  function write(msg){ const el = outEl(); if(!el) return; el.textContent = (el.textContent ? el.textContent + '\n' : '') + msg; }
  function clear(){ const el = outEl(); if(el) el.textContent = ''; }

  // JS runner: sandboxed iframe (captures console.log)
  async function runJS(code){
    clear();
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const logs = [];
    win.console.log = (...a) => logs.push(a.join(' '));
    try { win.eval(code); } catch(e) { logs.push(String(e)); }
    write(logs.join('\n') || '[no output]');
    iframe.remove();
  }

  // Python runner via Pyodide (first load from CDN, then cached by SW)
  let pyReady = null;
  async function ensurePy(){
    if(pyReady) return pyReady;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
    document.head.appendChild(s);
    pyReady = new Promise(res => { s.onload = async () => res(await loadPyodide()); });
    return pyReady;
  }
  async function runPy(code){
    clear();
    const py = await ensurePy();
    try { const r = await py.runPythonAsync(code); if(r !== undefined) write(String(r)); else write('[no output]'); }
    catch(e) { write(String(e)); }
  }

  // C# stub - replace with actual WASM runtime initialization if you add .NET WASM files
  async function runCSharpStub(code){
    return 'C# runtime not installed. To enable, add .NET WASM runtime and implement Runner.runCSharp in runner.js.';
  }

  window.Runner = { runJS, runPy, runCSharp: runCSharpStub };
})();