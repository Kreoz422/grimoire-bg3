/* ====== Grimoire de Builds — BG3 ====== */

const STORAGE_KEY = "bg3-builds-v1";
const PROFILE_KEY = "bg3-profile-v1";

const CLASSES = ["Barbare","Barde","Clerc","Druide","Ensorceleur","Guerrier","Magicien","Moine","Occultiste","Paladin","Rôdeur","Roublard"];
const STATS = [["str","FOR"],["dex","DEX"],["con","CON"],["int","INT"],["wis","SAG"],["cha","CHA"]];
const ACTS = ["Acte 1","Acte 2","Acte 3","Tout le jeu"];
const SLOTS = ["Casque","Cape","Armure/Vêtement","Gants","Bottes","Amulette","Anneau 1","Anneau 2","Arme","Arme à distance","Autre"];
const MILESTONES = new Set([4,8,12]);

/* ---------- storage helpers ---------- */
function loadBuilds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveBuilds(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
function loadAuthor() {
  try { return localStorage.getItem(PROFILE_KEY) || ""; } catch (e) { return ""; }
}
function saveAuthor(name) {
  localStorage.setItem(PROFILE_KEY, name);
}

/* ---------- model ---------- */
function uid() { return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function emptyLevels() {
  return Array.from({length:12}, (_,i) => ({ l:i+1, c:"", s:"", f:"", af:"", no:"" }));
}

function newBuild() {
  return {
    id: uid(), n: "Nouveau build", mc: "", r: "", rw: "",
    tg: [],
    st: { str:8, dex:8, con:8, int:8, wis:8, cha:8 }, sn: "",
    sk: "",
    lv: emptyLevels(),
    ge: [],
    cs: "",
    pf: [], pw: [],
    pl: "",
    src: "", sa: "",
    a: state.author || "Aventurier·ère",
    c: Date.now(), u: Date.now(), sc: null
  };
}

/* ---------- state ---------- */
const state = {
  view: "list",
  builds: loadBuilds(),
  author: loadAuthor(),
  draft: null,
  query: "",
  pendingImport: null,
};

/* ---------- utils ---------- */
function esc(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.style.display = "none"; }, 2400);
}
function svgIcon(name) {
  const icons = {
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    back: '<polyline points="15 18 9 12 15 6"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
  };
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]||""}</svg>`;
}

/* ---------- URL-safe compact encode/decode ---------- */
function compactBuild(b) {
  // already compact keys; just clone and strip runtime fields
  const c = JSON.parse(JSON.stringify(b));
  delete c.sc;
  return c;
}
function encodeBuildToLink(build) {
  const json = JSON.stringify(compactBuild(build));
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
  const url = new URL(location.href);
  url.hash = "b=" + b64;
  return url.toString();
}
function decodeBuildFromHash(hash) {
  const m = /b=([^&]+)/.exec(hash || "");
  if (!m) return null;
  let b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch (e) { return null; }
}

/* ---------- persistence actions ---------- */
function persist(build) {
  state.builds[build.id] = { ...build, u: Date.now() };
  saveBuilds(state.builds);
}
function removeBuild(id) {
  delete state.builds[id];
  saveBuilds(state.builds);
}

/* ---------- render: list ---------- */
function renderList() {
  const wrap = document.getElementById("build-list");
  const q = state.query.trim().toLowerCase();
  let items = Object.values(state.builds).sort((a,b) => (b.u||0) - (a.u||0));
  if (q) {
    items = items.filter(b => [b.n,b.mc,b.r,...(b.tg||[])].join(" ").toLowerCase().includes(q));
  }
  if (items.length === 0) {
    wrap.innerHTML = `<div class="empty-state">
      <h3>${Object.keys(state.builds).length === 0 ? "Aucun build pour l'instant" : "Aucun résultat"}</h3>
      <p>${Object.keys(state.builds).length === 0 ? "Crée ton premier build, ou reçois-en un via un lien partagé par ton pote." : "Essaie un autre mot-clé."}</p>
    </div>`;
    return;
  }
  wrap.innerHTML = items.map(b => `
    <div class="build-card" data-id="${b.id}">
      <h3>${esc(b.n)}</h3>
      <div class="meta">
        ${b.mc ? `<span class="pill bronze">${esc(b.mc)}</span>` : ""}
        ${b.r ? `<span class="pill">${esc(b.r)}</span>` : ""}
        ${(b.tg||[]).map(t => `<span class="pill">${esc(t)}</span>`).join("")}
      </div>
      <div class="card-actions">
        <button class="mini-btn" data-act="open" data-id="${b.id}">${svgIcon("edit")} Ouvrir</button>
        <button class="mini-btn" data-act="dup" data-id="${b.id}">${svgIcon("copy")} Dupliquer</button>
        <button class="mini-btn" data-act="share" data-id="${b.id}">${svgIcon("share")} Partager</button>
        <button class="mini-btn danger" data-act="del" data-id="${b.id}">${svgIcon("trash")} Suppr.</button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-act]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "open") openEditor(state.builds[id]);
      if (act === "dup") duplicateBuild(id);
      if (act === "share") shareBuildFlow(state.builds[id]);
      if (act === "del") { if (confirm("Supprimer ce build ?")) { removeBuild(id); renderList(); } }
    });
  });
  wrap.querySelectorAll(".build-card").forEach(card => {
    card.addEventListener("click", () => openEditor(state.builds[card.dataset.id]));
  });
}

