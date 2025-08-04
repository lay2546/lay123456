import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// 🔐 ตรวจสอบสถานะผู้ใช้และสิทธิ์แอดมิน
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    window.location.href = "Home.html";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() || userSnap.data().role !== "admin") {
      alert("⛔️ หน้านี้สำหรับแอดมินเท่านั้น");
      window.location.href = "Home.html";
      return;
    }

    console.log("✅ ยืนยันสิทธิ์: คุณคือผู้ดูแลระบบ");
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์:", err);
    alert("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์");
    window.location.href = "Home.html";
  }
});

// 🚪 Logout (Desktop & Mobile)
document.addEventListener("DOMContentLoaded", () => {
  // Logout buttons
  const logoutButtons = [
    document.getElementById("logout-btn-desktop"),
    document.getElementById("logout-btn-mobile")
  ];

  logoutButtons.forEach((btn) => {
    btn?.addEventListener("click", async (e) => {
      e.preventDefault(); // ❗ ป้องกัน reload หน้า
      try {
        await signOut(auth);
        localStorage.clear(); // เคลียร์ session
        alert("ออกจากระบบแล้ว");
        window.location.href = "Home.html";
      } catch (error) {
        console.error("❌ ออกจากระบบไม่สำเร็จ:", error);
        alert("เกิดข้อผิดพลาดในการออกจากระบบ");
      }
    });
  });
});

