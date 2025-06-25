function adjustContentMargin() {
  const menuBarHeight = document.querySelector('.menu-bar').offsetHeight;
  const navbarHeight = document.querySelector('.navbar').offsetHeight;
  const totalHeight = menuBarHeight + navbarHeight;
  
  document.body.style.paddingTop = totalHeight + 'px';
  
  // Sesuaikan tinggi konten
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => {
    tab.style.height = `calc(100vh - ${totalHeight}px)`;
    tab.style.overflowY = 'auto';
  });
}

// Panggil saat load dan resize
window.addEventListener('load', adjustContentMargin);
window.addEventListener('resize', adjustContentMargin);


// Sidebar functions
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  sidebar.classList.toggle('open');
  overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  
  // Tambahkan untuk mencegah scroll body saat sidebar terbuka
  document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').style.display = 'none';
}

// Placeholder functions for menu items
function showSalesReport() {
  toggleSales();
}

function showSettings() {
  alert("Fitur pengaturan akan ditambahkan di versi berikutnya");
}

function showBackupRestore() {
  document.getElementById('backupModal').style.display = 'flex';
}

function closeBackupModal() {
  document.getElementById('backupModal').style.display = 'none';
}

function showHelp() {
  document.getElementById('welcomeModal').style.display = 'flex';
}



// Fungsi untuk menampilkan modal keranjang


let isCartModalOpen = false;

function toggleCartModal() {
  const cartModal = document.getElementById('cartModal');
  
  if (isCartModalOpen) {
    // Jika modal sudah terbuka, tutup modal
    cartModal.style.display = 'none';
    isCartModalOpen = false;
  } else {
    // Jika modal tertutup, buka modal
    renderCartModalContent();
    cartModal.style.display = 'flex';
    isCartModalOpen = true;
  }
}


function closeCartModal() {
  document.getElementById('cartModal').style.display = 'none';
  isCartModalOpen = false;
}

// Update event listener untuk tombol keranjang
document.getElementById('cartButton').addEventListener('click', function(event) {
  event.stopPropagation(); // Mencegah event bubbling
  toggleCartModal();
});

// Tambahkan event listener untuk menutup modal saat klik di luar
document.addEventListener('click', function(event) {
  const cartModal = document.getElementById('cartModal');
  const cartButton = document.getElementById('cartButton');
  
  // Jika klik di luar modal dan tombol keranjang, tutup modal
  if (isCartModalOpen && !cartModal.contains(event.target) && !cartButton.contains(event.target)) {
    closeCartModal();
  }
});

// Fungsi untuk merender isi modal keranjang
function renderCartModalContent() {
  const cartContent = document.getElementById('cartModalContent');
  const cartTotal = document.getElementById('cartTotal');
  
  if (cart.length === 0) {
    cartContent.innerHTML = '<div style="text-align: center; padding: 20px;">Keranjang kosong</div>';
    cartTotal.textContent = '0';
    return;
  }
  
  let html = '';
  let total = 0;
  
  cart.forEach((item, index) => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    
    html += `
      <div class="cart-item">
        <div>
          <strong>${item.name}</strong><br>
          ${item.qty} × Rp${formatRupiah(item.price)}
        </div>
        <div>
          <span>Rp${formatRupiah(itemTotal)}</span>
          <div class="cart-item-controls">
            <button onclick="decreaseCartItem(${index})">−</button>
            <button onclick="removeCartItem(${index})">🗑️</button>
          </div>
        </div>
      </div>
    `;
  });
  
  // Tambahkan opsi pembayaran
  html += `<span>Uang Pembeli</span>
    <div class="payment-options">
      <button class="payment-option" onclick="calculateChange(100000)">100.000</button>
      <button class="payment-option" onclick="calculateChange(50000)">50.000</button>
      <button class="payment-option" onclick="calculateChange(20000)">20.000</button>
      <button class="payment-option" onclick="calculateChange(10000)">10.000</button>
    </div>
    <div class="payment-summary" id="paymentSummary">
      <div>Total: Rp${formatRupiah(total)}</div>
      <div>Dibayar: Rp<span id="amountPaid">0</span></div>
      <div>Kembalian: Rp<span id="changeAmount">0</span></div>
    </div>
  `;
  
  cartContent.innerHTML = html;
  cartTotal.textContent = formatRupiah(total);
}

function calculateChange(amount) {
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const change = amount - total;
  
  document.getElementById('amountPaid').textContent = formatRupiah(amount);
  document.getElementById('changeAmount').textContent = formatRupiah(change > 0 ? change : 0);
  document.getElementById('paymentSummary').style.display = 'block';
  
  // Scroll ke bawah untuk melihat hasil perhitungan
  const cartModalContent = document.getElementById('cartModalContent');
  cartModalContent.scrollTop = cartModalContent.scrollHeight;
}

// Fungsi untuk mengurangi jumlah item di keranjang
function decreaseCartItem(index) {
  if (cart[index].qty > 1) {
    cart[index].qty -= 1;
  } else {
    cart.splice(index, 1);
  }
  saveToIndexedDB(STORE_NAMES.CART, cart).then(() => {
    renderCartModalContent();
    updateCartBadge();
    renderProducts(); // Update quantity inputs in product list
  });
}

// Fungsi untuk menghapus item dari keranjang
function removeCartItem(index) {
  cart.splice(index, 1);
  saveToIndexedDB(STORE_NAMES.CART, cart).then(() => {
    renderCartModalContent();
    updateCartBadge();
    renderProducts(); // Update quantity inputs in product list
  });
}

// Fungsi untuk konfirmasi checkout
function confirmCheckout() {
  closeCartModal();
  checkout();
}

let currentSortColumn = null;
let sortDirection = 1; // 1 for ascending, -1 for descending

function sortSalesTable(column) {
  // If clicking the same column, reverse the direction
  if (currentSortColumn === column) {
    sortDirection *= -1;
  } else {
    currentSortColumn = column;
    sortDirection = 1;
  }
  
  // Flatten all sales items into one array for sorting
  let allItems = [];
  sales.forEach(sale => {
    sale.items.forEach(item => {
      allItems.push({
        ...item,
        time: sale.time,
        total: item.price * item.qty
      });
    });
  });
  
  // Sort the items
  allItems.sort((a, b) => {
    if (column === 'name') {
      return a.name.localeCompare(b.name) * sortDirection;
    } else if (column === 'time') {
      return (new Date(a.time) - new Date(b.time)) * sortDirection;
    } else {
      return (a[column] - b[column]) * sortDirection;
    }
  });
  
  // Regroup the sorted items back into sales records
  const groupedSales = {};
  allItems.forEach(item => {
    if (!groupedSales[item.time]) {
      groupedSales[item.time] = {
        time: item.time,
        items: [],
        total: 0
      };
    }
    groupedSales[item.time].items.push(item);
    groupedSales[item.time].total += item.price * item.qty;
  });
  
  // Convert back to array
  const sortedSales = Object.values(groupedSales);
  
  // Update the display
  renderSortedSalesTable(sortedSales);
}

