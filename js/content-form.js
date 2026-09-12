// 페이지 문구·이미지 편집 폼을 그리는 코드입니다.
//
// 예전에는 원시 JSON을 그대로 고치는 텍스트박스 + 이미지 자동 스캐너 방식이었지만,
// 지금은 content-schema.js에 정의된 자리마다 알맞은 입력칸을 만들어 보여줍니다.
// 저장할 때 영문칸이 비어 있으면 한글을 자동 번역해서 채웁니다.

function cfLabelRow(text, hint) {
  const wrap = el("div", { class: "cf-label" });
  wrap.appendChild(el("span", { text }));
  if (hint) wrap.appendChild(el("small", { text: hint }));
  return wrap;
}

// 이미지 한 칸 (미리보기 + 교체 + 삭제)
function cfImageField(getValue, setValue, field, onChange) {
  const box = el("div", { class: "cf-image" });
  const thumb = el("div", { class: "cf-thumb", style: `aspect-ratio:${field.width} / ${field.height}` });

  const paint = () => {
    thumb.innerHTML = "";
    const v = getValue();
    if (v) thumb.appendChild(el("img", { src: v, alt: "" }));
    else thumb.appendChild(el("span", { text: "없음" }));
  };
  paint();

  const file = el("input", { type: "file", accept: "image/*" });
  const status = el("span", { class: "cf-status" });
  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    status.textContent = "업로드 중…";
    try {
      const url = await uploadCropped(f, field.width, field.height, field.fit);
      setValue(url);
      paint();
      status.textContent = "";
      if (onChange) onChange();
    } catch (e) {
      status.textContent = "업로드 실패: " + e.message;
    }
    file.value = "";
  });

  const clear = el("button", { class: "mini-btn danger", type: "button", text: "삭제" });
  clear.addEventListener("click", () => {
    setValue("");
    paint();
    if (onChange) onChange();
  });

  box.appendChild(thumb);
  box.appendChild(el("div", { class: "cf-image-actions" }, [file, clear, status]));
  return box;
}

// 사진 여러 장 (박람회 사진처럼)
function cfImageListField(getValue, setValue, field) {
  const box = el("div", { class: "cf-imagelist" });
  const grid = el("div", { class: "cf-imagelist-grid" });

  const paint = () => {
    grid.innerHTML = "";
    (getValue() || []).forEach((src, i) => {
      const cell = el("div", { class: "cf-imagelist-cell" }, [el("img", { src, alt: "" })]);
      const del = el("button", { class: "cf-imagelist-del", type: "button", text: "×" });
      del.addEventListener("click", () => {
        const next = [...(getValue() || [])];
        next.splice(i, 1);
        setValue(next);
        paint();
      });
      cell.appendChild(del);
      grid.appendChild(cell);
    });
  };
  paint();

  const file = el("input", { type: "file", accept: "image/*", multiple: true });
  const status = el("span", { class: "cf-status" });
  file.addEventListener("change", async () => {
    const files = [...file.files];
    if (!files.length) return;
    status.textContent = `사진 ${files.length}장 올리는 중…`;
    try {
      const added = [];
      for (const f of files) added.push(await uploadCropped(f, field.width, field.height, field.fit));
      setValue([...(getValue() || []), ...added]);
      paint();
      status.textContent = "";
    } catch (e) {
      status.textContent = "업로드 실패: " + e.message;
    }
    file.value = "";
  });

  box.appendChild(grid);
  box.appendChild(el("div", { class: "cf-image-actions" }, [file, status]));
  return box;
}

