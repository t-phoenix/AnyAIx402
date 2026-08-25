/** Served at GET /setup — first-class config wizard (no secrets echoed). */
export const SETUP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AnyX — Connect APIs & Payments</title>
  <style>
    :root {
      --bg: #0b1020;
      --card: #141a2e;
      --ink: #e8edf7;
      --muted: #9aa8c7;
      --accent: #3ee0b2;
      --warn: #f5c14a;
      --bad: #ff6b8a;
      --line: #243056;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
      background: radial-gradient(1200px 600px at 10% -10%, #1a2a55 0%, var(--bg) 45%);
      color: var(--ink); min-height: 100vh;
    }
    header { padding: 32px 24px 8px; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; }
    .tag { color: var(--accent); font-weight: 600; }
    p.lead { color: var(--muted); max-width: 640px; line-height: 1.5; }
    main { max-width: 960px; margin: 0 auto; padding: 16px 24px 80px; }
    .caps { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0 28px; }
    .pill {
      background: var(--card); border: 1px solid var(--line); border-radius: 999px;
      padding: 8px 14px; font-size: 13px;
    }
    .pill.on { border-color: var(--accent); color: var(--accent); }
    .pill.off { color: var(--warn); }
    .grid { display: grid; gap: 16px; }
    section {
      background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px;
    }
    section h2 { margin: 0 0 4px; font-size: 18px; }
    section .blurb { color: var(--muted); font-size: 14px; margin: 0 0 12px; }
    .field {
      display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start;
      padding: 10px 0; border-top: 1px solid var(--line);
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; }
    .dot.yes { background: var(--accent); }
    .dot.no { background: var(--bad); }
    .label { font-weight: 600; }
    .env { font-family: ui-monospace, monospace; font-size: 12px; color: var(--accent); }
    .hint { color: var(--muted); font-size: 13px; margin: 4px 0 0; }
    ol { color: var(--muted); line-height: 1.6; }
    a { color: var(--accent); }
    footer { color: var(--muted); font-size: 13px; margin-top: 24px; }
  </style>
</head>
<body>
  <header>
    <div class="tag">AnyX · AnyAIx402</div>
    <h1>Connecting APIs &amp; Payments</h1>
    <p class="lead">
      Fill in only what you need. Quotes work with demo rates until you add a 1inch or 0x key.
      Payments stay simulated until you add a dedicated USDC wallet key.
      This page never shows secret values — only whether they are present.
    </p>
  </header>
  <main>
    <div class="caps" id="caps"></div>
    <div class="grid" id="groups"></div>
    <section>
      <h2>How to add a key</h2>
      <ol>
        <li>Copy <code>.env.example</code> to <code>.env.local</code> in the project folder.</li>
        <li>Paste each value next to its name. Do not put quotes around the 0x private key.</li>
        <li>Or copy <code>config/user.config.example.yaml</code> to <code>config/user.config.yaml</code> and fill the blanks.</li>
        <li>Restart the API (<code>npm run dev:api</code>) and refresh this page.</li>
        <li>Confirm with <code>npm run check-config</code> — it prints missing items in plain language.</li>
      </ol>
      <p class="hint">DEX keys: <a href="https://portal.1inch.dev/" target="_blank" rel="noreferrer">1inch portal</a> · <a href="https://dashboard.0x.org/" target="_blank" rel="noreferrer">0x dashboard</a>. Facilitator default is Coinbase CDP x402. Circle Iris is only for later cross-chain USDC.</p>
    </section>
    <footer>Never commit <code>.env.local</code> or a filled <code>user.config.yaml</code>.</footer>
  </main>
  <script>
    const capLabel = {
      quote_live: "Live DEX quotes",
      quote_stub: "Demo quotes",
      pay_live: "Live USDC pay",
      pay_stub: "Simulated pay",
      mas_llm: "Agent LLM",
      persist: "Postgres",
    };
    fetch("/v1/config/status").then(r => r.json()).then((data) => {
      const caps = document.getElementById("caps");
      for (const [key, label] of Object.entries(capLabel)) {
        const on = data.capabilities[key];
        const el = document.createElement("div");
        el.className = "pill " + (on ? "on" : "off");
        el.textContent = (on ? "Ready · " : "Not yet · ") + label;
        caps.appendChild(el);
      }
      const root = document.getElementById("groups");
      for (const group of data.groups) {
        const sec = document.createElement("section");
        sec.innerHTML = "<h2>" + group.title + "</h2><p class='blurb'>" + group.blurb + "</p>";
        for (const field of group.fields) {
          const row = document.createElement("div");
          row.className = "field";
          row.innerHTML = "<div class='dot " + (field.present ? "yes" : "no") + "'></div>" +
            "<div><div class='label'>" + field.label + " <span class='env'>" + field.env + "</span></div>" +
            "<p class='hint'>" + field.hint + "</p></div>";
          sec.appendChild(row);
        }
        root.appendChild(sec);
      }
    }).catch((err) => {
      document.getElementById("groups").textContent = "Could not load config status: " + err;
    });
  </script>
</body>
</html>
`;