function renderSortedSalesTable(sortedSales) {
  const salesDiv = document.getElementById('salesData');
  
  if (sortedSales.length === 0) {
    salesDiv.innerHTML = '<div class="empty-state">Belum ada data penjualan</div>';
    return;
  }
  
  let html = `
    <table>
      <thead>
        <tr>
          <th onclick="sortSalesTable('time')">Waktu ▲▼</th>
          <th>Gambar</th>
          <th onclick="sortSalesTable('name')">Nama ▲▼</th>
          <th onclick="sortSalesTable('qty')">Qty ▲▼</th>
          <th onclick="sortSalesTable('price')">Harga ▲▼</th>
          <th onclick="sortSalesTable('total')">Total ▲▼</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  let grandTotal = 0;
  
  sortedSales.forEach((sale, saleIndex) => {
    sale.items.forEach((item, i) => {
      const total = item.price * item.qty;
      if (i === 0) grandTotal += sale.total;
      
      html += `
        <tr>
          <td>${i === 0 ? sale.time : ''}</td>
          <td><img src="${item.image}" alt="${item.name}"></td>
          <td>${item.name}</td>
          <td>${item.qty}</td>
          <td>Rp${formatRupiah(item.price)}</td>
          <td>Rp${formatRupiah(total)}</td>
          <td>
            ${i === 0 ? `<button class="btn-delete-sales" onclick="deleteSalesRecord(${sales.findIndex(s => s.time === sale.time)})">Hapus</button>` : ''}
          </td>
        </tr>
      `;
    });
  });
  
  html += `</tbody></table>`;
  html += `<div style="margin-top: 15px; text-align: right; font-weight: bold;">Total Penjualan: Rp${formatRupiah(grandTotal)}</div>`;
  html += `<button id="downloadExcelBtn" onclick="downloadExcel()">Download Data</button>`;
  
  salesDiv.innerHTML = html;
  
  // Add arrow indicators to the sorted column
  const headers = salesDiv.querySelectorAll('th[onclick]');
  headers.forEach(header => {
    header.innerHTML = header.innerHTML.replace('▲▼', '').replace('▲', '').replace('▼', '');
    if (header.textContent.includes(currentSortColumn)) {
      header.innerHTML += sortDirection === 1 ? ' ▲' : ' ▼';
    } else {
      header.innerHTML += ' ▲▼';
    }
  });
}

// Nama database dan versi
const DB_NAME = 'penjualan_barang_db';
const DB_VERSION = 1;

// Nama object store
const STORE_NAMES = {
  PRODUCTS: 'products',
  CART: 'cart',
  SALES: 'sales',
  CATEGORIES: 'categories'
};

// Variabel untuk database
let db;

// Data awal
let data = {
  stiker: [],
  poster: [],
  ganci: [],
  standee: [],
  penggaris: []
};

let categories = [];
let cart = [];
let sales = [];

// Toggle dark mode
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
  document.getElementById('themeToggle').textContent = isDarkMode ? '☀' : '🌙';
}

// Check for saved dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
  document.getElementById('themeToggle').textContent = '☀️';
}

// Buka koneksi ke IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error("Gagal membuka database:", event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Buat object store untuk produk
      if (!db.objectStoreNames.contains(STORE_NAMES.PRODUCTS)) {
        db.createObjectStore(STORE_NAMES.PRODUCTS, { keyPath: ['category', 'name'] });
      }
      
      // Buat object store untuk keranjang
      if (!db.objectStoreNames.contains(STORE_NAMES.CART)) {
        db.createObjectStore(STORE_NAMES.CART, { keyPath: 'name' });
      }
      
      // Buat object store untuk penjualan
      if (!db.objectStoreNames.contains(STORE_NAMES.SALES)) {
        db.createObjectStore(STORE_NAMES.SALES, { keyPath: 'time' });
      }
      
      // Buat object store untuk kategori
      if (!db.objectStoreNames.contains(STORE_NAMES.CATEGORIES)) {
        db.createObjectStore(STORE_NAMES.CATEGORIES, { keyPath: 'name' });
      }
    };
  });
}

// Fungsi untuk menyimpan data ke IndexedDB
function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database belum diinisialisasi"));
      return;
    }

    const transaction = db.transaction([storeName], 'readwrite');
    transaction.onerror = (event) => reject(event.target.error);
    
    const store = transaction.objectStore(storeName);
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      try {
        const items = Array.isArray(data) ? data : 
                     (typeof data === 'object' ? Object.values(data).flat() : []);
        
        if (items.length === 0) return resolve();

        let completed = 0;
        items.forEach(item => {
          const request = store.add(item);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            if (++completed === items.length) resolve();
          };
        });
      } catch (error) {
        reject(error);
      }
    };

    clearRequest.onerror = (event) => reject(event.target.error);
  });
}

// Fungsi untuk memuat data dari IndexedDB
function loadFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database belum diinisialisasi"));
      return;
    }
    
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
}

// Tampilkan notifikasi
function showNotification(message) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.style.display = 'flex';
  
  // Reset animasi
  notification.style.animation = 'none';
  void notification.offsetWidth; // Trigger reflow
  notification.style.animation = 'fadeInUp 0.3s ease-out, fadeOutDown 0.5s 2.5s forwards';
}

// Load data dari IndexedDB
async function loadFromDatabase() {
  try {
    await openDatabase();
    
    // Load categories
    const loadedCategories = await loadFromIndexedDB(STORE_NAMES.CATEGORIES);
    if (loadedCategories && loadedCategories.length > 0) {
      categories = loadedCategories.map(c => c.name).sort((a, b) => a.localeCompare(b));
      updateNavbarCategories();
    }
    
    // Load products
    const loadedProducts = await loadFromIndexedDB(STORE_NAMES.PRODUCTS);
    if (loadedProducts && loadedProducts.length > 0) {
      // Reset data object
      data = {};
      
      // Group products by category
      loadedProducts.forEach(product => {
        if (!data[product.category]) {
          data[product.category] = [];
        }
        data[product.category].push(product);
      });
    }
    // Hapus pemanggilan initializeSampleData() di sini
    
    // Load cart
    const loadedCart = await loadFromIndexedDB(STORE_NAMES.CART);
    if (loadedCart) {
      cart = loadedCart;
    }
    
    // Load sales
    const loadedSales = await loadFromIndexedDB(STORE_NAMES.SALES);
    if (loadedSales) {
      sales = loadedSales;
    }
    
    renderProducts();
    updateCartBadge();
    
    // Tampilkan tab pertama jika ada kategori, jika tidak biarkan kosong
    if (categories.length > 0) {
      showTab(categories[0]);
    }
  } catch (error) {
    console.error("Gagal memuat data dari database:", error);
    // Tidak perlu memanggil initializeSampleData() di sini
  }
}

// Simpan semua data ke IndexedDB
async function saveAllData() {
  try {
    // Save products
    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    
    // Save cart
    await saveToIndexedDB(STORE_NAMES.CART, cart);
    
    // Save sales
    await saveToIndexedDB(STORE_NAMES.SALES, sales);
    
    // Save categories
    const categoriesToSave = categories.map(name => ({ name }));
    await saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave);
  } catch (error) {
    console.error("Gagal menyimpan data ke database:", error);
  }
}

// Initialize dengan data contoh jika kosong
function initializeSampleData() {
  const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAA7EAAAOxAGVKw4bAAABdElEQVR4nO3VMUoDQRCF4U9qDYZoDOKDrCS3TGUoATQX0AuRPIAiSBUOw3cZt30VLcqSCZMw/fD8JJGfzXzftvdfS+9/AgAAAAAAAAAAAAAAAAAAAPwNLDJoTNp4GMHDsYPuYB7rwCzHch0rPfDJ17K3BR/PvA0v0qk+yF4O8Qhva2TNeHsl6oLsG1cCl8icfD3Phdz69dz29l9dP3/xNx98MWd66Z8/XBzZ8Y2OYw3zoDu6OuEXAuA/hI/VJmfF0fvT+A12k5NVu2P82cuAVfUybDrtd1WHBe+Vc5Nozj3upON/dfZ9jnp6sB70J+XEGWZP5ELGLoVcNlr4vcFD6uj+Nglw5tNsHSf89qjXQH83IrAqfDwDsuDj++mvVbgHPh2gPc4w2Ht7q4QvH8xDqWJv0IjP+F1cOW+S46z1dCyBwj8Bi+NFfFQAAAAAAAAAAAAAAAAD8BvgB7Yq3e6DdOpLwAAAABJRU5ErkJggg==';

  // Hanya tambahkan kategori default jika benar-benar kosong
  if (categories.length === 0) {
    categories = ['stiker', 'poster', 'ganci', 'standee', 'penggaris'];
  }

  categories.forEach(category => {
    if (!data[category]) data[category] = [];
    
  });
  
  saveAllData();
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Pada fungsi showTab(), ubah selektor untuk navbar yang benar
function showTab(tabName) {
  // Sembunyikan semua tab content dengan animasi
  document.querySelectorAll('.tab-content').forEach(tab => {
    if (tab.classList.contains('active')) {
      tab.style.opacity = '0';
      tab.style.transform = 'translateY(10px)';
      setTimeout(() => {
        tab.classList.remove('active');
      }, 300);
    }
  });
  
  // Hapus kelas active dari semua tombol kategori
  document.querySelectorAll('.navbar button').forEach(btn => {
    if (!btn.classList.contains('manage-category')) {
      btn.classList.remove('active');
      btn.classList.remove('active-category');
    }
  });
  
  // Tampilkan tab yang dipilih dengan animasi
  const activeTab = document.getElementById(tabName);
  if (activeTab) {
    setTimeout(() => {
      activeTab.classList.add('active');
      setTimeout(() => {
        activeTab.style.opacity = '1';
        activeTab.style.transform = 'translateY(0)';
      }, 10);
    }, 300);
  }
  
  // Tambahkan kelas active-category ke tombol yang sesuai
  const activeButton = document.querySelector(`.navbar button[onclick="showTab('${tabName}')"]`);
  if (activeButton) {
    // Hapus animasi yang mungkin sedang berjalan
    activeButton.style.animation = 'none';
    void activeButton.offsetWidth; // Trigger reflow
    
    // Tambahkan kelas dan mulai animasi
    activeButton.classList.add('active');
    activeButton.classList.add('active-category');
    activeButton.style.animation = 'liquid 0.4s ease-out';
  }
  
  // Simpan tab yang sedang aktif di localStorage
  localStorage.setItem('activeTab', tabName);
}

// Pada saat load, cek apakah ada tab yang aktif disimpan
document.addEventListener('DOMContentLoaded', function() {
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) {
    showTab(savedTab);
  } else {
    showTab('stiker'); // Default tab
  }
});

function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', { style: 'decimal' }).format(number);
}

function renderProducts() {
  // Pastikan hanya render kategori yang valid
  const validCategories = categories.filter(cat => cat && typeof cat === 'string');
  
  validCategories.forEach(category => {
    const container = document.getElementById(`${category}-list`);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!data[category] || data[category].length === 0) {
      container.innerHTML = '<div class="empty-state">Belum ada produk</div>';
      return;
    }
    
    data[category].forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      
      // Check stock status
      const isLowStock = item.stock <= item.minStock;
      const isOutOfStock = item.stock <= 0;
      
      // Check if item is in cart
      const cartItem = cart.find(c => c.name === item.name);
      const cartQty = cartItem ? cartItem.qty : 0;
      
      card.innerHTML = `
        ${cartQty > 0 ? `<div class="product-badge">${cartQty}</div>` : ''}
        <strong>${item.name}</strong>
        <img src="${item.image}" class="product-img" alt="${item.name}" loading="lazy">
        
        <strong>Rp${formatRupiah(item.price)}</strong>
        <div class="stock-info">
          <span class="stock-label">Stok:</span>
          <span class="stock-value ${isLowStock ? 'low-stock' : ''}">${item.stock}</span>
        </div>
        <div class="stock-info">
          <span class="stock-label">Min. Stok:</span>
          <span class="stock-value">${item.minStock}</span>
        </div>
        <div class="quantity-controls">
          <button onclick="decreaseQuantity('${category}', ${index})" ${isOutOfStock || item.soldOut ? 'disabled' : ''}>−</button>
          <input type="text" value="${cartQty}" id="qty-${category}-${index}" readonly />
          <button onclick="increaseQuantity('${category}', ${index})" ${isOutOfStock || item.soldOut ? 'disabled' : ''}>+</button>
        </div>
        <div class="button-group">
          <button class="action-btn btn-edit" onclick="editProduct('${category}', ${index}); event.stopPropagation();">✏️</button>
          <button class="action-btn btn-delete" onclick="deleteProduct('${category}', ${index}); event.stopPropagation();">🗑️</button>
          <button class="action-btn btn-soldout ${item.soldOut ? 'active' : ''}" onclick="toggleSoldOut('${category}', ${index}); event.stopPropagation();">
            ${item.soldOut ? '🛑' : '⚠️'}
          </button>
        </div>
      `;
      
      // Tambahkan event listener untuk gambar produk
      const img = card.querySelector('.product-img');
      const buttonGroup = card.querySelector('.button-group');
      
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        // Sembunyikan semua button group lainnya
        document.querySelectorAll('.button-group').forEach(group => {
          if (group !== buttonGroup) group.style.display = 'none';
        });
        // Toggle button group ini
        buttonGroup.style.display = buttonGroup.style.display === 'flex' ? 'none' : 'flex';
      });
      
      // Sembunyikan button group saat klik di luar
      document.addEventListener('click', (e) => {
        if (!card.contains(e.target)) {
          buttonGroup.style.display = 'none';
        }
      });
      
      container.appendChild(card);
    });
  });
}

function increaseQuantity(category, index) {
  const item = data[category][index];
  if (item.soldOut || item.stock <= 0) return;
  
  const qtyInput = document.getElementById(`qty-${category}-${index}`);
  const currentQty = parseInt(qtyInput.value);
  
  // Check if we have enough stock
  if (currentQty >= item.stock) {
    showNotification(`Stok tidak cukup! Hanya tersedia ${item.stock} item.`);
    return;
  }
  
  qtyInput.value = currentQty + 1;
  updateCart(category, index, parseInt(qtyInput.value));
  
  // Tampilkan notifikasi
  const productName = data[category][index].name;
  showNotification(`Ditambahkan: ${productName} (${qtyInput.value}x)`);
}

function decreaseQuantity(category, index) {
  const qtyInput = document.getElementById(`qty-${category}-${index}`);
  const currentValue = parseInt(qtyInput.value);
  
  if (currentValue > 0) {
    qtyInput.value = currentValue - 1;
    updateCart(category, index, parseInt(qtyInput.value));
    
    // Tampilkan notifikasi saat mengurangi barang
    const productName = data[category][index].name;
    showNotification(`Dikurangi: ${productName} (${qtyInput.value}x)`);
  }
}

async function updateCart(category, index, qty) {
  try {
    const product = data[category]?.[index];
    if (!product) {
      throw new Error('Produk tidak ditemukan');
    }
    
    // Cari item di cart
    const cartIndex = cart.findIndex(item => item.name === product.name);
    
    if (qty > 0) {
      // Update atau tambahkan ke cart
      const cartItem = {
        name: product.name,
        price: product.price,
        qty: qty,
        category: category,
        image: product.image
      };
      
      if (cartIndex >= 0) {
        cart[cartIndex] = cartItem;
      } else {
        cart.push(cartItem);
      }
    } else if (cartIndex >= 0) {
      // Hapus dari cart jika qty = 0
      cart.splice(cartIndex, 1);
    }
    
    await saveToIndexedDB(STORE_NAMES.CART, cart);
    updateCartBadge();
    renderProducts(); // Render ulang untuk update badge
  } catch (error) {
    console.error('Error in updateCart:', error);
    showNotification('Gagal memperbarui keranjang');
  }
}

// Update cart badge
function updateCartBadge() {
  const cartBadge = document.getElementById('cartBadge');
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  cartBadge.textContent = itemCount;
}

async function checkout() {
  if (cart.length === 0) {
    alert('Keranjang kosong!');
    return;
  }
  
  // Check stock availability before checkout
  for (const item of cart) {
    const product = data[item.category]?.find(p => p.name === item.name);
    if (!product || product.stock < item.qty) {
      alert(`Stok tidak cukup untuk ${item.name}! Stok tersedia: ${product?.stock || 0}`);
      return;
    }
  }
  
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  if (confirm(`Beli ${itemCount} item dengan total Rp${formatRupiah(grandTotal)}?`)) {
    const now = new Date().toLocaleString('id-ID');
    
    // Update stock for each item
    cart.forEach(item => {
      const product = data[item.category].find(p => p.name === item.name);
      if (product) {
        product.stock -= item.qty;
      }
    });
    
    sales.push({ 
      time: now, 
      items: JSON.parse(JSON.stringify(cart)),
      total: grandTotal
    });
    
    // Reset quantities in UI and cart
    cart.forEach(item => {
      const idx = data[item.category]?.findIndex(p => p.name === item.name) ?? -1;
      if (idx >= 0) {
        const qtyInput = document.getElementById(`qty-${item.category}-${idx}`);
        if (qtyInput) qtyInput.value = 0;
      }
    });
    
    cart.length = 0;
    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    await saveToIndexedDB(STORE_NAMES.CART, cart);
    await saveToIndexedDB(STORE_NAMES.SALES, sales);
    
    updateCartBadge();
    renderProducts();
    
    if (document.getElementById('salesData').style.display === 'block') {
      renderSalesTable();
    }
    
    showNotification(`Pembelian berhasil! ${itemCount} item (Rp${formatRupiah(grandTotal)})`);
  }
}

async function deleteProduct(category, index) {
  const productName = data[category][index].name;
  if (confirm(`Hapus barang "${productName}"?`)) {
    // Remove from data
    data[category].splice(index, 1);
    
    // Remove from cart if exists
    for (let i = cart.length - 1; i >= 0; i--) {
      if (cart[i].name === productName) {
        cart.splice(i, 1);
      }
    }
    
    // Save changes
    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    await saveToIndexedDB(STORE_NAMES.CART, cart);
    
    renderProducts();
    updateCartBadge();
  }
}

async function toggleSoldOut(category, index) {
  data[category][index].soldOut = !data[category][index].soldOut;
  
  // Reset quantity if sold out toggled on
  if (data[category][index].soldOut) {
    const qtyInput = document.getElementById(`qty-${category}-${index}`);
    if (qtyInput) qtyInput.value = 0;
    
    // Remove from cart
    const cartIndex = cart.findIndex(c => c.name === data[category][index].name);
    if (cartIndex >= 0) cart.splice(cartIndex, 1);
  }
  
  // Update button states for this product only
  const card = document.querySelector(`#${category}-list .product-card:nth-child(${index + 1})`);
  if (card) {
    const buttons = card.querySelectorAll('.quantity-controls button');
    buttons.forEach(button => {
      button.disabled = data[category][index].soldOut || data[category][index].stock <= 0;
    });
  }
  
  // Save changes
  await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
  if (data[category][index].soldOut) {
    await saveToIndexedDB(STORE_NAMES.CART, cart);
  }
  
  updateCartBadge();
}

