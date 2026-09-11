// 브랜드/수입브랜드/제품 카탈로그는 "브랜드 추가 등록"과 "신규 제품 추가" 탭이
// 이미 전용 폼(+ 3개 문서 동기화 로직)으로 관리하므로, 같은 데이터를 다시 원시
// JSON으로 편집할 수 있게 두면 두 편집 경로가 어긋날 수 있어 탭에서 제외한다.
const SECTIONS = [
  { id: "add-brand", label: "브랜드 추가 등록" },
  { id: "add-product", label: "신규 제품 추가" },
  { id: "home", label: "홈페이지", endpoint: "/api/content", preview: "index.html" },
  { id: "about", label: "회사소개", endpoint: "/api/about-content", preview: "about.html" },
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

// 업로드 전 이미지 용량을 줄인다 (D1 행 크기 제한 및 느린 업로드 방지).
// 투명 배경이 필요한 PNG는 PNG로, 그 외는 훨씬 작은 JPEG로 인코딩.
function compressImage(file, { maxDimension = 1600, startQuality = 0.85, maxBase64Length = 850000 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const keepPng = file.type === "image/png";
      let quality = startQuality;
      let dataUrl = canvas.toDataURL(keepPng ? "image/png" : "image/jpeg", quality);

      while (dataUrl.length > maxBase64Length && quality > 0.3) {
        quality -= 0.1;
        if (keepPng) {
          canvas.width = Math.round(canvas.width * 0.85);
          canvas.height = Math.round(canvas.height * 0.85);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/png");
        } else {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
      }
      resolve({ dataUrl, contentType: keepPng ? "image/png" : "image/jpeg" });
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

async function uploadImage(file) {
  const { dataUrl, contentType } = await compressImage(file);
  const dataBase64 = dataUrl.split(",")[1];
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType, dataBase64 }),
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

function slugify(s) {
  const cleaned = (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "item-" + Date.now();
}

async function fetchJson(endpoint) {
  const res = await fetch(endpoint, { cache: "no-store" });
  if (!res.ok) throw new Error("불러오기 실패: " + endpoint);
  return res.json();
}

async function putJson(endpoint, data) {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
}

function formField(labelText, inputEl, required) {
  return el("div", { class: "form-field" }, [
    el("label", { text: labelText + (required ? " *" : "") }),
    inputEl,
  ]);
}

// ---------- Shared modal helper ----------
let modalCounter = 0;

function openModal(title, bodyEl, onSave) {
  const overlay = el("div", { class: "admin-modal-overlay" });
  const card = el("div", { class: "admin-modal-card" });
  const status = el("div", { class: "editor-status" });
  const cancelBtn = el("button", { class: "mini-btn", type: "button", text: "취소" });
  const saveBtn = el("button", { class: "submit-btn", type: "button", text: "저장하기" });
  cancelBtn.addEventListener("click", () => overlay.remove());
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "저장 중...";
    status.textContent = "";
    status.className = "editor-status";
    try {
      await onSave();
      overlay.remove();
    } catch (e) {
      status.textContent = "저장 실패: " + e.message;
      status.className = "editor-status error";
      saveBtn.disabled = false;
      saveBtn.textContent = "저장하기";
    }
  });
  card.appendChild(el("h3", { class: "media-manager-title", text: title }));
  card.appendChild(bodyEl);
  card.appendChild(status);
  card.appendChild(el("div", { class: "modal-actions" }, [cancelBtn, saveBtn]));
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return { overlay, status };
}

function imagePreview(url) {
  const wrap = el("div", { class: "image-preview" });
  if (url) wrap.appendChild(el("img", { src: url, alt: "" }));
  else wrap.appendChild(el("span", { text: "이미지 미리보기" }));
  return wrap;
}

// ---------- Brand form (shared by add + edit) ----------
function buildBrandFields(prefill) {
  const p = prefill || {};
  const groupName = "brand-type-" + ++modalCounter;
  const nameKo = el("input", { type: "text", placeholder: "예: 웰젠, 부명케어", value: p.nameKo || "" });
  const nameEn = el("input", { type: "text", placeholder: "예: WELLZEN", value: p.nameEn || "" });
  const typeOwn = el("input", { type: "radio", name: groupName, value: "own", checked: (p.type || "own") === "own" });
  const typeImported = el("input", { type: "radio", name: groupName, value: "imported", checked: p.type === "imported" });
  const tagline = el("input", { type: "text", placeholder: "예: Healthy & Happy Pet Care", value: p.tagline || "" });
  const descKo = el("textarea", { rows: 2, placeholder: "브랜드에 대한 간단한 소개를 입력하세요.", text: p.descriptionKo || "" });
  const descEn = el("textarea", { rows: 2, placeholder: "Enter brand description in English.", text: p.descriptionEn || "" });
  const color = el("input", { type: "color", value: p.color || "#0066b3" });
  const colorText = el("input", { type: "text", value: (p.color || "#0066B3").toUpperCase() });
  color.addEventListener("input", () => (colorText.value = color.value.toUpperCase()));
  colorText.addEventListener("change", () => {
    if (/^#[0-9a-fA-F]{6}$/.test(colorText.value)) color.value = colorText.value;
  });
  const logoFile = el("input", { type: "file", accept: "image/*" });
  let preview = imagePreview(p.logo);
  const previewSlot = el("div", {}, [preview]);
  logoFile.addEventListener("change", () => {
    const f = logoFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const fresh = imagePreview(reader.result);
      preview.replaceWith(fresh);
      preview = fresh;
    };
    reader.readAsDataURL(f);
  });
  let currentLogo = p.logo || "";

  const container = el("div", { class: "admin-form" }, [
    el("div", { class: "form-row-2" }, [formField("브랜드명 (한글)", nameKo, true), formField("브랜드명 (영문)", nameEn)]),
    formField(
      "브랜드 유형 (노출될 메뉴/페이지 결정)",
      el("div", { class: "radio-row" }, [
        el("label", {}, [typeOwn, document.createTextNode(' 자사 브랜드 → "브랜드" 메뉴에 노출')]),
        el("label", {}, [typeImported, document.createTextNode(' 수입 브랜드 → "수입브랜드" 메뉴에 노출')]),
      ])
    ),
    formField("브랜드 슬로건 (Tagline)", tagline),
    el("div", { class: "form-row-2" }, [formField("브랜드 설명 (한글)", descKo), formField("브랜드 설명 (영문)", descEn)]),
    el("div", { class: "form-row-2" }, [
      formField("브랜드 대표 테마 색상", el("div", { class: "color-row" }, [color, colorText])),
      formField("브랜드 로고 이미지 첨부", logoFile),
    ]),
    previewSlot,
  ]);

  return {
    container,
    validate() {
      return nameKo.value.trim() ? null : "브랜드명(한글)은 필수입니다.";
    },
    async getBrand() {
      let logo = currentLogo;
      if (logoFile.files[0]) {
        const { url } = await uploadImage(logoFile.files[0]);
        logo = url;
      }
      return {
        nameKo: nameKo.value.trim(),
        nameEn: nameEn.value.trim(),
        type: typeImported.checked ? "imported" : "own",
        tagline: tagline.value.trim(),
        descriptionKo: descKo.value.trim(),
        descriptionEn: descEn.value.trim(),
        color: colorText.value,
        logo,
      };
    },
    reset() {
      nameKo.value = "";
      nameEn.value = "";
      tagline.value = "";
      descKo.value = "";
      descEn.value = "";
      logoFile.value = "";
      currentLogo = "";
      const fresh = imagePreview("");
      preview.replaceWith(fresh);
      preview = fresh;
      typeOwn.checked = true;
      typeImported.checked = false;
      colorText.value = "#0066B3";
      color.value = "#0066b3";
    },
  };
}

// Brands live in one of two content files depending on type, and are
// mirrored into the catalog's brand filter and (for in-house brands only)
// the homepage teaser grid — every write keeps all three in sync.
async function upsertBrand(fields, existingId) {
  const data = await fields.getBrand();
  const id = existingId || slugify(data.nameEn || data.nameKo);
  const brand = { id, ...data };

  const ownData = await fetchJson("/api/brands-content");
  const importedData = await fetchJson("/api/imported-content");
  ownData.brands = (ownData.brands || []).filter((b) => b.id !== id);
  importedData.brands = (importedData.brands || []).filter((b) => b.id !== id);
  if (brand.type === "own") ownData.brands.push(brand);
  else importedData.brands.push(brand);
  await putJson("/api/brands-content", ownData);
  await putJson("/api/imported-content", importedData);

  const catalogData = await fetchJson("/api/catalog-content");
  catalogData.brands = catalogData.brands || [];
  const filterIdx = catalogData.brands.findIndex((b) => b.id === id);
  const filterEntry = { id, label: brand.nameKo, labelEn: brand.nameEn || brand.nameKo };
  if (filterIdx >= 0) catalogData.brands[filterIdx] = filterEntry;
  else catalogData.brands.push(filterEntry);
  await putJson("/api/catalog-content", catalogData);

  const homeData = await fetchJson("/api/content");
  homeData.brands = homeData.brands || [];
  const homeIdx = homeData.brands.findIndex((b) => b.href === `brands.html#${id}`);
  if (brand.type === "own") {
    const teaser = {
      name: brand.nameKo,
      nameEn: brand.nameEn,
      tagline: brand.descriptionKo,
      taglineEn: brand.descriptionEn,
      logo: brand.logo,
      href: `brands.html#${id}`,
    };
    if (homeIdx >= 0) homeData.brands[homeIdx] = teaser;
    else homeData.brands.push(teaser);
  } else if (homeIdx >= 0) {
    homeData.brands.splice(homeIdx, 1);
  }
  await putJson("/api/content", homeData);

  return id;
}

async function deleteBrand(id) {
  const ownData = await fetchJson("/api/brands-content");
  const importedData = await fetchJson("/api/imported-content");
  ownData.brands = (ownData.brands || []).filter((b) => b.id !== id);
  importedData.brands = (importedData.brands || []).filter((b) => b.id !== id);
  await putJson("/api/brands-content", ownData);
  await putJson("/api/imported-content", importedData);

  const catalogData = await fetchJson("/api/catalog-content");
  catalogData.brands = (catalogData.brands || []).filter((b) => b.id !== id);
  await putJson("/api/catalog-content", catalogData);

  const homeData = await fetchJson("/api/content");
  homeData.brands = (homeData.brands || []).filter((b) => b.href !== `brands.html#${id}`);
  await putJson("/api/content", homeData);
}

function openBrandEditModal(brand, panel) {
  const fields = buildBrandFields(brand);
  openModal("✏️ 브랜드 정보 수정", fields.container, async () => {
    const err = fields.validate();
    if (err) throw new Error(err);
    await upsertBrand(fields, brand.id);
    renderAddBrandForm(panel);
  });
}

async function renderAddBrandForm(panel) {
  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "admin-loading", text: "불러오는 중..." }));

  const [ownData, importedData] = await Promise.all([
    fetchJson("/api/brands-content").catch(() => ({ brands: [] })),
    fetchJson("/api/imported-content").catch(() => ({ brands: [] })),
  ]);
  panel.innerHTML = "";

  const fields = buildBrandFields(null);
  const status = el("div", { class: "editor-status" });
  const submitBtn = el("button", { class: "submit-btn", type: "button", text: "+ 신규 브랜드 등록 완료" });
  submitBtn.addEventListener("click", async () => {
    const err = fields.validate();
    if (err) {
      status.textContent = err;
      status.className = "editor-status error";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";
    status.textContent = "";
    status.className = "editor-status";
    try {
      await upsertBrand(fields, null);
      status.textContent = "브랜드가 등록되었습니다. 모든 방문자에게 즉시 반영됩니다.";
      status.className = "editor-status success";
      fields.reset();
      renderAddBrandForm(panel);
    } catch (e) {
      status.textContent = "등록 실패: " + e.message;
      status.className = "editor-status error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "+ 신규 브랜드 등록 완료";
    }
  });

  panel.appendChild(
    el("div", { class: "admin-form" }, [
      el("h3", { class: "media-manager-title", text: "🏷️ 브랜드 정보 입력" }),
      fields.container,
      submitBtn,
      status,
    ])
  );

  const allBrands = [
    ...(ownData.brands || []).map((b) => ({ ...b, type: "own" })),
    ...(importedData.brands || []).map((b) => ({ ...b, type: "imported" })),
  ];
  const listWrap = el("div", { class: "admin-list-panel" });
  listWrap.appendChild(el("h3", { class: "media-manager-title", text: `📋 등록된 브랜드 목록 (${allBrands.length}개)` }));
  const list = el("div", { class: "admin-item-list" });
  allBrands.forEach((b) => {
    const editBtn = el("button", { class: "mini-btn", type: "button", text: "✏️ 수정" });
    editBtn.addEventListener("click", () => openBrandEditModal(b, panel));
    const delBtn = el("button", { class: "mini-btn danger", type: "button", text: "🗑 삭제" });
    delBtn.addEventListener("click", async () => {
      if (!confirm(`'${b.nameKo}' 브랜드를 삭제할까요?`)) return;
      await deleteBrand(b.id);
      renderAddBrandForm(panel);
    });
    list.appendChild(
      el("div", { class: "admin-item-row" }, [
        el("div", { class: "admin-item-thumb" }, b.logo ? [el("img", { src: b.logo, alt: "" })] : []),
        el("div", { class: "admin-item-info" }, [
          el("div", { class: "admin-item-title" }, [
            document.createTextNode(`${b.nameKo} (${b.nameEn || ""}) `),
            el("span", { class: "admin-badge " + (b.type === "own" ? "badge-own" : "badge-imported"), text: b.type === "own" ? "자사브랜드" : "수입브랜드" }),
          ]),
          el("div", { class: "admin-item-sub", text: b.tagline || "" }),
        ]),
        el("div", { class: "admin-item-actions" }, [editBtn, delBtn]),
      ])
    );
  });
  listWrap.appendChild(list);
  panel.appendChild(listWrap);
}

