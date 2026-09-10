const SECTIONS = [
  { id: "add-brand", label: "브랜드 추가 등록" },
  { id: "add-product", label: "신규 제품 추가" },
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

function renderAddBrandForm(panel) {
  panel.innerHTML = "";
  const nameKo = el("input", { type: "text", placeholder: "예: 웰젠, 부명케어" });
  const nameEn = el("input", { type: "text", placeholder: "예: WELLZEN" });
  const typeOwn = el("input", { type: "radio", name: "brand-type", value: "own", checked: true });
  const typeImported = el("input", { type: "radio", name: "brand-type", value: "imported" });
  const tagline = el("input", { type: "text", placeholder: "예: Healthy & Happy Pet Care" });
  const descKo = el("textarea", { rows: 2, placeholder: "브랜드에 대한 간단한 소개를 입력하세요." });
  const descEn = el("textarea", { rows: 2, placeholder: "Enter brand description in English." });
  const color = el("input", { type: "color", value: "#0066b3" });
  const colorText = el("input", { type: "text", value: "#0066B3" });
  color.addEventListener("input", () => (colorText.value = color.value.toUpperCase()));
  colorText.addEventListener("change", () => {
    if (/^#[0-9a-fA-F]{6}$/.test(colorText.value)) color.value = colorText.value;
  });
  const logoFile = el("input", { type: "file", accept: "image/*" });
  const status = el("div", { class: "editor-status" });
  const submitBtn = el("button", { class: "submit-btn", type: "button", text: "+ 신규 브랜드 등록 완료" });

  submitBtn.addEventListener("click", async () => {
    if (!nameKo.value.trim()) {
      status.textContent = "브랜드명(한글)은 필수입니다.";
      status.className = "editor-status error";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "등록 중...";
    status.textContent = "";
    status.className = "editor-status";
    try {
      const type = typeImported.checked ? "imported" : "own";
      let logo = "";
      if (logoFile.files[0]) {
        const { url } = await uploadImage(logoFile.files[0]);
        logo = url;
      }
      const id = slugify(nameEn.value || nameKo.value);
      const brand = {
        id,
        nameKo: nameKo.value.trim(),
        nameEn: nameEn.value.trim(),
        tagline: tagline.value.trim(),
        logo,
        descriptionKo: descKo.value.trim(),
        descriptionEn: descEn.value.trim(),
        color: colorText.value,
        type,
      };

      const endpoint = type === "own" ? "/api/brands-content" : "/api/imported-content";
      const brandData = await fetchJson(endpoint);
      brandData.brands = brandData.brands || [];
      brandData.brands.push(brand);
      await putJson(endpoint, brandData);

      // Keep the catalog's brand filter chips in sync so the new brand is
      // selectable when adding products.
      const catalogData = await fetchJson("/api/catalog-content");
      catalogData.brands = catalogData.brands || [];
      if (!catalogData.brands.some((b) => b.id === id)) {
        catalogData.brands.push({ id, label: brand.nameKo, labelEn: brand.nameEn || brand.nameKo });
        await putJson("/api/catalog-content", catalogData);
      }

      // Only in-house brands get a teaser card on the homepage.
      if (type === "own") {
        const homeData = await fetchJson("/api/content");
        homeData.brands = homeData.brands || [];
        homeData.brands.push({
          name: brand.nameKo,
          nameEn: brand.nameEn,
          tagline: brand.descriptionKo,
          taglineEn: brand.descriptionEn,
          logo: brand.logo,
          href: `brands.html#${id}`,
        });
        await putJson("/api/content", homeData);
      }

      status.textContent = "브랜드가 등록되었습니다. 모든 방문자에게 즉시 반영됩니다.";
      status.className = "editor-status success";
      nameKo.value = "";
      nameEn.value = "";
      tagline.value = "";
      descKo.value = "";
      descEn.value = "";
      logoFile.value = "";
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
      submitBtn,
      status,
    ])
  );
}

function renderAddProductForm(panel) {
  panel.innerHTML = "";
  panel.appendChild(el("p", { class: "admin-loading", text: "불러오는 중..." }));

  Promise.all([
    fetchJson("/api/brands-content").catch(() => ({ brands: [] })),
    fetchJson("/api/imported-content").catch(() => ({ brands: [] })),
    fetchJson("/api/catalog-content"),
  ]).then(([ownBrands, importedBrands, catalogData]) => {
    panel.innerHTML = "";
    const allBrands = [...(ownBrands.brands || []), ...(importedBrands.brands || [])];
    const categories = (catalogData.categories || []).filter((c) => c.id !== "all");

    const brandSelect = el(
      "select",
      {},
      [el("option", { value: "", text: "-- 브랜드 선택 --" }), ...allBrands.map((b) => el("option", { value: b.id, text: b.nameKo }))]
    );
    const categorySelect = el(
      "select",
      {},
      categories.map((c) => el("option", { value: c.id, text: c.label }))
    );
    const nameKo = el("input", { type: "text", placeholder: "예: 데이스포 프레시 츄르 연어" });
    const nameEn = el("input", { type: "text", placeholder: "예: Dayspo Fresh Churu Salmon" });
    const petType = el("select", {}, [
      el("option", { value: "dog", text: "강아지 (Dog)" }),
      el("option", { value: "cat", text: "고양이 (Cat)" }),
      el("option", { value: "all", text: "공통 (All)" }),
    ]);
    const spec = el("input", { type: "text", placeholder: "예: 1.2kg (200g * 6)" });
    const code = el("input", { type: "text", placeholder: "예: 8809565905407" });
    const mainImage = el("input", { type: "file", accept: "image/*" });
    const detailImages = el("input", { type: "file", accept: "image/*", multiple: true });
    const buyLink = el("input", { type: "text", placeholder: "https://..." });
    const features = el("textarea", { rows: 4, placeholder: "예:\n· 생후 2개월 이상 전연령 반려견 사료\n· 가수분해 오리 원료 사용\n· 관절 건강에 도움을 주는 초유 첨가" });
    const ingredients = el("textarea", { rows: 3, placeholder: "사용된 상세 원료와 성분 정보를 작성해주세요." });
    const status = el("div", { class: "editor-status" });
    const submitBtn = el("button", { class: "submit-btn", type: "button", text: "📦 신규 제품 등록 완료" });

    submitBtn.addEventListener("click", async () => {
      if (!brandSelect.value || !nameKo.value.trim()) {
        status.textContent = "소속 브랜드와 제품명(한글)은 필수입니다.";
        status.className = "editor-status error";
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "등록 중...";
      status.textContent = "";
      status.className = "editor-status";
      try {
        let image = "";
        if (mainImage.files[0]) {
          const { url } = await uploadImage(mainImage.files[0]);
          image = url;
        }
        const detailUrls = [];
        for (const file of detailImages.files) {
          const { url } = await uploadImage(file);
          detailUrls.push(url);
        }
        const id = slugify(nameEn.value || nameKo.value);
        const product = {
          id,
          nameKo: nameKo.value.trim(),
          nameEn: nameEn.value.trim(),
          brandId: brandSelect.value,
          code: code.value.trim(),
          spec: spec.value.trim(),
          shelfLife: "제조일로부터 18개월까지",
          shelfLifeEn: "18 months from manufacture date",
          features: features.value
            .split("\n")
            .map((s) => s.replace(/^[·\-•]\s*/, "").trim())
            .filter(Boolean),
          ingredients: ingredients.value.trim(),
          origin: "대한민국",
          originEn: "Republic of Korea",
          category: categorySelect.value,
          petType: petType.value,
          image,
          detailImages: detailUrls,
          buyLink: buyLink.value.trim(),
        };

        const fresh = await fetchJson("/api/catalog-content");
        fresh.products = fresh.products || [];
        fresh.products.push(product);
        await putJson("/api/catalog-content", fresh);

        status.textContent = "제품이 등록되었습니다. 모든 방문자에게 즉시 반영됩니다.";
        status.className = "editor-status success";
        nameKo.value = "";
        nameEn.value = "";
        spec.value = "";
        code.value = "";
        buyLink.value = "";
        features.value = "";
        ingredients.value = "";
        mainImage.value = "";
        detailImages.value = "";
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
        el("div", { class: "form-row-2" }, [formField("소속 브랜드 선택", brandSelect, true), formField("제품 카테고리", categorySelect, true)]),
        el("div", { class: "form-row-2" }, [formField("제품명 (한글)", nameKo, true), formField("제품명 (영문)", nameEn)]),
        el("div", { class: "form-row-3" }, [formField("반려동물 구분", petType), formField("제품 규격 / 용량", spec), formField("상품 바코드 / 코드", code)]),
        formField("제품 대표 이미지 첨부", mainImage),
        formField("상세정보 페이지 이미지 첨부 (여러 장 가능)", detailImages),
        formField("바로 구매하기 링크 (URL)", buyLink),
        formField("제품 주요 특징 (줄바꿈으로 구분)", features),
        formField("원료 및 원산지/유통기한 정보", ingredients),
        submitBtn,
        status,
      ])
    );
  });
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
