let lang = "ko";

function renderPageHero(data) {
  const root = document.getElementById("page-hero-root");
  if (data.image) root.querySelector("img.hero-bg").src = data.image;
  root.querySelector(".eyebrow span").textContent = t(data, "eyebrow", lang);
  root.querySelector("h1").textContent = t(data, "title", lang);
  root.querySelector(".hero-body").textContent = t(data, "body", lang);
}

function openLightbox(src, alt, caption) {
  const box = document.getElementById("image-lightbox");
  const img = document.getElementById("lightbox-img");
  img.src = src;
  img.alt = alt || "";
  document.getElementById("lightbox-caption-title").textContent = caption || alt || "";
  box.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const box = document.getElementById("image-lightbox");
  box.classList.remove("open");
  document.body.style.overflow = "";
}

function setupLightbox() {
  const box = document.getElementById("image-lightbox");
  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  box.addEventListener("click", (e) => {
    if (e.target === box) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
}

const CERT_LOGO_MAP = {
  "ISO 14001": "assets/cert_logos/iso14001.png",
  "ISO 22000": "assets/cert_logos/iso22000.png",
  "HACCP": "assets/cert_logos/haccp.png",
  "AAFCO": "assets/cert_logos/aafco.png",
};

function renderCertifications(intro, list) {
  document.querySelector("#cert-root .bm-trust-title").textContent = t(intro, "title");
  document.querySelector("#cert-root .bm-trust-desc").textContent = t(intro, "body");
  const grid = document.getElementById("cert-grid");
  grid.innerHTML = "";
  list.forEach((c) => {
    const logo = CERT_LOGO_MAP[c.code];
    const badgeClass = "bm-cert-logo-badge" + (c.code === "AAFCO" ? " aafco" : "");
    const currentImg = (lang === "en" && c.imageEn) || c.image;
    const card = el("div", { class: "bm-cert-card" + (currentImg ? " clickable" : ""), "data-reveal": "" }, [
      el("div", { class: "bm-cert-badge-wrap" }, [
        el("span", { class: "bm-cert-code", text: c.code }),
        el("div", { class: badgeClass }, logo ? [el("img", { src: logo, alt: c.code })] : []),
      ]),
      el("h3", { class: "bm-cert-card-title", text: t(c, "title") }),
      el("p", { class: "bm-cert-card-desc", text: t(c, "body") }),
    ]);
    if (currentImg) card.addEventListener("click", () => openLightbox(currentImg, c.code, `${c.code} — ${t(c, "title")}`));
    grid.appendChild(card);
  });
}

function renderPatents(intro, list) {
  document.querySelector("#ip-root .section-title").textContent = t(intro, "title");
  document.querySelector("#ip-root .section-body").textContent = t(intro, "body");
  const grid = document.getElementById("patent-grid");
  grid.innerHTML = "";
  // 등록 종류는 데이터에 한글로만 들어있어서, 영어 모드 표시용 라벨을 여기서 매핑한다
  const typeEnMap = { "특허": "Patent", "디자인등록": "Design Registration" };
  list.forEach((p) => {
    const typeLabel = currentLang() === "en" ? typeEnMap[p.type] || p.type : p.type;
    const card = el("div", { class: "patent-card", "data-reveal": "" }, [
      el("div", { class: "thumb" }, [el("img", { src: p.image, alt: t(p, "title"), loading: "lazy" })]),
      el("div", { class: "cap" }, [
        el("div", { class: "type", text: `${typeLabel} ${p.number}` }),
        el("div", { class: "num", text: t(p, "title") }),
      ]),
    ]);
    if (p.image) {
      card.classList.add("clickable");
      card.addEventListener("click", () => openLightbox(p.image, t(p, "title")));
    }
    grid.appendChild(card);
  });
}

function renderExhibitions(intro, list) {
  document.querySelector("#expo-root .section-title").textContent = t(intro, "title");
  const root = document.getElementById("expo-list");
  root.innerHTML = "";
  list.forEach((expo) => {
    root.appendChild(
      el("div", { class: "expo-block", "data-reveal": "" }, [
        el("div", { class: "expo-head" }, [
          el("h3", { text: t(expo, "title") }),
          el("span", { class: "expo-location", text: t(expo, "location") }),
        ]),
        el(
          "div",
          { class: "expo-gallery" },
          expo.photos.map((src) => el("div", { class: "expo-photo" }, [el("img", { src, alt: t(expo, "title"), loading: "lazy" })]))
        ),
      ])
    );
  });
}

function renderLogoSection(rootId, gridId, intro, list, muted) {
  const root = document.getElementById(rootId);
  root.querySelector(".section-title").textContent = t(intro, "title");
  const bodyEl = root.querySelector(".section-body");
  if (bodyEl) bodyEl.textContent = t(intro, "body");
  const grid = document.getElementById(gridId);
  grid.innerHTML = "";
  list.forEach((item) => {
    grid.appendChild(
      item.logo
        ? el("div", { class: "logo-card" + (muted ? " muted" : "") }, [el("img", { src: item.logo, alt: item.name, loading: "lazy" })])
        : el("div", { class: "logo-card placeholder" }, [el("span", { text: lang === "en" ? "Logo coming soon" : "로고 추가 예정" })])
    );
  });
}

function render(content, newLang) {
  lang = newLang;
  renderFooter(content.footer, lang);
  renderPageHero(content.hero);
  renderCertifications(content.certIntro, content.certifications);
  renderPatents(content.ipIntro, content.patents);
  renderExhibitions(content.expoIntro, content.exhibitions);
  renderLogoSection("retail-root", "retail-grid", content.retailIntro, content.retailers, false);
  renderLogoSection("distributors-root", "distributor-grid", content.distributorIntro, content.distributors, true);
  observeReveals();
}

(async function init() {
  setupHeaderScroll();
  setupLightbox();
  const content = await loadContent("/api/trust-content", "content/trust.json");
  setupLangToggle((newLang) => render(content, newLang));
})();