function duplicateBuild(id) {
  const src = state.builds[id];
  const copy = { ...JSON.parse(JSON.stringify(src)), id: uid(), n: src.n + " (copie)", c: Date.now(), u: Date.now(), sc: null };
  persist(copy);
  renderList();
  toast("Build dupliqué");
}

/* ---------- share flow ---------- */
function shareBuildFlow(build) {
  const link = encodeBuildToLink(build);
  showShareModal(build, link);
}
function showShareModal(build, link) {
  const overlay = document.getElementById("import-modal");
  document.querySelector(".modal-title").textContent = "Lien de partage";
  document.getElementById("import-preview").innerHTML = `
    <p class="preview-line">Envoie ce lien à ton pote par MP (WhatsApp, Discord, SMS…). Il n'a qu'à l'ouvrir dans son navigateur pour recevoir une proposition d'import.</p>
    <div class="share-box"><div class="link-preview" id="share-link-text">${esc(link)}</div>
      <button class="btn primary" id="copy-link-btn">${svgIcon("copy")} Copier le lien</button>
    </div>`;
  document.getElementById("btn-import-accept").style.display = "none";
  document.getElementById("btn-import-reject").textContent = "Fermer";
  overlay.style.display = "flex";
  document.getElementById("copy-link-btn").addEventListener("click", () => {
    navigator.clipboard?.writeText(link).then(() => toast("Lien copié !"));
  });
  document.getElementById("btn-import-reject").onclick = () => {
    overlay.style.display = "none";
    document.getElementById("btn-import-accept").style.display = "flex";
    document.getElementById("btn-import-reject").textContent = "Ignorer";
  };
}

/* ---------- editor ---------- */
function openEditor(build) {
  state.draft = JSON.parse(JSON.stringify(build));
  state.view = "editor";
  switchTab("editor");
  renderEditor();
}
function createBuild() {
  state.draft = newBuild();
  state.view = "editor";
  switchTab("editor");
  renderEditor();
}

