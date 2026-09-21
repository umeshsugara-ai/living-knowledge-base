const DEBUG_PORT = 9222;
const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json();
const page = list.find((t) => t.type === "page" && t.url.includes("localhost:5173"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.onopen = r);
const probe = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    inputs: [...document.querySelectorAll("input,textarea")].map(e => ({tag: e.tagName, type: e.type, placeholder: e.placeholder, name: e.name})),
    buttons: [...document.querySelectorAll("button")].map(b => b.textContent.trim()),
    label: document.querySelector("label")?.textContent,
    forms: document.forms.length,
  })`,
  returnByValue: true,
});
console.log(probe.result?.result?.value);
ws.close(); process.exit(0);
