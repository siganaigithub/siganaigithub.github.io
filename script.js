let posts = [];
let currentDetailId = null;
let supabase = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);
const views = {
  home: $("homeView"),
  archive: $("archiveView"),
  write: $("writeView"),
  detail: $("detailView")
};

function escapeHTML(str="") {
  return String(str).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("ja-JP", {year:"numeric", month:"2-digit", day:"2-digit"}).format(new Date(iso));
}
function shortDate(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}
function showView(name) {
  Object.values(views).forEach(v => v.classList.remove("active-view"));
  views[name].classList.add("active-view");
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === name));
  window.scrollTo({top:0, behavior:"smooth"});
}

function ensureConfigured() {
  return SUPABASE_URL && SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_SUPABASE") && !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
}

async function init() {
  // ナビゲーション等のUIはSupabase未設定でも動作させる
  if (!ensureConfigured()) {
    showSetupWarning();
    updateAuthUI();
    return;
  }
  if (!window.supabase?.createClient) {
    showSetupWarning("Supabaseライブラリを読み込めませんでした。ネットワーク/CDN設定を確認してください。");
    return;
  }
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    updateAuthUI();
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateAuthUI();
    });
    await loadPosts();
  } catch (error) {
    console.error("Supabase initialization failed:", error);
    showSetupWarning("Supabaseへの接続に失敗しました。config.js のURL/keyとSupabase設定を確認してください。");
  }
}

function showSetupWarning(message = "Supabaseの設定が必要です。") {
  $("latestPosts").innerHTML = `<div style="grid-column:1/-1;padding:50px;color:#668196"><strong>${escapeHTML(message)}</strong><br>config.js に Supabase Project URL と publishable/anon key を設定してください。</div>`;
  $("archivePosts").innerHTML = `<div style="padding:50px;color:#668196">Supabase未接続のため記事を取得できません。</div>`;
}

async function loadPosts() {
  const { data, error } = await supabase.from("posts").select("*, comments(*)").order("created_at", {ascending:false});
  if (error) {
    console.error(error);
    toast("記事の読み込みに失敗しました");
    return;
  }
  posts = (data || []).map(p => ({...p, date:p.created_at, comments:(p.comments || []).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))}));
  renderAll();
}

function isAdmin() { return !!currentUser; }
function updateAuthUI() {
  $("loginOpen").hidden = isAdmin();
  $("logoutBtn").hidden = !isAdmin();
  $("writeView").querySelector(".editor").style.display = isAdmin() ? "" : "none";
}

function requireAdmin() {
  if (isAdmin()) return true;
  $("loginMessage").textContent = "管理者ログインが必要です。";
  $("loginDialog").showModal();
  return false;
}

function postCard(post) {
  return `<article class="post-card" data-id="${post.id}">
    <span class="tag">${escapeHTML(post.category)}</span>
    <h3>${escapeHTML(post.title)}</h3>
    <p>${escapeHTML(post.excerpt || post.body.slice(0,90) + "…")}</p>
    <div class="meta">${formatDate(post.created_at)}　/　${post.comments.length} COMMENTS</div>
  </article>`;
}
function renderHome() {
  $("latestPosts").innerHTML = posts.slice(0,3).map(postCard).join("") || emptyState();
}
function renderArchive() {
  const q = $("archiveSearch").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const filtered = posts.filter(p => category === "all" || p.category === category)
    .filter(p => [p.title,p.excerpt,p.body,p.category].join(" ").toLowerCase().includes(q));
  $("archivePosts").innerHTML = filtered.length ? filtered.map(p => `
    <article class="archive-item" data-id="${p.id}">
      <div class="archive-date">${shortDate(p.created_at)}</div>
      <div class="archive-info"><span class="tag">${escapeHTML(p.category)}</span><h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.excerpt || p.body.slice(0,100))}</p></div>
      <div class="archive-arrow">↗</div>
    </article>`).join("") : `<div style="padding:50px 0;color:#668196">該当する記事はありません。</div>`;
}
function emptyState() { return `<div style="grid-column:1/-1;padding:50px;color:#668196">まだ記事がありません。最初の記事を書いてみましょう。</div>`; }

function openDetail(id) {
  const post = posts.find(p => p.id === id);
  if (!post) return;
  currentDetailId = id;
  $("detailArticle").innerHTML = `
    <span class="tag">${escapeHTML(post.category)}</span><h1>${escapeHTML(post.title)}</h1>
    <div class="detail-meta">${formatDate(post.created_at)}　/　${post.comments.length} COMMENTS</div>
    <div class="detail-body">${escapeHTML(post.body)}</div>
    ${isAdmin() ? `<div class="detail-actions"><button class="secondary-btn" id="editPost">EDIT</button><button class="danger-btn" id="deletePost">DELETE</button></div>` : ""}
    <section class="comments"><span class="section-kicker">COMMENTS</span><h2>この記事について</h2>
      <form class="comment-form" id="commentForm"><input id="commentName" maxlength="30" placeholder="名前" required><input id="commentText" maxlength="500" placeholder="コメントを書く..." required><button>POST</button></form>
      <div id="commentList">${post.comments.length ? post.comments.map(c => `<div class="comment"><strong>${escapeHTML(c.name)}</strong><time>${formatDate(c.created_at)}</time><p>${escapeHTML(c.text)}</p></div>`).join("") : `<p style="color:#597489">まだコメントはありません。</p>`}</div>
    </section>`;
  if (isAdmin()) {
    $("editPost").onclick = () => startEdit(id);
    $("deletePost").onclick = () => deletePost(id);
  }
  $("commentForm").onsubmit = addComment;
  showView("detail");
}

