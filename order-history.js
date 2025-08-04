import { db, auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

async function translateText(key) {
  const lang = localStorage.getItem("language") || "en";
  const res = await fetch(`lang/${lang}.json`);
  const translations = await res.json();
  return translations[key] || key;
}

async function applyTranslations() {
  document.querySelectorAll("[data-translate]").forEach(async (el) => {
    const key = el.getAttribute("data-translate");
    const translated = await translateText(key);
    el.innerHTML = translated;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const orderList = document.getElementById("order-list");
  const addressInfo = document.getElementById("address-info");
  const editAddressBtn = document.getElementById("edit-address-btn");
  const searchBtn = document.getElementById("search-btn");
  const filterDate = document.getElementById("filter-date");

  const nameInput = document.getElementById("profile-name");
  const lastnameInput = document.getElementById("profile-lastname");
  const usernameInput = document.getElementById("profile-username");
  const phoneInput = document.getElementById("profile-phone");
  const addressInput = document.getElementById("profile-address");
  const emailInput = document.getElementById("profile-email");

  orderList.innerHTML = "<li class='text-center text-gray-500'>⏳ Loading data...</li>";

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("❌ Please login to access this page.");
      window.location.href = "Home.html";
      return;
    }

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        if (addressInfo) {
          addressInfo.innerHTML = `
            <p><strong data-translate="recipient">Recipient:</strong> <span id="info-name">${data.name || "-"}</span></p>
            <p><strong data-translate="phone">Phone:</strong> <span id="info-phone">${data.phone || "-"}</span></p>
            <p><strong data-translate="address">Address:</strong> <span id="info-address">${data.address || "-"}</span></p>
          `;
          applyTranslations();
        }

        if (nameInput) nameInput.value = data.name || "";
        if (lastnameInput) lastnameInput.value = data.lastname || "";
        if (usernameInput) usernameInput.value = data.username || "";
        if (phoneInput) phoneInput.value = data.phone || "";
        if (addressInput) addressInput.value = data.address || "";
        if (emailInput) emailInput.value = user.email || "";
      }

      if (editAddressBtn) {
        editAddressBtn.addEventListener("click", async () => {
          const name = prompt("New name:", document.getElementById("info-name")?.textContent || "");
          const phone = prompt("New phone:", document.getElementById("info-phone")?.textContent || "");
          const address = prompt("New address:", document.getElementById("info-address")?.textContent || "");

          if (name && phone && address) {
            await setDoc(docRef, { name, phone, address }, { merge: true });
            addressInfo.innerHTML = `
              <p><strong data-translate="recipient">Recipient:</strong> <span id="info-name">${name}</span></p>
              <p><strong data-translate="phone">Phone:</strong> <span id="info-phone">${phone}</span></p>
              <p><strong data-translate="address">Address:</strong> <span id="info-address">${address}</span></p>
            `;
            applyTranslations();
            alert("✅ Address updated successfully.");
          }
        });
      }

      await loadOrders(user);

      if (searchBtn && filterDate) {
        searchBtn.addEventListener("click", async () => {
          await loadOrders(user, filterDate.value);
        });
      }

    } catch (error) {
      console.error("🔥 Error occurred:", error);
    }
  });

  async function loadOrders(user, selectedDate = "") {
    orderList.innerHTML = "<li class='text-center text-gray-500'>⏳ Loading orders...</li>";

    try {
      const q = query(collection(db, "orders"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        orderList.innerHTML = "<li class='text-center text-gray-500'>No order history found.</li>";
        return;
      }

      orderList.innerHTML = "";

      for (const docSnap of querySnapshot.docs) {
        const order = docSnap.data();
        const createdAt = order.createdAt?.toDate?.() || new Date();
        const orderDate = createdAt.toISOString().split("T")[0];
        if (selectedDate && orderDate !== selectedDate) continue;

        const items = order.cart || [];
        const orderTotal = items.reduce((sum, item) =>
          sum + (item.quantity || 1) * parseFloat(item.price), 0);
        const discountPercent = parseFloat(order.discountPercent || 0);
        const discountAmount = orderTotal * (discountPercent / 100);
        const finalTotal = orderTotal - discountAmount;

        const itemList = items.map(item => `
          <li class="ml-4">• ${item.name} x${item.quantity || 1} — ฿${item.price}</li>
        `).join("");

        const translatedStatus = await translateText("status_" + (order.deliveryStatus || "pending"));
        const translatedPayment = await translateText("payment_" + (order.paymentMethod || "cod"));

        const li = document.createElement("li");
        li.className = "bg-gray-100 p-4 rounded shadow";
        li.innerHTML = `
          <p><strong data-translate="order_id">🧾 Order ID:</strong> ${docSnap.id}</p>
          <p><strong data-translate="status">📦 Status:</strong> ${translatedStatus}</p>
          <p><strong data-translate="recipient">👤 Recipient:</strong> ${order.name || "-"}</p>
          <p><strong data-translate="phone">📞 Phone:</strong> ${order.phone || "-"}</p>
          <p><strong data-translate="address">🏠 Address:</strong> ${order.address || "-"}</p>
          <p><strong data-translate="total">💰 Total:</strong> ฿${finalTotal.toFixed(2)}</p>
          <p><strong data-translate="date">🗓️ Date:</strong> ${createdAt.toLocaleString()}</p>
          <p><strong data-translate="payment_method">💳 Payment Method:</strong> ${translatedPayment}</p>
          <p><strong data-translate="items">📦 Items:</strong></p>
          <ul class="list-disc ml-5 mt-1">${itemList}</ul>
        `;
        orderList.appendChild(li);
        applyTranslations();
      }

    } catch (err) {
      console.error("🔥 Failed to load orders:", err);
      orderList.innerHTML = "<li class='text-red-500'>❌ Failed to load data</li>";
    }
  }

  const menuBtn = document.getElementById("menu-btn");
  const closeBtn = document.getElementById("close-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (menuBtn && closeBtn && sidebar && overlay) {
    const toggleSidebar = (show) => {
      sidebar.classList.toggle("show", show);
      overlay.classList.toggle("show", show);
      sidebar.classList.toggle("hidden", !show);
      overlay.classList.toggle("hidden", !show);
    };
    menuBtn.addEventListener("click", () => toggleSidebar(true));
    closeBtn.addEventListener("click", () => toggleSidebar(false));
    overlay.addEventListener("click", () => toggleSidebar(false));
  }

  const saveProfileBtn = document.getElementById("save-profile-btn");

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
      const updatedData = {
        name: nameInput?.value.trim() || "",
        lastname: lastnameInput?.value.trim() || "",
        username: usernameInput?.value.trim() || "",
        phone: phoneInput?.value.trim() || "",
        address: addressInput?.value.trim() || ""
      };

      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), updatedData, { merge: true });
        alert("✅ Profile updated successfully.");
      } catch (err) {
        console.error("❌ Failed to save profile:", err);
        alert("❌ Error occurred while saving profile.");
      }
    });
    
  }
});