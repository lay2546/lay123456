// admin_coupon.js
import { db } from './firebase.js';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const couponTable = document.getElementById("couponTable");
const addBtn = document.getElementById("addCoupon");
const couponCountEl = document.getElementById("couponCount");

const codeInput = document.getElementById("code");
const discountInput = document.getElementById("discount");
const expireDateInput = document.getElementById("expireDate");

const couponsRef = collection(db, "coupons");
const ordersRef = collection(db, "orders");

function showMessage(msg, type = "success", duration = 3000) {
  const div = document.createElement("div");
  const icons = {
    success: "🎉",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };
  const colors = {
    success: "from-green-500 to-emerald-600",
    error: "from-red-500 to-rose-600",
    warning: "from-yellow-500 to-amber-600",
    info: "from-blue-500 to-indigo-600"
  };
  div.innerHTML = `<div class="flex items-center space-x-2"><span class="text-lg">${icons[type]}</span><span class="font-medium">${msg}</span></div>`;
  div.className = `fixed top-4 right-4 z-50 bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl transform translate-x-full transition-all duration-500 ease-out backdrop-blur-sm border border-white border-opacity-20`;
  document.body.appendChild(div);
  setTimeout(() => { div.style.transform = "translateX(0)"; }, 100);
  setTimeout(() => { div.style.transform = "translateX(full)"; setTimeout(() => div.remove(), 500); }, duration);
}

function updateStats(coupons) {
  const now = new Date();
  const active = coupons.filter(c => c.isActive && new Date(c.expireDate?.toDate()) > now).length;
  const expired = coupons.filter(c => new Date(c.expireDate?.toDate()) <= now).length;
  const total = coupons.length;
  const inUse = active;
  if (couponCountEl) couponCountEl.textContent = `${total} คูปอง`;
  const totalEl = document.querySelector('[data-stat="total"]');
  const activeEl = document.querySelector('[data-stat="active"]');
  const expiredEl = document.querySelector('[data-stat="expired"]');
  const inUseEl = document.querySelector('[data-stat="inuse"]');
  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (expiredEl) expiredEl.textContent = expired;
  if (inUseEl) inUseEl.textContent = inUse;
}

function createCouponCard(code) {
  const colors = ['from-purple-500 to-indigo-600', 'from-pink-500 to-rose-600', 'from-blue-500 to-cyan-600', 'from-green-500 to-emerald-600', 'from-orange-500 to-red-600'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  return `<div class="coupon-card bg-gradient-to-r ${randomColor} text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg transform hover:scale-105 transition-all duration-200">${code}</div>`;
}

function calculateDiscount(order) {
  const cart = order.cart || [];
  const discountPercent = order.discountPercent || 0;
  let totalBeforeDiscount = 0;
  cart.forEach(item => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 1);
    totalBeforeDiscount += price * quantity;
  });
  return Math.round((totalBeforeDiscount * discountPercent) / 100);
}

async function loadCoupons() {
  try {
    couponTable.innerHTML = `<tr><td colspan="4" class="text-center py-8">⏳ Loading...</td></tr>`;
    const snapshot = await getDocs(couponsRef);
    couponTable.innerHTML = "";
    const coupons = [];
    if (snapshot.empty) {
      couponTable.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">ยังไม่มีคูปองในระบบ</td></tr>`;
      updateStats([]);
      return;
    }
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const expireDate = data.expireDate?.toDate();
      const isExpired = expireDate && expireDate <= new Date();
      coupons.push({ id: docSnap.id, ...data });
      const row = document.createElement("tr");
      row.className = "hover:bg-gray-50 transition-colors duration-200 fade-in";
      row.innerHTML = `<td class="px-6 py-4">${createCouponCard(data.code)}</td>
      <td class="px-6 py-4"><span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">${data.discount}%</span></td>
      <td class="px-6 py-4 text-sm ${isExpired ? 'text-red-600' : 'text-gray-600'}">${expireDate ? expireDate.toLocaleString('th-TH') : '-'}</td>
      <td class="px-6 py-4 text-center"><button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm" data-id="${docSnap.id}">🗑️ ลบ</button></td>`;
      couponTable.appendChild(row);
    });
    updateStats(coupons);
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (confirm("คุณแน่ใจว่าต้องการลบคูปองนี้?")) {
          await deleteDoc(doc(db, "coupons", id));
          showMessage("ลบคูปองเรียบร้อยแล้ว");
          loadCoupons();
        }
      });
    });
    loadCouponOrders();
  } catch (error) {
    console.error(error);
    showMessage("เกิดข้อผิดพลาดในการโหลดคูปอง", "error");
  }
}

async function loadCouponOrders() {
  const list = document.getElementById("couponOrders");
  if (!list) return;
  try {
    const q = query(ordersRef, where("couponCode", "!=", ""));
    const snapshot = await getDocs(q);
    list.innerHTML = "";
    let totalDiscount = 0;
    const orders = [];
    snapshot.forEach(order => {
      const data = order.data();
      const discount = calculateDiscount(data);
      if (discount <= 0) return; // skip if no discount
      totalDiscount += discount;
      orders.push({ ...data, id: order.id, discount });
    });
    orders.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
    orders.forEach(order => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors mb-2";
      div.innerHTML = `<div><div class="font-medium text-gray-800">คำสั่งซื้อ #${order.id}</div><div class="text-sm text-gray-500">ใช้คูปอง: ${order.couponCode}</div></div><div class="text-green-600 font-bold">-${order.discount.toFixed(0)}฿</div>`;
      list.appendChild(div);
    });
    const totalDiscountEl = document.querySelector('[data-total="discount"]');
    if (totalDiscountEl) totalDiscountEl.textContent = `-${totalDiscount.toFixed(0)}฿`;
  } catch (error) {
    console.error(error);
    showMessage("โหลดคำสั่งซื้อไม่สำเร็จ", "error");
  }
}

addBtn.addEventListener("click", async () => {
  const code = codeInput.value.trim().toUpperCase();
  const discount = Number(discountInput.value.trim());
  const expireDate = new Date(expireDateInput.value);
  if (!code || code.length < 3) return showMessage("รหัสคูปองไม่ถูกต้อง", "error");
  if (isNaN(discount) || discount < 1 || discount > 100) return showMessage("ส่วนลดต้องอยู่ระหว่าง 1-100%", "error");
  if (expireDate <= new Date()) return showMessage("วันหมดอายุต้องเป็นอนาคต", "error");
  try {
    addBtn.disabled = true;
    const existing = await getDocs(query(couponsRef, where("code", "==", code)));
    if (!existing.empty) throw new Error("รหัสนี้มีอยู่แล้ว");
    await addDoc(couponsRef, {
      code,
      discount,
      expireDate: Timestamp.fromDate(expireDate),
      isActive: true,
      createdAt: serverTimestamp(),
    });
    codeInput.value = "";
    discountInput.value = "";
    expireDateInput.value = "";
    showMessage("เพิ่มคูปองเรียบร้อยแล้ว");
    loadCoupons();
  } catch (err) {
    showMessage(err.message, "error");
  } finally {
    addBtn.disabled = false;
  }
});

codeInput.addEventListener("input", e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
discountInput.addEventListener("input", e => {
  let v = Number(e.target.value);
  if (v > 100) e.target.value = 100;
  if (v < 0) e.target.value = 0;
});

document.addEventListener("DOMContentLoaded", () => loadCoupons());
window.loadCoupons = loadCoupons;