// Fungsi untuk membuka modal edit
function editProduct(category, index) {
  const product = data[category][index];
  document.getElementById('editCategory').value = category;
  document.getElementById('editIndex').value = index;
  document.getElementById('editName').value = product.name;
  // Format harga dengan titik
  document.getElementById('editPrice').value = formatRupiah(product.price).replace('Rp', '');
  document.getElementById('editStock').value = product.stock;
  document.getElementById('editMinStock').value = product.minStock;
  document.getElementById('editPreview').src = product.image;
  document.getElementById('editPreview').style.display = 'block';
  
  // Reset file input
  document.getElementById('editImageFile').value = '';
  
  // Tampilkan modal
  document.getElementById('editModal').style.display = 'flex';
}


// Fungsi untuk menyimpan perubahan produk
async function saveEditedProduct(event) {
  event.preventDefault();
  const form = event.target;
  const category = form.category.value;
  const index = parseInt(form.index.value);
  const name = form.name.value.trim();
  // Hapus titik sebelum konversi ke number
  const price = parseInt(form.price.value.replace(/\./g, ''));
  const stock = parseInt(form.stock.value);
  const minStock = parseInt(form.minStock.value);
  const fileInput = document.getElementById('editImageFile');
  
  if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0 || isNaN(minStock) || minStock < 0) {
    alert("Harap isi semua data dengan benar!");
    return;
  }
  
  // Update data produk
  data[category][index].name = name;
  data[category][index].price = price;
  data[category][index].stock = stock;
  data[category][index].minStock = minStock;
  
  // Jika ada gambar baru, update gambar
  if (fileInput.files && fileInput.files[0]) {
    try {
      const compressedImage = await compressImage(fileInput.files[0]);
      data[category][index].image = compressedImage;
      
      // Update gambar di cart jika ada
      const cartItem = cart.find(c => c.name === name);
      if (cartItem) {
        cartItem.image = compressedImage;
      }
    } catch (error) {
      console.error("Gagal mengkompres gambar:", error);
      alert("Gagal mengkompres gambar. Perubahan lain tetap disimpan.");
    }
  }
  
  // Save changes
  await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
  if (fileInput.files && fileInput.files[0]) {
    await saveToIndexedDB(STORE_NAMES.CART, cart);
  }
  
  renderProducts();
  updateCartBadge();
  closeEditModal();
}

