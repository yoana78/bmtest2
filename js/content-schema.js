// 관리자 페이지의 문구/이미지 입력 폼 설계도입니다.
//
// siteB는 페이지별 JSON 문서에 내용을 저장하고 공개 페이지가 그 문서를 직접 읽습니다.
// 그래서 이 설계도는 "문서의 어느 자리를 어떤 입력칸으로 보여줄지"만 정하면 되고,
// 화면 렌더링 코드는 손대지 않아도 됩니다.
//
// 필드 옵션
//   type: 'text'(한 줄) | 'textarea'(여러 줄, 엔터 줄바꿈 그대로 반영)
//         | 'image' | 'plain'(언어 구분 없는 한 줄) | 'lines'(한 줄에 하나씩 = 배열)
//   size: 화면 글자 크기 — 크기가 다른 문구를 한 칸에 섞지 않도록 안내로 표시
//   width/height: 이미지 권장 해상도. 업로드 시 이 비율로 가운데 자동 크롭
//   fit: 'contain'이면 로고처럼 잘리지 않게 여백을 두고 맞춤 (기본은 꽉 채워 crop)

const CONTENT_SCHEMA = {
  home: {
    label: "홈페이지",
    groups: [
      {
        key: "hero",
        label: "메인 상단 배너",
        type: "object",
        note: "제목 중 강조할 단어는 아래 '강조 단어'에 그대로 적어주세요.",
        fields: [
          { key: "image", label: "배경 사진", type: "image", width: 2560, height: 1440 },
          { key: "eyebrow", label: "작은 라벨", type: "text", size: "13px" },
          { key: "headline", label: "큰 제목", type: "textarea", size: "24~40px" },
          { key: "highlight", label: "강조 단어 (제목 안의 한 단어)", type: "text", size: "24~40px" },
          { key: "body", label: "본문", type: "textarea", size: "14.5px" },
          { key: "ctaText", label: "버튼 문구", type: "text", size: "13px" },
          { key: "ctaHref", label: "버튼 링크", type: "plain" },
        ],
      },
      {
        key: "philosophy",
        label: "철학 섹션 (스크롤 블록)",
        type: "list",
        itemLabel: (it) => it.title || "새 블록",
        newItem: () => ({ num: "", label: "", labelEn: "", title: "", titleEn: "", body: "", bodyEn: "", tags: [], tagsEn: [], image: "", caption: "" }),
        fields: [
          { key: "num", label: "번호 (예: 01)", type: "plain" },
          { key: "label", label: "라벨", type: "text", size: "13px" },
          { key: "title", label: "제목", type: "text", size: "19~26px" },
          { key: "body", label: "본문", type: "textarea", size: "13.5px" },
          { key: "tags", label: "태그 (한 줄에 하나씩)", type: "lines" },
          { key: "image", label: "사진", type: "image", width: 1200, height: 1600 },
          { key: "caption", label: "사진 설명", type: "plain" },
        ],
      },
      {
        key: "brandsIntro",
        label: "브랜드 섹션 제목",
        type: "object",
        fields: [
          { key: "title", label: "섹션 제목", type: "text", size: "19~26px" },
          { key: "body", label: "섹션 본문", type: "textarea", size: "13.5px" },
        ],
      },
      {
        key: "retailIntro",
        label: "유통 파트너 섹션 제목",
        type: "object",
        fields: [
          { key: "eyebrow", label: "작은 라벨", type: "text", size: "13px" },
          { key: "title", label: "섹션 제목", type: "text", size: "19~26px" },
          { key: "body", label: "섹션 본문", type: "textarea", size: "13.5px" },
        ],
      },
      {
        key: "retailers",
        label: "대형 유통 파트너 로고",
        type: "list",
        itemLabel: (it) => it.name || "새 파트너",
        newItem: () => ({ name: "", logo: "" }),
        fields: [
          { key: "name", label: "이름", type: "plain" },
          { key: "logo", label: "로고", type: "image", width: 400, height: 200, fit: "contain" },
        ],
      },
      {
        key: "distributorIntro",
        label: "펫 전문 유통사 섹션 제목",
        type: "object",
        fields: [
          { key: "title", label: "섹션 제목", type: "text", size: "19~26px" },
          { key: "body", label: "섹션 본문", type: "textarea", size: "13.5px" },
        ],
      },
      {
        key: "distributors",
        label: "펫 전문 유통사 로고",
        type: "list",
        itemLabel: (it) => it.name || "새 유통사",
        newItem: () => ({ name: "", logo: "" }),
        fields: [
          { key: "name", label: "이름", type: "plain" },
          { key: "logo", label: "로고", type: "image", width: 400, height: 200, fit: "contain" },
        ],
      },
      {
        key: "export",
        label: "제휴·수출 문의 배너",
        type: "object",
        fields: [
          { key: "eyebrow", label: "작은 라벨", type: "text", size: "13px" },
          { key: "title", label: "제목", type: "textarea", size: "19~26px" },
          { key: "body", label: "본문", type: "textarea", size: "13.5px" },
          { key: "ctaText", label: "버튼 문구", type: "text", size: "13px" },
          { key: "ctaHref", label: "버튼 링크", type: "plain" },
        ],
      },
      {
        key: "footer",
        label: "푸터 (회사 정보)",
        type: "object",
        note: "모든 페이지 하단에 공통으로 표시됩니다.",
        fields: [
          { key: "company", label: "회사명", type: "text", size: "13px" },
          { key: "address", label: "주소", type: "textarea", size: "13px" },
          { key: "tel", label: "전화번호", type: "plain" },
          { key: "fax", label: "팩스번호", type: "plain" },
          { key: "email", label: "이메일", type: "plain" },
          { key: "brn", label: "사업자등록번호", type: "plain" },
          { key: "copyright", label: "저작권 문구", type: "plain" },
        ],
      },
    ],
  },

  about: {
    label: "회사소개",
    groups: [
      {
        key: "hero",
        label: "상단 배너",
        type: "object",
        fields: [
          { key: "image", label: "배경 사진", type: "image", width: 2560, height: 1440 },
          { key: "eyebrow", label: "작은 라벨", type: "plain" },
          { key: "title", label: "페이지 제목", type: "text", size: "24~40px" },
          { key: "body", label: "본문", type: "textarea", size: "14.5px" },
        ],
      },
      {
        key: "ceo",
        label: "대표 인사말",
        type: "object",
        fields: [
          { key: "eyebrow", label: "작은 라벨", type: "plain" },
          { key: "title", label: "제목", type: "text", size: "19~26px" },
          { key: "name", label: "대표 이름", type: "text", size: "13.5px" },
          { key: "role", label: "직함", type: "text", size: "13px" },
          { key: "paragraphs", label: "인사말 본문 (한 줄에 한 문단)", type: "lines" },
          { key: "signature", label: "서명 이미지", type: "image", width: 600, height: 180, fit: "contain" },
        ],
      },
      { key: "historyIntro", label: "기업 연혁 섹션 제목", type: "object",
        fields: [{ key: "title", label: "섹션 제목", type: "text", size: "19~26px" }] },
      {
        key: "history",
        label: "기업 연혁",
        type: "list",
        itemLabel: (it) => it.year || "새 연혁",
        newItem: () => ({ year: "", title: "", titleEn: "", items: [], itemsEn: [], featured: false, image: "" }),
        fields: [
          { key: "year", label: "연도", type: "plain" },
          { key: "title", label: "연도 제목", type: "text", size: "13.5px" },
          { key: "items", label: "세부 내용 (한 줄에 하나씩)", type: "lines" },
          { key: "image", label: "사진 (선택)", type: "image", width: 1600, height: 1200 },
        ],
      },
      { key: "infraIntro", label: "인프라 섹션 제목", type: "object",
        fields: [{ key: "title", label: "섹션 제목", type: "text", size: "19~26px" }] },
      {
        key: "infra",
        label: "생산 및 R&D 인프라",
        type: "list",
        itemLabel: (it) => it.title || "새 시설",
        newItem: () => ({ eyebrow: "", title: "", titleEn: "", body: "", bodyEn: "", tags: [], image: "" }),
        fields: [
          { key: "eyebrow", label: "작은 라벨", type: "plain" },
          { key: "title", label: "제목", type: "text", size: "13.5px" },
          { key: "body", label: "본문", type: "textarea", size: "13.5px" },
          { key: "tags", label: "태그 (한 줄에 하나씩)", type: "lines" },
          { key: "image", label: "사진", type: "image", width: 1600, height: 1200 },
        ],
      },
      {
        key: "ciIntro",
        label: "CI 섹션",
        type: "object",
        fields: [
          { key: "title", label: "섹션 제목", type: "text", size: "19~26px" },
          { key: "logo", label: "CI 로고", type: "image", width: 800, height: 800, fit: "contain" },
          { key: "subtitle", label: "로고 아래 제목", type: "plain" },
          { key: "caption", label: "로고 아래 설명", type: "plain" },
        ],
      },
      {
        key: "ci",
        label: "CI 설명 카드",
        type: "list",
        itemLabel: (it) => it.title || "새 카드",
        newItem: () => ({ num: "", eyebrow: "", title: "", titleEn: "", body: "", bodyEn: "" }),
        fields: [
          { key: "num", label: "번호", type: "plain" },
          { key: "eyebrow", label: "작은 라벨", type: "plain" },
          { key: "title", label: "제목", type: "text", size: "13.5px" },
          { key: "body", label: "본문", type: "textarea", size: "13.5px" },
        ],
      },
    ],
  },

  trust: {
    label: "신뢰와 인증",
    groups: [
      {
        key: "hero",
        label: "상단 배너",
        type: "object",
        fields: [
          { key: "image", label: "배경 사진", type: "image", width: 2560, height: 1440 },
          { key: "eyebrow", label: "작은 라벨", type: "text", size: "13px" },
          { key: "title", label: "페이지 제목", type: "text", size: "24~40px" },
          { key: "body", label: "본문", type: "textarea", size: "14.5px" },
        ],
      },
      { key: "certIntro", label: "품질 인증 섹션 제목", type: "object",
        fields: [{ key: "title", label: "섹션 제목", type: "text", size: "19~26px" }] },
      {
        key: "certifications",
        label: "품질 인증",
        type: "list",
        itemLabel: (it) => it.code || it.title || "새 인증",
        newItem: () => ({ code: "", title: "", titleEn: "", body: "", bodyEn: "", image: "" }),
        fields: [
          { key: "code", label: "인증 코드", type: "plain" },
          { key: "title", label: "제목", type: "text", size: "13.5px" },
          { key: "body", label: "설명", type: "textarea", size: "13.5px" },
          { key: "image", label: "인증서 사진", type: "image", width: 1240, height: 1754, fit: "contain" },
        ],
      },
      {
        key: "ipIntro",
        label: "보유 특허 섹션",
        type: "object",
        fields: [
          { key: "title", label: "섹션 제목", type: "text", size: "19~26px" },
          { key: "body", label: "섹션 본문", type: "textarea", size: "13.5px" },
        ],
      },
      {
        key: "patents",
        label: "보유 특허 · 디자인등록",
        type: "list",
        itemLabel: (it) => `${it.type || ""} ${it.number || ""}`.trim() || "새 특허",
        newItem: () => ({ type: "특허", number: "", title: "", titleEn: "", image: "" }),
        fields: [
          { key: "type", label: "종류 (특허 / 디자인등록)", type: "plain" },
          { key: "number", label: "등록번호", type: "plain" },
          { key: "title", label: "명칭", type: "text", size: "13.5px" },
          { key: "image", label: "등록증 사진", type: "image", width: 1240, height: 1754 },
        ],
      },
      { key: "expoIntro", label: "박람회 섹션 제목", type: "object",
        fields: [{ key: "title", label: "섹션 제목", type: "text", size: "19~26px" }] },
      {
        key: "exhibitions",
        label: "박람회 (연도별)",
        type: "list",
        note: "새로 참가한 박람회는 여기에 연도를 추가하면 됩니다.",
        itemLabel: (it) => `${it.year || ""} ${it.title || ""}`.trim() || "새 박람회",
        newItem: () => ({ year: "", title: "", titleEn: "", location: "", locationEn: "", photos: [] }),
        fields: [
          { key: "year", label: "연도", type: "plain" },
          { key: "title", label: "박람회 이름", type: "text", size: "19~26px" },
          { key: "location", label: "장소", type: "text", size: "13px" },
          { key: "photos", label: "사진", type: "imageList", width: 1600, height: 1200 },
        ],
      },
      { key: "retailIntro", label: "대형 유통 섹션 제목", type: "object",
        fields: [{ key: "title", label: "섹션 제목", type: "text", size: "19~26px" }] },
      {
        key: "retailers",
        label: "대형 유통 파트너 로고",
        type: "list",
        itemLabel: (it) => it.name || "새 파트너",
        newItem: () => ({ name: "", logo: "" }),
        fields: [
          { key: "name", label: "이름", type: "plain" },
          { key: "logo", label: "로고", type: "image", width: 400, height: 200, fit: "contain" },
        ],
      },
      {
        key: "distributorIntro",
        label: "펫 전문 유통사 섹션 제목",
        type: "object",
        fields: [
          { key: "title", label: "섹션 제목", type: "text", size: "19~26px" },
          { key: "body", label: "섹션 본문", type: "textarea", size: "13.5px" },
        ],
      },
      {
        key: "distributors",
        label: "펫 전문 유통사 로고",
        type: "list",
        itemLabel: (it) => it.name || "새 유통사",
        newItem: () => ({ name: "", logo: "" }),
        fields: [
          { key: "name", label: "이름", type: "plain" },
          { key: "logo", label: "로고", type: "image", width: 400, height: 200, fit: "contain" },
        ],
      },
    ],
  },
};
