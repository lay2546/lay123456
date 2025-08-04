import { listenToOrders } from './modules/firebase_order_listener.js';
import { renderOrders } from './modules/render_orders.js';
import { setupFilters } from './modules/filters.js';
import { verifySlipWithEasySlip } from './modules/slip_verifier.js';

export async function initAdminOrderPage() {
  const tbody = document.getElementById("order-table-body");
  if (!tbody) {
    console.error("❌ ไม่พบ <tbody> สำหรับแสดงรายการออเดอร์");
    return;
  }

  setupFilters(); // 🧠 ตัวกรองวันที่, สถานะ ฯลฯ

  listenToOrders(async (orders) => {
    if (!Array.isArray(orders)) return;

    renderOrders(orders, tbody); // 🎨 วาดรายการออเดอร์ในตาราง

    // 🔍 ตรวจสอบสลิปแบบอัตโนมัติ (เฉพาะที่ยังไม่ verify)
    for (const order of orders) {
      const el = document.getElementById(`status-${order.id}`);
      if (order.slipUrl && el && !order.paymentVerified) {
        try {
          await verifySlipWithEasySlip({
            slipUrl: order.slipUrl,
            expectedTotal: order.totalAmount || order.total || 0,
            expectedName: order.name || '',
            docId: order.id,
            statusEl: el
          });
        } catch (err) {
          console.warn(`⛔ ไม่สามารถตรวจสอบสลิปอัตโนมัติ: ${order.id}`, err);
        }
      }
    }
  });
}