// Fungsi untuk mengkompres gambar
async function compressImage(file, maxSizeKB = 50) { // Ubah maxSize menjadi 50KB
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        EXIF.getData(file, function() {
          const orientation = EXIF.getTag(this, 'Orientation');
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Hitung dimensi baru dengan rasio aspek
          let width = img.width;
          let height = img.height;
          const maxDimension = 800; // Batasi dimensi maksimum
          
          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }
          
          // Handle orientation
          if (orientation > 4 && orientation < 9) {
            canvas.width = height;
            canvas.height = width;
          } else {
            canvas.width = width;
            canvas.height = height;
          }
          
          // Apply orientation transformations
          switch (orientation) {
            case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
            case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
            case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
            case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
            case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
            case 7: ctx.transform(0, -1, -1, 0, height, width); break;
            case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
            default: ctx.transform(1, 0, 0, 1, 0, 0);
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          let quality = 0.7; // Mulai dengan kualitas lebih rendah
          let compressedDataUrl;
          
          // Loop untuk menemukan kualitas terbaik di bawah 50KB
          for (let i = 0; i < 5; i++) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            const sizeKB = (compressedDataUrl.length * 0.75) / 1024;
            
            if (sizeKB <= maxSizeKB) break;
            
            quality -= 0.15; // Kurangi kualitas lebih agresif
            if (quality < 0.1) quality = 0.1;
          }
          
          resolve(compressedDataUrl);
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}
async function addProduct(event, category) {
  event.preventDefault();
  const form = event.target;
  const name = form.name.value.trim();
  // Hapus titik sebelum konversi ke number
  const price = parseInt(form.price.value.replace(/\./g, ''));
  const stock = parseInt(form.stock.value);
  const minStock = parseInt(form.minStock.value);
  const fileInput = form.imageFile;
  
  // Validasi lebih ketat
  if (!name || name.length < 2) {
    alert("Nama barang harus diisi (minimal 2 karakter)!");
    return;
  }
  
  if (isNaN(price) || price < 100) {
    alert("Harga harus diisi (minimal Rp100)!");
    return;
  }
  
  if (isNaN(stock) || stock < 0) {
    alert("Stok harus diisi (tidak boleh negatif)!");
    return;
  }
  
  if (isNaN(minStock) || minStock < 0) {
    alert("Stok minimum harus diisi (tidak boleh negatif)!");
    return;
  }
  
  if (!fileInput.files[0]) {
    alert("Gambar produk wajib diupload!");
    return;
  }

  try {
    const compressedImage = await compressImage(fileInput.files[0]);
    
    const newProduct = { 
      name, 
      image: compressedImage, 
      price, 
      stock,
      minStock,
      soldOut: false, 
      category 
    };
    
    if (!data[category]) data[category] = [];
    data[category].push(newProduct);
    
    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    
    form.reset();
    const preview = form.querySelector('img.preview');
    if (preview) {
      preview.style.display = 'none';
      preview.src = '';
    }
    renderProducts();
    showNotification(`Produk "${name}" ditambahkan!`);
  } catch (error) {
    console.error("Gagal menambahkan produk:", error);
    alert("Gagal menambahkan produk! " + error.message);
  }
}



// Fungsi untuk memperbaiki orientasi gambar
function fixImageOrientation(img, orientation) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set ukuran canvas berdasarkan orientasi
  if (orientation > 4) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }
  
  // Transformasi berdasarkan orientasi
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, img.width, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, img.width, img.height); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, img.height); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, img.height, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, img.height, img.width); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, img.width); break;
    default: ctx.transform(1, 0, 0, 1, 0, 0);
  }
  
  ctx.drawImage(img, 0, 0);
  img.src = canvas.toDataURL();
}

