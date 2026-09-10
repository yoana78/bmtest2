function setupForm() {
  const form = document.getElementById("contact-form");
  const msg = document.getElementById("form-msg");
  const submitBtn = form.querySelector(".submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const lang = currentLang();
    msg.className = "form-msg";
    submitBtn.disabled = true;
    submitBtn.textContent = lang === "en" ? "Sending..." : "전송 중...";

    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      msg.textContent =
        lang === "en"
          ? "Your inquiry has been received. Our team will contact you soon."
          : "문의가 접수되었습니다. 빠른 시일 내에 담당자가 연락드리겠습니다.";
      msg.classList.add("show", "success");
      form.reset();
    } catch {
      msg.textContent = lang === "en" ? "Failed to send. Please try again shortly." : "전송에 실패했습니다. 잠시 후 다시 시도해주세요.";
      msg.classList.add("show", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = currentLang() === "en" ? "Send Inquiry" : "문의 보내기";
    }
  });
}

(function init() {
  setupHeaderScroll();
  const footerData = {
    company: "(주)부명 BOOMYUNG",
    companyEn: "BOOMYUNG Co., Ltd.",
    address: "경기도 구리시 건원대로34번길 19 306",
    addressEn: "306, 19 Geonwondae-ro 34beon-gil, Guri-si, Gyeonggi-do, Republic of Korea",
    tel: "031-553-8003",
    fax: "031-592-2460",
    email: "help@petsb2b.co.kr",
    brn: "132-81-49973",
    copyright: "© 2026 BOOMYUNG Co., Ltd. All Rights Reserved.",
  };
  setupLangToggle((lang) => renderFooter(footerData, lang));
  setupForm();
})();
