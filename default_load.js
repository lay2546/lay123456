export async function loadAdminHeader() {
  const container = document.getElementById("admin-header");
  if (!container) return;

  try {
    const html = await fetch("./components/admin_header/admin_header.html").then(res => res.text());
    container.innerHTML = html;

    const { initHeader } = await import("./components/admin_header/admin_header.js");
    initHeader(); // ทำ slide menu, logout ฯลฯ
  } catch (err) {
    console.error("❌ โหลด header ไม่สำเร็จ:", err);
  }
}