function renderEditor() {
  const d = state.draft;
  const view = document.getElementById("view-editor");
  view.innerHTML = `
    <div class="editor-header">
      <button class="back-btn" id="editor-back">${svgIcon("back")}</button>
      <input class="name-input" id="f-name" value="${esc(d.n)}" placeholder="Nom du build" />
    </div>

    <div class="grid-2">
      <div>
        <span class="field-label">Classe principale</span>
        <select class="text-input" id="f-mc">
          <option value="">—</option>
          ${CLASSES.map(c => `<option value="${c}" ${d.mc===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>
      <div>
        <span class="field-label">Race</span>
        <input class="text-input" id="f-race" value="${esc(d.r)}" placeholder="ex. Tieffelin" />
      </div>
    </div>
    <div class="field-block">
      <span class="field-label">Pourquoi cette race (bonus utile, dialogues…)</span>
      <textarea class="text-area" id="f-racewhy" placeholder="ex. peu importe pour ce build à part les dialogues">${esc(d.rw)}</textarea>
    </div>
    <div class="field-block">
      <span class="field-label">Tags (séparés par virgule)</span>
      <input class="text-input" id="f-tags" value="${esc((d.tg||[]).join(", "))}" placeholder="ex. corps à corps, honor mode, solo" />
    </div>

    <div class="section-title">Caractéristiques</div>
    <div class="stats-grid">
      ${STATS.map(([k,label]) => `
        <div class="stat-box">
          <label>${label}</label>
          <input type="number" data-stat="${k}" value="${d.st[k]}" />
        </div>`).join("")}
    </div>
    <div class="field-block">
      <span class="field-label">Notes sur la répartition (ce qu'on dump, comment on compense)</span>
      <textarea class="text-area" id="f-statnotes" placeholder="ex. on laisse tomber la force, compensée par les élixirs de force de géant">${esc(d.sn)}</textarea>
    </div>

    <div class="field-block">
      <span class="field-label">Compétences / maîtrises</span>
      <input class="text-input" id="f-skills" value="${esc(d.sk)}" placeholder="ex. Acrobatie, Discrétion" />
    </div>

    <div class="section-title">Progression niveau par niveau</div>
    <div class="ladder" id="ladder"></div>

    <div class="section-title">Équipement par acte</div>
    <p class="section-sub">Une ligne par objet — acte, emplacement, effet, et une alternative si tu en as une.</p>
    <div id="gear-list" class="list-editor"></div>
    <button class="add-row-btn" id="add-gear">${svgIcon("plus")} Ajouter un objet</button>

    <div class="field-block" style="margin-top:18px;">
      <span class="field-label">Stratégie consommables (élixirs, potions, larves…)</span>
      <textarea class="text-area" id="f-consumables" placeholder="ex. acheter les élixirs de force chez Tati dès l'acte 1, faire le plein avant l'acte 2">${esc(d.cs)}</textarea>
    </div>

    <div class="section-title">Bilan</div>
    <div class="grid-2">
      <div>
        <span class="field-label">Points forts</span>
        <div id="pf-list" class="list-editor"></div>
        <button class="add-row-btn" id="add-pf">${svgIcon("plus")} Ajouter</button>
      </div>
      <div>
        <span class="field-label">Points faibles</span>
        <div id="pw-list" class="list-editor"></div>
        <button class="add-row-btn" id="add-pw">${svgIcon("plus")} Ajouter</button>
      </div>
    </div>

    <div class="field-block" style="margin-top:18px;">
      <span class="field-label">Style de jeu / rotation en combat</span>
      <textarea class="text-area" id="f-playstyle" placeholder="ordre des actions en combat, priorités, synergies avec le groupe…">${esc(d.pl)}</textarea>
    </div>

    <div class="section-title">Source</div>
    <div class="grid-2">
      <div>
        <span class="field-label">Créateur / créatrice du guide</span>
        <input class="text-input" id="f-srcauthor" value="${esc(d.sa)}" placeholder="ex. nom de la chaîne" />
      </div>
      <div>
        <span class="field-label">Lien (vidéo, site…)</span>
        <input class="text-input" id="f-srclink" value="${esc(d.src)}" placeholder="https://…" />
      </div>
    </div>

    ${d.sc ? `<div class="share-box"><div class="field-label">Code lié à ce build</div><div class="link-preview">${esc(d.sc)}</div></div>` : ""}

    <div class="actions-bar">
      <button class="btn ghost" id="editor-cancel">Annuler</button>
      <button class="btn" id="editor-share">${svgIcon("share")} Partager</button>
      <button class="btn primary" id="editor-save">${svgIcon("check")} Sauvegarder</button>
    </div>
  `;

  renderLadder();
  renderGearList();
  renderStringList("pf-list", d.pf, "pf");
  renderStringList("pw-list", d.pw, "pw");
  bindEditorEvents();
}

function renderLadder() {
  const d = state.draft;
  const wrap = document.getElementById("ladder");
  wrap.innerHTML = d.lv.map((lvl, idx) => `
    <div class="lvl-row">
      <div class="lvl-badge ${MILESTONES.has(lvl.l)?"milestone":""}">${lvl.l}</div>
      <div class="lvl-card">
        <div class="lvl-grid">
          <div>
            <span class="field-label">Classe prise</span>
            <select class="text-input" data-lvl="${idx}" data-f="c">
              <option value="">—</option>
              ${CLASSES.map(c => `<option value="${c}" ${lvl.c===c?"selected":""}>${c}</option>`).join("")}
            </select>
          </div>
          <div>
            <span class="field-label">Sous-classe</span>
            <input class="text-input" data-lvl="${idx}" data-f="s" value="${esc(lvl.s)}" placeholder="si choisie ici" />
          </div>
        </div>
        <span class="field-label">Capacité / sort marquant</span>
        <textarea class="text-area" data-lvl="${idx}" data-f="f" placeholder="ex. Action Surge, Extra Attack…">${esc(lvl.f)}</textarea>
        ${MILESTONES.has(lvl.l) ? `
          <span class="field-label" style="margin-top:8px;">Don ou +2 caractéristiques</span>
          <input class="text-input" data-lvl="${idx}" data-f="af" value="${esc(lvl.af)}" placeholder="ex. Bagarreur des tavernes" />
        ` : ""}
        <span class="field-label" style="margin-top:8px;">Notes</span>
        <textarea class="text-area" data-lvl="${idx}" data-f="no" placeholder="équipement, sorts, à quel niveau multiclasser…">${esc(lvl.no)}</textarea>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-lvl]").forEach(el => {
    el.addEventListener("input", () => {
      const idx = Number(el.dataset.lvl);
      const f = el.dataset.f;
      d.lv[idx][f] = el.value;
    });
  });
}

