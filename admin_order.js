// Enhanced OCR with detailed amount detection and tolerant verification
import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// DOM Elements
const tbody = document.getElementById("order-table-body");
const deleteSelectedBtn = document.getElementById("delete-selected");
const selectAllCheckbox = document.getElementById("select-all");
const grandTotalEl = document.getElementById("grand-total");
const totalOrdersEl = document.getElementById("total-orders");
const todayOrdersEl = document.getElementById("today-orders");
const filterDate = document.getElementById("filter-date");
const filterMonth = document.getElementById("filter-month");
const filterStatus = document.getElementById("filter-status");
const refreshBtn = document.getElementById("refresh-button");
const exportBtn = document.getElementById("export-button");
const loadingIndicator = document.getElementById("loading-indicator");

// Global Variables
let allOrders = [];
let isLoading = false;

// Enhanced Loading State Management
function showLoading() {
  if (loadingIndicator) {
    loadingIndicator.classList.remove("hidden");
  }
  isLoading = true;
}

function hideLoading() {
  if (loadingIndicator) {
    loadingIndicator.classList.add("hidden");
  }
  isLoading = false;
}

// Enhanced Firebase Query with Error Handling
const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

onSnapshot(
  q,
  (snapshot) => {
    try {
      showLoading();
      allOrders = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        allOrders.push({ id: docId, ...data });
      });
      renderOrders();
      updateStatistics();
    } catch (error) {
      console.error("Error loading orders:", error);
      showNotification("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    } finally {
      hideLoading();
    }
  },
  (error) => {
    console.error("Firestore listener error:", error);
    showNotification("ไม่สามารถเชื่อมต่อฐานข้อมูลได้", "error");
    hideLoading();
  }
);

// Enhanced Statistics Update
function updateStatistics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = allOrders.filter((order) => {
    if (!order.createdAt) return false;
    const orderDate = order.createdAt.toDate();
    return orderDate >= today;
  });

  if (totalOrdersEl) totalOrdersEl.textContent = allOrders.length;
  if (todayOrdersEl) todayOrdersEl.textContent = todayOrders.length;
}