function toggleSales() {
  const salesDiv = document.getElementById('salesData');
  const salesBtn = document.getElementById('salesTab');
  
  if (salesDiv.style.display === 'block') {
    salesDiv.style.display = 'none';
    salesBtn.textContent = '📊 Lihat Data Penjualan';
  } else {
    renderSalesTable();
    salesDiv.style.display = 'block';
    salesDiv.style.overflowY = 'auto'; // Pastikan overflow diaktifkan
    salesBtn.textContent = '✖️ Tutup Data Penjualan';
  }
}

function renderSalesTable() {
  const salesDiv = document.getElementById('salesData');
  
  // Atur tinggi salesDiv berdasarkan viewport
  salesDiv.style.maxHeight = 'calc(100vh - 200px)'; // Sesuaikan dengan kebutuhan
  
  if (sales.length === 0) {
    salesDiv.innerHTML = '<div class="empty-state">Belum ada data penjualan</div>';
    return;
  }
  
  let html = `
    <table>
      <thead>
        <tr>
          <th>Waktu</th>
          <th>Gambar</th>
          <th onclick="sortSalesTable('name')">Nama ▲▼</th>
          <th onclick="sortSalesTable('qty')">Qty ▲▼</th>
          <th onclick="sortSalesTable('price')">Harga ▲▼</th>
          <th onclick="sortSalesTable('total')">Total ▲▼</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  let grandTotal = 0;
  
  sales.forEach((sale, saleIndex) => {
    sale.items.forEach((item, i) => {
      const total = item.price * item.qty;
      if (i === 0) grandTotal += sale.total;
      
      html += `
        <tr>
          <td>${i === 0 ? sale.time : ''}</td>
          <td><img src="${item.image}" alt="${item.name}"></td>
          <td>${item.name}</td>
          <td>${item.qty}</td>
          <td>Rp${formatRupiah(item.price)}</td>
          <td>Rp${formatRupiah(total)}</td>
          <td>
            ${i === 0 ? `<button class="btn-delete-sales" onclick="deleteSalesRecord(${saleIndex})">Hapus</button>` : ''}
          </td>
        </tr>
      `;
    });
  });
  
  html += `</tbody></table>`;
  html += `<div style="margin-top: 15px; text-align: right; font-weight: bold;">Total Penjualan: Rp${formatRupiah(grandTotal)}</div>`;
  html += `<button id="downloadExcelBtn" onclick="downloadExcel()">Download Data</button>`;
  
  salesDiv.innerHTML = html;
}

async function deleteSalesRecord(index) {
  if (confirm("Apakah Anda yakin ingin menghapus record penjualan ini?")) {
    sales.splice(index, 1);
    await saveToIndexedDB(STORE_NAMES.SALES, sales);
    renderSalesTable();
  }
}

// Ganti fungsi downloadExcel dengan ini
function downloadExcel() {
  try {
    if (sales.length === 0) {
      showNotification("Belum ada data penjualan untuk diunduh!");
      return;
    }

    // Format data dengan pembatas tab
    let csvData = "Waktu\tNama Barang\tKategori\tJumlah\tHarga Satuan\tTotal\n";
    
    sales.forEach(sale => {
      sale.items.forEach(item => {
        csvData += `${sale.time}\t${item.name}\t${item.category}\t${item.qty}\t${item.price}\t${item.qty * item.price}\n`;
      });
    });

    // Tambahkan total penjualan
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    csvData += `\nTOTAL PENJUALAN\t\t\t\t${totalSales}`;

    // Buat blob untuk kompatibilitas yang lebih baik
    const blob = new Blob(["\uFEFF" + csvData], { type: 'text/plain;charset=utf-8' });
    
    // Cek metode download yang didukung
    if (navigator.msSaveBlob) { // IE/Edge
      navigator.msSaveBlob(blob, `Data_Penjualan_${new Date().toISOString().slice(0,10)}.txt`);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Data_Penjualan_${new Date().toISOString().slice(0,10)}.txt`;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    }
    
    showNotification("Data penjualan berhasil diunduh!");
  } catch (error) {
    console.error("Gagal mengunduh data:", error);
    showNotification("Gagal mengunduh data!");
  }
}


