function renderPageHero(data, lang) {
  const root = document.getElementById("page-hero-root");
  if (data.image) root.querySelector("img.hero-bg").src = data.image;
  root.querySelector(".eyebrow span").textContent = t(data, "eyebrow", lang);
  root.querySelector("h1").textContent = t(data, "title", lang);
  root.querySelector(".hero-body").textContent = t(data, "body", lang);
}

function render(content, lang) {
  renderFooter(content.footer, lang);
  renderPageHero(content.intro, lang);
  const root = document.getElementById("brand-showcase");
  root.innerHTML = "";
  const catalogLabel = lang === "en" ? "View in product catalog →" : "제품 카탈로그에서 보기 →";
  content.brands.forEach((b) => {
    const name = lang === "en" ? b.nameEn : b.nameKo;
    const desc = lang === "en" ? b.descriptionEn : b.descriptionKo;
    const sub = lang === "en" ? `${b.nameKo} — ${b.descriptionKo}` : `${b.nameEn} — ${b.descriptionEn}`;
    root.appendChild(
      el("div", { class: "brand-feature", id: b.id, style: `--accent:${b.color}`, "data-reveal": "" }, [
        el("div", { class: "mark" }, [el("img", { src: b.logo, alt: name })]),
        el("div", {}, [
          el("p", { class: "tagline", text: (lang === "en" ? b.taglineEn : b.tagline) || b.tagline }),
          el("h3", { text: name }),
          el("p", { class: "desc", text: desc }),
          el("p", { class: "en", text: sub }),
          el("a", { class: "go-catalog", href: `catalog.html?brand=${b.id}` }, [document.createTextNode(catalogLabel)]),
        ]),
      ])
    );
  });
  observeReveals();
}

(async function init() {
  setupHeaderScroll();
  const content = await loadContent("/api/brands-content", "content/brands.json");
  setupLangToggle((lang) => render(content, lang));
})();