// Enhanced Order Rendering with Better UI
function renderOrders() {
  if (!tbody) return;

  tbody.innerHTML = "";
  let totalAllOrders = 0;

  const selectedDate = filterDate?.value;
  const selectedMonth = filterMonth?.value;
  const selectedStatus = filterStatus?.value;

  const filteredOrders = allOrders.filter((order) => {
    if (!order.createdAt) return false;

    const dateObj = order.createdAt.toDate();
    const dateStr = dateObj.toISOString().split("T")[0];
    const monthStr = (dateObj.getMonth() + 1).toString().padStart(2, "0");

    // Date filters
    if (selectedDate && dateStr !== selectedDate) return false;
    if (selectedMonth && monthStr !== selectedMonth) return false;

    // Status filter
    if (selectedStatus) {
      if (selectedStatus === "pending" && order.paymentVerified) return false;
      if (selectedStatus === "paid" && !order.paymentVerified) return false;
      if (selectedStatus === "shipped" && order.deliveryStatus !== "shipping")
        return false;
      if (
        selectedStatus === "delivered" &&
        order.deliveryStatus !== "delivered"
      )
        return false;
    }

    return true;
  });

  filteredOrders.forEach((data, index) => {
    const docId = data.id;
    const cartItems = (data.cart || [])
      .map(
        (item) =>
          `<li class="flex justify-between items-center py-1">
        <span>${item.name} x${item.quantity || 1}</span>
        <span class="font-semibold">฿${item.price}</span>
      </li>`
      )
      .join("");

    const orderTotal = (data.cart || []).reduce(
      (sum, item) => sum + (item.quantity || 1) * parseFloat(item.price || 0),
      0
    );

    const discountPercent = parseFloat(data.discountPercent || 0);
    const discountAmount = orderTotal * (discountPercent / 100);
    const finalTotal = orderTotal - discountAmount;
    totalAllOrders += finalTotal;

    const slipStatusId = `status-${docId}`;
    const paymentStatus = getPaymentStatusHtml(data, slipStatusId);
    const slipHtml = getSlipHtml(data, orderTotal, docId);

    const tr = document.createElement("tr");
    tr.classList.add(
      "table-row",
      "border-b",
      "hover:bg-pink-50/30",
      "transition-all",
      "duration-200"
    );

    // Add alternating row colors
    if (index % 2 === 0) {
      tr.classList.add("bg-gray-50/30");
    }

    tr.innerHTML = `
      <td class="text-center">
        <input type="checkbox" class="select-order w-4 h-4 text-pink-600 rounded focus:ring-pink-500" data-id="${docId}" />
      </td>
      <td class="font-medium">${data.name || "-"}</td>
      <td>${formatPhoneNumber(data.phone) || "-"}</td>
      <td class="max-w-xs truncate" title="${data.address || "-"}">${
      data.address || "-"
    }</td>
      <td>${getDeliveryOptionDisplay(data.deliveryOption)}</td>
      <td>
        <div class="max-w-xs">
          <ul class="text-sm space-y-1">${cartItems}</ul>
        </div>
      </td>
      <td class="text-sm">${
        data.createdAt ? formatThaiDateTime(data.createdAt.toDate()) : "-"
      }</td>
      <td class="text-green-600 font-bold">
        ฿${finalTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
        ${
          discountPercent > 0
            ? `<div class="text-xs text-pink-500 mt-1">ส่วนลด ${discountPercent}% (-฿${discountAmount.toFixed(
                2
              )})</div>`
            : ""
        }
      </td>
      <td>${getPaymentMethodDisplay(data.paymentMethod)}</td>
      <td class="text-center">${slipHtml}</td>
      <td class="text-center">${paymentStatus}</td>
      <td>
        <div class="space-y-2">
          ${renderStatusBadge(data.deliveryStatus)}
          <div class="text-xs text-gray-600">
            ${getDeliveryStatusLabel(data.deliveryStatus)}
          </div>
          ${renderStepProgress(data.deliveryStatus)}
        </div>
      </td>
      <td>
        <div class="flex flex-col gap-1">
          ${renderActionButtons(docId, data.deliveryStatus)}
        </div>
      </td>
    `;

    tbody.appendChild(tr);

    // Auto-verify slip if exists
    if (
      data.paymentMethod === "transfer" &&
      data.slipUrl &&
      !data.paymentVerified
    ) {
      setTimeout(
        () => verifySlip(data.slipUrl, finalTotal, data.name, docId, false),
        500
      );
    }
  });

  // Update grand total with animation
  if (grandTotalEl) {
    const currentTotal = parseFloat(
      grandTotalEl.textContent.replace(/,/g, "") || 0
    );
    animateNumber(grandTotalEl, currentTotal, totalAllOrders);
  }
}

// Enhanced Helper Functions
function formatPhoneNumber(phone) {
  if (!phone) return null;
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
}

function getDeliveryOptionDisplay(option) {
  const options = {
    pickup: "🏪 รับที่ร้าน",
    delivery: "🚚 จัดส่ง",
    express: "⚡ ด่วนพิเศษ",
  };
  return options[option] || option || "-";
}

function getPaymentMethodDisplay(method) {
  return method === "transfer" ? "💳 พร้อมเพย์" : "💰 ปลายทาง";
}

function getPaymentStatusHtml(data, slipStatusId) {
  if (data.paymentMethod !== "transfer") {
    return '<span class="status-badge bg-yellow-500 text-white">📦 ปลายทาง</span>';
  }

  if (!data.slipUrl) {
    return '<span class="status-badge bg-red-500 text-white">❌ ยังไม่ชำระ</span>';
  }

  if (data.paymentVerified === true) {
    return '<span class="status-badge bg-green-500 text-white">✅ ตรวจสอบแล้ว</span>';
  }

  if (data.paymentVerified === false) {
    return '<span class="status-badge bg-red-500 text-white">❌ ตรวจสอบไม่ผ่าน</span>';
  }

  return `<span id="${slipStatusId}" class="status-badge bg-gray-500 text-white">⏳ กำลังตรวจ...</span>`;
}