function renderGearList() {
  const d = state.draft;
  const wrap = document.getElementById("gear-list");
  if (d.ge.length === 0) {
    wrap.innerHTML = `<p class="hint">Aucun objet ajouté pour l'instant.</p>`;
    return;
  }
  wrap.innerHTML = d.ge.map((g, idx) => `
    <div class="gear-item" data-idx="${idx}">
      <div class="gear-top">
        <div>
          <span class="field-label">Acte</span>
          <select class="text-input" data-gear="${idx}" data-f="act">
            ${ACTS.map(a => `<option value="${a}" ${g.act===a?"selected":""}>${a}</option>`).join("")}
          </select>
        </div>
        <div>
          <span class="field-label">Emplacement</span>
          <select class="text-input" data-gear="${idx}" data-f="slot">
            ${SLOTS.map(s => `<option value="${s}" ${g.slot===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
      <span class="field-label">Objet</span>
      <input class="text-input" data-gear="${idx}" data-f="item" value="${esc(g.item)}" placeholder="ex. Gants de capture d'âme" />
      <span class="field-label" style="margin-top:8px;">Effet</span>
      <textarea class="text-area" data-gear="${idx}" data-f="effect" placeholder="ce que ça apporte au build">${esc(g.effect)}</textarea>
      <span class="field-label" style="margin-top:8px;">Alternative (optionnel)</span>
      <input class="text-input" data-gear="${idx}" data-f="alt" value="${esc(g.alt)}" placeholder="autre objet possible à ce slot" />
      <div class="gear-remove"><button class="row-remove-btn" data-remove-gear="${idx}">${svgIcon("trash")}</button></div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-gear]").forEach(el => {
    el.addEventListener("input", () => {
      const idx = Number(el.dataset.gear);
      d.ge[idx][el.dataset.f] = el.value;
    });
  });
  wrap.querySelectorAll("[data-remove-gear]").forEach(btn => {
    btn.addEventListener("click", () => {
      d.ge.splice(Number(btn.dataset.removeGear), 1);
      renderGearList();
    });
  });
}