// Fungsi untuk menutup modal kategori
function closeCategoryModal() {
  document.getElementById('categoryModal').style.display = 'none';
}

// Fungsi untuk merender daftar kategori
function renderCategoryList() {
  const categoryList = document.getElementById('categoryList');
  categoryList.innerHTML = '';
  
  if (categories.length === 0) {
    categoryList.innerHTML = '<div class="empty-state">Belum ada jenis barang</div>';
    return;
  }
  
  categories.forEach((category, index) => {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.innerHTML = `
      <span>${capitalizeFirstLetter(category)}</span>
      <button onclick="deleteCategory('${category}', ${index})">Hapus</button>
    `;
    categoryList.appendChild(item);
  });
}

// Fungsi untuk menambahkan kategori baru
async function addNewCategory(event) {
  event.preventDefault();
  const nameInput = document.getElementById('newCategoryName');
  const name = nameInput.value.trim().toLowerCase();
  
  if (!name) {
    alert('Nama jenis barang tidak boleh kosong!');
    return;
  }
  
  if (categories.includes(name)) {
    alert('Jenis barang sudah ada!');
    return;
  }
  
  // Tambahkan kategori baru
  categories.push(name);
  
  // Urutkan kategori berdasarkan nama
  categories.sort((a, b) => a.localeCompare(b));
  
  if (!data[name]) data[name] = []; // Inisialisasi array kosong untuk kategori baru
  
  // Simpan kategori baru ke database
  const categoriesToSave = categories.map(name => ({ name }));
  await saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave);
  
  // Perbarui UI tanpa perlu refresh
  updateNavbarCategories();
  renderCategoryList();
  
  nameInput.value = '';
  showNotification(`Jenis barang "${capitalizeFirstLetter(name)}" ditambahkan!`);
  closeCategoryModal();
  
  // Pindah ke tab baru yang dibuat
  showTab(name);
}

// Fungsi untuk menghapus kategori
async function deleteCategory(category, index) {
  if (!confirm(`Hapus jenis barang "${capitalizeFirstLetter(category)}"? Semua produk dalam kategori ini juga akan dihapus.`)) {
    return;
  }

  try {
    // Hapus dari array categories
    const removedCategory = categories.splice(index, 1)[0];
    
    // Hapus dari data produk
    delete data[removedCategory];
    
    // Hapus dari cart jika ada (gunakan filter untuk menghindari masalah index)
    cart = cart.filter(item => item.category !== removedCategory);
    
    // Simpan perubahan ke database
    const categoriesToSave = categories.map(name => ({ name }));
    await Promise.all([
      saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave),
      saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
      saveToIndexedDB(STORE_NAMES.CART, cart)
    ]);
    
    // Hapus tab content
    const tabContent = document.getElementById(removedCategory);
    if (tabContent) tabContent.remove();
    
    // Hapus tombol navbar
    const navbarButtons = Array.from(document.querySelectorAll('.navbar button'));
    const buttonToRemove = navbarButtons.find(button => 
  button.textContent.trim().toLowerCase() === removedCategory.toLowerCase()
   );
    if (buttonToRemove) buttonToRemove.remove();
    
    // Jika kategori yang dihapus sedang aktif, pindah ke kategori pertama
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab || activeTab.id === removedCategory) {
      showTab(categories[0] || 'stiker');
    }
    
    renderProducts();
    updateCartBadge();
    renderCategoryList();
    showNotification(`Jenis barang "${capitalizeFirstLetter(removedCategory)}" dihapus!`);
  } catch (error) {
    console.error("Gagal menghapus kategori:", error);
    showNotification("Gagal menghapus kategori!");
  }
}