function getSlipHtml(data, orderTotal, docId) {
  if (!data.slipUrl) return "-";

  return `
    <div class="flex flex-col items-center space-y-2">
      <a href="${data.slipUrl}" target="_blank" class="block">
        <img src="${data.slipUrl}" class="w-16 h-20 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow" 
             alt="Payment Slip" />
      </a>
      <button onclick="verifySlip('${data.slipUrl}', '${orderTotal}', '${data.name}', '${docId}', true)" 
              class="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors">
        🔍 ตรวจสลิป
      </button>
    </div>
  `;
}

// 🔁 ปรับใหม่: ฟังก์ชัน renderActionButtons()
function renderActionButtons(docId, currentStatus) {
  const statuses = [
    { value: "preparing", label: "🛠 เตรียมสินค้า" },
    { value: "shipping", label: "🚚 กำลังจัดส่ง" },
    { value: "delivered", label: "✅ จัดส่งแล้ว" },
  ];

  const optionsHtml = statuses
    .map(
      (status) => `
    <option value="${status.value}" ${
        currentStatus === status.value ? "selected" : ""
      }>
      ${status.label}
    </option>
  `
    )
    .join("");

  return `
    <div class="flex flex-col gap-2">
      <select class="status-dropdown border rounded px-3 py-1 text-sm text-gray-800 focus:ring-pink-500" data-id="${docId}">
        ${optionsHtml}
      </select>
      <button class="update-status-btn bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 rounded-md text-sm transition">
        อัปเดตสถานะ
      </button>
      <button class="delete-btn bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-md transition" data-id="${docId}">
        🗑️ ลบ
      </button>
    </div>
  `;
}

// Enhanced OCR Functions
function preprocessImage(imageUrl, callback) {
  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Scale image for better OCR
    const scale = Math.min(800 / img.width, 600 / img.height, 1);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    // Draw and enhance image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply contrast and brightness enhancement
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const enhanced =
        gray > 128 ? Math.min(255, gray * 1.2) : Math.max(0, gray * 0.8);
      data[i] = data[i + 1] = data[i + 2] = enhanced;
    }

    ctx.putImageData(imageData, 0, 0);
    callback(canvas.toDataURL());
  };

  img.onerror = () => {
    console.error("Failed to load image for OCR");
    callback(null);
  };

  img.src = imageUrl;
}

function enhancedFuzzyMatch(text, keyword) {
  const cleanText = text.toLowerCase().replace(/\s+/g, "");
  const cleanKeyword = keyword.toLowerCase().replace(/\s+/g, "");

  // Direct match
  if (cleanText.includes(cleanKeyword)) return true;

  // Character matching with threshold
  let matchCount = 0;
  for (const char of cleanKeyword) {
    if (cleanText.includes(char)) matchCount++;
  }

  return matchCount / cleanKeyword.length >= 0.7;
}

