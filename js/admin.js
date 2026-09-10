const SECTIONS = [
  { id: "home", label: "홈페이지", endpoint: "/api/content", preview: "index.html" },
  { id: "about", label: "회사소개", endpoint: "/api/about-content", preview: "about.html" },
  { id: "brands", label: "브랜드", endpoint: "/api/brands-content", preview: "brands.html" },
  { id: "imported", label: "수입브랜드", endpoint: "/api/imported-content", preview: "imported-brands.html" },
  { id: "catalog", label: "제품 카탈로그", endpoint: "/api/catalog-content", preview: "catalog.html" },
  { id: "trust", label: "신뢰와 인증", endpoint: "/api/trust-content", preview: "trust.html" },
];

let activeSection = "home";

function qs(sel, root = document) {
  return root.querySelector(sel);
}

async function checkSession() {
  // /api/contact's GET is the only endpoint that requires auth, so a
  // successful call here doubles as a session check.
  const res = await fetch("/api/contact", { cache: "no-store" });
  return res.ok;
}

function showLogin(errorMsg) {
  qs("#login-view").hidden = false;
  qs("#dashboard-view").hidden = true;
  if (errorMsg) {
    const el2 = qs("#login-error");
    el2.textContent = errorMsg;
    el2.hidden = false;
  }
}

function showDashboard() {
  qs("#login-view").hidden = true;
  qs("#dashboard-view").hidden = false;
  renderTabs();
  loadSection(activeSection);
  loadInquiries();
}

function renderTabs() {
  const nav = qs("#admin-tabs");
  nav.innerHTML = "";
  SECTIONS.forEach((s) => {
    const btn = el("button", { class: "admin-tab" + (s.id === activeSection ? " active" : ""), type: "button", text: s.label });
    btn.addEventListener("click", () => {
      activeSection = s.id;
      renderTabs();
      loadSection(s.id);
    });
    nav.appendChild(btn);
  });
}

// ---------- Path utilities (dot/bracket paths like "brands[2].logo") ----------
function getPath(obj, path) {
  return path.reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}
function setPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
}
function pathLabel(path) {
  return path
    .map((seg, i) => (typeof seg === "number" ? `[${seg}]` : i === 0 ? seg : `.${seg}`))
    .join("");
}

// Any string field whose key looks like an image reference, or whose value
// already looks like one, is treated as an editable image field.
const IMAGE_KEY_RE = /image|logo|photo|thumbnail|src/i;
const IMAGE_VALUE_RE = /^(assets\/|\/api\/asset\/|https?:\/\/)/i;

function findImageFields(obj, path = [], out = []) {
  if (obj == null || typeof obj !== "object") return out;
  for (const [key, value] of Object.entries(obj)) {
    const nextPath = [...path, key];
    if (typeof value === "string" && (IMAGE_KEY_RE.test(key) || IMAGE_VALUE_RE.test(value))) {
      out.push(nextPath);
    } else if (typeof value === "object" && value !== null) {
      findImageFields(value, nextPath, out);
    }
  }
  return out;
}

// Arrays of objects at any depth are treated as manageable lists (brands,
// products, distributors, certifications, ...) so they get add/remove
// buttons instead of only raw-JSON editing.
function findArrayFields(obj, path = [], out = []) {
  if (obj == null || typeof obj !== "object") return out;
  for (const [key, value] of Object.entries(obj)) {
    const nextPath = [...path, key];
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      out.push(nextPath);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      findArrayFields(value, nextPath, out);
    }
  }
  return out;
}

function itemLabel(item, index) {
  const nameKey = ["nameKo", "name", "title", "code", "year", "number", "eyebrow"].find((k) => item[k]);
  return nameKey ? `${index + 1}. ${item[nameKey]}` : `항목 ${index + 1}`;
}

