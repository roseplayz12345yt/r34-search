const API = "https://api.rule34.xxx/index.php";
const AUTO = "https://api.rule34.xxx/autocomplete.php";
const STORE = "r34search.v1";

const $ = (id) => document.getElementById(id);
const state = { page: 0, posts: [] };

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "{}");
    if (s.blacklist == null) s.blacklist = "loli shota young child";
    return s;
  } catch (e) {
    return { blacklist: "loli shota young child" };
  }
}
function saveSettings(partial) {
  const next = Object.assign({}, loadSettings(), partial);
  localStorage.setItem(STORE, JSON.stringify(next));
  return next;
}
function parseCreds(rawUser, rawKey) {
  const blob = (rawUser || "") + " " + (rawKey || "");
  const keyMatch = blob.match(/api_key=([^&\s]+)/i);
  const idMatch = blob.match(/user_id=([^&\s]+)/i);
  return {
    userId: (idMatch && idMatch[1]) || String(rawUser || "").trim(),
    apiKey: (keyMatch && keyMatch[1]) || String(rawKey || "").trim()
  };
}
function hasCreds() {
  const s = loadSettings();
  return !!(s.userId && s.apiKey);
}
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}
function buildTags() {
  const s = loadSettings();
  const parts = [];
  const typed = $("q").value.trim();
  if (typed) parts.push(typed);
  if ($("rating").value) parts.push("rating:" + $("rating").value);
  if ($("sort").value) parts.push($("sort").value);
  if ($("no-ai").checked) parts.push("-ai_generated");
  if (s.blacklist) {
    s.blacklist.split(/\s+/).filter(Boolean).forEach(function (t) {
      parts.push(t.charAt(0) === "-" ? t : "-" + t);
    });
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
function setStatus(text) { $("status").textContent = text; }

async function search(page) {
  page = page || 0;
  if (!hasCreds()) {
    $("need-key").classList.remove("hidden");
    $("results").innerHTML = "";
    $("pager").classList.add("hidden");
    setStatus("API key needed");
    $("settings").classList.remove("hidden");
    return;
  }
  $("need-key").classList.add("hidden");
  const s = loadSettings();
  const tags = buildTags();
  const limit = Number($("limit").value) || 24;
  state.page = page;
  setStatus("Loading...");
  $("results").innerHTML = '<div class="empty">Searching ' + escapeHtml(tags || "(latest)") + "</div>";

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
      throw new Error("Rule34 rejected the key. Generate a new key on the account options page, save, then paste user id and api key here.");
    }
    if (!text || text === "[]") {
      state.posts = [];
      renderResults([]);
      setStatus("No posts");
      $("pager").classList.remove("hidden");
      $("page-label").textContent = "Page " + (page + 1);
      $("prev").disabled = page === 0;
      $("next").disabled = true;
      return;
    }
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error(text.slice(0, 180) || "Unexpected API response"); }
    if (data && data.success === false) throw new Error(data.message || "Search failed");
    if (!Array.isArray(data)) {
      throw new Error((data && (data.message || data.error)) || "No results payload");
    }
    state.posts = data;
    renderResults(data);
    setStatus(data.length + " posts, page " + (page + 1));
    $("page-label").textContent = "Page " + (page + 1);
    $("pager").classList.remove("hidden");
    $("prev").disabled = page === 0;
    $("next").disabled = data.length < limit;
    history.replaceState(null, "", "#q=" + encodeURIComponent($("q").value) + "&p=" + page);
  } catch (err) {
    $("results").innerHTML = '<div class="error">' + escapeHtml(err.message || String(err)) + "</div>";
    setStatus("Error");
    $("pager").classList.add("hidden");
  }
}