// Enhanced Slip Verification
window.verifySlip = function (
  url,
  expectedTotal,
  expectedName,
  docId,
  manual = true
) {
  if (!url) return;

  const statusEl = document.getElementById(`status-${docId}`);
  if (statusEl && !manual) {
    statusEl.innerHTML = `<span class='status-badge bg-blue-500 text-white'>🔄 กำลังตรวจ...</span>`;
  }

  preprocessImage(url, async (processedImage) => {
    if (!processedImage) {
      if (statusEl) {
        statusEl.innerHTML = `<span class='status-badge bg-red-500 text-white'>❌ ไม่สามารถอ่านรูป</span>`;
      }
      return;
    }

    try {
      const result = await Tesseract.recognize(processedImage, "tha+eng", {
        tessedit_char_whitelist: "0123456789.,บาท THB",
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });

      const text = result.data.text;
      const expected = Number(expectedTotal);

      // Enhanced amount detection
      let amountText = "ไม่พบ";
      let isAmountMatch = false;

      // Multiple patterns for amount detection
      const patterns = [
        /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:บาท|THB|baht)/gi,
        /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      ];

      for (const pattern of patterns) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
          const cleanMatch = match.replace(/[^\d.,]/g, "");
          const num = parseFloat(cleanMatch.replace(/,/g, ""));

          if (!isNaN(num) && Math.abs(num - expected) <= 1) {
            amountText = match;
            isAmountMatch = true;
            break;
          }
        }
        if (isAmountMatch) break;
      }

      // Enhanced name matching
      const isNameMatch = enhancedFuzzyMatch(text, expectedName);

      // Update database and UI
      const docRef = doc(db, "orders", docId);
      let verificationStatus = false;

      if (statusEl) {
        if (!isAmountMatch && !isNameMatch) {
          statusEl.innerHTML = `<span class='status-badge bg-red-500 text-white'>❌ ยอดและชื่อไม่ตรง</span>`;
        } else if (!isAmountMatch) {
          statusEl.innerHTML = `<span class='status-badge bg-orange-500 text-white'>⚠️ ยอดไม่ตรง</span>`;
        } else if (!isNameMatch) {
          statusEl.innerHTML = `<span class='status-badge bg-orange-500 text-white'>⚠️ ชื่อไม่ชัดเจน</span>`;
          verificationStatus = true; // Allow if amount matches
        } else {
          statusEl.innerHTML = `<span class='status-badge bg-green-500 text-white'>✅ ตรวจสอบผ่าน</span>`;
          verificationStatus = true;
        }
      }

      await updateDoc(docRef, { paymentVerified: verificationStatus });

      if (manual) {
        showSlipVerificationModal({
          amountText,
          isAmountMatch,
          isNameMatch,
          expectedTotal,
          expectedName,
          fullText: text,
        });
      }
    } catch (error) {
      console.error("OCR Error:", error);
      if (statusEl) {
        statusEl.innerHTML = `<span class='status-badge bg-red-500 text-white'>❌ ตรวจสอบไม่ได้</span>`;
      }
      if (manual) {
        showNotification("เกิดข้อผิดพลาดในการตรวจสอบสลิป", "error");
      }
    }
  });
};