// Fungsi untuk update navbar dengan kategori terbaru
function updateNavbarCategories() {
  const navbar = document.querySelector('.navbar');
  const tabContainer = document.getElementById('dynamic-tabs');
  
  // Kosongkan navbar dan tab container
  navbar.innerHTML = '';
  tabContainer.innerHTML = '';
  
  // Tambahkan tombol manage category
  const manageBtn = document.createElement('button');
  manageBtn.className = 'manage-category';
  manageBtn.textContent = '➕ Jenis Barang';
  manageBtn.onclick = showCategoryModal;
  navbar.appendChild(manageBtn);
  
  // Tambahkan kategori yang valid
  categories.filter(cat => cat && typeof cat === 'string').forEach(category => {
    // Tambahkan tombol navbar
    const button = document.createElement('button');
    button.textContent = capitalizeFirstLetter(category);
    button.onclick = () => showTab(category);
    navbar.insertBefore(button, manageBtn);
    
    // Buat tab content jika belum ada
    if (!document.getElementById(category)) {
      const tabContent = document.createElement('div');
      tabContent.id = category;
      tabContent.className = 'tab-content';
      tabContent.innerHTML = `
        <div class="product-list" id="${category}-list"></div>
        <form class="add-form" onsubmit="addProduct(event, '${category}')">
          <p>Nama Barang</p>
          <input type="text" name="name" placeholder="Nama Barang" required />
          <div class="image-input-container">
            <div class="image-source-buttons">
              <button type="button" class="image-source-btn" onclick="openCamera('${category}')">📷 Kamera</button>
              <button type="button" class="image-source-btn" onclick="openGallery('${category}')">🖼️ Galeri</button>
            </div>
            <input type="file" id="imageInput-${category}" name="imageFile" accept="image/*" required 
              onchange="previewImage(event, '${category}')" style="display: none">
            <img id="imagePreview-${category}" class="preview" style="display: none"/>
          </div>
          <p>Harga</p>
          <input type="number" name="price" placeholder="Harga (Rp)" required min="100" />
          <p>Stok</p>
          <input type="number" name="stock" placeholder="Stok Barang" required min="0" />
          <p>Stok Minimum</p>
          <input type="number" name="minStock" placeholder="Stok Minimum" required min="0" />
          <button type="submit">➕ Tambah Barang</button>
        </form>
      `;
      tabContainer.appendChild(tabContent);
    }
  });
  
  // Aktifkan tab pertama jika ada
  if (categories.length > 0) {
    showTab(categories[0]);
  }
}

