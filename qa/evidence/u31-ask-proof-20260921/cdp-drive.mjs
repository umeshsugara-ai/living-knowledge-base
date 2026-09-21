const DEBUG_PORT = 9222;
const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json();
const page = list.find((t) => t.type === "page" && t.url.includes("localhost:5173"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.onopen = r);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// seed + reload
await send("Runtime.evaluate", { expression: `localStorage.setItem("lkbApiKey","lv_8528eaa26fad03b93299a6256f413b07203f829369065821"); "ok"` });
await send("Page.navigate", { url: "http://localhost:5173/ask" });
await sleep(4000);
const typed = await send("Runtime.evaluate", {
  expression: `(async () => {
    const el = document.querySelector('input[placeholder*="speakers"]');
    if (!el) return "NO-INPUT";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "What did speakers say about UK student visas?");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Ask");
    if (!btn) return "NO-BUTTON";
    btn.click();
    return "clicked";
  })()`,
  awaitPromise: true, returnByValue: true,
});
console.log("submit:", JSON.stringify(typed.result?.result?.value));
let body = "";
for (let i = 0; i < 45; i++) {
  await sleep(2000);
  const chk = await send("Runtime.evaluate", { expression: `document.querySelector("main")?.innerText || document.body.innerText`, returnByValue: true });
  body = chk.result?.result?.value || "";
  if (/answer/i.test(body) && /Compliance|UKVI|insufficient coverage|Sorry/i.test(body)) break;
}
const shot = await send("Page.captureScreenshot", { format: "png" });
const { writeFileSync } = await import("node:fs");
writeFileSync("D:/KnowledgeBase/qa/evidence/u31-ask-proof-20260921/ask-answer-cdp.png", Buffer.from(shot.result.data, "base64"));
const links = await send("Runtime.evaluate", {
  expression: `[...document.querySelectorAll("a")].map(a => (a.textContent.trim().slice(0,60)) + " => " + a.getAttribute("href")).join("\\n")`,
  returnByValue: true,
});
console.log("---MAIN TEXT---"); console.log(body.slice(0, 1500));
console.log("---LINKS---"); console.log(links.result?.result?.value);
ws.close(); process.exit(0);
