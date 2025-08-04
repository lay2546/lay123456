async function setLanguage(lang) {
  const response = await fetch(`lang/${lang}.json`);
  const translations = await response.json();

  document.querySelectorAll("[data-translate]").forEach(el => {
    const key = el.getAttribute("data-translate");
    if (translations[key]) {
      if (el.querySelector("h3")) {
        el.querySelector("h3").textContent = translations[key];
      } else if (el.querySelector("#cart-count")) {
        const count = el.querySelector("#cart-count").textContent;
        el.childNodes[0].textContent = translations[key] + " ";
        el.querySelector("#cart-count").textContent = count;
      } else {
        el.textContent = translations[key];
      }
    }
  });

  localStorage.setItem("language", lang);

  // ✅ เปลี่ยนธงตามภาษา
  const toggleBtn = document.getElementById("lang-toggle");
  if (toggleBtn) {
    toggleBtn.textContent = lang === "en" ? "🇺🇸" : "🇹🇭";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  let currentLang = localStorage.getItem("language") || "th";
  setLanguage(currentLang);

  const toggleBtn = document.getElementById("lang-toggle");
  toggleBtn?.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "th" : "en";
    setLanguage(currentLang);
  });
});
