const API = "https://api.rule34.xxx/index.php";
const AUTO = "https://api.rule34.xxx/autocomplete.php";
const STORE = "r34search.v1";

const $ = (id) => document.getElementById(id);
const state = {
  page: 0,
  lastCount: 0,
  posts: [],
  query: "",
};

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "{}");
    if (s.blacklist === undefined) s.blacklist = "loli shota young child";
    return s;
  } catch {
    return { blacklist: "loli shota young child" };
  }
}
function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial };
  localStorage.setItem(STORE, JSON.stringify(next));
  return next;
}

function parseCreds(rawUser, rawKey) {
  const blob = `${rawUser || ""} ${rawKey || ""}`;
  const key = (blob.match(/api_key=([^&\s]+)/i) || [])[1] || (rawKey || "").trim();
  const uid = (blob.match(/user_id=([^&\s]+)/i) || [])[1] || (rawUser || "").trim();
  return { userId: uid, apiKey: key };
}

function hasCreds() {
  const s = loadSettings();
  return !!(s.userId && s.apiKey);
}

function buildTags() {
  const s = loadSettings();
  const parts = [];
  const typed = $("q").value.trim();
  if (typed) parts.push(typed);
  const rating = $("rating").value;
  if (rating) parts.push("rating:" + rating);
  const sort = $("sort").value;
  if (sort) parts.push(sort);
  if ($("no-ai").checked) parts.push("-ai_generated -ai -stable_diffusion");
  if (s.blacklist) {
    s.blacklist.split(/\s+/).filter(Boolean).forEach((t) => {
      parts.push(t.startsWith("-") ? t : "-" + t);
    });
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function search(page = 0) {
  if (!hasCreds()) {
    $("need-key").classList.remove("hidden");
    $("results").innerHTML = "";
    $("pager").classList.add("hidden");
    $("status").textContent = "No API key";
    return;
  }
  $("need-key").classList.add("hidden");
  const s = loadSettings();
  const tags = buildTags();
  const limit = Number($("limit").value) || 42;
  state.page = page;
  state.query = tags;
  $("status").textContent = "Loading…";
  $("results").innerHTML = `<div class="empty">Searching <code>${escapeHtml(tags || "(everything)")}</code></div>`;

  const url = new URL(API);
  url.searchParams.set("page", "dapi");
  url.searchParams.set("s", "post");
  url.searchParams.set("q", "index");
  url.searchParams.set("json", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("pid", String(page));
  url.searchParams.set("tags", tags);
  url.searchParams.set("user_id", s.userId);
  url.searchParams.set("api_key", s.apiKey);

  try {
    const res = await fetch(url.toString());
    const text = await res.text();
    if (/missing authentication/i.test(text)) {
      throw new Error("Rule34 rejected the credentials. Generate a new key on your account options page.");
    }
    let data;
    try { data = JSON.parse(text); }
    catch {
      throw new Error(text.slice(0, 180) || "Unexpected API response");
    }
    if (!Array.isArray(data)) {
      throw new Error((data && (data.message || data.error)) || "No results payload");
    }
    state.posts = data;
    state.lastCount = data.length;
    renderResults(data);
    $("status").textContent = data.length ? `${data.length} posts · page ${page + 1}` : "No posts";
    $("page-label").textContent = "Page " + (page + 1);
    $("pager").classList.toggle("hidden", page === 0 && data.length === 0);
    $("prev").disabled = page === 0;
    $("next").disabled = data.length < limit;
    history.replaceState(null, "", "#q=" + encodeURIComponent($("q").value) + "&p=" + page);
  } catch (err) {
    $("results").innerHTML = `<div class="error">${escapeHtml(err.message || String(err))}</div>`;
    $("status").textContent = "Error";
    $("pager").classList.add("hidden");
  }
}

function isVideo(post) {
  const u = (post.file_url || post.image || "").toLowerCase();
  return /\.(mp4|webm|mov)(\?|$)/.test(u);
}

function renderResults(posts) {
  if (!posts.length) {
    $("results").innerHTML = `<div class="empty">No posts matched that search.</div>`;
    return;
  }
  const grid = document.createElement("div");
  grid.className = "grid";
  posts.forEach((post) => {
    const el = document.createElement("article");
    el.className = "card";
    el.tabIndex = 0;
    const src = post.preview_url || post.sample_url || post.file_url;
    const media = isVideo(post)
      ? `<span class="badge">VIDEO</span><img alt="" loading="lazy" src="${escapeAttr(src)}">`
      : `<img alt="" loading="lazy" src="${escapeAttr(src)}">`;
    el.innerHTML = `${media}<div class="meta"><span>#${post.id}</span><span>★ ${post.score ?? 0}</span></div>`;
    el.addEventListener("click", () => openLightbox(post));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") openLightbox(post); });
    grid.appendChild(el);
  });
  $("results").innerHTML = "";
  $("results").appendChild(grid);
}

function openLightbox(post) {
  const stage = $("lb-stage");
  stage.innerHTML = "";
  const url = post.sample_url || post.file_url;
  if (isVideo(post)) {
    const v = document.createElement("video");
    v.controls = true;
    v.autoplay = true;
    v.loop = true;
    v.src = post.file_url || url;
    stage.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = post.file_url || url;
    img.alt = "post " + post.id;
    stage.appendChild(img);
  }
  $("lb-info").innerHTML = `<strong>#${post.id}</strong> · ${post.width}×${post.height} · ${post.rating || ""} · score ${post.score ?? 0}<br><span class="hint">owner ${escapeHtml(post.owner || "unknown")}</span>`;
  $("lb-open").href = "https://rule34.xxx/index.php?page=post&s=view&id=" + post.id;
  const tags = String(post.tags || "").split(/\s+/).filter(Boolean);
  $("lb-tags").innerHTML = "";
  tags.forEach((t) => {
    const b = document.createElement("button");
    b.textContent = t;
    b.addEventListener("click", () => {
      $("q").value = ($("q").value + " " + t).trim();
      closeLightbox();
      search(0);
    });
    $("lb-tags").appendChild(b);
  });
  $("lightbox").classList.remove("hidden");
}
function closeLightbox() {
  $("lightbox").classList.add("hidden");
  $("lb-stage").innerHTML = "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&","<":"<",">":">","\"":""","'":"&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

let suggestTimer = 0;
let suggestItems = [];
let suggestIndex = -1;

async function suggest(q) {
  const last = q.trim().split(/\s+/).pop() || "";
  if (last.length < 2) { $("suggest").classList.add("hidden"); return; }
  try {
    const res = await fetch(AUTO + "?q=" + encodeURIComponent(last));
    const data = await res.json();
    suggestItems = Array.isArray(data) ? data.slice(0, 12) : [];
    if (!suggestItems.length) { $("suggest").classList.add("hidden"); return; }
    $("suggest").innerHTML = suggestItems.map((it, i) =>
      `<button type="button" data-i="${i}" class="${i===0?"active":""}"><span>${escapeHtml(it.value)}</span><span class="count">${escapeHtml((it.label||"").replace(it.value, "").trim())}</span></button>`
    ).join("");
    $("suggest").classList.remove("hidden");
    suggestIndex = 0;
  } catch {
    $("suggest").classList.add("hidden");
  }
}

function applySuggestion(item) {
  const parts = $("q").value.trim().split(/\s+/);
  parts[parts.length - 1] = item.value;
  $("q").value = parts.join(" ") + " ";
  $("suggest").classList.add("hidden");
  $("q").focus();
}

function fillSettingsForm() {
  const s = loadSettings();
  $("user-id").value = s.userId || "";
  $("api-key").value = s.apiKey || "";
  $("blacklist").value = s.blacklist || "";
}

function boot() {
  const accepted = localStorage.getItem("r34search.age") === "1";
  if (accepted) enterApp();
  $("enter").onclick = () => {
    localStorage.setItem("r34search.age", "1");
    enterApp();
  };
  $("leave").onclick = () => { location.href = "https://www.google.com"; };

  $("open-settings").onclick = () => { fillSettingsForm(); $("settings").classList.remove("hidden"); };
  $("close-settings").onclick = () => $("settings").classList.add("hidden");
  $("settings").addEventListener("click", (e) => { if (e.target.id === "settings") $("settings").classList.add("hidden"); });
  $("save-settings").onclick = () => {
    const parsed = parseCreds($("user-id").value, $("api-key").value);
    saveSettings({
      userId: parsed.userId,
      apiKey: parsed.apiKey,
      blacklist: $("blacklist").value.trim(),
    });
    $("user-id").value = parsed.userId;
    $("api-key").value = parsed.apiKey;
    $("saved-msg").classList.remove("hidden");
    setTimeout(() => $("saved-msg").classList.add("hidden"), 1600);
    $("settings").classList.add("hidden");
    search(0);
  };
  $("clear-settings").onclick = () => {
    localStorage.removeItem(STORE);
    fillSettingsForm();
    search(0);
  };

  $("search-form").addEventListener("submit", (e) => { e.preventDefault(); $("suggest").classList.add("hidden"); search(0); });
  $("q").addEventListener("input", () => {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => suggest($("q").value), 180);
  });
  $("suggest").addEventListener("mousedown", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    applySuggestion(suggestItems[Number(btn.dataset.i)]);
  });
  $("q").addEventListener("keydown", (e) => {
    if ($("suggest").classList.contains("hidden")) return;
    if (e.key === "ArrowDown") { e.preventDefault(); suggestIndex = Math.min(suggestItems.length - 1, suggestIndex + 1); paintSuggest(); }
    if (e.key === "ArrowUp") { e.preventDefault(); suggestIndex = Math.max(0, suggestIndex - 1); paintSuggest(); }
    if (e.key === "Enter" && suggestIndex >= 0) { e.preventDefault(); applySuggestion(suggestItems[suggestIndex]); }
    if (e.key === "Escape") $("suggest").classList.add("hidden");
  });
  ["rating","sort","limit"].forEach((id) => $(id).addEventListener("change", () => search(0)));
  $("no-ai").addEventListener("change", () => search(0));
  $("prev").onclick = () => search(Math.max(0, state.page - 1));
  $("next").onclick = () => search(state.page + 1);
  $("lb-close").onclick = closeLightbox;
  $("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox" || e.target.id === "lb-stage") closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (hash.get("q")) $("q").value = hash.get("q");
}

function paintSuggest() {
  [...$("suggest").querySelectorAll("button")].forEach((b, i) => b.classList.toggle("active", i === suggestIndex));
}

function enterApp() {
  $("age-gate").classList.add("hidden");
  $("app-header").classList.remove("hidden");
  $("app-main").classList.remove("hidden");
  if (!hasCreds()) {
    fillSettingsForm();
    $("settings").classList.remove("hidden");
  } else {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    search(Number(hash.get("p") || 0) || 0);
  }
}

boot();
