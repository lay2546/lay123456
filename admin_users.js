import { db } from './firebase.js';
import {
  collection, getDocs, deleteDoc, doc, getDoc, updateDoc,
  query, where, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const userTableBody = document.getElementById("user-table-body");
const searchInput = document.getElementById("search-user");
const roleFilter = document.getElementById("filter-role");
const exportExcelBtn = document.getElementById("export-excel");
const totalUsersEl = document.getElementById("total-users");
const newUsersTodayEl = document.getElementById("new-users-today");
const totalOrdersEl = document.getElementById("total-orders");

const addressModal = document.getElementById("address-modal");
const addressContent = document.getElementById("address-content");
const closeAddressBtn = document.getElementById("close-address-modal");
const editModal = document.getElementById("edit-user-modal");
const closeEditBtn = document.getElementById("close-edit-user-modal");
const editForm = document.getElementById("edit-user-form");
let currentEditId = null;

let users = [];

function formatDate(date) {
  if (!date) return "-";
  return date.toLocaleDateString("th-TH", {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function timeAgo(date) {
  if (!date) return "";
  const now = new Date();
  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d2 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = d1 - d2;
  const oneDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor(diffTime / oneDay);
  if (diffDays === 0) return "วันนี้";
  if (diffDays === 1) return "เมื่อวานนี้";
  return `${diffDays} วันที่แล้ว`;
}

async function loadUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  users = [];
  const today = new Date();
  let newTodayCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const uid = docSnap.id;
    const createdAt = data.createdAt?.toDate?.();

    if (createdAt && createdAt.toDateString() === today.toDateString()) newTodayCount++;

    users.push({
      id: uid,
      name: data.name || "-",
      email: data.email || "-",
      phone: data.phone || "-",
      role: data.role || "user",
      createdAt,
      createdFormatted: formatDate(createdAt),
      ago: timeAgo(createdAt)
    });
  }

  totalUsersEl.textContent = users.length;
  newUsersTodayEl.textContent = newTodayCount;
  const orderSnap = await getCountFromServer(collection(db, "orders"));
  totalOrdersEl.textContent = orderSnap.data().count || 0;
  renderTable(users);
}

async function loadOrderCount(uid) {
  const q = query(collection(db, "orders"), where("uid", "==", uid));
  const snap = await getCountFromServer(q);
  return snap.data().count || 0;
}

function getInitial(name = "") {
  return name?.charAt(0)?.toUpperCase() || "U";
}

async function renderTable(data) {
  userTableBody.innerHTML = "";
  for (const user of data) {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-100 transition";

    const orderCount = await loadOrderCount(user.id);

    tr.innerHTML = `
      <td class="p-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white flex items-center justify-center font-bold">
          ${getInitial(user.name)}
        </div>
        <div>
          <div class="font-medium">${user.name}</div>
          <div class="text-xs text-gray-500">${user.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งานทั่วไป"}</div>
        </div>
      </td>
      <td class="p-4">
        <div>${user.email}</div>
        <span class="text-green-600 text-xs font-medium">✅ ยืนยันแล้ว</span>
      </td>
      <td class="p-4">${user.phone}</td>
      <td class="p-4">
        <div>${user.createdFormatted}</div>
        <div class="text-xs text-gray-400">${user.ago}</div>
      </td>
      <td class="p-4 text-center">
        <span class="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">${orderCount} รายการ</span>
      </td>
      <td class="p-4 text-center">
        <button class="view-address bg-pink-500 text-white text-xs px-3 py-1 rounded-lg hover:scale-105 transition" data-uid="${user.id}">📍 ดูที่อยู่</button>
      </td>
      <td class="p-4 text-center">
        <div class="flex justify-center gap-2">
          <button class="edit-user bg-yellow-400 text-white p-2 rounded hover:scale-110 transition" title="แก้ไข" data-uid="${user.id}">✏️</button>
          <button class="delete-user bg-red-500 text-white p-2 rounded hover:scale-110 transition" title="ลบ" data-id="${user.id}">🗑️</button>
        </div>
      </td>
    `;
    userTableBody.appendChild(tr);
  }
}

searchInput?.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(term) ||
    u.email.toLowerCase().includes(term)
  );
  renderTable(filtered);
});

roleFilter?.addEventListener("change", () => {
  const role = roleFilter.value;
  const filtered = role ? users.filter(u => u.role === role) : users;
  renderTable(filtered);
});

userTableBody.addEventListener("click", async (e) => {
  const target = e.target;
  if (target.classList.contains("delete-user")) {
    const id = target.dataset.id;
    if (confirm("⚠️ คุณแน่ใจว่าต้องการลบผู้ใช้นี้?")) {
      try {
        await deleteDoc(doc(db, "users", id));
        alert("✅ ลบผู้ใช้เรียบร้อยแล้ว");
        loadUsers();
      } catch (err) {
        alert("❌ ลบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์");
      }
    }
  }

  if (target.classList.contains("view-address")) {
    const uid = target.dataset.uid;
    addressModal.classList.remove("hidden");
    addressContent.textContent = "กำลังโหลด...";
    try {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists()) {
        addressContent.textContent = docSnap.data().address ? JSON.stringify(docSnap.data().address, null, 2) : "ไม่มีข้อมูลที่อยู่";
      } else {
        addressContent.textContent = "ไม่พบผู้ใช้";
      }
    } catch {
      addressContent.textContent = "เกิดข้อผิดพลาด";
    }
  }

  if (target.classList.contains("edit-user")) {
    const uid = target.dataset.uid;
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById("edit-name").value = data.name || "";
      document.getElementById("edit-email").value = data.email || "";
      document.getElementById("edit-phone").value = data.phone || "";
      document.getElementById("edit-role").value = data.role || "user";
      currentEditId = uid;
      editModal.classList.remove("hidden");
    }
  }
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentEditId) return;
  const updated = {
    name: document.getElementById("edit-name").value,
    email: document.getElementById("edit-email").value,
    phone: document.getElementById("edit-phone").value,
    role: document.getElementById("edit-role").value,
  };
  try {
    await updateDoc(doc(db, "users", currentEditId), updated);
    alert("✅ อัปเดตข้อมูลสำเร็จ");
    editModal.classList.add("hidden");
    loadUsers();
  } catch {
    alert("❌ อัปเดตข้อมูลล้มเหลว");
  }
});

closeAddressBtn.addEventListener("click", () => addressModal.classList.add("hidden"));
closeEditBtn.addEventListener("click", () => editModal.classList.add("hidden"));

exportExcelBtn?.addEventListener("click", () => {
  const exportData = users.map(u => ({
    ชื่อ: u.name,
    อีเมล: u.email,
    เบอร์โทร: u.phone,
    วันที่สมัคร: u.createdFormatted,
    "สมัครเมื่อ": u.ago,
    บทบาท: u.role
  }));
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");
  XLSX.writeFile(wb, `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

loadUsers();
