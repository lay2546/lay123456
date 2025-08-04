import { formatThaiDateTime } from './ui_helpers.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { db } from '../firebase.js';
import { verifySlipWithEasySlip } from './slip_verifier.js';

function renderTotalWithDiscount(order) {
  if (!order.cart || !Array.isArray(order.cart)) return '฿0.00';
  const subtotal = order.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountPercent = order.discountPercent || 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const final = subtotal - discountAmount;
  const formatted = `฿${final.toFixed(2)}`;

  return discountPercent > 0
    ? `${formatted}<br><span class="text-xs text-green-600 block">ลด ${discountPercent}% (−฿${discountAmount.toFixed(2)})</span>`
    : formatted;
}

function renderDeliveryStatusSelect(order) {
  const status = order.deliveryStatus || "prepare";
  const options = {
    prepare: "🟡 เตรียมสินค้า",
    shipping: "🔵 กำลังจัดส่ง",
    shipped: "🟢 จัดส่งแล้ว",
    cancelled: "🔴 ยกเลิก"
  };

  return `
    <select data-id="${order.id}" class="status-select text-sm rounded border px-2 py-1 bg-white">
      ${Object.entries(options).map(([val, label]) =>
        `<option value="${val}" ${val === status ? 'selected' : ''}>${label}</option>`
      ).join('')}
    </select>
  `;
}

export function renderOrders(orders, container) {
  container.innerHTML = "";

  if (!orders.length) {
    container.innerHTML = '<tr><td colspan="13" class="text-center text-gray-500 py-4">ไม่พบรายการ</td></tr>';
    return;
  }

  orders.forEach(order => {
    const row = document.createElement('tr');
    const created = order.createdAt?.toDate ? formatThaiDateTime(order.createdAt.toDate()) : '-';
    const itemsText = (order.cart || []).map(item =>
      `${item.name} ×${item.quantity}`
    ).join("<br>");

    row.innerHTML = `
      <td class="text-center">
        <input type="checkbox" data-id="${order.id}" class="w-4 h-4 text-pink-600 rounded" />
      </td>
      <td>${order.name || '-'}</td>
      <td>${order.phone || '-'}</td>
      <td>${order.address || '-'}</td>
      <td>${order.deliveryOption || '-'}</td>
      <td class="text-sm leading-tight">${itemsText}</td>
      <td>${created}</td>
      <td class="text-pink-700 font-semibold">${renderTotalWithDiscount(order)}</td>
      <td>${order.paymentMethod === 'transfer' ? 'พร้อมเพย์' : order.paymentMethod === 'cod' ? 'ชำระเงินปลายทาง' : '–'}</td>
      <td>
        ${order.slipUrl 
          ? `<div class="flex flex-col gap-1">
              <a href="${order.slipUrl}" target="_blank" class="text-blue-500 underline text-sm">ดูสลิป</a>
              <button 
                data-docid="${order.id}" 
                data-total="${order.totalAmount || 0}" 
                data-name="${order.name || ''}" 
                data-url="${order.slipUrl}" 
                class="verify-slip-btn text-xs text-white bg-pink-500 hover:bg-pink-600 rounded px-2 py-1">
                ตรวจสอบสลิป
              </button>
            </div>`
          : '-'}
      </td>
      <td id="status-${order.id}" class="font-semibold">
        ${order.paymentVerified ? '✅ ชำระแล้ว' : '⏳ รอชำระเงิน'}
      </td>
      <td>${renderDeliveryStatusSelect(order)}</td>
      <td>⚙️</td>
    `;

    container.appendChild(row);
  });
}

// 📌 ตรวจสอบสลิป
document.addEventListener("click", async (e) => {
  if (e.target.matches(".verify-slip-btn")) {
    const btn = e.target;
    const slipUrl = btn.dataset.url;
    const total = parseFloat(btn.dataset.total);
    const name = btn.dataset.name;
    const docId = btn.dataset.docid;
    const statusEl = document.getElementById(`status-${docId}`);
    const modal = document.getElementById("slip-modal");
    const modalBody = document.getElementById("slip-modal-body");

    // เปิด popup
    modal.classList.remove("hidden");
    modalBody.innerHTML = `<div class="text-sm text-gray-600">⏳ กำลังตรวจสอบสลิปจาก <span class="font-medium text-pink-600">${name}</span>...</div>`;

    try {
      const { verifySlipWithEasySlip } = await import('../modules/slip_verifier.js');
      await verifySlipWithEasySlip({
        slipUrl,
        expectedTotal: total,
        expectedName: name,
        docId,
        statusEl
      });

      modalBody.innerHTML = `<div class="text-green-600 font-semibold">✅ ตรวจสอบเสร็จสิ้น</div>`;
    } catch (err) {
      console.error("❌ Error verifying slip", err);
      modalBody.innerHTML = `<div class="text-red-600 font-medium">❌ ตรวจสอบล้มเหลว: ${err.message || 'เกิดข้อผิดพลาด'}</div>`;
    }
  }
});

// ปุ่มปิด modal
document.getElementById("slip-modal-close")?.addEventListener("click", () => {
  document.getElementById("slip-modal")?.classList.add("hidden");
});


// 🔄 อัปเดตสถานะจัดส่ง
document.addEventListener("change", async (e) => {
  if (e.target.matches(".status-select")) {
    const newStatus = e.target.value;
    const orderId = e.target.dataset.id;
    try {
      await updateDoc(doc(db, "orders", orderId), { deliveryStatus: newStatus });
      e.target.classList.add("ring-2", "ring-green-400");
      setTimeout(() => e.target.classList.remove("ring-2", "ring-green-400"), 1500);
    } catch (err) {
      console.error("❌ อัปเดตไม่สำเร็จ:", err);
      alert("ไม่สามารถอัปเดตสถานะได้");
    }
  }
});