function renderStringList(containerId, arr, kind) {
  const wrap = document.getElementById(containerId);
  if (arr.length === 0) {
    wrap.innerHTML = `<p class="hint" style="margin:0 0 8px 0;">Rien pour l'instant.</p>`;
  } else {
    wrap.innerHTML = arr.map((val, idx) => `
      <div class="list-row">
        <input class="text-input" data-list="${kind}" data-idx="${idx}" value="${esc(val)}" placeholder="ex. Excellent en mobilité" />
        <button class="row-remove-btn" data-list-remove="${kind}" data-idx="${idx}">${svgIcon("trash")}</button>
      </div>
    `).join("");
  }
  wrap.querySelectorAll(`[data-list="${kind}"]`).forEach(el => {
    el.addEventListener("input", () => {
      state.draft[kind][Number(el.dataset.idx)] = el.value;
    });
  });
  wrap.querySelectorAll(`[data-list-remove="${kind}"]`).forEach(btn => {
    btn.addEventListener("click", () => {
      state.draft[kind].splice(Number(btn.dataset.idx), 1);
      renderStringList(containerId, state.draft[kind], kind);
    });
  });
}

function bindEditorEvents() {
  const d = state.draft;
  document.getElementById("editor-back").addEventListener("click", () => { switchTab("list"); renderList(); });
  document.getElementById("editor-cancel").addEventListener("click", () => { switchTab("list"); renderList(); });
  document.getElementById("f-name").addEventListener("input", (e) => d.n = e.target.value);
  document.getElementById("f-mc").addEventListener("change", (e) => d.mc = e.target.value);
  document.getElementById("f-race").addEventListener("input", (e) => d.r = e.target.value);
  document.getElementById("f-racewhy").addEventListener("input", (e) => d.rw = e.target.value);
  document.getElementById("f-tags").addEventListener("input", (e) => d.tg = e.target.value.split(",").map(t=>t.trim()).filter(Boolean));
  document.getElementById("f-statnotes").addEventListener("input", (e) => d.sn = e.target.value);
  document.getElementById("f-skills").addEventListener("input", (e) => d.sk = e.target.value);
  document.getElementById("f-consumables").addEventListener("input", (e) => d.cs = e.target.value);
  document.getElementById("f-playstyle").addEventListener("input", (e) => d.pl = e.target.value);
  document.getElementById("f-srcauthor").addEventListener("input", (e) => d.sa = e.target.value);
  document.getElementById("f-srclink").addEventListener("input", (e) => d.src = e.target.value);

  document.querySelectorAll("[data-stat]").forEach(inp => {
    inp.addEventListener("input", () => {
      const v = Math.max(1, Math.min(30, Number(inp.value) || 0));
      d.st[inp.dataset.stat] = v;
    });
  });

  document.getElementById("add-gear").addEventListener("click", () => {
    d.ge.push({ act: ACTS[0], slot: SLOTS[0], item: "", effect: "", alt: "" });
    renderGearList();
  });
  document.getElementById("add-pf").addEventListener("click", () => { d.pf.push(""); renderStringList("pf-list", d.pf, "pf"); });
  document.getElementById("add-pw").addEventListener("click", () => { d.pw.push(""); renderStringList("pw-list", d.pw, "pw"); });

  document.getElementById("editor-save").addEventListener("click", () => {
    persist(d);
    toast("Build sauvegardé");
    switchTab("list");
    renderList();
  });
  document.getElementById("editor-share").addEventListener("click", () => {
    persist(d);
    shareBuildFlow(d);
  });
}

/* ---------- import (from URL hash) ---------- */
function checkHashForImport() {
  if (!location.hash) return;
  const incoming = decodeBuildFromHash(location.hash);
  if (!incoming || !incoming.n) return;
  state.pendingImport = incoming;
  showImportModal(incoming);
}