// 필드 하나를 그린다. obj는 편집 대상 객체(그 자리에 직접 값을 쓴다).
function cfField(obj, field) {
  const row = el("div", { class: "cf-row" });

  if (field.type === "image") {
    row.appendChild(cfLabelRow(field.label, `권장 ${field.width}×${field.height} · ${field.fit === "contain" ? "잘리지 않게 여백을 두고 맞춤" : "가운데 기준 자동 크롭"}`));
    row.appendChild(cfImageField(() => obj[field.key], (v) => { obj[field.key] = v; }, field));
    return row;
  }

  if (field.type === "imageList") {
    row.appendChild(cfLabelRow(field.label, `권장 ${field.width}×${field.height} · 여러 장 한 번에 선택 가능`));
    row.appendChild(cfImageListField(() => obj[field.key], (v) => { obj[field.key] = v; }, field));
    return row;
  }

  if (field.type === "plain") {
    row.appendChild(cfLabelRow(field.label));
    const input = el("input", { type: "text", class: "cf-input", value: obj[field.key] ?? "" });
    input.addEventListener("input", () => { obj[field.key] = input.value; });
    row.appendChild(input);
    return row;
  }

  if (field.type === "lines") {
    row.appendChild(cfLabelRow(field.label, "엔터로 줄을 나누면 항목이 나뉩니다"));
    const pair = el("div", { class: "cf-pair" });
    const toLines = (v) => v.split("\n").map((l) => l.trim()).filter(Boolean);

    const ko = el("textarea", { class: "cf-input", rows: "4" });
    ko.value = (obj[field.key] || []).join("\n");
    ko.addEventListener("input", () => { obj[field.key] = toLines(ko.value); });

    const en = el("textarea", { class: "cf-input cf-en", rows: "4", placeholder: "비워두면 자동 번역" });
    en.value = (obj[field.key + "En"] || []).join("\n");
    en.addEventListener("input", () => { obj[field.key + "En"] = toLines(en.value); });

    pair.appendChild(el("div", {}, [el("small", { class: "cf-sub", text: "한글" }), ko]));
    pair.appendChild(el("div", {}, [el("small", { class: "cf-sub", text: "영문 (비워두면 자동 번역)" }), en]));
    row.appendChild(pair);
    return row;
  }

  // text / textarea — 한글·영문 한 쌍
  row.appendChild(cfLabelRow(field.label, field.size ? `화면 글자크기 ${field.size}` : ""));
  const pair = el("div", { class: "cf-pair" });
  const make = (key, placeholder, extraClass) => {
    const node = field.type === "textarea"
      ? el("textarea", { class: "cf-input " + (extraClass || ""), rows: "3", placeholder: placeholder || "" })
      : el("input", { type: "text", class: "cf-input " + (extraClass || ""), placeholder: placeholder || "" });
    node.value = obj[key] ?? "";
    node.addEventListener("input", () => { obj[key] = node.value; });
    return node;
  };
  pair.appendChild(el("div", {}, [el("small", { class: "cf-sub", text: "한글" }), make(field.key)]));
  pair.appendChild(el("div", {}, [el("small", { class: "cf-sub", text: "영문 (비워두면 자동 번역)" }), make(field.key + "En", "비워두면 자동 번역", "cf-en")]));
  row.appendChild(pair);
  return row;
}

// 목록형 그룹 (연혁, 로고, 특허, 박람회 등)
function cfListGroup(data, group) {
  const wrap = el("div", { class: "cf-group" });
  const head = el("div", { class: "cf-group-head" }, [el("strong", { text: group.label })]);
  if (group.note) head.appendChild(el("div", { class: "cf-note", text: group.note }));
  wrap.appendChild(head);

  const body = el("div", { class: "cf-group-body" });
  if (!Array.isArray(data[group.key])) data[group.key] = [];

  const paint = () => {
    body.innerHTML = "";
    data[group.key].forEach((item, index) => {
      const card = el("div", { class: "cf-item" });
      const bar = el("div", { class: "cf-item-bar" });
      bar.appendChild(el("span", { class: "cf-item-no", text: String(index + 1) }));
      bar.appendChild(el("span", { class: "cf-item-title", text: group.itemLabel(item) }));

      const mk = (label, fn, disabled) => {
        const b = el("button", { class: "mini-btn", type: "button", text: label });
        if (disabled) b.disabled = true;
        else b.addEventListener("click", fn);
        return b;
      };
      bar.appendChild(mk("▲", () => {
        const a = data[group.key];
        [a[index - 1], a[index]] = [a[index], a[index - 1]];
        paint();
      }, index === 0));
      bar.appendChild(mk("▼", () => {
        const a = data[group.key];
        [a[index + 1], a[index]] = [a[index], a[index + 1]];
        paint();
      }, index === data[group.key].length - 1));

      const fields = el("div", { class: "cf-item-fields", hidden: true });
      bar.appendChild(mk("수정", () => { fields.hidden = !fields.hidden; }));
      bar.appendChild((() => {
        const b = el("button", { class: "mini-btn danger", type: "button", text: "삭제" });
        b.addEventListener("click", () => {
          if (!confirm("이 항목을 삭제하시겠습니까?")) return;
          data[group.key].splice(index, 1);
          paint();
        });
        return b;
      })());

      group.fields.forEach((f) => fields.appendChild(cfField(item, f)));
      card.appendChild(bar);
      card.appendChild(fields);
      body.appendChild(card);
    });

    const add = el("button", { class: "mini-btn cf-add", type: "button", text: "➕ 항목 추가" });
    add.addEventListener("click", () => {
      data[group.key].push(group.newItem());
      paint();
    });
    body.appendChild(add);
  };
  paint();

  wrap.appendChild(body);
  return wrap;
}