function isVideo(post) {
  const u = String(post.file_url || post.image || "").toLowerCase();
  return /\.(mp4|webm|mov)(\?|$)/.test(u);
}
function renderResults(posts) {
  if (!posts.length) {
    $("results").innerHTML = '<div class="empty">No posts matched that search.</div>';
    return;
  }
  const grid = document.createElement("div");
  grid.className = "grid";
  posts.forEach(function (post) {
    const el = document.createElement("article");
    el.className = "card";
    el.tabIndex = 0;
    if (isVideo(post)) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "VIDEO";
      el.appendChild(badge);
    }
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = post.preview_url || post.sample_url || post.file_url || "";
    el.appendChild(img);
    const meta = document.createElement("div");
    meta.className = "meta";
    const id = document.createElement("span");
    id.textContent = "#" + post.id;
    const score = document.createElement("span");
    score.textContent = "score " + (post.score || 0);
    meta.appendChild(id);
    meta.appendChild(score);
    el.appendChild(meta);
    el.addEventListener("click", function () { openLightbox(post); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter") openLightbox(post); });
    grid.appendChild(el);
  });
  $("results").innerHTML = "";
  $("results").appendChild(grid);
}

function openLightbox(post) {
  const stage = $("lb-stage");
  stage.innerHTML = "";
  if (isVideo(post)) {
    const v = document.createElement("video");
    v.controls = true;
    v.autoplay = true;
    v.loop = true;
    v.playsInline = true;
    v.referrerPolicy = "no-referrer";
    v.src = post.file_url || post.sample_url || "";
    stage.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.referrerPolicy = "no-referrer";
    img.alt = "post " + post.id;
    img.src = post.sample_url || post.file_url || post.preview_url || "";
    stage.appendChild(img);
  }
  $("lb-info").textContent = "#" + post.id + " · " + (post.width || "?") + "x" + (post.height || "?") + " · " + (post.rating || "") + " · score " + (post.score || 0);
  $("lb-open").href = "https://rule34.xxx/index.php?page=post&s=view&id=" + encodeURIComponent(post.id);
  const tags = String(post.tags || "").split(/\s+/).filter(Boolean);
  $("lb-tags").innerHTML = "";
  tags.forEach(function (t) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t;
    b.addEventListener("click", function () {
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

let suggestTimer = 0;
let suggestItems = [];
let suggestIndex = -1;
async function suggest(q) {
  const last = (q.trim().split(/\s+/).pop() || "").replace(/^-/, "");
  if (last.length < 2) { $("suggest").classList.add("hidden"); return; }
  try {
    const res = await fetch(AUTO + "?q=" + encodeURIComponent(last));
    const data = await res.json();
    suggestItems = Array.isArray(data) ? data.slice(0, 10) : [];
    if (!suggestItems.length) { $("suggest").classList.add("hidden"); return; }
    $("suggest").innerHTML = "";
    suggestItems.forEach(function (it, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.i = String(i);
      if (i === 0) btn.className = "active";
      const name = document.createElement("span");
      name.textContent = it.value;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = String(it.label || "").replace(it.value, "").trim();
      btn.appendChild(name);
      btn.appendChild(count);
      $("suggest").appendChild(btn);
    });
    $("suggest").classList.remove("hidden");
    suggestIndex = 0;
  } catch (e) {
    $("suggest").classList.add("hidden");
  }
}
function applySuggestion(item) {
  const parts = $("q").value.trim().split(/\s+/);
  const prefix = parts[parts.length - 1].charAt(0) === "-" ? "-" : "";
  parts[parts.length - 1] = prefix + item.value;
  $("q").value = parts.join(" ") + " ";
  $("suggest").classList.add("hidden");
  $("q").focus();
}
function paintSuggest() {
  Array.prototype.forEach.call($("suggest").querySelectorAll("button"), function (b, i) {
    b.classList.toggle("active", i === suggestIndex);
  });
}
function fillSettingsForm() {
  const s = loadSettings();
  $("user-id").value = s.userId || "";
  $("api-key").value = s.apiKey || "";
  $("blacklist").value = s.blacklist || "";
}
function boot() {
  if (localStorage.getItem("r34search.age") === "1") enterApp();
  $("enter").onclick = function () {
    localStorage.setItem("r34search.age", "1");
    enterApp();
  };
  $("leave").onclick = function () { location.href = "https://www.google.com"; };
  $("open-settings").onclick = function () {
    fillSettingsForm();
    $("settings").classList.remove("hidden");
  };
  $("close-settings").onclick = function () { $("settings").classList.add("hidden"); };
  $("settings").addEventListener("click", function (e) {
    if (e.target.id === "settings") $("settings").classList.add("hidden");
  });
  $("save-settings").onclick = function () {
    const parsed = parseCreds($("user-id").value, $("api-key").value);
    if (!parsed.userId || !parsed.apiKey) {
      $("saved-msg").textContent = "Both user id and api key are required.";
      $("saved-msg").classList.remove("hidden");
      return;
    }
    saveSettings({ userId: parsed.userId, apiKey: parsed.apiKey, blacklist: $("blacklist").value.trim() });
    $("user-id").value = parsed.userId;
    $("api-key").value = parsed.apiKey;
    $("saved-msg").textContent = "Saved in this browser.";
    $("saved-msg").classList.remove("hidden");
    $("settings").classList.add("hidden");
    search(0);
  };
  $("clear-settings").onclick = function () {
    localStorage.removeItem(STORE);
    fillSettingsForm();
    search(0);
  };
  $("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    $("suggest").classList.add("hidden");
    search(0);
  });
  $("q").addEventListener("input", function () {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(function () { suggest($("q").value); }, 180);
  });
  $("suggest").addEventListener("mousedown", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    e.preventDefault();
    applySuggestion(suggestItems[Number(btn.dataset.i)]);
  });
  $("q").addEventListener("keydown", function (e) {
    if ($("suggest").classList.contains("hidden")) return;
    if (e.key === "ArrowDown") { e.preventDefault(); suggestIndex = Math.min(suggestItems.length - 1, suggestIndex + 1); paintSuggest(); }
    if (e.key === "ArrowUp") { e.preventDefault(); suggestIndex = Math.max(0, suggestIndex - 1); paintSuggest(); }
    if (e.key === "Enter" && suggestIndex >= 0) { e.preventDefault(); applySuggestion(suggestItems[suggestIndex]); }
    if (e.key === "Escape") $("suggest").classList.add("hidden");
  });
  ["rating", "sort", "limit"].forEach(function (id) {
    $(id).addEventListener("change", function () { if (hasCreds()) search(0); });
  });
  $("no-ai").addEventListener("change", function () { if (hasCreds()) search(0); });
  $("prev").onclick = function () { search(Math.max(0, state.page - 1)); };
  $("next").onclick = function () { search(state.page + 1); };
  $("lb-close").onclick = closeLightbox;
  $("lightbox").addEventListener("click", function (e) {
    if (e.target.id === "lightbox" || e.target.id === "lb-stage") closeLightbox();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLightbox(); });
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (hash.get("q")) $("q").value = hash.get("q");
}
function enterApp() {
  $("age-gate").classList.add("hidden");
  $("app-header").classList.remove("hidden");
  $("app-main").classList.remove("hidden");
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (!hasCreds()) {
    fillSettingsForm();
    $("settings").classList.remove("hidden");
    setStatus("API key needed");
  } else {
    search(Number(hash.get("p") || 0) || 0);
  }
}
boot();