// Fungsi pencarian yang diperbaiki
function filterProducts(searchTerm) {
  searchTerm = searchTerm.toLowerCase().trim();
  
  // Jika search kosong, tampilkan semua produk
  if (!searchTerm) {
    document.querySelectorAll('.product-card').forEach(card => {
      card.style.display = 'flex';
    });
    return;
  }

  // Filter produk berdasarkan nama
  document.querySelectorAll('.product-card').forEach(card => {
    const productName = card.querySelector('strong').textContent.toLowerCase();
    if (productName.includes(searchTerm)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// Tambahkan event listener untuk input pencarian
document.getElementById('searchInput').addEventListener('input', function() {
  filterProducts(this.value);
});

// Tambahkan juga di bagian DOMContentLoaded untuk memastikan
document.addEventListener('DOMContentLoaded', function() {
  // ... kode yang sudah ada ...
  
  // Event listener untuk pencarian
  document.getElementById('searchInput').addEventListener('input', function() {
    filterProducts(this.value);
  });
});

// Fungsi untuk export data
async function exportData() {
  try {
    // Ambil semua data dari IndexedDB
    const allData = {
      products: await loadFromIndexedDB(STORE_NAMES.PRODUCTS),
      cart: await loadFromIndexedDB(STORE_NAMES.CART),
      sales: await loadFromIndexedDB(STORE_NAMES.SALES),
      categories: await loadFromIndexedDB(STORE_NAMES.CATEGORIES),
      darkMode: localStorage.getItem('darkMode') === 'true',
      timestamp: new Date().toISOString()
    };

    // Buat blob dari data
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Buat elemen anchor untuk download
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_penjualan_${new Date().toISOString().slice(0,10)}.json`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Bersihkan
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    showNotification('Data berhasil di-export!');
  } catch (error) {
    console.error('Gagal export data:', error);
    showNotification('Gagal export data!');
  }
}

// Fungsi untuk import data
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      
      if (!confirm(`Import data dari ${new Date(importedData.timestamp).toLocaleString()}? Semua data saat ini akan diganti.`)) {
        return;
      }
      
      // Simpan data ke IndexedDB
      await Promise.all([
        saveToIndexedDB(STORE_NAMES.PRODUCTS, importedData.products || []),
        saveToIndexedDB(STORE_NAMES.CART, importedData.cart || []),
        saveToIndexedDB(STORE_NAMES.SALES, importedData.sales || []),
        saveToIndexedDB(STORE_NAMES.CATEGORIES, importedData.categories || [])
      ]);
      
      // Update dark mode
      if (importedData.darkMode !== undefined) {
        if (importedData.darkMode) {
          document.body.classList.add('dark-mode');
          document.getElementById('themeToggle').textContent = '☀';
        } else {
          document.body.classList.remove('dark-mode');
          document.getElementById('themeToggle').textContent = '🌙';
        }
        localStorage.setItem('darkMode', importedData.darkMode);
      }
      
      // Reload aplikasi
      await loadFromDatabase();
      closeBackupModal();
      showNotification('Data berhasil di-import!');
    } catch (error) {
      console.error('Gagal import data:', error);
      showNotification('Format file tidak valid!');
    }
  };
  
  reader.onerror = () => {
    showNotification('Gagal membaca file!');
  };
  
  reader.readAsText(file);
}


// Toggle backup submenu
function toggleBackupMenu(event) {
  event.preventDefault(); // Mencegah event bubbling
  event.stopPropagation(); // Menghentikan propagasi event
  
  const submenu = document.getElementById('backupSubmenu');
  const parentItem = submenu.parentElement;
  
  if (submenu.style.display === 'block') {
    submenu.style.display = 'none';
    parentItem.querySelector('a').innerHTML = '💾 Backup & Restore ▼';
  } else {
    submenu.style.display = 'block';
    parentItem.querySelector('a').innerHTML = '💾 Backup & Restore ▲';
  }
  
  // Jangan tutup sidebar di sini
}

// Show import dialog
function showImportDialog() {
  document.getElementById('importFile').click();
}

// Reset all data
async function resetAllData() {
  if (confirm("Apakah Anda yakin ingin mereset SEMUA data?\nIni akan menghapus semua produk, penjualan, dan keranjang belanja.")) {
    try {
      // Clear all data
      data = {};
      cart = [];
      sales = [];
      categories = []; // Kosongkan kategori
      
      // Save empty data to IndexedDB
      await Promise.all([
        saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
        saveToIndexedDB(STORE_NAMES.CART, cart),
        saveToIndexedDB(STORE_NAMES.SALES, sales),
        saveToIndexedDB(STORE_NAMES.CATEGORIES, []) // Simpan array kosong
      ]);
      
      // Reset UI
      renderProducts();
      updateCartBadge();
      renderCategoryList();
      updateNavbarCategories();
      
      showNotification('Semua data telah direset!');
    } catch (error) {
      console.error("Gagal mereset data:", error);
      showNotification('Gagal mereset data!');
    }
  }
}

// Fungsi untuk membuka kamera
function openCamera(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.removeAttribute('capture');
    input.setAttribute('capture', 'environment');
    input.click();
  }
}

function openGallery(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.removeAttribute('capture');
    input.click();
  }
}

// Ganti fungsi previewImage dengan ini
function previewImage(event, context) {
  const file = event.target.files[0];
  if (!file) return;

  // Validasi format file
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showNotification('Hanya format JPEG/PNG/WEBP yang diizinkan!');
    return;
  }

  // Validasi ukuran file (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('Ukuran gambar terlalu besar! Maksimal 5MB.');
    return;
  }

  const previewId = context === 'edit' ? 'editPreview' : `imagePreview-${context}`;
  const preview = document.getElementById(previewId);
  const reader = new FileReader();
  
  reader.onload = function(e) {
    preview.src = e.target.result;
    preview.style.display = 'block';
    
    // Perbaikan orientasi untuk gambar dari kamera
    EXIF.getData(file, function() {
      const orientation = EXIF.getTag(this, 'Orientation');
      if (orientation && orientation > 1) {
        fixImageOrientation(preview, orientation);
      }
    });
  };
  
  reader.readAsDataURL(file);
}

// Tambahkan fungsi untuk membuka kamera/galeri
function openCamera(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.removeAttribute('capture');
    input.setAttribute('capture', 'environment');
    input.click();
  }
}

function openGallery(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.removeAttribute('capture');
    input.click();
  }
}


// Add to your script.js
const themes = [
  { name: 'default', label: '🙂' },
  { name: 'dark-mode', label: '🕷' }
];

let currentThemeIndex = 0;

function cycleTheme() {
  const themeToggle = document.getElementById('themeToggle');
  
  // Tambahkan class animating
  themeToggle.classList.add('animating');
  
  // Hapus semua class tema
  document.body.classList.remove('dark-mode');
  
  // Dapatkan tema berikutnya
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  const newTheme = themes[currentThemeIndex].name;
  
  // Terapkan tema baru jika bukan default
  if (newTheme !== 'default') {
    document.body.classList.add(newTheme);
  }
  
  // Update tombol toggle setelah animasi selesai
  setTimeout(() => {
    themeToggle.textContent = themes[currentThemeIndex].label;
    themeToggle.classList.remove('animating');
    
    // Simpan ke localStorage
    localStorage.setItem('currentTheme', newTheme);
  }, 500); // Sesuaikan dengan durasi animasi
}


// Initialize theme from localStorage
function initTheme() {
  const savedTheme = localStorage.getItem('currentTheme') || 'default';
  
  // Hapus semua class tema
  document.body.classList.remove('dark-mode', 'ocean-theme', 'forest-theme', 'sunset-theme');
  
  // Terapkan tema yang disimpan
  if (savedTheme !== 'default') {
    document.body.classList.add(savedTheme);
  }
  
  // Temukan index tema saat ini
  const index = themes.findIndex(t => t.name === savedTheme);
  if (index !== -1) {
    currentThemeIndex = index;
    document.getElementById('themeToggle').textContent = themes[index].label;
  }
}

// Update your event listener
document.getElementById('themeToggle').addEventListener('click', cycleTheme);

// Call initTheme when DOM loads
document.addEventListener('DOMContentLoaded', initTheme);


// Fungsi untuk menutup modal selamat datang
function closeWelcomeModal() {
  document.getElementById('welcomeModal').style.display = 'none';
  // Set flag di localStorage bahwa pengguna sudah melihat pesan selamat datang
  localStorage.setItem('hasSeenWelcome', 'true');
}

// Fungsi untuk mengecek dan menampilkan modal selamat datang
function checkWelcomeMessage() {
  // Cek di localStorage apakah pengguna sudah pernah melihat pesan ini
  const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
  
  if (!hasSeenWelcome) {
    // Tampilkan modal hanya jika belum pernah dilihat
    document.getElementById('welcomeModal').style.display = 'flex';
  }
}

// Panggil fungsi checkWelcomeMessage saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', function() {
  loadFromDatabase();
  adjustContentMargin();
  initTheme();
  
  // Event listeners
  document.getElementById('themeToggle').addEventListener('click', cycleTheme);
  document.getElementById('cartButton').addEventListener('click', showCartModal);
  
  // Cek dan tampilkan pesan selamat datang
  checkWelcomeMessage();
  
  // Load active tab
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab && document.getElementById(savedTab)) {
    showTab(savedTab);
  }
});


// Fungsi untuk menutup modal ketika mengklik di luar
function setupModalCloseOnOutsideClick() {
  const modals = document.querySelectorAll('.modal-overlay');
  
  modals.forEach(modal => {
    modal.addEventListener('click', function() {
      const modalId = this.id;
      if (modalId === 'editModal') {
        closeEditModal();
      } else if (modalId === 'categoryModal') {
        closeCategoryModal();
      } else if (modalId === 'backupModal') {
        closeBackupModal();
      } else if (modalId === 'welcomeModal') {
        closeWelcomeModal();
      }
      else if (modalId === 'dashboardModal') {
  closeDashboard();
}
    });
  });
}

// Panggil fungsi ini saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', function() {
  setupModalCloseOnOutsideClick();
  // ... kode lainnya yang sudah ada
});

function showEditModal() {
  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

function showCategoryModal() {
  renderCategoryList();
  document.getElementById('categoryModal').style.display = 'flex';
  
  // Tambahkan animasi liquid ke tombol "Jenis Barang"
  const manageBtn = document.querySelector('.manage-category');
  manageBtn.classList.add('active');
  manageBtn.style.animation = 'liquid 0.4s ease-out';
  
  // Hapus animasi setelah selesai
  setTimeout(() => {
    manageBtn.classList.remove('active');
  }, 400);
}


// Fungsi untuk menghitung jumlah item per kategori di keranjang
function countItemsPerCategory() {
  const categoryCounts = {};
  
  cart.forEach(item => {
    if (!categoryCounts[item.category]) {
      categoryCounts[item.category] = 0;
    }
    categoryCounts[item.category] += item.qty;
  });
  
  return categoryCounts;
}

// Fungsi untuk update badge kategori
function updateCategoryBadges() {
  const categoryCounts = countItemsPerCategory();
  
  document.querySelectorAll('.navbar button').forEach(button => {
    if (!button.classList.contains('manage-category')) {
      const category = button.getAttribute('onclick').match(/'([^']+)'/)[1];
      const count = categoryCounts[category] || 0;
      
      // Hapus badge lama jika ada
      const existingBadge = button.querySelector('.category-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      
      // Tambahkan badge baru jika ada item
      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'category-badge';
        badge.textContent = count;
        button.appendChild(badge);
      }
    }
  });
}


// Fungsi untuk memformat input harga dengan titik
function formatRupiahInput(input) {
  // Hapus semua karakter non-digit
  let value = input.value.replace(/\D/g, '');
  
  // Format dengan titik setiap 3 digit dari belakang
  value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  // Update nilai input
  input.value = value;
}
