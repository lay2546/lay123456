import { db } from '../firebase.js';
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const totalSalesEl = document.getElementById("total-sales");
const totalOrdersEl = document.getElementById("total-orders");
const salesChartEl = document.getElementById("salesChart");
const dateFilterEl = document.getElementById("date-filter");
const monthlySalesEl = document.getElementById("monthly-sales");

let chartInstance = null;

function formatDateKey(date) {
  return date.toISOString().split("T")[0];
}

function formatThaiDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function isSameMonth(d1, d2) {
  return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
}

function isSameYear(d1, d2) {
  return d1.getFullYear() === d2.getFullYear();
}

function updateSummaryUI(total, orders, filtered, selectedDate, filterMode) {
  totalSalesEl.textContent = `฿${total.toLocaleString()}`;
  totalOrdersEl.textContent = `${orders} รายการ`;

  let label = "ทั้งหมด";
  if (selectedDate) label = `วันที่ ${formatThaiDate(selectedDate)}`;
  else if (filterMode === "month") label = "เดือนนี้";
  else if (filterMode === "year") label = "ปีนี้";

  monthlySalesEl.textContent = `ยอดขาย${label}: ฿${filtered.toLocaleString()}`;
}

function renderSalesChart(data) {
  const labels = Object.keys(data).sort();
  const values = labels.map(date => data[date]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(salesChartEl, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'ยอดขายรายวัน',
        data: values,
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => `฿${value.toLocaleString()}`
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => `ยอดขาย: ฿${context.raw.toLocaleString()}`
          }
        }
      }
    }
  });
}

async function loadDashboardData(selectedDate = null, filterMode = null) {
  try {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, orderBy("createdAt"));
    const snapshot = await getDocs(q);

    let totalSales = 0;
    let totalOrders = 0;
    let filteredSales = 0;
    const salesByDate = {};
    const now = new Date();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      if (!(createdAt instanceof Date)) return;

      const dateKey = formatDateKey(createdAt);
      const selectedKey = selectedDate ? formatDateKey(new Date(selectedDate)) : null;

      const isSelected =
        (selectedDate && dateKey === selectedKey) ||
        (filterMode === "month" && isSameMonth(createdAt, now)) ||
        (filterMode === "year" && isSameYear(createdAt, now)) ||
        (!selectedDate && !filterMode);

      let orderTotal = 0;

      if (Array.isArray(data.cart)) {
        data.cart.forEach((item) => {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          totalSales += itemTotal;
          if (isSelected) {
            filteredSales += itemTotal;
            orderTotal += itemTotal;
          }
        });
      }

      totalOrders += 1;
      if (isSelected) {
        salesByDate[dateKey] = (salesByDate[dateKey] || 0) + orderTotal;
      }
    });

    updateSummaryUI(totalSales, totalOrders, filteredSales, selectedDate, filterMode);
    renderSalesChart(salesByDate);
  } catch (err) {
    console.error("❌ โหลดข้อมูลผิดพลาด:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();

  dateFilterEl?.addEventListener("change", () => {
    loadDashboardData(dateFilterEl.value);
  });

  document.getElementById("btn-all")?.addEventListener("click", () => loadDashboardData(null));
  document.getElementById("btn-month")?.addEventListener("click", () => loadDashboardData(null, "month"));
  document.getElementById("btn-year")?.addEventListener("click", () => loadDashboardData(null, "year"));
});