// 고정 항목 그룹 (배너, 섹션 제목 등)
function cfObjectGroup(data, group) {
  const wrap = el("div", { class: "cf-group" });
  const head = el("div", { class: "cf-group-head" }, [el("strong", { text: group.label })]);
  if (group.note) head.appendChild(el("div", { class: "cf-note", text: group.note }));
  wrap.appendChild(head);

  if (!data[group.key] || typeof data[group.key] !== "object") data[group.key] = {};
  const body = el("div", { class: "cf-group-body" });
  group.fields.forEach((f) => body.appendChild(cfField(data[group.key], f)));
  wrap.appendChild(body);
  return wrap;
}

// 저장 직전에, 영문칸이 비어 있고 한글이 있는 항목을 자동 번역으로 채운다
async function cfFillTranslations(data, schema) {
  for (const group of schema.groups) {
    const targets = group.type === "list" ? (data[group.key] || []) : [data[group.key] || {}];
    for (const obj of targets) {
      for (const field of group.fields) {
        if (field.type === "image" || field.type === "imageList" || field.type === "plain") continue;
        if (field.type === "lines") {
          const ko = obj[field.key] || [];
          const en = obj[field.key + "En"] || [];
          if (ko.length && en.length !== ko.length) {
            obj[field.key + "En"] = await Promise.all(ko.map((line) => translateText(line).then((t) => t || line)));
          }
          continue;
        }
        const ko = obj[field.key];
        if (ko && !obj[field.key + "En"]) {
          obj[field.key + "En"] = (await translateText(ko)) || ko;
        }
      }
    }
  }
}

// 푸터(회사 정보)는 페이지별 문서에 각각 복사되어 저장된다.
// 한 곳에서 고치면 나머지 페이지도 같이 바뀌도록, 저장할 때 모든 문서에 반영한다.
const FOOTER_ENDPOINTS = [
  "/api/content",
  "/api/about-content",
  "/api/trust-content",
  "/api/catalog-content",
  "/api/brands-content",
  "/api/imported-content",
];

async function cfSyncFooter(footer, skipEndpoint) {
  for (const endpoint of FOOTER_ENDPOINTS) {
    if (endpoint === skipEndpoint) continue;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) continue;
      const doc = await res.json();
      if (!doc || typeof doc !== "object" || !doc.footer) continue;
      doc.footer = JSON.parse(JSON.stringify(footer));
      await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
    } catch {
      // 한 문서가 실패해도 나머지는 계속 반영한다
    }
  }
}

// 페이지 문서 하나에 대한 편집 폼 전체를 그린다
function renderContentForm(panel, sectionId, data, endpoint, previewHref) {
  const schema = CONTENT_SCHEMA[sectionId];
  panel.innerHTML = "";

  panel.appendChild(el("p", { class: "cf-intro", text: "한글만 입력하시면 됩니다. 영문칸을 비워두고 저장하면 자동으로 번역되어 채워집니다. 엔터로 줄을 바꾸면 화면에도 그대로 줄이 바뀝니다." }));

  schema.groups.forEach((group) => {
    panel.appendChild(group.type === "list" ? cfListGroup(data, group) : cfObjectGroup(data, group));
  });

  const status = el("div", { class: "editor-status" });
  const saveBtn = el("button", { class: "submit-btn", type: "button", text: "저장" });
  const previewLink = el("a", { class: "preview-link", href: previewHref, target: "_blank", rel: "noopener", text: "실제 페이지 보기 ↗" });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "저장 중… (영문 자동 번역 포함)";
    status.textContent = "";
    status.className = "editor-status";
    try {
      await cfFillTranslations(data, schema);
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      if (data.footer) await cfSyncFooter(data.footer, endpoint);
      status.textContent = "저장되었습니다. 사이트에 바로 반영됩니다.";
      status.className = "editor-status ok";
      renderContentForm(panel, sectionId, data, endpoint, previewHref);
    } catch (e) {
      status.textContent = "저장 실패: " + e.message;
      status.className = "editor-status error";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "저장";
    }
  });

  panel.appendChild(el("div", { class: "cf-actions" }, [saveBtn, previewLink, status]));
}