async function uploadImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const dataBase64 = dataUrl.split(",")[1];
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function renderImageManager(data, textarea, syncFromData) {
  const wrap = el("div", { class: "media-manager" });
  const fields = findImageFields(data);
  if (fields.length === 0) return wrap;
  wrap.appendChild(el("h3", { class: "media-manager-title", text: "이미지 관리" }));
  const grid = el("div", { class: "media-grid" });
  fields.forEach((path) => {
    const value = getPath(data, path) || "";
    const row = el("div", { class: "media-row" });
    const thumbWrap = el("div", { class: "media-thumb" });
    if (value) {
      thumbWrap.appendChild(el("img", { src: value, alt: "" }));
    } else {
      thumbWrap.appendChild(el("span", { text: "없음" }));
    }
    row.appendChild(thumbWrap);
    row.appendChild(el("div", { class: "media-label", text: pathLabel(path) }));

    const fileInput = el("input", { type: "file", accept: "image/*" });
    fileInput.style.display = "none";
    const changeBtn = el("button", { class: "mini-btn", type: "button", text: "변경" });
    changeBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      changeBtn.disabled = true;
      changeBtn.textContent = "업로드 중...";
      try {
        const { url } = await uploadImage(file);
        setPath(data, path, url);
        textarea.value = JSON.stringify(data, null, 2);
        syncFromData();
      } catch (e) {
        alert("업로드 실패: " + e.message);
      } finally {
        changeBtn.disabled = false;
        changeBtn.textContent = "변경";
      }
    });

    const clearBtn = el("button", { class: "mini-btn danger", type: "button", text: "삭제" });
    clearBtn.addEventListener("click", async () => {
      if (value.startsWith("/api/asset/")) {
        const id = value.split("/").pop();
        fetch(`/api/asset/${id}`, { method: "DELETE" }).catch(() => {});
      }
      setPath(data, path, "");
      textarea.value = JSON.stringify(data, null, 2);
      syncFromData();
    });

    row.appendChild(el("div", { class: "media-actions" }, [changeBtn, clearBtn, fileInput]));
    grid.appendChild(row);
  });
  wrap.appendChild(grid);
  return wrap;
}

function renderArrayManager(data, textarea, syncFromData) {
  const wrap = el("div", { class: "array-manager" });
  const fields = findArrayFields(data);
  if (fields.length === 0) return wrap;
  wrap.appendChild(el("h3", { class: "media-manager-title", text: "목록 항목 추가 / 삭제" }));
  fields.forEach((path) => {
    const arr = getPath(data, path);
    const section = el("div", { class: "array-section" }, [el("div", { class: "array-path", text: pathLabel(path) })]);
    const list = el("div", { class: "array-list" });
    arr.forEach((item, i) => {
      const row = el("div", { class: "array-item-row" }, [el("span", { text: itemLabel(item, i) })]);
      const delBtn = el("button", { class: "mini-btn danger", type: "button", text: "삭제" });
      delBtn.addEventListener("click", () => {
        if (!confirm(`'${itemLabel(item, i)}' 항목을 삭제할까요?`)) return;
        arr.splice(i, 1);
        textarea.value = JSON.stringify(data, null, 2);
        syncFromData();
      });
      row.appendChild(delBtn);
      list.appendChild(row);
    });
    section.appendChild(list);
    const addBtn = el("button", { class: "mini-btn", type: "button", text: "+ 새 항목 추가" });
    addBtn.addEventListener("click", () => {
      // Clone the shape of the last item so required fields exist, blanking
      // out text/number values for the admin to fill in.
      const template = arr[arr.length - 1] || {};
      const blank = JSON.parse(JSON.stringify(template), (key, v) => {
        if (typeof v === "string") return "";
        if (typeof v === "number") return 0;
        return v;
      });
      arr.push(blank);
      textarea.value = JSON.stringify(data, null, 2);
      syncFromData();
    });
    section.appendChild(addBtn);
    wrap.appendChild(section);
  });
  return wrap;
}

