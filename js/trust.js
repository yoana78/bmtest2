let lang = "ko";

function renderPageHero(data) {
  const root = document.getElementById("page-hero-root");
  if (data.image) root.querySelector("img.hero-bg").src = data.image;
  root.querySelector(".eyebrow span").textContent = t(data, "eyebrow", lang);
  root.querySelector("h1").textContent = t(data, "title", lang);
  root.querySelector(".hero-body").textContent = t(data, "body", lang);
}

function openLightbox(src, alt) {
  const box = document.getElementById("image-lightbox");
  const img = document.getElementById("lightbox-img");
  img.src = src;
  img.alt = alt || "";
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

function renderCertifications(intro, list) {
  document.querySelector("#cert-root .section-title").textContent = t(intro, "title");
  const grid = document.getElementById("cert-grid");
  grid.innerHTML = "";
  list.forEach((c) => {
    const card = el("div", { class: "cert-card no-thumb" + (c.image ? " clickable" : ""), "data-reveal": "" }, [
      el("h3", { text: t(c, "title") }),
      el("p", { text: t(c, "body") }),
    ]);
    if (c.image) card.addEventListener("click", () => openLightbox(c.image, c.code));
    grid.appendChild(card);
  });
}

function renderPatents(intro, list) {
  document.querySelector("#ip-root .section-title").textContent = t(intro, "title");
  document.querySelector("#ip-root .section-body").textContent = t(intro, "body");
  const grid = document.getElementById("patent-grid");
  grid.innerHTML = "";
  list.forEach((p) => {
    const card = el("div", { class: "patent-card", "data-reveal": "" }, [
      el("div", { class: "thumb" }, [el("img", { src: p.image, alt: t(p, "title"), loading: "lazy" })]),
      el("div", { class: "cap" }, [
        el("div", { class: "type", text: `${p.type} ${p.number}` }),
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
