import { db } from "../../../firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// 📌 DOM
const totalSalesEl = document.getElementById("total-sales");
const totalOrdersEl = document.getElementById("total-orders");
const salesChartEl = document.getElementById("salesChart");
const dateFilterEl = document.getElementById("date-filter");

const monthlySalesEl = document.createElement("p");
monthlySalesEl.className = "text-sm text-gray-600 mt-1 text-center";
totalSalesEl?.parentElement?.appendChild(monthlySalesEl);

// ✅ โหลดข้อมูล
async function loadDashboardData(selectedDate = null, filterMode = null) {
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt"));
    const snapshot = await getDocs(q);

    let totalSales = 0;
    let totalOrders = 0;
    let filteredSales = 0;
    const salesByDate = {};
    const now = new Date();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      if (!createdAt) return;

      const dateKey = createdAt.toISOString().split("T")[0];
      const selectedKey = selectedDate
        ? new Date(selectedDate).toISOString().split("T")[0]
        : null;

      const isSelected =
        (selectedDate && dateKey === selectedKey) ||
        (filterMode === "month" && isSameMonth(createdAt, now)) ||
        (filterMode === "year" && isSameYear(createdAt, now)) ||
        (!selectedDate && !filterMode);

      const orderTotal = (data.cart || []).reduce(
        (sum, item) => sum + (item.quantity || 1) * parseFloat(item.price || 0),
        0
      );

      const discountPercent = parseFloat(data.discountPercent || 0);
      const discountAmount = orderTotal * (discountPercent / 100);
      const finalTotal = orderTotal - discountAmount;

      totalSales += finalTotal;
      totalOrders += 1;

      if (isSelected) {
        filteredSales += finalTotal;
        salesByDate[dateKey] = (salesByDate[dateKey] || 0) + finalTotal;
      }
    });

    animateNumber(totalSalesEl, totalSales, "฿", "");
    animateNumber(totalOrdersEl, totalOrders, "", " รายการ");

    let label = "ทั้งหมด";
    if (selectedDate) label = `วันที่ ${formatThaiDate(selectedDate)}`;
    else if (filterMode === "month") label = "เดือนนี้";
    else if (filterMode === "year") label = "ปีนี้";

    monthlySalesEl.textContent = `ยอดขาย${label}: ฿${filteredSales.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    renderSalesChart(salesByDate);
  } catch (err) {
    console.error("โหลดข้อมูลผิดพลาด:", err);
  }
}

// ✅ กราฟ Chart.js
let chartInstance = null;
function renderSalesChart(data) {
  const labels = Object.keys(data).sort();
  const values = labels.map((date) => data[date]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(salesChartEl, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "ยอดขายรายวัน",
          data: values,
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) =>
              `฿${value.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`,
          },
        },
      },
    },
  });
}

// ✅ แสดงวันที่ไทย
function formatThaiDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ✅ Animation ตัวเลข
function animateNumber(element, finalNumber, prefix = "", suffix = "") {
  const duration = 1200;
  const start = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(startValue + (finalNumber - startValue) * easeOut);

    element.textContent = `${prefix}${currentValue.toLocaleString()}${suffix}`;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ✅ การ์ด slide-in
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px',
});

document.querySelectorAll('.card-hover').forEach(card => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(20px)';
  card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(card);
});

// ✅ ตรวจเดือน/ปี
function isSameMonth(date1, date2) {
  return date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}
function isSameYear(date1, date2) {
  return date1.getFullYear() === date2.getFullYear();
}

// ✅ เมื่อเปิดหน้า
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();

  // 👉 เมื่อเลือกวันที่
  dateFilterEl?.addEventListener("change", () => {
    const selected = dateFilterEl.value;
    loadDashboardData(selected);
  });

  // 👉 ดูทั้งหมด
  document.getElementById("btn-all")?.addEventListener("click", () =>
    loadDashboardData(null)
  );

  // 👉 เฉพาะเดือนนี้
  document.getElementById("btn-month")?.addEventListener("click", () =>
    loadDashboardData(null, "month")
  );

  // 👉 เฉพาะปีนี้
  document.getElementById("btn-year")?.addEventListener("click", () =>
    loadDashboardData(null, "year")
  );
});
