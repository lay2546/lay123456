import { db, auth } from './firebase.js';
import {
  collection, addDoc, serverTimestamp, getDoc, doc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";


document.addEventListener("DOMContentLoaded", () => {

  async function getTranslation(key) {
    const lang = localStorage.getItem("language") || "en";
    const response = await fetch(`lang/${lang}.json`);
    const translations = await response.json();
    return translations[key] || key;
  }

  const menuBtn = document.getElementById("menu-btn");
  const closeBtn = document.getElementById("close-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  menuBtn?.addEventListener("click", () => toggleSidebar(true));
  closeBtn?.addEventListener("click", () => toggleSidebar(false));
  overlay?.addEventListener("click", () => toggleSidebar(false));

  function toggleSidebar(show) {
    sidebar?.classList.toggle("show", show);
    overlay?.classList.toggle("show", show);
  }

  document.querySelectorAll(".dropdown-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const dropdownContent = btn.nextElementSibling;
      dropdownContent?.classList.toggle("show");
    });
  });

  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");

  loginBtn?.addEventListener("click", () => loginModal?.classList.remove("hidden"));
  document.getElementById("close-login-modal")?.addEventListener("click", () => loginModal?.classList.add("hidden"));

  onAuthStateChanged(auth, (user) => {
    loginBtn?.classList.toggle("hidden", !!user);
    logoutBtn?.classList.toggle("hidden", !user);
  });

  logoutBtn?.addEventListener("click", async () => {
    await auth.signOut();
    window.location.reload();
  });

  const cartCount = document.getElementById("cart-count");
  const cartItems = document.getElementById("cart-items");
  const clearCart = document.getElementById("clear-cart");
  const totalPriceElement = document.getElementById("total-price");
  const totalItemsElement = document.getElementById("total-items");
  const checkoutBtn = document.getElementById("checkout");
  const slipInput = document.getElementById("payment-slip");
  const slipPreview = document.getElementById("slip-preview");

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  renderCart();

  function updateCartCount() {
    let totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartCount.textContent = `(${totalItems})`;
  }

  function calculateTotalPrice() {
    let total = cart.reduce((sum, item) => sum + parseFloat(item.price) * (item.quantity || 1), 0);
    totalPriceElement.textContent = total.toFixed(2);
    totalItemsElement.textContent = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  async function renderCart() {
    cartItems.innerHTML = "";
    if (cart.length === 0) {
      const msg = await getTranslation("emptycartalert");
      cartItems.innerHTML = `<li class='text-center text-gray-500'>${msg}</li>`;
    } else {
      cart.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "flex justify-between items-center p-2 border-b";
        li.innerHTML = `
          <span>${item.name} (x${item.quantity || 1}) - ฿${item.price}</span>
          <div class="flex items-center gap-2">
            <button class="decrease-qty" data-index="${index}">➖</button>
            <span>${item.quantity || 1}</span>
            <button class="increase-qty" data-index="${index}">➕</button>
            <button class="remove-item text-red-500" data-index="${index}">❌</button>
          </div>
        `;
        cartItems.appendChild(li);
      });
    }
    calculateTotalPrice();
    updateCartCount();
  }

  cartItems.addEventListener("click", (event) => {
    let index = event.target.dataset.index;
    if (event.target.classList.contains("increase-qty")) {
      cart[index].quantity = (cart[index].quantity || 1) + 1;
    } else if (event.target.classList.contains("decrease-qty")) {
      if (cart[index].quantity > 1) {
        cart[index].quantity--;
      } else {
        cart.splice(index, 1);
      }
    } else if (event.target.classList.contains("remove-item")) {
      cart.splice(index, 1);
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
  });

  document.addEventListener("click", async (event) => {
    if (event.target.classList.contains("add-to-cart")) {
      const user = auth.currentUser;
      if (!user) {
        alert(await getTranslation("loginbeforeorder"));
        loginModal?.classList.remove("hidden");
        return;
      }
      let name = event.target.dataset.name;
      let price = event.target.dataset.price;
      let existingItem = cart.find(item => item.name === name);

      if (existingItem) {
        existingItem.quantity++;
      } else {
        cart.push({ name, price, quantity: 1 });
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
    }
  });

  clearCart?.addEventListener("click", () => {
    localStorage.removeItem("cart");
    cart = [];
    renderCart();
  });

  async function submitOrder() {
    const user = auth.currentUser;
    if (!user) {
      alert(await getTranslation("loginbeforeorder"));
      loginModal?.classList.remove("hidden");
      return;
    }

    if (cart.length === 0) {
      alert(await getTranslation("emptycartalert"));
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const name = userData.name || "";
      const phone = userData.phone || "";
      const address = userData.address || "";

      if (!address.trim()) {
        alert(await getTranslation("pleasefilladdress"));
        window.location.href = "Delivery.html";
        return;
      }

      const methodSelect = document.getElementById("payment-method");
      const paymentMethod = methodSelect?.value || "cod";

      let slipUrl = "";
      if (paymentMethod === "transfer") {
        slipUrl = currentSlipUrl;
        if (!slipUrl) {
          alert(await getTranslation("uploadslip"));
          return;
        }
      }

      await addDoc(collection(db, "orders"), {
        uid: user.uid,
        name, phone, address,
        cart,
        paymentMethod,
        slipUrl,
        couponCode: couponInput.value.trim() || null,
        discountPercent: currentDiscount || 0,
        totalAmount: parseFloat(totalPriceElement.textContent) || 0,
        createdAt: serverTimestamp()
      });

      alert(await getTranslation("ordersuccess"));
      localStorage.removeItem("cart");
      window.location.href = "orderhistory.html";
    } catch (error) {
      console.error("❌ Error submitting order:", error);
      alert(await getTranslation("orderfail"));
    }
  }

  checkoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    confirmModal?.classList.remove('hidden');
  });

  const paymentMethod = document.getElementById('payment-method');
  const slipUpload = document.getElementById('slip-upload-container');
  const qrPreview = document.getElementById("qr-preview");

  paymentMethod?.addEventListener('change', function () {
    if (paymentMethod.value === 'transfer') {
      slipUpload.classList.remove('hidden');
      qrPreview.classList.remove('hidden');
    } else {
      slipUpload.classList.add('hidden');
      qrPreview.classList.add('hidden');
    }
  });

  const uploadSlipToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "upload-slip");
    const res = await fetch("https://api.cloudinary.com/v1_1/dpgru06ox/image/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    return data.secure_url;
  };

  let currentSlipUrl = "";
  slipInput?.addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (file) {
      currentSlipUrl = await uploadSlipToCloudinary(file);
      slipPreview.src = currentSlipUrl;
      slipPreview.classList.remove('hidden');
    }
  });

  const confirmModal = document.getElementById('confirm-modal');
  const confirmSubmit = document.getElementById('confirm-submit');
  const cancelSubmit = document.getElementById('cancel-submit');

  cancelSubmit?.addEventListener('click', () => confirmModal?.classList.add('hidden'));
  confirmSubmit?.addEventListener('click', async () => {
    confirmModal?.classList.add('hidden');
    await submitOrder();
  });

  const couponInput = document.getElementById("coupon-input");
  const applyCouponBtn = document.getElementById("apply-coupon");
  const couponResult = document.getElementById("coupon-result");
  const discountValueElement = document.getElementById("discount-value");
  const subtotalElement = document.getElementById("subtotal-price");
  const discountAmountElement = document.getElementById("discount-amount");

  let currentDiscount = 0;

  applyCouponBtn?.addEventListener("click", async () => {
    const code = couponInput.value.trim();
    if (!code) {
      alert(await getTranslation("enter_coupon"));
      return;
    }
    try {
      const q = query(collection(db, "coupons"), where("code", "==", code));
      const querySnap = await getDocs(q);
      if (querySnap.empty) {
        alert(await getTranslation("invalid_coupon"));
        return;
      }
      const coupon = querySnap.docs[0].data();
      if (coupon.expired) {
        alert(await getTranslation("coupon_expired"));
        return;
      }
      currentDiscount = coupon.discount || 0;
      const subtotal = cart.reduce((sum, item) => sum + parseFloat(item.price) * (item.quantity || 1), 0);
      const discountAmount = (subtotal * currentDiscount) / 100;
      const total = subtotal - discountAmount;
      subtotalElement.textContent = subtotal.toFixed(2);
      discountAmountElement.textContent = discountAmount.toFixed(2);
      totalPriceElement.textContent = total.toFixed(2);
      couponResult.classList.remove("hidden");
      discountValueElement.textContent = currentDiscount;
    } catch (err) {
      console.error("Error applying coupon:", err);
      alert(await getTranslation("error_coupon"));
    }
    document.addEventListener("click", async (event) => {
  if (event.target.classList.contains("add-to-cart")) {
    const user = auth.currentUser;
    if (!user) {
      alert(await getTranslation("loginbeforeorder"));
      loginModal?.classList.remove("hidden");
      return;
    }

    const productId = event.target.dataset.id;
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) return;

    const productData = productSnap.data();
    const existingItem = cart.find(item => item.id === productId);
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty + 1 > productData.quantity) {
      alert("สินค้าในสต็อกไม่พอ");
      return;
    }

    if (existingItem) {
      existingItem.quantity++;
    } else {
      cart.push({
        id: productId,
        name: productData.name,
        price: productData.price,
        quantity: 1,
        stock: productData.quantity
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
  }
});
cartItems.addEventListener("click", async (event) => {
  let index = event.target.dataset.index;

  if (event.target.classList.contains("increase-qty")) {
    const productId = cart[index].id;
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) return;

    const productData = productSnap.data();
    if (cart[index].quantity + 1 > productData.quantity) {
      alert("สินค้าในสต็อกไม่พอ");
      return;
    }
    cart[index].quantity++;
  } else if (event.target.classList.contains("decrease-qty")) {
    if (cart[index].quantity > 1) {
      cart[index].quantity--;
    } else {
      cart.splice(index, 1);
    }
  } else if (event.target.classList.contains("remove-item")) {
    cart.splice(index, 1);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
});

  });

});
