let lang = "ko";

function renderHero(data) {
  const root = document.getElementById("hero-root");
  root.querySelector("img.hero-bg").src = data.image;
  root.querySelector(".hero-eyebrow").textContent = t(data, "eyebrow", lang);
  const h1 = root.querySelector("h1");
  const headline = t(data, "headline", lang);
  const highlight = t(data, "highlight", lang);
  h1.innerHTML = headline.replace(highlight, `<em>${highlight}</em>`);
  root.querySelector("p.lead").textContent = t(data, "body", lang);
  const cta = root.querySelector(".hero-cta");
  cta.href = data.ctaHref;
  cta.querySelector("span").textContent = t(data, "ctaText", lang);
}

function renderPhilosophy(items) {
  const root = document.getElementById("philosophy-root");
  root.innerHTML = "";
  items.forEach((item, i) => {
    const tags = (lang === "en" && item.tagsEn) || item.tags;
    const text = el("div", { class: "phi-text" }, [
      el("div", { class: "phi-label", text: t(item, "label", lang) }),
      el("h3", { class: "phi-title", text: t(item, "title", lang) }),
      el("p", { class: "phi-body", text: t(item, "body", lang) }),
      el("div", { class: "phi-tags" }, tags.map((tag) => el("span", { text: tag }))),
    ]);

    if (!item.image) {
      root.appendChild(el("div", { class: "phi-item phi-lead", "data-reveal": "" }, [text]));
      return;
    }

    const caption = t(item, "caption", lang);
    const media = el("figure", { class: "phi-media" }, [
      el("img", { src: item.image, alt: caption || item.title, loading: "lazy" }),
      caption ? el("figcaption", { text: caption }) : null,
    ]);
    // Alternate which side the photo sits on so the four blocks don't read as a list.
    const flip = i % 2 === 1 ? " reverse" : "";
    root.appendChild(el("div", { class: `phi-item${flip}`, "data-reveal": "" }, [media, text]));
  });
}

function renderBrands(intro, brands, imported) {
  // 이 eyebrow만 HTML에 한글로 박혀 있어서 영어 모드에서도 안 바뀌었다 — 렌더할 때 같이 맞춰준다
  document.querySelector("#brands-root .eyebrow span").textContent = lang === "en" ? "BRANDS" : "브랜드";
  document.querySelector("#brands-root .section-title").textContent = t(intro, "title", lang);
  document.querySelector("#brands-root .section-body").textContent = t(intro, "body", lang);
  const grid = document.getElementById("brand-grid");
  grid.innerHTML = "";
  const goLabel = lang === "en" ? "View details →" : "자세히 보기 →";
  brands.forEach((b) => {
    const name = t(b, "name", lang);
    grid.appendChild(
      el("a", { class: "brand-card", href: b.href, "data-reveal": "" }, [
        el("img", { src: b.logo, alt: name, class: b.name === "하우펫" ? "logo-normal" : "" }),
        el("h3", { text: name }),
        el("p", { text: t(b, "tagline", lang) }),
        el("span", { class: "go", text: goLabel }),
      ])
    );
  });
  const strip = document.getElementById("imported-strip");
  strip.innerHTML = "";
  strip.appendChild(el("span", { class: "label", text: lang === "en" ? "Imported Distribution Brands" : "수입 유통 브랜드" }));
  const logoGrid = el("div", { class: "imported-logo-grid" });
  imported.forEach((b) =>
    logoGrid.appendChild(
      el("a", { class: "logo-card", href: `imported-brands.html#${b.id}` }, [el("img", { src: b.logo, alt: t(b, "name", lang), loading: "lazy" })])
    )
  );
  strip.appendChild(logoGrid);
}

function renderDistributors(intro, list) {
  document.querySelector("#distributors-root .section-title").textContent = t(intro, "title", lang);
  document.querySelector("#distributors-root .section-body").textContent = t(intro, "body", lang);
  const grid = document.getElementById("distributor-grid");
  grid.innerHTML = "";
  list.forEach((d) => {
    grid.appendChild(
      d.logo
        ? el("div", { class: "logo-card muted" }, [el("img", { src: d.logo, alt: d.name, loading: "lazy" })])
        : el("div", { class: "logo-card placeholder" }, [el("span", { text: lang === "en" ? "Logo coming soon" : "로고 추가 예정" })])
    );
  });
}

function renderRetail(intro, retailers) {
  document.querySelector("#retail-root .eyebrow span").textContent = t(intro, "eyebrow", lang);
  document.querySelector("#retail-root .section-title").textContent = t(intro, "title", lang);
  document.querySelector("#retail-root .section-body").textContent = t(intro, "body", lang);
  const track = document.getElementById("marquee-track");
  track.innerHTML = "";
  const doubled = retailers.concat(retailers);
  doubled.forEach((r) =>
    track.appendChild(el("div", { class: "logo-card" }, [el("img", { src: r.logo, alt: r.name, loading: "lazy" })]))
  );
}

function renderExport(data) {
  const root = document.getElementById("export-root");
  root.querySelector(".eyebrow span").textContent = t(data, "eyebrow", lang);
  root.querySelector("h2").textContent = t(data, "title", lang);
  root.querySelector(".export-body").textContent = t(data, "body", lang);
  const cta = root.querySelector(".btn-outline");
  cta.href = data.ctaHref;
  cta.querySelector("span").textContent = t(data, "ctaText", lang);
}

function render(content, newLang) {
  lang = newLang;
  renderHero(content.hero);
  renderPhilosophy(content.philosophy);
  renderBrands(content.brandsIntro, content.brands, content.importedBrands);
  renderDistributors(content.distributorIntro, content.distributors);
  renderRetail(content.retailIntro, content.retailers);
  renderExport(content.export);
  renderFooter(content.footer, newLang);
  observeReveals();
}

(async function init() {
  setupHeaderScroll();
  const content = await loadContent("/api/content", "content/home.json");
  setupLangToggle((newLang) => render(content, newLang));
})();
