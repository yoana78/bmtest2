function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === "" && k !== "class" && k !== "value") continue; // skip unset optional fields (e.g. image: "") — but not `value`, since an empty option/input value is meaningful (e.g. a "no selection" placeholder) and must not fall back to the element's text content
    if (v === false) continue; // boolean attribute explicitly off (e.g. checked: false) — omit entirely, since setAttribute(k, "false") would still make it present/true
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
  setupLegalModals();
}

// ---------- 개인정보처리방침 / 이용약관 팝업 (메인 홈페이지와 동일한 전문) ----------
const LEGAL_TEXT = {
  privacyKo: `주식회사 부명(이하 '회사'라 함)은 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및 관계 법령이 정한 바를 준수하여, 적법하게 개인정보를 처리하고 안전하게 관리하고 있습니다. 이에 「개인정보 보호법」 제30조에 따라 정보주체에게 개인정보 처리에 관한 절차 및 기준을 안내하고, 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.

제1조 (개인정보의 처리 목적)
회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.

1. 고객 문의 및 상담 관리
   - 제휴·입점 문의, 대량 구매 및 OEM/ODM 상담, 고객 불만 접수 및 처리, 사실 확인을 위한 연락·통지, 처리 결과 통보 등
2. 서비스 제공 및 계약 이행
   - 견적서 발송, 비즈니스 협의, 물품 배송 및 계약 체결·이행 등
3. 신규 서비스 개발 및 마케팅(선택 동의 시)
   - 신규 서비스 및 제품 안내, 이벤트 및 프로모션 정보 제공(별도 마케팅 동의를 받은 경우에 한함)

제2조 (처리하는 개인정보의 항목)
회사는 원활한 상담 및 서비스 제공을 위해 최소한의 개인정보를 수집하고 있습니다.

1. 문의하기 / 상담 접수 시
   - 필수항목: 회사명(또는 성명), 담당자명, 연락처(전화번호 또는 휴대전화번호), 이메일 주소, 문의 내용
   - 선택항목: 직책/부서, 첨부파일 내 포함된 개인정보 등
2. 인터넷 서비스 이용 과정에서 자동으로 생성·수집될 수 있는 항목
   - IP 주소, 쿠키(Cookie), 서비스 이용 기록, 방문 기록 등

제3조 (개인정보의 처리 및 보유 기간)
① 회사는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보 수집 시에 동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.
② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.

- 고객 문의 및 상담 정보: 문의 접수 및 상담 완료 후 3년간 보관 (이력 관리 및 분쟁 해결 목적) 후 지체 없이 파기
- 상법 및 전자상거래 등에서의 소비자보호에 관한 법률 등 관계 법령에 따른 보존 의무가 있는 경우:
   - 계약 또는 청약철회 등에 관한 기록: 5년
   - 대금결제 및 재화 등의 공급에 관한 기록: 5년
   - 소비자의 불만 또는 분쟁처리에 관한 기록: 3년
   - 웹사이트 방문 기록(통신비밀보호법): 3개월

제4조 (개인정보의 제3자 제공)
회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.

제5조 (개인정보 처리 업무의 위탁)
① 회사는 원활한 업무 처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.

- 수탁업체: 클라우드 서비스 제공사
- 위탁업무 내용: 홈페이지 시스템 운영 및 서버 관리, 데이터 보관

② 회사는 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행목적 외 개인정보 처리금지, 안전성 확보조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 명확히 규정하고 수탁자가 개인정보를 안전하게 처리하는지 감독하고 있습니다.

제6조 (개인정보의 파기 절차 및 방법)
① 회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
② 파기의 절차 및 방법은 다음과 같습니다.

1. 파기절차: 목적이 달성된 개인정보는 별도의 DB로 옮겨져(종이의 경우 별도의 서류함) 내부 방침 및 기타 관련 법령에 따라 일정 기간 저장된 후 혹은 즉시 파기됩니다.
2. 파기방법: 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 영구 삭제하며, 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.

제7조 (정보주체와 법정대리인의 권리·의무 및 행사방법)
① 정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.
② 권리 행사는 회사에 대해 서면, 전화, 전자우편(E-mail) 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.
③ 정보주체가 개인정보 오류 등의 정정을 요구한 경우, 회사는 정정을 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.

제8조 (개인정보의 안전성 확보 조치)
회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.

1. 관리적 조치: 내부관리계획 수립·시행, 개인정보 취급 직원의 최소화 및 정기적 교육 실시
2. 기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접속기록 보관, 백신 소프트웨어 설치 및 주기적 점검, 네트워크 보안 장비 운영
3. 물리적 조치: 전산실, 자료보관실 등 개인정보 보관 장소에 대한 접근통제

제9조 (개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항)
① 회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용할 수 있습니다.
② 쿠키는 웹사이트를 운영하는 데 이용되는 서버가 이용자의 컴퓨터 브라우저에 보내는 소량의 정보이며 이용자들의 PC 컴퓨터 내의 하드디스크에 저장되기도 합니다.

- 쿠키의 설치·운영 및 거부: 웹브라우저 상단의 [설정] > [개인정보 및 보안] 메뉴를 통해 쿠키 저장을 거부할 수 있습니다.
- 쿠키 저장을 거부할 경우 맞춤형 서비스 이용에 일부 어려움이 발생할 수 있습니다.

제10조 (개인정보 보호책임자 및 담당부서)
회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.

- 개인정보 보호책임자
   - 성명: 조강현
   - 직책: 과장
   - 연락처: 070-4256-7389
   - 이메일: help@petsb2b.co.kr

제11조 (권익침해 구제방법)
정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.

- 개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)
- 개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)
- 대검찰청 사이버수사과: (국번없이) 1301 (www.spo.go.kr)
- 경찰청 사이버수사국: (국번없이) 182 (ecrm.police.go.kr)

제12조 (개인정보 처리방침의 변경)
이 개인정보 처리방침은 2026년 9월 1일 부터 적용됩니다. 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 공지사항을 통하여 고지할 것입니다.`,

  privacyEn: `BOOMYUNG CO., LTD. (hereinafter the "Company") complies with the Personal Information Protection Act and related laws to lawfully process personal information and protect the freedom and rights of data subjects. In accordance with Article 30 of the Personal Information Protection Act, the Company establishes and discloses this Privacy Policy to inform data subjects of the procedures and standards for processing personal information, and to promptly and smoothly handle related grievances.

Article 1 (Purpose of Processing Personal Information)
The Company processes personal information for the following purposes. Personal information processed will not be used for purposes other than those below, and if the purpose of use changes, the Company will take necessary measures such as obtaining separate consent pursuant to Article 18 of the Personal Information Protection Act.

1. Managing customer inquiries and consultations
   - Partnership/retail inquiries, bulk purchase and OEM/ODM consultation, receiving and handling customer complaints, contact/notification for fact verification, notification of processing results, etc.
2. Providing services and fulfilling contracts
   - Sending quotations, business consultation, delivery of goods, and contract execution/fulfillment
3. Development of new services and marketing (only with separate consent)
   - Guidance on new services and products, provision of event and promotional information (only where separate marketing consent has been obtained)

Article 2 (Items of Personal Information Processed)
The Company collects the minimum personal information necessary for smooth consultation and service provision.

1. When submitting an inquiry / consultation request
   - Required: Company name (or individual name), contact person, phone number, email address, inquiry details
   - Optional: Job title/department, any personal information contained in attached files
2. Items that may be automatically generated and collected while using internet services
   - IP address, cookies, service usage records, visit history, etc.

Article 3 (Processing and Retention Period of Personal Information)
① The Company processes and retains personal information within the retention/use period required by law or the period consented to by the data subject at the time of collection.
② The specific processing and retention periods are as follows.

- Customer inquiry and consultation information: Retained for 3 years after the inquiry/consultation is completed (for record management and dispute resolution purposes), then destroyed without delay
- Where retention is required by the Commercial Act, the Act on Consumer Protection in Electronic Commerce, and other related laws:
   - Records on contracts or withdrawal of subscription: 5 years
   - Records on payment and supply of goods: 5 years
   - Records on consumer complaints or dispute handling: 3 years
   - Website visit records (Protection of Communications Secrets Act): 3 months

Article 4 (Provision of Personal Information to Third Parties)
The Company processes data subjects' personal information only within the scope specified in Article 1 (Purpose of Processing Personal Information), and provides personal information to third parties only in cases falling under Articles 17 and 18 of the Personal Information Protection Act, such as with the data subject's consent or where specifically permitted by law.

Article 5 (Outsourcing of Personal Information Processing)
① The Company outsources personal information processing tasks as follows for the smooth performance of its operations.

- Contracted party: Cloud service provider
- Outsourced tasks: Operation of the website system and server management, data storage

② When entering into an outsourcing contract, the Company clearly stipulates matters concerning the prohibition of processing personal information beyond the purpose of the outsourced work, security measures, restrictions on re-outsourcing, management and supervision of the contractor, and liability for damages, in accordance with Article 26 of the Personal Information Protection Act, and supervises whether the contractor safely processes personal information.

Article 6 (Procedures and Methods of Destroying Personal Information)
① The Company destroys personal information without delay once the retention period has elapsed or the processing purpose has been achieved and the information becomes unnecessary.
② The procedures and methods of destruction are as follows.

1. Destruction procedure: Personal information for which the purpose has been achieved is transferred to a separate database (or a separate document storage for paper records) and is stored for a certain period in accordance with internal policy and relevant laws before being destroyed, or is destroyed immediately.
2. Destruction method: Information in electronic file form is permanently deleted using technical methods that make the records unrecoverable, and personal information printed on paper is destroyed by shredding or incineration.

Article 7 (Rights and Obligations of Data Subjects and Legal Representatives, and Methods of Exercise)
① Data subjects may exercise their rights to view, correct, delete, and request suspension of processing of their personal information at any time against the Company.
② Such rights may be exercised in writing, by telephone, or by email, and the Company will take action without delay.
③ If a data subject requests correction of an error in their personal information, the Company will not use or provide the relevant personal information until the correction is completed.

Article 8 (Measures to Ensure the Security of Personal Information)
The Company takes the following measures to ensure the security of personal information.

1. Administrative measures: Establishment and implementation of an internal management plan, minimization and regular training of employees handling personal information
2. Technical measures: Access authority management for the personal information processing system, retention of access records, installation and periodic inspection of anti-virus software, operation of network security equipment
3. Physical measures: Access control for locations where personal information is stored, such as server rooms and data storage rooms

Article 9 (Installation, Operation, and Refusal of Automatic Personal Information Collection Devices)
① The Company may use "cookies" that store and periodically retrieve usage information in order to provide personalized services to users.
② Cookies are small pieces of information sent by the server operating the website to the user's browser and may be stored on the hard disk of the user's computer.

- Setting/refusing cookies: Users can refuse to allow cookies by changing the settings in [Settings] > [Privacy and Security] in their web browser.
- If cookie storage is refused, some difficulties may occur in using personalized services.

Article 10 (Personal Information Protection Officer and Department in Charge)
The Company designates a Personal Information Protection Officer as follows, who is responsible for overall personal information processing tasks and handles complaints and remedies related to personal information processing.

- Personal Information Protection Officer
   - Name: Kang-hyun Cho
   - Title: Manager
   - Contact: 070-4256-7389
   - Email: help@petsb2b.co.kr

Article 11 (Remedies for Infringement of Rights)
Data subjects may apply for dispute resolution or consultation with the Personal Information Dispute Mediation Committee, the Korea Internet & Security Agency's Personal Information Infringement Report Center, and other relevant institutions to obtain relief for infringement of personal information.

- Personal Information Dispute Mediation Committee: 1833-6972 (www.kopico.go.kr)
- Personal Information Infringement Report Center: 118 (privacy.kisa.or.kr)
- Supreme Prosecutors' Office Cyber Investigation Division: 1301 (www.spo.go.kr)
- National Police Agency Cyber Investigation Bureau: 182 (ecrm.police.go.kr)

Article 12 (Changes to the Privacy Policy)
This Privacy Policy is effective from September 1, 2026. Any additions, deletions, or corrections to this Policy due to changes in laws or company policy will be announced through the notice board.`,

  termsKo: `서비스 이용약관

제1조 (목적)
본 약관은 주식회사 부명(이하 "회사"라 함)이 운영하는 공식 웹사이트(이하 "홈페이지"라 함)에서 제공하는 인터넷 관련 서비스(이하 "서비스"라 함)를 이용함에 있어 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)

1. "홈페이지"란 회사가 상품 정보, 기업 정보, 인프라 현황 등의 정보를 이용자에게 제공하고 상담 접수 및 제휴 문의를 처리하기 위해 컴퓨터 등 정보통신설비를 이용하여 구축한 가상의 공간을 의미합니다.
2. "이용자"란 홈페이지에 접속하여 본 약관에 따라 회사가 제공하는 서비스를 이용하는 고객 및 방문자를 말합니다.
3. "콘텐츠"란 홈페이지에 게시된 부호, 문자, 음성, 음향, 이미지, 영상, 그래픽 등 일체의 정보 및 데이터를 의미합니다.

제3조 (약관의 명시와 개정)

1. 회사는 본 약관의 내용과 상호, 대표자 성명, 영업소 소재지 주소, 사업자등록번호, 연락처 등을 이용자가 쉽게 알 수 있도록 홈페이지 하단 또는 연결 화면에 게시합니다.
2. 회사는 「약관의 규제에 관한 법률」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.
3. 회사가 약관을 개정할 경우에는 적용일자 및 개정 사유를 명시하여 현행 약관과 함께 개정 약관 적용일 최소 7일 전부터 홈페이지 공지사항 등을 통해 공지합니다. 단, 이용자에게 불리한 내용으로 변경되는 경우에는 최소 30일 이상의 유예기간을 두고 공지합니다.
4. 이용자가 개정 약관의 적용에 동의하지 않는 경우 홈페이지 이용을 중단할 수 있으며, 개정 약관의 적용일 이후에도 계속해서 서비스를 이용하는 경우에는 변경된 약관에 동의한 것으로 봅니다.

제4조 (서비스의 제공 및 변경)

1. 회사는 홈페이지를 통해 다음과 같은 서비스를 제공합니다.
   - 회사 소개, 연구개발(R&D), 생산 및 물류 인프라 정보 제공
   - 생산 제품, 유통 브랜드 및 취급 품목 안내
   - 사업 제휴, OEM/ODM 및 대량 구매 상담 접수 창구 운영
   - 공지사항, 채용 정보 등 기타 회사가 정하는 제반 안내 서비스
2. 회사는 기술적 사양의 변경이나 경영상의 정책 변경 등의 사유가 있는 경우 서비스의 내용을 변경할 수 있으며, 이 경우 홈페이지를 통해 안내합니다.

제5조 (서비스의 중단)

1. 회사는 컴퓨터 등 정보통신설비의 보수·점검·교체 및 고장, 통신의 두절 또는 천재지변 등의 불가항력적인 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
2. 회사는 시스템 정기점검 등 필요한 경우 사전에 홈페이지를 통해 공지한 후 서비스 제공을 일시 중단할 수 있습니다.
3. 회사는 제1항 및 제2항의 사유로 인한 서비스 중단으로 인해 이용자에게 발생한 손해에 대하여 고의 또는 중대한 과실이 없는 한 책임을 부담하지 않습니다.

제6조 (이용자의 의무)
이용자는 홈페이지를 이용할 때 다음 각 호의 행위를 하여서는 안 됩니다.

1. 온라인 상담, 제휴 문의 등 작성 시 허위 사실을 기재하거나 타인의 정보를 도용하는 행위
2. 홈페이지에 게시된 정보, 텍스트, 이미지 등을 회사의 사전 승낙 없이 무단으로 복제, 배포, 출판, 방송 기타 상업적 목적으로 이용하거나 제3자에게 제공하는 행위
3. 회사 및 제3자의 저작권, 상표권, 특허권 등 지식재산권을 침해하는 행위
4. 회사 및 제3자의 명예를 훼손하거나 업무를 방해하는 행위
5. 외설, 폭력적인 메시지나 화상, 음성, 기타 공서양속에 반하는 정보를 전달하거나 유포하는 행위
6. 회사의 시스템이나 서버에 무단으로 접근하거나 컴퓨터 바이러스 감염 자료를 등록·유포하는 등 정상적인 운영을 방해하는 행위
7. 기타 관계 법령 및 본 약관에서 금지하는 행위

제7조 (저작권 및 지식재산권의 귀속)

1. 회사가 작성한 홈페이지 내 디자인, UI/UX, 브랜드 로고, 상표, 텍스트, 이미지, 영상, 카탈로그, 기술 설명서 등 모든 저작물에 대한 저작권 및 기타 지식재산권은 회사에 귀속됩니다.
2. 이용자는 홈페이지를 이용함으로써 얻은 정보 중 회사에게 지식재산권이 귀속된 정보를 회사의 명시적인 사전 서면 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리 목적으로 이용하거나 제3자에게 이용하게 하여서는 안 됩니다.

제8조 (면책 조항)

1. 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
2. 회사는 홈페이지에 게재된 정보, 자료, 사실의 신뢰도 및 정확성에 대해 선량한 관리자로서 주의를 기울이나, 이용자가 이를 신뢰하여 행한 결정이나 거래로 인해 발생한 직·간접적 손해에 대하여 회사의 고의 또는 중과실이 없는 한 책임을 지지 않습니다.
3. 회사는 이용자가 홈페이지를 매개로 제3자와 행한 거래나 분쟁에 대하여 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임을 지지 않습니다.
4. 회사는 무료로 제공되는 홈페이지 정보 조회 및 문의 서비스의 이용과 관련하여 관련 법령에 특별한 규정이 없는 한 책임을 부담하지 않습니다.

제9조 (분쟁 해결 및 관할 법원)

1. 회사와 이용자는 홈페이지 서비스 이용과 관련하여 발생한 분쟁을 원만하게 해결하기 위하여 성실히 협의합니다.
2. 본 약관과 관련된 분쟁에 대해서는 대한민국 법률을 준거법으로 적용합니다.
3. 회사와 이용자 간에 발생한 분쟁으로 인하여 소송이 제기될 경우, 회사의 본점 소재지를 관할하는 법원을 전속관할 법원으로 합니다.`,

  termsEn: `Terms of Service

Article 1 (Purpose)
These Terms of Service ("Terms") govern the rights, obligations, and responsibilities of BOOMYUNG CO., LTD. (hereinafter the "Company") and users in connection with the internet-related services (hereinafter the "Service") provided through the Company's official website (hereinafter the "Website").

Article 2 (Definitions)

1. "Website" means the virtual space established by the Company using computers and other information and communications facilities to provide users with product information, corporate information, infrastructure status, and other information, and to process consultation requests and partnership inquiries.
2. "User" means a customer or visitor who accesses the Website and uses the services provided by the Company in accordance with these Terms.
3. "Content" means all information and data, including signs, characters, voice, sound, images, video, and graphics, posted on the Website.

Article 3 (Disclosure and Amendment of Terms)

1. The Company posts the content of these Terms, along with the company name, name of the representative, address of the place of business, business registration number, and contact information, at the bottom of the Website or on a linked page so that users can easily access them.
2. The Company may amend these Terms to the extent that it does not violate the Act on the Regulation of Terms and Conditions, the Act on Promotion of Information and Communications Network Utilization and Information Protection, and other related laws.
3. When amending the Terms, the Company will specify the effective date and reasons for the amendment and announce it, together with the current Terms, through the notice board on the Website at least 7 days prior to the effective date of the amended Terms. However, if the amendment is unfavorable to users, the Company will provide at least 30 days' notice.
4. If a user does not agree to the application of the amended Terms, the user may discontinue use of the Website. Continued use of the Service after the effective date of the amended Terms will be deemed as agreement to the amended Terms.

Article 4 (Provision and Modification of Services)

1. The Company provides the following services through the Website.
   - Providing information on company overview, R&D, and production/logistics infrastructure
   - Providing information on manufactured products, distribution brands, and handled items
   - Operating a reception channel for business partnership, OEM/ODM, and bulk purchase inquiries
   - Other general information services determined by the Company, such as notices and recruitment information
2. The Company may change the content of the Service due to changes in technical specifications or management policy, and will notify users of such changes through the Website in such cases.

Article 5 (Suspension of Service)

1. The Company may temporarily suspend the provision of the Service in the event of maintenance, inspection, replacement, or failure of computers or other information and communications facilities, communication outages, or force majeure events such as natural disasters.
2. The Company may temporarily suspend the Service for necessary reasons, such as regular system maintenance, after giving prior notice through the Website.
3. The Company shall not be liable for any damages incurred by users due to service suspension under paragraphs 1 and 2, unless caused by the Company's intent or gross negligence.

Article 6 (Obligations of Users)
Users shall not engage in any of the following acts while using the Website.

1. Providing false information or using another person's information without authorization when submitting online consultations, partnership inquiries, etc.
2. Reproducing, distributing, publishing, broadcasting, or otherwise using for commercial purposes, or providing to third parties, information, text, images, etc. posted on the Website without the Company's prior consent
3. Infringing on the copyrights, trademark rights, patent rights, or other intellectual property rights of the Company or third parties
4. Damaging the reputation of, or interfering with the business of, the Company or third parties
5. Transmitting or distributing obscene or violent messages, images, sounds, or other information contrary to public order and morals
6. Gaining unauthorized access to the Company's systems or servers, or registering or distributing materials infected with computer viruses, thereby interfering with normal operations
7. Any other acts prohibited by relevant laws and these Terms

Article 7 (Ownership of Copyright and Intellectual Property Rights)

1. Copyrights and other intellectual property rights in all works created by the Company on the Website, including design, UI/UX, brand logos, trademarks, text, images, video, catalogs, and technical documentation, belong to the Company.
2. Users shall not reproduce, transmit, publish, distribute, broadcast, or otherwise use for profit, or allow third parties to use, information obtained through use of the Website to which the Company's intellectual property rights are attached, without the Company's prior written consent.

Article 8 (Disclaimer)

1. The Company is exempted from liability for providing the Service if it is unable to do so due to natural disasters, war, suspension of service by a telecommunications carrier, or other force majeure events.
2. The Company exercises the care of a good manager with respect to the reliability and accuracy of information, materials, and facts posted on the Website, but shall not be liable for any direct or indirect damages arising from decisions or transactions made by users in reliance on such information, unless caused by the Company's intent or gross negligence.
3. The Company has no obligation to intervene in any transactions or disputes between users and third parties conducted through the Website, and shall not be liable for any damages arising therefrom.
4. The Company shall not be liable for the use of free information inquiry and inquiry services provided on the Website, unless otherwise specifically provided by relevant laws.

Article 9 (Dispute Resolution and Jurisdiction)

1. The Company and users shall make good-faith efforts to amicably resolve any disputes arising in connection with the use of the Website Service.
2. Disputes related to these Terms shall be governed by the laws of the Republic of Korea.
3. In the event of litigation arising from a dispute between the Company and a user, the court having jurisdiction over the location of the Company's headquarters shall have exclusive jurisdiction.`,
};

