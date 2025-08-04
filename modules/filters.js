import { renderOrders } from './render_orders.js';
import { allOrders } from './firebase_order_listener.js';

export function setupFilters() {
  const dateInput = document.getElementById("filter-date");
  const monthInput = document.getElementById("filter-month");
  const statusInput = document.getElementById("filter-status");
  const btn = document.getElementById("filter-button");
  const tbody = document.getElementById("order-table-body");

  btn?.addEventListener("click", () => {
    const date = dateInput?.value;
    const month = monthInput?.value;
    const status = statusInput?.value;

    const filtered = allOrders.filter(o => {
      if (!o.createdAt) return false;
      const d = o.createdAt.toDate();
      const matchDate = date ? d.toISOString().startsWith(date) : true;
      const matchMonth = month ? d.getMonth() + 1 === parseInt(month) : true;
      const matchStatus = status ? o.deliveryStatus === status : true;
      return matchDate && matchMonth && matchStatus;
    });

    renderOrders(filtered, tbody);
  });
}