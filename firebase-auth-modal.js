import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

import {
  doc,
  setDoc, 
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("submit-login");
  const registerBtn = document.getElementById("submit-register");
  const loginNavBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const orderLink = document.getElementById("order-history-link");

  // 🔐 Login
  loginBtn?.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("เข้าสู่ระบบสำเร็จ!");
      document.getElementById("login-modal")?.classList.add("hidden");
      window.location.href = "index.html";
    } catch (error) {
      alert("เข้าสู่ระบบล้มเหลว: " + error.message);
    }
  });

  // 📝 Register + Save to Firestore
  registerBtn?.addEventListener("click", async () => {
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const name = document.getElementById("register-name")?.value || document.getElementById("register-firstname")?.value || "";
    const surname = document.getElementById("register-surname")?.value || document.getElementById("register-lastname")?.value || "";
    const username = document.getElementById("register-username").value;
    const phone = document.getElementById("register-phone").value;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ✅ บันทึกข้อมูลลง Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        name: name,
        surname: surname,
        username: username,
        phone: phone,
        role: "user",
        createdAt: serverTimestamp()
      });

      alert("สมัครสมาชิกสำเร็จ!");
      document.getElementById("register-modal")?.classList.add("hidden");
      window.location.href = "index.html";
    } catch (error) {
      alert("สมัครไม่สำเร็จ: " + error.message);
    }
  });

  // 🔄 Toggle Login/Register
  document.getElementById("openRegister")?.addEventListener("click", () => {
    document.getElementById("login-modal")?.classList.add("hidden");
    document.getElementById("register-modal")?.classList.remove("hidden");
  });
  document.getElementById("backToLogin")?.addEventListener("click", () => {
    document.getElementById("register-modal")?.classList.add("hidden");
    document.getElementById("login-modal")?.classList.remove("hidden");
  });

  // ❌ Logout
  logoutBtn?.addEventListener("click", async () => {
    await auth.signOut();
    alert("ออกจากระบบเรียบร้อยแล้ว");
    window.location.href = "index.html";
  });

  // 👁️ Show/Hide Login-Logout
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginNavBtn?.classList.add("hidden");
      logoutBtn?.classList.remove("hidden");
      orderLink?.classList.remove("hidden");
    } else {
      loginNavBtn?.classList.remove("hidden");
      logoutBtn?.classList.add("hidden");
      orderLink?.classList.add("hidden");
    }
  });

  // ❎ ปิด modal
  document.getElementById("close-login-modal")?.addEventListener("click", () => {
    document.getElementById("login-modal")?.classList.add("hidden");
  });
  document.getElementById("close-register-modal")?.addEventListener("click", () => {
    document.getElementById("register-modal")?.classList.add("hidden");
  });
});
// 🛒 Fetch and Display Products
async function fetchProducts() {
  const productsContainer = document.getElementById("products-container");
  if (!productsContainer) return; // ตรวจสอบ element มีอยู่จริง

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    querySnapshot.forEach((docSnap) => {
      const product = docSnap.data();
      const productElement = document.createElement("div");
      productElement.className = "product p-4 border rounded shadow mb-4";
      productElement.innerHTML = `
        <h3 class="font-bold text-lg">${product.name}</h3>
        <p class="text-sm text-gray-600">${product.category}</p>
        <p class="text-pink-600">฿${product.price}</p>
      `;
      productsContainer.appendChild(productElement);
    });
  } catch (error) {
    console.error("Error fetching products: ", error);
  }
}

// Call fetchProducts on page load
fetchProducts();

// Google Login
document.getElementById("google-login-btn")?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // บันทึกข้อมูลลง Firestore ถ้ายังไม่มี
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await setDoc(docRef, {
        name: user.displayName,
        email: user.email,
        role: "user",
        createdAt: serverTimestamp()
      });
    }

    alert("✅ เข้าสู่ระบบด้วย Google สำเร็จ!");
    window.location.href = "index.html";

  } catch (error) {
    console.error("❌ Login Failed:", error);
    alert("เข้าสู่ระบบด้วย Google ไม่สำเร็จ: " + error.message);
  }
});

// Reset Password
document.getElementById("reset-password-link")?.addEventListener("click", async () => {
  const email = prompt("กรุณากรอกอีเมลที่ใช้สมัครสมาชิก:");
  if (!email) return alert("⚠️ กรุณากรอกอีเมล");

  try {
    await sendPasswordResetEmail(auth, email);
    alert("✅ ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว");
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    alert("❌ ไม่สามารถรีเซ็ตรหัสผ่านได้: " + error.message);
  }
});