async function loadSection(id) {
  const section = SECTIONS.find((s) => s.id === id);
  const panel = qs("#editor-panel");
  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "admin-loading", text: "불러오는 중..." }));

  let data;
  try {
    const res = await fetch(section.endpoint, { cache: "no-store" });
    data = await res.json();
  } catch {
    panel.innerHTML = "";
    panel.appendChild(el("p", { class: "admin-error", text: "콘텐츠를 불러오지 못했습니다." }));
    return;
  }

  panel.innerHTML = "";
  const textarea = el("textarea", { class: "json-editor", spellcheck: "false" });
  textarea.value = JSON.stringify(data, null, 2);

  const status = el("div", { class: "editor-status" });
  const saveBtn = el("button", { class: "submit-btn", type: "button", text: "저장" });
  const previewLink = el("a", { class: "preview-link", href: section.preview, target: "_blank", rel: "noopener", text: "실제 페이지 보기 ↗" });

  // Re-parse the textarea into `data` whenever the admin edits raw JSON by
  // hand, so the image/array managers above always reflect the latest state.
  let mediaWrap, arrayWrap;
  function refreshManagers() {
    const freshImg = renderImageManager(data, textarea, refreshManagers);
    const freshArr = renderArrayManager(data, textarea, refreshManagers);
    mediaWrap.replaceWith(freshImg);
    mediaWrap = freshImg;
    arrayWrap.replaceWith(freshArr);
    arrayWrap = freshArr;
  }
  textarea.addEventListener("change", () => {
    try {
      data = JSON.parse(textarea.value);
      status.textContent = "";
      status.className = "editor-status";
      refreshManagers();
    } catch (e) {
      status.textContent = "JSON 형식 오류: " + e.message;
      status.className = "editor-status error";
    }
  });

  saveBtn.addEventListener("click", async () => {
    let parsed;
    try {
      parsed = JSON.parse(textarea.value);
    } catch (e) {
      status.textContent = "JSON 형식 오류: " + e.message;
      status.className = "editor-status error";
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "저장 중...";
    try {
      const res = await fetch(section.endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (res.status === 401) {
        showLogin("로그인이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      status.textContent = "저장되었습니다. 모든 방문자에게 즉시 반영됩니다.";
      status.className = "editor-status success";
    } catch (e) {
      status.textContent = "저장 실패: " + e.message;
      status.className = "editor-status error";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "저장";
    }
  });

  mediaWrap = renderImageManager(data, textarea, refreshManagers);
  arrayWrap = renderArrayManager(data, textarea, refreshManagers);
  panel.appendChild(mediaWrap);
  panel.appendChild(arrayWrap);
  panel.appendChild(
    el("div", { class: "editor-toolbar" }, [
      el("p", { class: "editor-hint", text: "위에서 다루지 못하는 텍스트 필드는 아래 JSON을 직접 수정하세요. 수정 후 다른 곳을 클릭하면 위 목록에도 반영됩니다." }),
      previewLink,
    ])
  );
  panel.appendChild(textarea);
  panel.appendChild(el("div", { class: "editor-actions" }, [saveBtn, status]));
}

async function loadInquiries() {
  const list = qs("#inquiry-list");
  list.innerHTML = "";
  list.appendChild(el("p", { class: "admin-loading", text: "불러오는 중..." }));
  let items;
  try {
    const res = await fetch("/api/contact", { cache: "no-store" });
    if (!res.ok) throw new Error();
    items = await res.json();
  } catch {
    list.innerHTML = "";
    list.appendChild(el("p", { class: "admin-error", text: "문의 내역을 불러오지 못했습니다." }));
    return;
  }

  list.innerHTML = "";
  qs("#inquiry-count").textContent = `총 ${items.length}건 (미확인 ${items.filter((i) => !i.read).length}건)`;
  if (items.length === 0) {
    list.appendChild(el("p", { class: "admin-empty", text: "접수된 문의가 없습니다." }));
    return;
  }
  items.forEach((item) => list.appendChild(inquiryCard(item)));
}

function inquiryCard(item) {
  const date = new Date(item.submittedAt).toLocaleString("ko-KR");
  const card = el("div", { class: "inquiry-card" + (item.read ? "" : " unread") }, [
    el("div", { class: "inquiry-head" }, [
      el("div", {}, [
        el("strong", { text: item.company }),
        el("span", { class: "inquiry-name", text: ` · ${item.name}` }),
      ]),
      el("time", { text: date }),
    ]),
    el("div", { class: "inquiry-meta" }, [
      el("span", { text: `연락처: ${item.phone}` }),
      item.email ? el("span", { text: `이메일: ${item.email}` }) : null,
    ]),
    el("p", { class: "inquiry-message", text: item.message }),
  ]);

  const actions = el("div", { class: "inquiry-actions" });
  const toggleBtn = el("button", { class: "mini-btn", type: "button", text: item.read ? "안읽음으로 표시" : "읽음으로 표시" });
  toggleBtn.addEventListener("click", () => updateInquiry(item.id, item.read ? "markUnread" : "markRead"));
  const deleteBtn = el("button", { class: "mini-btn danger", type: "button", text: "삭제" });
  deleteBtn.addEventListener("click", () => {
    if (confirm("이 문의를 삭제할까요?")) updateInquiry(item.id, "delete");
  });
  actions.appendChild(toggleBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);
  return card;
}

async function updateInquiry(id, action) {
  await fetch("/api/contact", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action }),
  });
  loadInquiries();
}

function setupLogin() {
  const form = qs("#login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = qs("#login-password").value;
    const errorEl = qs("#login-error");
    errorEl.hidden = true;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "확인 중...";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        errorEl.textContent = "비밀번호가 올바르지 않습니다.";
        errorEl.hidden = false;
        return;
      }
      qs("#login-password").value = "";
      showDashboard();
    } catch {
      errorEl.textContent = "로그인 중 오류가 발생했습니다.";
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "로그인";
    }
  });
}

function setupLogout() {
  qs("#logout-btn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
  });
}

(async function init() {
  setupLogin();
  setupLogout();
  const authed = await checkSession();
  if (authed) showDashboard();
  else showLogin();
})();
