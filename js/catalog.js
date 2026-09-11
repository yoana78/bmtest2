const NUTRITION_LABELS = { protein: "조단백", fat: "조지방", fiber: "조섬유", moisture: "수분" };
const NUTRITION_LABELS_EN = { protein: "Crude Protein", fat: "Crude Fat", fiber: "Crude Fiber", moisture: "Moisture" };

let allProducts = [];
let brandLabels = {};
let activeCategory = "all";
let activeBrand = "all";
let lang = "ko";

function renderPageHero(data) {
  const root = document.getElementById("page-hero-root");
  if (data.image) root.querySelector("img.hero-bg").src = data.image;
  root.querySelector(".eyebrow span").textContent = data.eyebrow;
  root.querySelector("h1").textContent = t(data, "title", lang);
  root.querySelector(".hero-body").textContent = t(data, "body", lang);
}

function buildFilters(categories, brands) {
  const catRow = document.getElementById("category-filter-row");
  catRow.innerHTML = "";
  categories.forEach((c) => catRow.appendChild(chip(t(c, "label", lang), c.id, activeCategory, setCategory)));

  const brandRow = document.getElementById("brand-filter-row");
  brandRow.innerHTML = "";
  brands.forEach((b) => brandRow.appendChild(chip(t(b, "label", lang), b.id, activeBrand, setBrand)));
}

function chip(label, value, active, onClick) {
  const btn = el("button", { class: "filter-chip" + (value === active ? " active" : ""), type: "button", text: label });
  btn.addEventListener("click", () => onClick(value));
  return btn;
}

function setCategory(id) {
  activeCategory = id;
  refresh();
}
function setBrand(id) {
  activeBrand = id;
  refresh();
}
function refresh() {
  buildFiltersActiveState();
  renderGrid();
}
function buildFiltersActiveState() {
  document.querySelectorAll("#category-filter-row .filter-chip").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent === labelFor("category", activeCategory));
  });
  document.querySelectorAll("#brand-filter-row .filter-chip").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent === labelFor("brand", activeBrand));
  });
}
function labelFor(kind, id) {
  const list = kind === "category" ? window.__catalogCategories : window.__catalogBrands;
  const found = (list || []).find((x) => x.id === id);
  return found ? t(found, "label", lang) : "";
}

function renderGrid() {
  const filtered = allProducts.filter(
    (p) => (activeCategory === "all" || p.category === activeCategory) && (activeBrand === "all" || p.brandId === activeBrand)
  );
  document.getElementById("catalog-count").textContent = `TOTAL ${filtered.length} PRODUCTS`;
  const grid = document.getElementById("catalog-grid");
  grid.innerHTML = "";
  if (filtered.length === 0) {
    grid.appendChild(el("div", { class: "catalog-empty", text: lang === "en" ? "No products match this filter." : "조건에 맞는 제품이 없습니다." }));
    return;
  }
  filtered.forEach((p) => {
    const name = lang === "en" ? p.nameEn : p.nameKo;
    const card = el("div", { class: "product-card", "data-reveal": "" }, [
      el("div", { class: "thumb" }, [el("img", { src: p.image, alt: name, loading: "lazy" })]),
      el("div", { class: "info" }, [
        el("div", { class: "brand-tag", text: brandLabels[p.brandId] || p.brandId }),
        el("h4", { text: name }),
        el("div", { class: "spec", text: p.spec }),
      ]),
    ]);
    card.addEventListener("click", () => openModal(p));
    grid.appendChild(card);
  });
  observeReveals();
}