function showImportModal(build) {
  const overlay = document.getElementById("import-modal");
  document.querySelector(".modal-title").textContent = "Build reçu";
  document.getElementById("import-preview").innerHTML = `
    <p class="preview-line"><b>${esc(build.n)}</b></p>
    <p class="preview-line">${build.mc ? esc(build.mc) : "Classe non précisée"}${build.r ? " · " + esc(build.r) : ""}</p>
    <p class="preview-line">Par ${esc(build.a || "quelqu'un")}</p>
    ${build.sa ? `<p class="preview-line">Guide original : ${esc(build.sa)}</p>` : ""}
  `;
  document.getElementById("btn-import-accept").style.display = "flex";
  document.getElementById("btn-import-reject").textContent = "Ignorer";
  overlay.style.display = "flex";

  document.getElementById("btn-import-accept").onclick = () => {
    const copy = { ...JSON.parse(JSON.stringify(build)), id: uid(), c: Date.now(), u: Date.now(), sc: null };
    persist(copy);
    overlay.style.display = "none";
    history.replaceState(null, "", location.pathname + location.search);
    switchTab("list");
    renderList();
    toast("Build ajouté à ta bibliothèque");
  };
  document.getElementById("btn-import-reject").onclick = () => {
    overlay.style.display = "none";
    history.replaceState(null, "", location.pathname + location.search);
  };
}

/* ---------- import from pasted link / file ---------- */
function importFromPastedLink(text) {
  const errEl = document.getElementById("import-error");
  errEl.style.display = "none";
  let hash = "";
  try {
    const url = new URL(text.trim());
    hash = url.hash;
  } catch (e) {
    hash = text.includes("b=") ? text.slice(text.indexOf("b=") - 1) : "";
  }
  const build = decodeBuildFromHash(hash);
  if (!build || !build.n) {
    errEl.textContent = "Ce lien ne semble pas contenir de build valide.";
    errEl.style.display = "flex";
    return;
  }
  showImportModal(build);
}

function exportAllToFile() {
  const data = JSON.stringify({ builds: state.builds, exportedAt: Date.now() }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "grimoire-builds-bg3.json";
  a.click();
  toast("Fichier exporté");
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const incoming = parsed.builds || {};
      let count = 0;
      Object.values(incoming).forEach(b => {
        if (!b || !b.id) return;
        state.builds[b.id] = b;
        count++;
      });
      saveBuilds(state.builds);
      renderList();
      toast(`${count} build(s) importé(s)`);
    } catch (e) {
      toast("Fichier invalide");
    }
  };
  reader.readAsText(file);
}

/* ---------- tabs / views ---------- */
function switchTab(tab) {
  state.view = tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab || (tab==="editor" && b.dataset.tab==="list")));
  document.getElementById("view-list").style.display = tab === "list" ? "block" : "none";
  document.getElementById("view-editor").style.display = tab === "editor" ? "block" : "none";
  document.getElementById("view-import").style.display = tab === "import" ? "block" : "none";
  window.scrollTo(0,0);
}

/* ---------- init ---------- */
function init() {
  document.getElementById("author-input").value = state.author;
  document.getElementById("author-input").addEventListener("input", (e) => {
    state.author = e.target.value;
    saveAuthor(e.target.value);
  });

  document.querySelectorAll(".tab-btn").forEach(b => {
    b.addEventListener("click", () => { switchTab(b.dataset.tab); if (b.dataset.tab==="list") renderList(); });
  });

  document.getElementById("btn-new-build").addEventListener("click", createBuild);
  document.getElementById("search-input").addEventListener("input", (e) => { state.query = e.target.value; renderList(); });

  document.getElementById("btn-export-all").addEventListener("click", exportAllToFile);
  document.getElementById("btn-export-file").addEventListener("click", exportAllToFile);
  document.getElementById("btn-import-file").addEventListener("click", () => document.getElementById("file-input").click());
  document.getElementById("file-input").addEventListener("change", (e) => {
    if (e.target.files[0]) importFromFile(e.target.files[0]);
  });
  document.getElementById("btn-import-link").addEventListener("click", () => {
    importFromPastedLink(document.getElementById("import-link-input").value);
  });

  renderList();
  checkHashForImport();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
