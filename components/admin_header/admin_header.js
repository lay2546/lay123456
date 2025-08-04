import { auth } from '../../firebase.js'; // ✅ path ต้องถูก
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

export function initHeader() {
  const toggle = document.getElementById("menu-toggle");
  const close = document.getElementById("menu-close");
  const mobileMenu = document.getElementById("mobile-menu");

  if (toggle && close && mobileMenu) {
    toggle.addEventListener("click", () => mobileMenu.classList.remove("translate-x-full"));
    close.addEventListener("click", () => mobileMenu.classList.add("translate-x-full"));
  }

  const logoutButtons = [
    document.getElementById("logout-btn"),
    document.getElementById("logout-btn-desktop"),
    document.getElementById("logout-btn-mobile")
  ];

  logoutButtons.forEach((btn) => {
    btn?.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        localStorage.clear();
        alert("ออกจากระบบแล้ว");
        window.location.href = "Home.html"; // ✅ ไปหน้า index หรือที่คุณกำหนด
      } catch (error) {
        console.error("❌ Logout Error:", error);
        alert("เกิดข้อผิดพลาดในการออกจากระบบ");
      }
    });
  });
}