let legalModalEl = null;

function ensureLegalModal() {
  if (legalModalEl) return legalModalEl;
  const closeBtn = el("button", { class: "legal-modal-close", type: "button", "aria-label": "Close" }, [document.createTextNode("×")]);
  const titleEl = el("h2", { class: "legal-modal-title" });
  const bodyEl = el("pre", { class: "legal-modal-body" });
  const card = el("div", { class: "legal-modal-card" }, [closeBtn, titleEl, bodyEl]);
  const backdrop = el("div", { class: "legal-modal-backdrop" }, [card]);
  const close = () => backdrop.classList.remove("open");
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.body.appendChild(backdrop);
  legalModalEl = { backdrop, titleEl, bodyEl };
  return legalModalEl;
}

function openLegalModal(kind) {
  const modal = ensureLegalModal();
  const lang = currentLang();
  const isPrivacy = kind === "privacy";
  modal.titleEl.textContent = lang === "en"
    ? (isPrivacy ? "Privacy Policy" : "Terms of Service")
    : (isPrivacy ? "개인정보처리방침" : "이용약관");
  modal.bodyEl.textContent = lang === "en"
    ? (isPrivacy ? LEGAL_TEXT.privacyEn : LEGAL_TEXT.termsEn)
    : (isPrivacy ? LEGAL_TEXT.privacyKo : LEGAL_TEXT.termsKo);
  modal.backdrop.classList.add("open");
}

function setupLegalModals() {
  const spans = document.querySelectorAll(".foot-legal span");
  if (spans[0]) spans[0].onclick = () => openLegalModal("privacy");
  if (spans[1]) spans[1].onclick = () => openLegalModal("terms");
}
