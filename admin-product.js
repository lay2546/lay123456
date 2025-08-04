// admin-product-upload-enhanced.js
import { db } from './firebase.js';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const form = document.getElementById('product-form');
const productList = document.getElementById('product-list');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-category');

const submitButton = form.querySelector('button[type="submit"]');
const editIdInput = document.getElementById('edit-id');
const imageUrlInput = document.getElementById('imageUrlInput');
const imageFileInput = document.getElementById('imageFileInput');
const hiddenImageUrl = document.getElementById('imageUrl');
const imagePreview = document.getElementById('imagePreview');
const status = document.getElementById('status');
const productCountDisplay = document.getElementById("product-count");

let allProducts = [];
let currentPage = 1;
const itemsPerPage = 5;

// ✅ เพิ่มหรือแก้ไขสินค้า
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitButton.disabled = true;

  const name = document.getElementById('name').value.trim();
  const price = parseFloat(document.getElementById('price').value);
  const category = document.getElementById('category').value;
  const quantity = parseInt(document.getElementById('quantity').value);
  const imageUrl = hiddenImageUrl.value.trim();
  const discount = parseFloat(document.getElementById('discount').value) || 0;
  const isDailySpecial = document.getElementById('isDailySpecial').checked;
  const imagesInput = document.getElementById('imagesList').value || "";
  const images = imagesInput.split(',').map(url => url.trim()).filter(Boolean);
  const editId = editIdInput.value;

  if (!name || isNaN(price) || isNaN(quantity)) {
    status.textContent = "❗ กรุณากรอกชื่อ ราคา และจำนวนสินค้า";
    submitButton.disabled = false;
    return;
  }

  const data = {
    name, price, category, quantity, imageUrl,
    discount, isDailySpecial, images
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "products", editId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      status.textContent = "✅ แก้ไขสินค้าสำเร็จ";
    } else {
      await addDoc(collection(db, "products"), {
        ...data,
        createdAt: serverTimestamp()
      });
      status.textContent = "✅ เพิ่มสินค้าสำเร็จ";
    }

    form.reset();
    editIdInput.value = "";
    imagePreview.classList.add("hidden");
    hiddenImageUrl.value = "";
  } catch (error) {
    status.textContent = "❌ เกิดข้อผิดพลาด: " + error.message;
  }

  submitButton.disabled = false;
});

// ✅ แสดงรูปจาก URL
imageUrlInput?.addEventListener('input', () => {
  const url = imageUrlInput.value.trim();
  if (url.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)$/i)) {
    hiddenImageUrl.value = url;
    imagePreview.src = url;
    imagePreview.classList.remove("hidden");
    imageFileInput.value = "";
    status.textContent = "";
  } else {
    imagePreview.classList.add("hidden");
    status.textContent = "❌ URL ต้องเป็นรูปภาพเท่านั้น (.jpg .png .webp)";
  }
});

// ✅ อัปโหลดรูปผ่านไฟล์
imageFileInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    imageUrlInput.value = "";
    try {
      const url = await uploadImageToCloudinary(file);
      hiddenImageUrl.value = url;
      imagePreview.src = url;
      imagePreview.classList.remove("hidden");
    } catch (error) {
      alert("❌ อัปโหลดรูปภาพไม่สำเร็จ: " + error.message);
    }
  }
});

// ✅ ฟังก์ชันอัปโหลด Cloudinary
async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append("upload_preset", "upload-slip");
  const response = await fetch('https://api.cloudinary.com/v1_1/dpgru06ox/image/upload', {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
}

// ✅ โหลดสินค้า
onSnapshot(collection(db, "products"), (snapshot) => {
  allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderFiltered();
});

filterSelect.addEventListener("change", () => {
  currentPage = 1;
  renderFiltered();
});
searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderFiltered();
});

// ✅ กรอง + แสดง
const sortSelect = document.getElementById("sort-select");

sortSelect.addEventListener("change", () => {
  currentPage = 1;
  renderFiltered();
});