// Enhanced UI Functions
function showSlipVerificationModal(data) {
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-md w-full animate-fade-in">
      <h3 class="text-xl font-bold text-gray-800 mb-4">📋 ผลการตรวจสอบสลิป</h3>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">ยอดบนสลิป:</span>
          <span class="font-semibold ${
            data.isAmountMatch ? "text-green-600" : "text-red-600"
          }">${data.amountText}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">ยอดที่ต้องชำระ:</span>
          <span class="font-semibold">฿${data.expectedTotal}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">การตรวจสอบชื่อ:</span>
          <span class="font-semibold ${
            data.isNameMatch ? "text-green-600" : "text-orange-600"
          }">
            ${data.isNameMatch ? "✅ พบชื่อใกล้เคียง" : "⚠️ ไม่พบชื่อชัดเจน"}
          </span>
        </div>
        <div class="border-t pt-3">
          <span class="text-gray-600">สถานะ:</span>
          <div class="mt-1">
            <span class="status-badge ${
              data.isAmountMatch ? "bg-green-500" : "bg-red-500"
            } text-white">
              ${data.isAmountMatch ? "✅ ยอดถูกต้อง" : "❌ ยอดไม่ตรง"}
            </span>
          </div>
        </div>
      </div>
      <div class="mt-6 flex justify-end space-x-3">
        <button onclick="this.closest('.fixed').remove()" 
                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">
          ปิด
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-orange-500",
    info: "bg-blue-500",
  };

  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in`;
  notification.textContent = message;

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function animateNumber(element, start, end) {
  const duration = 500;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = start + (end - start) * progress;

    element.textContent = current.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
    });

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// Enhanced Utility Functions
function formatThaiDateTime(date) {
  if (!date) return "-";
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getDeliveryStatusLabel(status) {
  const labels = {
    preparing: "🛠 เตรียมสินค้า",
    shipping: "🚚 กำลังจัดส่ง",
    delivered: "✅ จัดส่งแล้ว",
  };
  return labels[status] || "⏳ รอดำเนินการ";
}

function renderStatusBadge(status) {
  const configs = {
    preparing: { color: "bg-yellow-500", text: "text-white" },
    shipping: { color: "bg-blue-500", text: "text-white" },
    delivered: { color: "bg-green-500", text: "text-white" },
    default: { color: "bg-gray-400", text: "text-white" },
  };

  const config = configs[status] || configs.default;
  const label = getDeliveryStatusLabel(status);

  return `<span class="status-badge ${config.color} ${config.text}">${label}</span>`;
}

const ORDER_STEPS = ["preparing", "shipping", "delivered"];

function renderStepProgress(currentStatus) {
  const currentIndex = ORDER_STEPS.indexOf(currentStatus);

  return `
    <div class="flex items-center space-x-1 mt-2">
      ${ORDER_STEPS.map((status, index) => {
        const isActive = index <= currentIndex;
        const isLast = index === ORDER_STEPS.length - 1;
        return `
          <div class="flex items-center">
            <div class="w-2 h-2 rounded-full ${
              isActive ? "bg-green-500" : "bg-gray-300"
            }"></div>
            ${!isLast ? '<div class="w-4 h-0.5 bg-gray-300 mx-1"></div>' : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// Enhanced Event Listeners
tbody?.addEventListener("click", async (e) => {
  const target = e.target;

  if (target.classList.contains("status-btn")) {
    const orderId = target.dataset.id;
    const newStatus = target.dataset.status;

    try {
      showLoading();
      await updateDoc(doc(db, "orders", orderId), {
        deliveryStatus: newStatus,
      });
      showNotification(
        `✅ เปลี่ยนสถานะเป็น "${getDeliveryStatusLabel(newStatus)}" แล้ว`,
        "success"
      );
    } catch (err) {
      console.error("Status update error:", err);
      showNotification("เกิดข้อผิดพลาดในการอัปเดตสถานะ", "error");
    } finally {
      hideLoading();
    }
  }

  // ✅ NEW: handle update-status button click
  if (target.classList.contains("update-status-btn")) {
    const container = target.closest("td");
    const selectEl = container.querySelector(".status-dropdown");
    const newStatus = selectEl?.value;
    const orderId = selectEl?.dataset.id;

    try {
      showLoading();
      await updateDoc(doc(db, "orders", orderId), {
        deliveryStatus: newStatus,
      });
      showNotification(
        `✅ เปลี่ยนสถานะเป็น "${getDeliveryStatusLabel(newStatus)}" แล้ว`,
        "success"
      );
    } catch (err) {
      console.error("Status update error:", err);
      showNotification("เกิดข้อผิดพลาดในการอัปเดตสถานะ", "error");
    } finally {
      hideLoading();
    }
  }

  if (target.classList.contains("delete-btn")) {
    const id = target.dataset.id;
    if (confirm("คุณต้องการลบออเดอร์นี้ใช่หรือไม่?")) {
      try {
        showLoading();
        await deleteDoc(doc(db, "orders", id));
        showNotification("✅ ลบออเดอร์เรียบร้อย", "success");
      } catch (err) {
        console.error("Delete error:", err);
        showNotification("เกิดข้อผิดพลาดในการลบ", "error");
      } finally {
        hideLoading();
      }
    }
  }
});

// Filter Events
document.getElementById("filter-button")?.addEventListener("click", () => {
  showLoading();
  setTimeout(() => {
    renderOrders();
    hideLoading();
  }, 300);
});

// Select All Event
selectAllCheckbox?.addEventListener("change", (e) => {
  const allCheckboxes = document.querySelectorAll(".select-order");
  allCheckboxes.forEach((cb) => (cb.checked = e.target.checked));
});

// Delete Selected Event
deleteSelectedBtn?.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".select-order:checked");
  if (checkboxes.length === 0) {
    showNotification("⚠️ กรุณาเลือกออเดอร์ที่ต้องการลบก่อน", "warning");
    return;
  }

  if (!confirm(`ต้องการลบ ${checkboxes.length} รายการใช่หรือไม่?`)) return;

  try {
    showLoading();
    const deletePromises = Array.from(checkboxes).map((checkbox) =>
      deleteDoc(doc(db, "orders", checkbox.dataset.id))
    );

    await Promise.all(deletePromises);
    showNotification(
      `✅ ลบ ${checkboxes.length} รายการเรียบร้อยแล้ว`,
      "success"
    );
    selectAllCheckbox.checked = false;
  } catch (err) {
    console.error("Bulk delete error:", err);
    showNotification("เกิดข้อผิดพลาดในการลบ", "error");
  } finally {
    hideLoading();
  }
});

// Refresh Event
refreshBtn?.addEventListener("click", () => {
  showLoading();
  setTimeout(() => {
    renderOrders();
    updateStatistics();
    hideLoading();
    showNotification("✅ รีเฟรชข้อมูลเรียบร้อย", "success");
  }, 500);
});

// Export Event
exportBtn?.addEventListener("click", () => {
  exportToExcel();
});

// Enhanced Export Function
function exportToExcel() {
  try {
    const exportData = allOrders.map((order) => ({
      ชื่อลูกค้า: order.name || "-",
      เบอร์โทร: order.phone || "-",
      ที่อยู่: order.address || "-",
      วิธีจัดส่ง: getDeliveryOptionDisplay(order.deliveryOption),
      วิธีชำระเงิน: getPaymentMethodDisplay(order.paymentMethod),
      ยอดรวม: (order.cart || []).reduce(
        (sum, item) => sum + (item.quantity || 1) * parseFloat(item.price || 0),
        0
      ),
      สถานะชำระเงิน: order.paymentVerified ? "ชำระแล้ว" : "ยังไม่ชำระ",
      สถานะการจัดส่ง: getDeliveryStatusLabel(order.deliveryStatus),
      วันที่สั่งซื้อ: order.createdAt
        ? formatThaiDateTime(order.createdAt.toDate())
        : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    // Auto-adjust column widths
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws["!cols"] = colWidths;

    const fileName = `orders_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showNotification("✅ ส่งออกข้อมูลเรียบร้อย", "success");
  } catch (error) {
    console.error("Export error:", error);
    showNotification("❌ เกิดข้อผิดพลาดในการส่งออกข้อมูล", "error");
  }
}

// Enhanced Stock Deduction Function
export async function deductStock(productId, quantityToDeduct) {
  try {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      throw new Error("ไม่พบข้อมูลสินค้า");
    }

    const productData = productSnap.data();
    const currentQuantity = productData.quantity ?? 0;

    if (currentQuantity < quantityToDeduct) {
      throw new Error(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ: ${currentQuantity}, ต้องการ: ${quantityToDeduct})`
      );
    }

    const newQuantity = Math.max(0, currentQuantity - quantityToDeduct);

    await updateDoc(productRef, {
      quantity: newQuantity,
      lastUpdated: new Date(),
    });

    // Log stock movement
    console.log(
      `Stock updated for ${productData.name}: ${currentQuantity} → ${newQuantity}`
    );

    return {
      success: true,
      oldQuantity: currentQuantity,
      newQuantity: newQuantity,
      productName: productData.name,
    };
  } catch (error) {
    console.error("Stock deduction error:", error);
    throw error;
  }
}

// Advanced Search and Filter Functions
function setupAdvancedFilters() {
  // Real-time search
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "🔍 ค้นหาชื่อลูกค้า, เบอร์โทร, หรือที่อยู่...";
  searchInput.className =
    "input-field border rounded-xl px-4 py-3 bg-white w-full";
  searchInput.addEventListener(
    "input",
    debounce((e) => {
      filterBySearch(e.target.value);
    }, 300)
  );

  // Add search input to filter section
  const filterContainer = document.querySelector(
    ".grid.grid-cols-1.md\\:grid-cols-3.lg\\:grid-cols-4"
  );
  if (filterContainer) {
    const searchDiv = document.createElement("div");
    searchDiv.innerHTML = `
      <label class="block font-medium mb-2 text-gray-700">🔍 ค้นหา:</label>
    `;
    searchDiv.appendChild(searchInput);
    filterContainer.appendChild(searchDiv);
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function filterBySearch(searchTerm) {
  if (!searchTerm.trim()) {
    renderOrders();
    return;
  }

  const filtered = allOrders.filter((order) => {
    const searchText = `${order.name || ""} ${order.phone || ""} ${
      order.address || ""
    }`.toLowerCase();
    return searchText.includes(searchTerm.toLowerCase());
  });

  renderFilteredOrders(filtered);
}

function renderFilteredOrders(orders) {
  // Similar to renderOrders but with filtered data
  tbody.innerHTML = "";
  let totalFiltered = 0;

  orders.forEach((data, index) => {
    // Same rendering logic as renderOrders
    const docId = data.id;
    const cartItems = (data.cart || [])
      .map(
        (item) =>
          `<li class="flex justify-between items-center py-1">
        <span>${item.name} x${item.quantity || 1}</span>
        <span class="font-semibold">฿${item.price}</span>
      </li>`
      )
      .join("");

    const orderTotal = (data.cart || []).reduce(
      (sum, item) => sum + (item.quantity || 1) * parseFloat(item.price || 0),
      0
    );

    const discountPercent = parseFloat(data.discountPercent || 0);
    const discountAmount = orderTotal * (discountPercent / 100);
    const finalTotal = orderTotal - discountAmount;
    totalFiltered += finalTotal;

    const tr = document.createElement("tr");
    tr.classList.add(
      "table-row",
      "border-b",
      "hover:bg-pink-50/30",
      "transition-all",
      "duration-200"
    );

    if (index % 2 === 0) {
      tr.classList.add("bg-gray-50/30");
    }

    tr.innerHTML = `
      <td class="text-center">
        <input type="checkbox" class="select-order w-4 h-4 text-pink-600 rounded focus:ring-pink-500" data-id="${docId}" />
      </td>
      <td class="font-medium">${data.name || "-"}</td>
      <td>${formatPhoneNumber(data.phone) || "-"}</td>
      <td class="max-w-xs truncate" title="${data.address || "-"}">${
      data.address || "-"
    }</td>
      <td>${getDeliveryOptionDisplay(data.deliveryOption)}</td>
      <td>
        <div class="max-w-xs">
          <ul class="text-sm space-y-1">${cartItems}</ul>
        </div>
      </td>
      <td class="text-sm">${
        data.createdAt ? formatThaiDateTime(data.createdAt.toDate()) : "-"
      }</td>
      <td class="text-green-600 font-bold">
        ฿${finalTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
        ${
          discountPercent > 0
            ? `<div class="text-xs text-pink-500 mt-1">ส่วนลด ${discountPercent}% (-฿${discountAmount.toFixed(
                2
              )})</div>`
            : ""
        }
      </td>
      <td>${getPaymentMethodDisplay(data.paymentMethod)}</td>
      <td class="text-center">${getSlipHtml(data, orderTotal, docId)}</td>
      <td class="text-center">${getPaymentStatusHtml(
        data,
        `status-${docId}`
      )}</td>
      <td>
        <div class="space-y-2">
          ${renderStatusBadge(data.deliveryStatus)}
          <div class="text-xs text-gray-600">
            ${getDeliveryStatusLabel(data.deliveryStatus)}
          </div>
          ${renderStepProgress(data.deliveryStatus)}
        </div>
      </td>
      <td>
        <div class="flex flex-col gap-1">
          ${renderActionButtons(docId, data.deliveryStatus)}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Update filtered total
  if (grandTotalEl) {
    grandTotalEl.textContent = totalFiltered.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
    });
  }
}

// Print Function
function printOrderList() {
  const printWindow = window.open("", "_blank");
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>รายการสั่งซื้อ</title>
      <style>
        body { font-family: 'Sarabun', sans-serif; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .header { text-align: center; margin-bottom: 20px; }
        .total { text-align: right; font-weight: bold; font-size: 14px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>รายการสั่งซื้อทั้งหมด</h1>
        <p>วันที่พิมพ์: ${new Date().toLocaleDateString("th-TH")}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ชื่อลูกค้า</th>
            <th>เบอร์โทร</th>
            <th>ที่อยู่</th>
            <th>รายการสินค้า</th>
            <th>ยอดรวม</th>
            <th>สถานะ</th>
            <th>วันที่สั่ง</th>
          </tr>
        </thead>
        <tbody>
          ${allOrders
            .map((order, index) => {
              const cartItems = (order.cart || [])
                .map((item) => `${item.name} x${item.quantity || 1}`)
                .join(", ");
              const total = (order.cart || []).reduce(
                (sum, item) =>
                  sum + (item.quantity || 1) * parseFloat(item.price || 0),
                0
              );
              return `
              <tr>
                <td>${index + 1}</td>
                <td>${order.name || "-"}</td>
                <td>${order.phone || "-"}</td>
                <td>${order.address || "-"}</td>
                <td>${cartItems}</td>
                <td>฿${total.toFixed(2)}</td>
                <td>${getDeliveryStatusLabel(order.deliveryStatus)}</td>
                <td>${
                  order.createdAt
                    ? formatThaiDateTime(order.createdAt.toDate())
                    : "-"
                }</td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
      
      <div class="total">
        <p>จำนวนออเดอร์ทั้งหมด: ${allOrders.length} รายการ</p>
        <p>ยอดรวมทั้งหมด: ฿${grandTotalEl?.textContent || "0.00"}</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
}

// Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl+R or F5 for refresh
  if ((e.ctrlKey && e.key === "r") || e.key === "F5") {
    e.preventDefault();
    refreshBtn?.click();
  }

  // Ctrl+E for export
  if (e.ctrlKey && e.key === "e") {
    e.preventDefault();
    exportBtn?.click();
  }

  // Ctrl+P for print
  if (e.ctrlKey && e.key === "p") {
    e.preventDefault();
    printOrderList();
  }

  // Delete key for delete selected
  if (e.key === "Delete") {
    const selected = document.querySelectorAll(".select-order:checked");
    if (selected.length > 0) {
      deleteSelectedBtn?.click();
    }
  }
});

// Auto-refresh every 5 minutes
setInterval(() => {
  if (!isLoading) {
    console.log("Auto-refreshing order data...");
    updateStatistics();
  }
}, 5 * 60 * 1000);

// Initialize enhanced features when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setupAdvancedFilters();

  // Add print button
  const actionContainer = document.querySelector(".flex.flex-wrap.gap-3");
  if (actionContainer) {
    const printBtn = document.createElement("button");
    printBtn.className =
      "bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:transform hover:scale-105 flex items-center gap-2";
    printBtn.innerHTML = "<span>🖨️</span> พิมพ์รายการ";
    printBtn.onclick = printOrderList;
    actionContainer.appendChild(printBtn);
  }

  // Add keyboard shortcuts info
  const shortcutsInfo = document.createElement("div");
  shortcutsInfo.className = "text-xs text-gray-500 mt-2";
  shortcutsInfo.innerHTML = `
    <details>
      <summary class="cursor-pointer hover:text-gray-700">⌨️ คีย์ลัด</summary>
      <div class="mt-2 space-y-1">
        <div>Ctrl+R หรือ F5: รีเฟรช</div>
        <div>Ctrl+E: ส่งออกข้อมูล</div>
        <div>Ctrl+P: พิมพ์รายการ</div>
        <div>Delete: ลบรายการที่เลือก</div>
      </div>
    </details>
  `;

  const mainElement = document.querySelector("main");
  if (mainElement) {
    mainElement.appendChild(shortcutsInfo);
  }
});

// Performance monitoring
let performanceMetrics = {
  renderTime: 0,
  ocrTime: 0,
  dbOperations: 0,
};

function measurePerformance(operation, fn) {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  performanceMetrics[operation] = duration;

  if (duration > 1000) {
    console.warn(
      `Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`
    );
  }

  return result;
}

// Batch operations for better performance
class BatchProcessor {
  constructor(batchSize = 10, delay = 100) {
    this.batchSize = batchSize;
    this.delay = delay;
    this.queue = [];
    this.processing = false;
  }

  add(operation) {
    this.queue.push(operation);
    if (!this.processing) {
      this.process();
    }
  }

  async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);

      try {
        await Promise.all(batch.map((op) => op()));
      } catch (error) {
        console.error("Batch processing error:", error);
      }

      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delay));
      }
    }

    this.processing = false;
  }
}

const batchProcessor = new BatchProcessor();

// Export enhanced functions for external use
window.adminOrderManager = {
  verifySlip,
  deductStock,
  exportToExcel,
  printOrderList,
  showNotification,
  batchProcessor,
  performanceMetrics,
};

console.log("🚀 Enhanced Admin Order Management System loaded successfully!");
