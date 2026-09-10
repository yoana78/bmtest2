let lang = "ko";

function renderPageHero(data) {
  const root = document.getElementById("page-hero-root");
  root.querySelector("img.hero-bg").src = data.image;
  root.querySelector(".eyebrow span").textContent = data.eyebrow;
  root.querySelector("h1").textContent = t(data, "title", lang);
  root.querySelector(".hero-body").textContent = t(data, "body", lang);
}

function renderCeo(data) {
  document.querySelector("#ceo-root .eyebrow span").textContent = data.eyebrow;
  document.querySelector("#ceo-root .ceo-side h2").textContent = t(data, "title", lang);
  const body = document.getElementById("ceo-body");
  body.innerHTML = "";
  const paragraphs = (lang === "en" && data.paragraphsEn) || data.paragraphs;
  paragraphs.forEach((p) => body.appendChild(el("p", { text: p })));
  document.getElementById("ceo-signature").src = data.signature;
  document.getElementById("ceo-name").textContent = t(data, "name", lang);
  document.getElementById("ceo-role").textContent = t(data, "role", lang);
}

function renderHistory(intro, list) {
  document.querySelector("#history-root .section-title").textContent = t(intro, "title", lang);
  const root = document.getElementById("timeline-root");
  root.innerHTML = "";
  list.forEach((row) => {
    const items = (lang === "en" && row.itemsEn) || row.items;
    if (row.featured) {
      root.appendChild(
        el("div", { class: "tl-row featured", "data-reveal": "" }, [
          el("div", { class: "tl-year", text: row.year }),
          el("div", { class: "tl-text" }, [
            el("h4", { text: t(row, "title", lang) }),
            el("ul", {}, items.map((i) => el("li", { text: i }))),
          ]),
        ])
      );
    } else {
      root.appendChild(
        el("div", { class: "tl-row", "data-reveal": "" }, [
          el("div", { class: "tl-year", text: row.year }),
          el("div", { class: "tl-body" }, [el("ul", {}, items.map((i) => el("li", { text: i })))]),
        ])
      );
    }
  });
}

function renderInfra(intro, list) {
  document.querySelector("#infra-root .section-title").textContent = t(intro, "title", lang);
  const grid = document.getElementById("infra-grid");
  grid.innerHTML = "";
  list.forEach((card) => {
    const title = t(card, "title", lang);
    const tags = (lang === "en" && card.tagsEn) || card.tags;
    let media;
    if (card.video) {
      const videoEl = el("video", { src: card.video, loop: true, playsinline: true, preload: "auto" });
      // Setting the `muted` *property* (not just the attribute) is required —
      // browsers only allow autoplay when the element is actually muted, and
      // the attribute alone doesn't reliably sync to the live property.
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.autoplay = true;
      media = el("div", { class: "infra-media" }, [videoEl]);
    } else if (card.image) {
      media = el("div", { class: "infra-media" }, [el("img", { src: card.image, alt: title, loading: "lazy" })]);
    } else {
      media = el("div", { class: "infra-media empty" }, [el("span", { text: card.eyebrow })]);
    }
    grid.appendChild(
      el("div", { class: "infra-card", "data-reveal": "" }, [
        media,
        el("div", { class: "infra-body" }, [
          el("p", { class: "eyebrow", html: `<span>${card.eyebrow}</span>` }),
          el("h3", { text: title }),
          el("p", { text: t(card, "body", lang) }),
          el("div", { class: "phi-tags" }, tags.map((tag) => el("span", { text: tag }))),
        ]),
      ])
    );
  });
  // Play videos only after they're actually attached to the document —
  // calling .play() on a detached element is unreliable.
  grid.querySelectorAll("video").forEach((v) => v.play().catch(() => {}));
}

function renderCi(intro, list) {
  document.querySelector("#ci-root .section-title").textContent = t(intro, "title", lang);
  document.getElementById("ci-logo").src = intro.logo;
  document.getElementById("ci-subtitle").textContent = intro.subtitle;
  document.getElementById("ci-caption").textContent = intro.caption;
  const wrap = document.getElementById("ci-list");
  wrap.innerHTML = "";
  list.forEach((item) => {
    const children = [
      el("div", { class: "ci-num", text: item.num }),
      el("div", {}, [
        el("p", { class: "eyebrow", html: `<span>${item.eyebrow}</span>` }),
        el("h3", { text: t(item, "title", lang) }),
        el("p", { text: t(item, "body", lang) }),
        item.swatch
          ? el("div", { class: "ci-swatch" }, [el("span", { class: "chip", style: `background:${item.swatch}` }), el("code", { text: item.swatch })])
          : null,
      ]),
    ];
    wrap.appendChild(el("div", { class: "ci-item", "data-reveal": "" }, children));
  });
}

function render(content, newLang) {
  lang = newLang;
  renderPageHero(content.hero);
  renderCeo(content.ceo);
  renderHistory(content.historyIntro, content.history);
  renderInfra(content.infraIntro, content.infra);
  renderCi(content.ciIntro, content.ci);
  renderFooter(content.footer, newLang);
  observeReveals();
}

(async function init() {
  setupHeaderScroll();
  const content = await loadContent("/api/about-content", "content/about.json");
  setupLangToggle((newLang) => render(content, newLang));
})();