// ---------- Product form (shared by add + edit) ----------
function buildProductFields(prefill, allBrands, categories) {
  const p = prefill || {};
  const brandSelect = el(
    "select",
    {},
    [el("option", { value: "", text: "-- 브랜드 선택 --" }), ...allBrands.map((b) => el("option", { value: b.id, text: b.nameKo }))]
  );
  brandSelect.value = p.brandId || "";
  const categorySelect = el("select", {}, categories.map((c) => el("option", { value: c.id, text: c.label })));
  if (p.category) categorySelect.value = p.category;
  const nameKo = el("input", { type: "text", placeholder: "예: 데이스포 프레시 츄르 연어", value: p.nameKo || "" });
  const nameEn = el("input", { type: "text", placeholder: "예: Dayspo Fresh Churu Salmon", value: p.nameEn || "" });
  const petType = el("select", {}, [
    el("option", { value: "dog", text: "강아지 (Dog)" }),
    el("option", { value: "cat", text: "고양이 (Cat)" }),
    el("option", { value: "all", text: "공통 (All)" }),
  ]);
  petType.value = p.petType || "dog";
  const spec = el("input", { type: "text", placeholder: "예: 1.2kg (200g * 6)", value: p.spec || "" });
  const code = el("input", { type: "text", placeholder: "예: 8809565905407", value: p.code || "" });

  const mainImage = el("input", { type: "file", accept: "image/*" });
  let mainPreview = imagePreview(p.image);
  const mainPreviewSlot = el("div", {}, [mainPreview]);
  mainImage.addEventListener("change", () => {
    const f = mainImage.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const fresh = imagePreview(reader.result);
      mainPreview.replaceWith(fresh);
      mainPreview = fresh;
    };
    reader.readAsDataURL(f);
  });
  let currentImage = p.image || "";

  const detailImages = el("input", { type: "file", accept: "image/*", multiple: true });
  const detailPreview = el("div", { class: "image-preview-row" }, (p.detailImages || []).map((src) => el("img", { src, alt: "" })));
  let currentDetailImages = p.detailImages || [];

  const buyLink = el("input", { type: "text", placeholder: "https://...", value: p.buyLink || "" });
  const features = el("textarea", {
    rows: 4,
    placeholder: "예:\n· 생후 2개월 이상 전연령 반려견 사료\n· 가수분해 오리 원료 사용\n· 관절 건강에 도움을 주는 초유 첨가",
    text: (p.features || []).join("\n"),
  });
  const ingredients = el("textarea", { rows: 3, placeholder: "사용된 상세 원료와 성분 정보를 작성해주세요.", text: p.ingredients || "" });
  const shelfLife = el("input", { type: "text", value: p.shelfLife || "제조일로부터 18개월까지" });
  const origin = el("input", { type: "text", value: p.origin || "대한민국" });

  const container = el("div", { class: "admin-form" }, [
    el("div", { class: "form-row-2" }, [formField("소속 브랜드 선택", brandSelect, true), formField("제품 카테고리", categorySelect, true)]),
    el("div", { class: "form-row-2" }, [formField("제품명 (한글)", nameKo, true), formField("제품명 (영문)", nameEn)]),
    el("div", { class: "form-row-3" }, [formField("반려동물 구분", petType), formField("제품 규격 / 용량", spec), formField("상품 바코드 / 코드", code)]),
    formField("제품 대표 이미지 첨부", mainImage),
    mainPreviewSlot,
    formField("상세정보 페이지 이미지 첨부 (여러 장 가능)", detailImages),
    detailPreview,
    formField("바로 구매하기 링크 (URL)", buyLink),
    formField("제품 주요 특징 (줄바꿈으로 구분)", features),
    el("div", { class: "form-row-2" }, [formField("유통기한", shelfLife), formField("제조국 / 원산지", origin)]),
    formField("원료 정보", ingredients),
  ]);

  return {
    container,
    validate() {
      return brandSelect.value && nameKo.value.trim() ? null : "소속 브랜드와 제품명(한글)은 필수입니다.";
    },
    async getProduct() {
      let image = currentImage;
      if (mainImage.files[0]) {
        const { url } = await uploadImage(mainImage.files[0]);
        image = url;
      }
      let detailUrls = currentDetailImages;
      if (detailImages.files.length) {
        detailUrls = [];
        for (const f of detailImages.files) {
          const { url } = await uploadImage(f);
          detailUrls.push(url);
        }
      }
      return {
        nameKo: nameKo.value.trim(),
        nameEn: nameEn.value.trim(),
        brandId: brandSelect.value,
        code: code.value.trim(),
        spec: spec.value.trim(),
        shelfLife: shelfLife.value.trim(),
        shelfLifeEn: p.shelfLifeEn || "18 months from manufacture date",
        features: features.value
          .split("\n")
          .map((s) => s.replace(/^[·\-•]\s*/, "").trim())
          .filter(Boolean),
        ingredients: ingredients.value.trim(),
        origin: origin.value.trim(),
        originEn: p.originEn || "Republic of Korea",
        category: categorySelect.value,
        petType: petType.value,
        image,
        detailImages: detailUrls,
        buyLink: buyLink.value.trim(),
        nutrition: p.nutrition,
      };
    },
    reset() {
      nameKo.value = "";
      nameEn.value = "";
      spec.value = "";
      code.value = "";
      buyLink.value = "";
      features.value = "";
      ingredients.value = "";
      mainImage.value = "";
      detailImages.value = "";
      currentImage = "";
      currentDetailImages = [];
      const fresh = imagePreview("");
      mainPreview.replaceWith(fresh);
      mainPreview = fresh;
      detailPreview.innerHTML = "";
      shelfLife.value = "제조일로부터 18개월까지";
      origin.value = "대한민국";
    },
  };
}