function renderFiltered() {
  const keyword = searchInput.value.toLowerCase();
  const category = filterSelect.value;
  const sortBy = sortSelect.value;

  let filtered = allProducts.filter(p => {
    const matchCategory = category === "all" || p.category === category;
    const matchSearch = p.name.toLowerCase().includes(keyword);
    return matchCategory && matchSearch;
  });

  // ✅ เรียงข้อมูลตามตัวเลือก
  switch (sortBy) {
    case "price-asc":
      filtered.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      filtered.sort((a, b) => b.price - a.price);
      break;
    case "latest":
      filtered.sort((a, b) => {
        const aTime = a.createdAt?.seconds ?? 0;
        const bTime = b.createdAt?.seconds ?? 0;
        return bTime - aTime;
      });
      break;
    case "stock-desc":
      filtered.sort((a, b) => b.quantity - a.quantity);
      break;
    default:
      break;
  }

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const currentItems = filtered.slice(start, start + itemsPerPage);

  productCountDisplay.textContent = filtered.length;
  renderProducts(currentItems);
  renderPagination(totalPages);
}

// ✅ แสดงรายการสินค้า
function renderProducts(products) {
  productList.innerHTML = "";
  products.forEach(product => {
    const li = document.createElement("li");
    li.className = "bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 md:space-x-4";
    li.innerHTML = `
      <div class="flex items-start space-x-4">
        <img src="${product.imageUrl}" class="w-20 h-20 object-cover rounded border" alt="">
        <div>
          <p class="font-bold">${product.name}</p>
          <p class="text-sm text-gray-600">฿${product.price} | ลด ${product.discount ?? 0}%</p>
          <p class="text-sm text-gray-500">หมวด: ${product.category}</p>
          <p class="text-sm ${product.quantity <= 0 ? 'text-red-500' : 'text-gray-600'}">
            ${product.quantity <= 0 ? '❗ หมด' : 'เหลือ: ' + product.quantity + ' ชิ้น'}
          </p>
          ${product.isDailySpecial ? '<p class="text-green-600 font-semibold">🌟 เมนูประจำวัน</p>' : ''}
        </div>
      </div>
      <div class="flex gap-2">
        <button class="edit-btn bg-yellow-500 text-white px-3 py-1 rounded" data-id="${product.id}">✏️ แก้ไข</button>
        <button class="delete-btn bg-red-600 text-white px-3 py-1 rounded" data-id="${product.id}">🗑 ลบ</button>
      </div>
    `;
    productList.appendChild(li);
  });

  // แก้ไขสินค้า
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const docRef = doc(db, "products", id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return alert("ไม่พบสินค้า");
      const data = docSnap.data();

      document.getElementById("name").value = data.name;
      document.getElementById("price").value = data.price;
      document.getElementById("category").value = data.category;
      document.getElementById("quantity").value = data.quantity;
      document.getElementById("discount").value = data.discount ?? 0;
      document.getElementById("isDailySpecial").checked = data.isDailySpecial ?? false;
      document.getElementById("imagesList").value = (data.images || []).join(', ');
      imageUrlInput.value = data.imageUrl;
      hiddenImageUrl.value = data.imageUrl;
      imagePreview.src = data.imageUrl;
      imagePreview.classList.remove("hidden");
      editIdInput.value = id;
      status.textContent = "📝 กำลังแก้ไขสินค้า...";
    });
  });

  // ลบสินค้า
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("คุณต้องการลบสินค้านี้หรือไม่?")) {
        await deleteDoc(doc(db, "products", id));
        alert("✅ ลบสินค้าแล้ว");
      }
    });
  });
}

// ✅ แสดง pagination
function renderPagination(totalPages) {
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = `px-3 py-1 rounded ${
      i === currentPage ? 'bg-pink-600 text-white' : 'bg-white text-gray-800 border'
    }`;
    btn.addEventListener("click", () => {
      currentPage = i;
      renderFiltered();
    });
    pagination.appendChild(btn);
  }
}