function openModal(p) {
  const modal = document.getElementById("product-modal");
  const sheet = modal.querySelector(".sheet");
  sheet.innerHTML = "";
  const closeBtn = el("button", { class: "close-btn", type: "button", "aria-label": "닫기", html: "&times;" });
  closeBtn.addEventListener("click", closeModal);
  sheet.appendChild(closeBtn);

  const nutrition = p.nutrition || {};
  const showNutrition =
    (p.category === "사료" || p.category === "간식") &&
    (nutrition.protein || nutrition.fat || nutrition.fiber || nutrition.moisture);
  const nutritionLabels = lang === "en" ? NUTRITION_LABELS_EN : NUTRITION_LABELS;
  const nutritionGrid = showNutrition
    ? el(
        "div",
        { class: "pd-nutrition" },
        Object.keys(nutritionLabels).map((key) =>
          el("div", {}, [el("div", { class: "label", text: nutritionLabels[key] }), el("div", { class: "value", text: nutrition[key] || "-" })])
        )
      )
    : null;

  const name = lang === "en" ? p.nameEn : p.nameKo;
  const subName = lang === "en" ? p.nameKo : p.nameEn;
  // 영문 특징이 아직 없는 제품은 한글 특징이라도 보여준다 (영어 모드에서 목록이 통째로 사라지지 않도록)
  const features = (lang === "en" ? (p.featuresEn?.length ? p.featuresEn : p.features) : p.features) || [];
  const origin = lang === "en" ? p.originEn || p.origin : p.origin;
  const shelfLife = lang === "en" ? p.shelfLifeEn || p.shelfLife : p.shelfLife;
  const ingredients = lang === "en" ? p.ingredientsEn || p.ingredients : p.ingredients;
  const labels =
    lang === "en"
      ? { spec: "Spec", origin: "Origin", shelfLife: "Shelf life", ingredients: "Ingredients" }
      : { spec: "규격", origin: "원산지", shelfLife: "유통기한", ingredients: "원료" };

  const nameEl = el("h2", { text: name });

  sheet.appendChild(
    el("div", { class: "product-detail" }, [
      el("div", { class: "pd-media" }, [el("img", { src: p.image, alt: name })]),
      el("div", { class: "pd-body" }, [
        el("div", { class: "brand-tag", text: brandLabels[p.brandId] || p.brandId }),
        nameEl,
        el("div", { class: "en-name", text: subName }),
        el("div", { class: "meta-row" }, [
          el("span", { html: `<strong>${labels.spec}</strong> ${p.spec}` }),
          el("span", { html: `<strong>${labels.origin}</strong> ${origin}` }),
          el("span", { html: `<strong>${labels.shelfLife}</strong> ${shelfLife}` }),
        ]),
        features.length ? el("ul", { class: "pd-features" }, features.map((f) => el("li", { text: f }))) : null,
        nutritionGrid,
        el("div", { class: "pd-ingredients" }, [el("strong", { text: labels.ingredients }), document.createTextNode(ingredients || "-")]),
        p.detailImages && p.detailImages.length
          ? el(
              "div",
              { class: "pd-detail-images" },
              p.detailImages.map((src) => el("a", { href: src, target: "_blank", rel: "noopener" }, [el("img", { src, alt: name, loading: "lazy" })]))
            )
          : null,
        p.buyLink
          ? el("a", { class: "pd-buy-link", href: p.buyLink, target: "_blank", rel: "noopener", text: lang === "en" ? "Buy Now →" : "바로 구매하기 →" })
          : null,
      ]),
    ])
  );

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  shrinkToFit(nameEl, 22, 14);
}

// Shrinks font-size step by step until the text fits on one line, so long
// product names (especially in English) don't wrap awkwardly in the
// fixed-width detail panel.
function shrinkToFit(node, maxSize, minSize) {
  node.style.whiteSpace = "nowrap";
  let size = maxSize;
  node.style.fontSize = size + "px";
  while (node.scrollWidth > node.clientWidth && size > minSize) {
    size -= 1;
    node.style.fontSize = size + "px";
  }
  if (node.scrollWidth > node.clientWidth) {
    node.style.whiteSpace = "normal";
  }
}

function closeModal() {
  const modal = document.getElementById("product-modal");
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

function render(content, newLang) {
  lang = newLang;
  renderFooter(content.footer, lang);
  renderPageHero(content.hero);
  allProducts = content.products;
  brandLabels = Object.fromEntries(content.brands.filter((b) => b.id !== "all").map((b) => [b.id, t(b, "label", lang)]));
  window.__catalogCategories = content.categories;
  window.__catalogBrands = content.brands;

  const params = new URLSearchParams(location.search);
  const requestedBrand = params.get("brand");
  if (requestedBrand && content.brands.some((b) => b.id === requestedBrand)) activeBrand = requestedBrand;

  buildFilters(content.categories, content.brands);
  buildFiltersActiveState();
  renderGrid();
}

(async function init() {
  setupHeaderScroll();
  const content = await loadContent("/api/catalog-content", "content/catalog.json");
  setupLangToggle((newLang) => render(content, newLang));

  const modal = document.getElementById("product-modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
})();