function startEdit(id) {
  if (!requireAdmin()) return;
  const post = posts.find(p => p.id === id);
  if (!post) return;
  $("postId").value = post.id;
  $("postTitle").value = post.title;
  $("postCategory").value = post.category;
  $("postExcerpt").value = post.excerpt || "";
  $("postBody").value = post.body;
  $("editorHeading").innerHTML = "EDIT<br><span>POST.</span>";
  updateCharCount(); showView("write");
}
function resetEditor() {
  $("postForm").reset(); $("postId").value = "";
  $("editorHeading").innerHTML = "NEW<br><span>POST.</span>"; updateCharCount();
}

$("postForm").onsubmit = async e => {
  e.preventDefault(); if (!requireAdmin()) return;
  const id = $("postId").value;
  const data = {title:$("postTitle").value.trim(), category:$("postCategory").value, excerpt:$("postExcerpt").value.trim(), body:$("postBody").value.trim()};
  let error;
  if (id) {
    ({error} = await supabase.from("posts").update({...data, updated_at:new Date().toISOString()}).eq("id", id));
  } else {
    ({error} = await supabase.from("posts").insert(data));
  }
  if (error) { console.error(error); toast("保存に失敗しました"); return; }
  await loadPosts(); resetEditor(); toast(id ? "記事を更新しました" : "記事を公開しました");
  const newId = id || posts[0]?.id;
  if (newId) openDetail(newId);
};

async function deletePost(id) {
  if (!requireAdmin()) return;
  const post = posts.find(p => p.id === id); if (!post) return;
  if (!confirm(`「${post.title}」を削除しますか？\nこの操作は元に戻せません。`)) return;
  const {error} = await supabase.from("posts").delete().eq("id", id);
  if (error) { console.error(error); toast("削除に失敗しました"); return; }
  await loadPosts(); showView("archive"); toast("記事を削除しました");
}

async function addComment(e) {
  e.preventDefault();
  const payload = {post_id:currentDetailId, name:$("commentName").value.trim(), text:$("commentText").value.trim()};
  const {error} = await supabase.from("comments").insert(payload);
  if (error) { console.error(error); toast("コメント投稿に失敗しました"); return; }
  await loadPosts(); openDetail(currentDetailId); toast("コメントを投稿しました");
}
function updateCharCount() { $("charCount").textContent = `${$("postBody").value.length} characters`; }
function renderAll() { renderHome(); renderArchive(); }

$("loginForm").onsubmit = async e => {
  e.preventDefault();
  if (!supabase) {
    $("loginMessage").textContent = "Supabase未設定です。config.js に接続情報を設定してください。";
    return;
  }
  $("loginMessage").textContent = "ログイン中...";
  const {error} = await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(), password:$("loginPassword").value});
  if (error) { $("loginMessage").textContent = "ログインに失敗しました。メールアドレスまたはパスワードを確認してください。"; return; }
  $("loginDialog").close(); $("loginForm").reset(); toast("管理者としてログインしました");
};
$("loginOpen").onclick = () => { $("loginMessage").textContent=""; $("loginDialog").showModal(); };
$("loginClose").onclick = () => $("loginDialog").close();
$("logoutBtn").onclick = async () => {
  if (!supabase) return;
  await supabase.auth.signOut(); showView("home"); toast("ログアウトしました");
};

$("cancelEdit").onclick = () => { resetEditor(); showView("archive"); };
$("postBody").addEventListener("input", updateCharCount);
$("archiveSearch").addEventListener("input", renderArchive);
$("categoryFilter").addEventListener("change", renderArchive);
$("searchOpen").onclick = () => $("searchDialog").showModal();
$("globalSearchSubmit").onclick = () => { const q=$("globalSearch").value.trim(); $("searchDialog").close(); showView("archive"); $("archiveSearch").value=q; renderArchive(); };

document.addEventListener("click", e => {
  const viewButton = e.target.closest("[data-view]");
  if (viewButton) { e.preventDefault(); const view=viewButton.dataset.view; if(view==="write" && !requireAdmin()) return; if(view==="write") resetEditor(); showView(view); }
  const card=e.target.closest("[data-id]");
  if(card && (card.classList.contains("post-card") || card.classList.contains("archive-item"))) openDetail(card.dataset.id);
});
$("backFromDetail").onclick = () => showView("archive");

init();