async function upsertProduct(fields, existingId) {
  const data = await fields.getProduct();
  const id = existingId || slugify(data.nameEn || data.nameKo);
  const product = { id, ...data };
  const catalogData = await fetchJson("/api/catalog-content");
  catalogData.products = catalogData.products || [];
  const idx = catalogData.products.findIndex((x) => x.id === id);
  if (idx >= 0) catalogData.products[idx] = product;
  else catalogData.products.push(product);
  await putJson("/api/catalog-content", catalogData);
  return id;
}

async function deleteProduct(id) {
  const catalogData = await fetchJson("/api/catalog-content");
  catalogData.products = (catalogData.products || []).filter((p) => p.id !== id);
  await putJson("/api/catalog-content", catalogData);
}

function openProductEditModal(product, allBrands, categories, panel) {
  const fields = buildProductFields(product, allBrands, categories);
  openModal("✏️ 제품 정보 전체 수정", fields.container, async () => {
    const err = fields.validate();
    if (err) throw new Error(err);
    await upsertProduct(fields, product.id);
    renderAddProductForm(panel);
  });
}

async function renderAddProductForm(panel) {
  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "admin-loading", text: "불러오는 중..." }));

  const [ownBrands, importedBrands, catalogData] = await Promise.all([
    fetchJson("/api/brands-content").catch(() => ({ brands: [] })),
    fetchJson("/api/imported-content").catch(() => ({ brands: [] })),
    fetchJson("/api/catalog-content"),
  ]);
  panel.innerHTML = "";
  const allBrands = [...(ownBrands.brands || []), ...(importedBrands.brands || [])];
  const brandLabel = Object.fromEntries(allBrands.map((b) => [b.id, b.nameKo]));
  const categories = (catalogData.categories || []).filter((c) => c.id !== "all");
  const products = catalogData.products || [];

  const fields = buildProductFields(null, allBrands, categories);
  const status = el("div", { class: "editor-status" });
  const submitBtn = el("button", { class: "submit-btn", type: "button", text: "📦 신규 제품 등록 완료" });
  submitBtn.addEventListener("click", async () => {
    const err = fields.validate();
    if (err) {
      status.textContent = err;
      status.className = "editor-status error";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";
    status.textContent = "";
    status.className = "editor-status";
    try {
      await upsertProduct(fields, null);
      status.textContent = "제품이 등록되었습니다. 모든 방문자에게 즉시 반영됩니다.";
      status.className = "editor-status success";
      fields.reset();
      renderAddProductForm(panel);
    } catch (e) {
      status.textContent = "등록 실패: " + e.message;
      status.className = "editor-status error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "📦 신규 제품 등록 완료";
    }
  });

  panel.appendChild(
    el("div", { class: "admin-form" }, [
      el("h3", { class: "media-manager-title", text: "📦 신제품 정보 입력" }),
      fields.container,
      submitBtn,
      status,
    ])
  );

  const listWrap = el("div", { class: "admin-list-panel" });
  listWrap.appendChild(el("h3", { class: "media-manager-title", text: `📋 등록된 제품 목록 (${products.length}개)` }));
  const brandFilter = el(
    "select",
    {},
    [el("option", { value: "", text: "전체 브랜드" }), ...allBrands.map((b) => el("option", { value: b.id, text: b.nameKo }))]
  );
  const search = el("input", { type: "text", placeholder: "제품명 검색..." });
  const list = el("div", { class: "admin-item-list" });

  function renderList() {
    list.innerHTML = "";
    const q = search.value.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (brandFilter.value && p.brandId !== brandFilter.value) return false;
      if (q && !`${p.nameKo} ${p.nameEn || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    filtered.forEach((p) => {
      const editBtn = el("button", { class: "mini-btn", type: "button", text: "✏️ 수정" });
      editBtn.addEventListener("click", () => openProductEditModal(p, allBrands, categories, panel));
      const delBtn = el("button", { class: "mini-btn danger", type: "button", text: "🗑 삭제" });
      delBtn.addEventListener("click", async () => {
        if (!confirm(`'${p.nameKo}' 제품을 삭제할까요?`)) return;
        await deleteProduct(p.id);
        renderAddProductForm(panel);
      });
      list.appendChild(
        el("div", { class: "admin-item-row" }, [
          el("div", { class: "admin-item-thumb" }, p.image ? [el("img", { src: p.image, alt: "" })] : []),
          el("div", { class: "admin-item-info" }, [
            el("div", { class: "admin-item-title", text: p.nameKo }),
            el("div", { class: "admin-item-sub", text: `${brandLabel[p.brandId] || p.brandId} · ${p.category} · ${p.code || ""}` }),
          ]),
          el("div", { class: "admin-item-actions" }, [editBtn, delBtn]),
        ])
      );
    });
  }
  brandFilter.addEventListener("change", renderList);
  search.addEventListener("input", renderList);
  listWrap.appendChild(el("div", { class: "list-toolbar" }, [brandFilter, search]));
  listWrap.appendChild(list);
  panel.appendChild(listWrap);
  renderList();
}

async function loadSection(id) {
  if (id === "add-brand") return renderAddBrandForm(qs("#editor-panel"));
  if (id === "add-product") return renderAddProductForm(qs("#editor-panel"));

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
