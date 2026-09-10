function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === "" && k !== "class") continue; // skip unset optional fields (e.g. image: "")
    if (v === true) node.setAttribute(k, ""); // boolean attribute (autoplay, muted, ...)
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.appendChild(c);
  return node;
}

function observeReveals() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    items.forEach((i) => i.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach((i) => io.observe(i));
  // Safety net: never leave content permanently invisible if the observer
  // fails to fire (backgrounded tab, unusual layout, etc.).
  setTimeout(() => items.forEach((i) => i.classList.add("in")), 1500);
}

function setupHeaderScroll() {
  const header = document.getElementById("site-header");
  // Pages with no dark hero image behind the header (e.g. contact.html) must
  // keep the "scrolled" light-background styling permanently — otherwise the
  // header renders white-on-white text at scrollY 0.
  const hasHero = !!document.querySelector(".hero, .page-hero");
  if (!hasHero) {
    header.classList.add("scrolled");
  } else {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  setupMobileMenu();
}

function setupMobileMenu() {
  const btn = document.getElementById("menu-btn");
  const nav = document.getElementById("mobile-nav");
  if (!btn || !nav) return;
  const close = () => {
    btn.classList.remove("open");
    nav.classList.remove("open");
    document.body.classList.remove("nav-open");
  };
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.classList.toggle("open", open);
    document.body.classList.toggle("nav-open", open);
  });
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) close();
  });
}

// Tries the live API first (so admin edits show up for every visitor).
// If that fails — API not deployed yet, static-only preview, network hiccup —
// falls back to the static JSON file shipped alongside the page, so content
// is never duplicated (and never drifts) between JS and content/*.json.
async function loadContent(endpoint, localJsonPath) {
  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error("bad response");
    return await res.json();
  } catch {
    const res = await fetch(localJsonPath, { cache: "no-store" });
    return await res.json();
  }
}

// ---------- Language toggle ----------
// Translates the static chrome (nav, footer, buttons) that's identical on
// every page. Content pulled from content/*.json only has Korean copy for
// long-form text (CEO message, philosophy paragraphs, patent titles, ...) —
// translating that accurately isn't something to guess at, so it stays in
// Korean even in EN mode. Pages whose data already carries both languages
// (brands, imported brands, catalog — nameKo/nameEn, descriptionKo/descriptionEn,
// features/featuresEn) re-render their content in the selected language via
// the onChange callback passed to setupLangToggle.
const UI_STRINGS = {
  "회사소개": "About Us",
  "브랜드": "Brands",
  "수입브랜드": "Imported Brands",
  "제품 카탈로그": "Product Catalog",
  "신뢰와 인증": "Trust & Certification",
  "문의하기": "Contact",
  "관리자": "Admin",
  "기업 안내": "Company",
  "비즈니스": "Business",
  "개인정보처리방침": "Privacy Policy",
  "이용약관": "Terms of Service",
  "B2B 입점 문의": "B2B Inquiry",
  "(주)부명": "BOOMYUNG",
};
const UI_STRINGS_REV = Object.fromEntries(Object.entries(UI_STRINGS).map(([k, v]) => [v, k]));

// Looks up `<key>En` next to `<key>` on any content object, e.g.
// t(intro, "title") returns intro.titleEn when lang is "en" (falling back
// to the Korean value if no translation was authored for that field).
function t(obj, key, lang) {
  if (!obj) return "";
  const activeLang = lang || currentLang();
  if (activeLang === "en" && obj[key + "En"]) return obj[key + "En"];
  return obj[key] || "";
}

function currentLang() {
  return localStorage.getItem("lang") === "en" ? "en" : "ko";
}

function translateStaticUI(lang) {
  document.documentElement.lang = lang === "en" ? "en" : "ko";
  // Any element can opt into static-copy translation by carrying both
  // data-ko and data-en — used for hand-written page copy that isn't driven
  // by content/*.json (e.g. the contact form's labels and placeholders).
  document.querySelectorAll("[data-ko][data-en]").forEach((node) => {
    const text = lang === "en" ? node.dataset.en : node.dataset.ko;
    if (node.hasAttribute("data-i18n-placeholder")) node.setAttribute("placeholder", text);
    else node.textContent = text;
  });
  document.querySelectorAll(".main-nav a, #mobile-nav a, .foot-col a, .foot-col h4, .foot-legal span, .foot-legal a, .brand-mark span").forEach((node) => {
    const text = node.textContent.trim();
    if (lang === "en" && UI_STRINGS[text]) node.textContent = UI_STRINGS[text];
    else if (lang === "ko" && UI_STRINGS_REV[text]) node.textContent = UI_STRINGS_REV[text];
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    if (btn.id === "menu-btn") return;
    if (/^(EN|KR)$/.test(btn.textContent.trim())) {
      btn.textContent = lang === "en" ? "KR" : "EN";
    } else {
      const text = btn.textContent.trim();
      if (lang === "en" && UI_STRINGS[text]) btn.textContent = UI_STRINGS[text];
      else if (lang === "ko" && UI_STRINGS_REV[text]) btn.textContent = UI_STRINGS_REV[text];
    }
  });
}

function setupLangToggle(onChange) {
  const lang = currentLang();
  translateStaticUI(lang);
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    if (btn.id === "menu-btn" || btn.tagName === "A") return;
    btn.addEventListener("click", () => {
      const next = currentLang() === "en" ? "ko" : "en";
      localStorage.setItem("lang", next);
      translateStaticUI(next);
      if (onChange) onChange(next);
    });
  });
  if (onChange) onChange(lang);
}

function renderFooter(f, lang) {
  const activeLang = lang || currentLang();
  const brnLabel = activeLang === "en" ? "Business Registration No." : "사업자등록번호";
  const company = (activeLang === "en" && f.companyEn) || f.company;
  const address = (activeLang === "en" && f.addressEn) || f.address;
  document.getElementById("foot-company").textContent = company;
  document.getElementById("foot-address").textContent = `${address} | TEL: ${f.tel} | FAX: ${f.fax}`;
  document.getElementById("foot-email").textContent = `E-MAIL: ${f.email} | ${brnLabel}: ${f.brn}`;
  document.getElementById("foot-copy").textContent = f.copyright;
}
