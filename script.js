// Fungsi untuk menyesuaikan margin konten berdasarkan tinggi header dan navbar
function adjustContentMargin() {
  const menuBarHeight = document.querySelector('.menu-bar').offsetHeight;
  const navbarHeight = document.querySelector('.navbar').offsetHeight;
  const totalHeight = menuBarHeight + navbarHeight + 0; // Tambahkan sedikit margin
  document.body.style.marginTop = totalHeight + 'px';
  // Set variabel CSS untuk tinggi header
  document.documentElement.style.setProperty('--total-header-height', `${totalHeight}px`);
}

// Panggil fungsi adjustContentMargin saat halaman dimuat dan saat ukuran jendela diubah
window.addEventListener('load', adjustContentMargin);
window.addEventListener('resize', adjustContentMargin);

// ===================== Variabel Global Aplikasi =====================
// Nama database IndexedDB
const DB_NAME = 'penjualan_barang_db';
// Versi database IndexedDB
const DB_VERSION = 1;
// Nama-nama object store dalam IndexedDB
const STORE_NAMES = {
  PRODUCTS: 'products',
  CART: 'cart',
  SALES: 'sales',
  CATEGORIES: 'categories'
};
// Objek database IndexedDB
let db;
// Data produk, dikelompokkan berdasarkan kategori
let data = {};
// Daftar kategori produk
let categories = [];
// Item-item dalam keranjang belanja
let cart = [];
// Riwayat transaksi penjualan
let sales = [];
// Variabel untuk menyimpan input angka manual di modal checkout
let currentAmountInput = '';
// Variabel untuk menyimpan total akhir setelah diskon di modal checkout
let currentGrandTotalAfterDiscount = 0;
// Variabel untuk melacak status modal keranjang
let isCartModalOpen = false;
// Variabel untuk pengurutan tabel penjualan
let currentSortColumn = null;
let sortDirection = 1; // 1 untuk ascending, -1 untuk descending

// ===================== Fungsi Database IndexedDB =====================
// Fungsi untuk membuka koneksi ke IndexedDB
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

    // Dipanggil saat database dibuat atau versi diupgrade
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Buat object store untuk produk jika belum ada
      if (!db.objectStoreNames.contains(STORE_NAMES.PRODUCTS)) {
        db.createObjectStore(STORE_NAMES.PRODUCTS, { keyPath: ['category', 'name'] });
      }

      // Buat object store untuk keranjang jika belum ada
      if (!db.objectStoreNames.contains(STORE_NAMES.CART)) {
        db.createObjectStore(STORE_NAMES.CART, { keyPath: 'name' });
      }

      // Buat object store untuk penjualan jika belum ada
      if (!db.objectStoreNames.contains(STORE_NAMES.SALES)) {
        db.createObjectStore(STORE_NAMES.SALES, { keyPath: 'time' });
      }

      // Buat object store untuk kategori jika belum ada
      if (!db.objectStoreNames.contains(STORE_NAMES.CATEGORIES)) {
        db.createObjectStore(STORE_NAMES.CATEGORIES, { keyPath: 'name' });
      }
    };
  });
}

// Fungsi untuk menyimpan data ke IndexedDB
function saveToIndexedDB(storeName, dataToSave) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database belum diinisialisasi"));
      return;
    }

    const transaction = db.transaction([storeName], 'readwrite');
    transaction.onerror = (event) => reject(event.target.error);

    const store = transaction.objectStore(storeName);
    const clearRequest = store.clear(); // Hapus semua data lama sebelum menyimpan yang baru

    clearRequest.onsuccess = () => {
      try {
        let items = [];

        // Menangani struktur data yang berbeda
        if (Array.isArray(dataToSave)) {
          items = dataToSave;
        } else if (typeof dataToSave === 'object' && dataToSave !== null) {
          // Untuk struktur data produk (objek kategori berisi array produk)
          items = Object.values(dataToSave).flat();
        }

        if (items.length === 0) return resolve(); // Jika tidak ada item, selesaikan

        let completed = 0;
        const total = items.length;

        items.forEach(item => {
          // Pastikan item produk memiliki properti yang diperlukan
          if (storeName === STORE_NAMES.PRODUCTS) {
            if (!item.category || !item.name) {
              console.warn('Item produk tidak valid:', item);
              if (++completed === total) resolve();
              return;
            }
          }

          const request = store.add(item); // Tambahkan item ke object store
          request.onerror = (e) => {
            console.error('Gagal menyimpan item:', item, e.target.error);
            if (++completed === total) resolve();
          };
          request.onsuccess = () => {
            if (++completed === total) resolve();
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
    const request = store.getAll(); // Ambil semua data dari object store

    request.onerror = (event) => {
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
}

// Fungsi untuk memuat semua data dari IndexedDB saat aplikasi dimulai
async function loadFromDatabase() {
  try {
    await openDatabase(); // Buka koneksi database

    // Muat kategori
    const loadedCategories = await loadFromIndexedDB(STORE_NAMES.CATEGORIES);
    categories = loadedCategories && loadedCategories.length > 0 ?
      loadedCategories.map(c => c.name) :
      [];

    // Muat produk
    const loadedProducts = await loadFromIndexedDB(STORE_NAMES.PRODUCTS);
    data = {}; // Reset data produk
    if (loadedProducts && loadedProducts.length > 0) {
      loadedProducts.forEach(product => {
        if (!data[product.category]) data[product.category] = [];
        data[product.category].push(product);
      });
    }

    // Muat keranjang dan penjualan
    cart = await loadFromIndexedDB(STORE_NAMES.CART) || [];
    sales = await loadFromIndexedDB(STORE_NAMES.SALES) || [];

    // Perbarui UI setelah data dimuat
    updateNavbarCategories();
    renderProducts();
    updateCartBadge();

    // Tampilkan tab kategori pertama jika ada
    if (categories.length > 0) {
      const savedTab = localStorage.getItem('activeTab');
      if (savedTab && document.getElementById(savedTab)) {
        showTab(savedTab);
      } else {
        showTab(categories[0]);
      }
    }
  } catch (error) {
    console.error("Gagal memuat data:", error);
    showNotification('Gagal memuat data!');
  }
}

// Fungsi untuk menyimpan semua data ke IndexedDB
async function saveAllData() {
  try {
    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    await saveToIndexedDB(STORE_NAMES.CART, cart);
    await saveToIndexedDB(STORE_NAMES.SALES, sales);
    const categoriesToSave = categories.map(name => ({ name }));
    await saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave);
  } catch (error) {
    console.error("Gagal menyimpan data ke database:", error);
  }
}

// ===================== Fungsi Utilitas Umum =====================
// Fungsi untuk menampilkan notifikasi popup
function showNotification(message) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.style.display = 'flex';

  // Reset animasi dan jalankan kembali
  notification.style.animation = 'none';
  void notification.offsetWidth; // Memaksa reflow DOM
  notification.style.animation = 'fadeInUp 0.3s ease-out, fadeOutDown 0.5s 2.5s forwards';
}

// Fungsi untuk mengkapitalisasi huruf pertama dari sebuah string
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Fungsi untuk memformat angka menjadi format Rupiah
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', { style: 'decimal' }).format(number);
}

// Fungsi untuk memformat input angka menjadi format Rupiah secara real-time
function formatRupiahInput(input) {
  let value = input.value.replace(/[^0-9]/g, ''); // Hapus semua karakter non-digit
  if (value.length > 0) {
    value = parseInt(value).toString();
    value = value.replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Tambahkan titik sebagai pemisah ribuan
  }
  input.value = value;
}

// Fungsi untuk memeriksa duplikasi kode barang
function isProductCodeDuplicate(code, currentProductName = null) {
  for (const category in data) {
    if (data.hasOwnProperty(category)) {
      for (const product of data[category]) {
        // Jika kode barang sama dan bukan produk yang sedang diedit (untuk fungsi edit)
        if (product.code === code && product.name !== currentProductName) {
          return true;
        }
      }
    }
  }
  return false;
}

// ===================== Fungsi Navigasi & Tampilan =====================
// Fungsi untuk menampilkan tab kategori tertentu
function showTab(tabName) {
  // Sembunyikan semua tab content yang aktif dengan animasi
  document.querySelectorAll('.tab-content').forEach(tab => {
    if (tab.classList.contains('active')) {
      tab.style.opacity = '0';
      tab.style.transform = 'translateY(10px)';
      setTimeout(() => {
        tab.classList.remove('active');
        tab.style.display = 'none'; // Sembunyikan setelah animasi selesai
      }, 300);
    }
  });

  // Hapus kelas 'active-category' dari semua tombol kategori di navbar
  document.querySelectorAll('.navbar button:not(.manage-category)').forEach(btn => {
    btn.classList.remove('active-category');
    btn.style.backgroundColor = ''; // Reset warna background
  });

  // Tampilkan tab yang dipilih dengan animasi
  const activeTab = document.getElementById(tabName);
  if (activeTab) {
    setTimeout(() => {
      activeTab.classList.add('active');
      activeTab.style.display = 'block'; // Tampilkan sebelum animasi dimulai
      setTimeout(() => {
        activeTab.style.opacity = '1';
        activeTab.style.transform = 'translateY(0)';
        adjustContentMargin(); // Sesuaikan margin setelah tab aktif ditampilkan
      }, 10);
    }, 300);
  }

  // Tambahkan kelas 'active-category' ke tombol navbar yang sesuai
  const activeButton = document.querySelector(`.navbar button[onclick="showTab('${tabName}')"]`);
  if (activeButton) {
    activeButton.classList.add('active-category');
    activeButton.style.backgroundColor = '#f25ef3'; // Set warna aktif
  }

  // Simpan nama tab yang sedang aktif ke localStorage
  localStorage.setItem('activeTab', tabName);

  // Sembunyikan tab hasil pencarian jika sedang ditampilkan
  const searchResultsTab = document.getElementById('searchResultsTab');
  if (searchResultsTab) {
    searchResultsTab.style.display = 'none';
    searchResultsTab.classList.remove('active');
  }

  // Kosongkan input pencarian dan sembunyikan tombol clear
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchButton').style.display = 'none';
}

// Fungsi untuk memuat tab yang terakhir aktif dari localStorage
function loadActiveTab() {
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) {
    const activeButton = document.querySelector(`.navbar button[onclick="showTab('${savedTab}')"]`);
    if (activeButton) {
      activeButton.classList.add('active-category');
      activeButton.style.backgroundColor = '#f25ef3';
    }
    showTab(savedTab);
  } else if (categories.length > 0) {
    showTab(categories[0]);
  }
}

// Fungsi untuk memperbarui tampilan produk di setiap kategori
function renderProducts() {
  // Filter kategori yang valid (bukan null atau undefined)
  const validCategories = categories.filter(cat => cat && typeof cat === 'string');

  validCategories.forEach(category => {
    const container = document.getElementById(`${category}-list`);
    if (!container) return; // Lewati jika kontainer tidak ditemukan

    container.innerHTML = ''; // Kosongkan kontainer produk

    // Tampilkan pesan jika tidak ada produk dalam kategori ini
    if (!data[category] || data[category].length === 0) {
      container.innerHTML = '<div class="empty-state">Belum ada produk</div>';
      return;
    }

    // Render setiap produk dalam kategori
    data[category].forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'product-card';

      const isLowStock = item.stock <= item.minStock; // Cek stok rendah
      const isOutOfStock = item.stock <= 0; // Cek stok habis

      const cartItem = cart.find(c => c.name === item.name); // Cari item di keranjang
      const cartQty = cartItem ? cartItem.qty : 0; // Dapatkan kuantitas di keranjang

      card.innerHTML = `
        <div class="product-img-container">
          ${cartQty > 0 ? `<div class="product-badge">${cartQty}</div>` : ''} <!-- Badge kuantitas di keranjang -->
          ${item.code ? `<div class="product-code-badge">${item.code}</div>` : ''} <!-- Badge Kode Barang -->
          <img src="${item.image}" class="product-img" alt="${item.name}" loading="lazy">
        </div>
        <div class="product-info">
          <div>
            <h3 class="product-name">${item.name}</h3>
            <div class="product-price">Rp${formatRupiah(item.price)}</div>
            <div class="stock-info-container">
              <div class="stock-info">
                <span class="stock-label">Stok:
                <span class="stock-value ${isLowStock ? 'low-stock' : ''}">${item.stock}</span></span>
              </div>
            </div>
          </div>
          <div class="quantity-controls">
            <button onclick="decreaseQuantity('${category}', ${index})" ${isOutOfStock ? 'disabled' : ''}>−</button>
            <input type="text" value="${cartQty}" id="qty-${category}-${index}" readonly />
            <button onclick="increaseQuantity('${category}', ${index})" ${isOutOfStock ? 'disabled' : ''}>+</button>
          </div>
          <div class="button-group">
            <button class="action-btn btn-edit" onclick="editProduct('${category}', ${index}); event.stopPropagation();">✏️</button>
            <button class="action-btn btn-delete" onclick="deleteProduct('${category}', ${index}); event.stopPropagation();">🗑️</button>
          </div>
        </div>
      `;

      // Tambahkan event listener untuk menampilkan/menyembunyikan tombol aksi saat gambar diklik
      const imgContainer = card.querySelector('.product-img-container');
      const buttonGroup = card.querySelector('.button-group');

      imgContainer.addEventListener('click', (e) => {
        e.stopPropagation();

        // Sembunyikan semua button group lainnya dengan animasi
        document.querySelectorAll('.button-group').forEach(group => {
          if (group !== buttonGroup && group.style.display === 'flex') {
            group.style.animation = 'fadeOutDown 0.2s forwards';
            setTimeout(() => {
              group.style.display = 'none';
            }, 200);
          }
        });

        // Toggle button group ini dengan animasi
        if (buttonGroup.style.display === 'flex') {
          buttonGroup.style.animation = 'fadeOutDown 0.2s forwards';
          setTimeout(() => {
            buttonGroup.style.display = 'none';
          }, 200);
        } else {
          buttonGroup.style.display = 'flex';
          buttonGroup.style.animation = 'fadeInUp 0.2s forwards';
        }
      });

      // Sembunyikan button group saat klik di luar kartu produk
      document.addEventListener('click', (e) => {
        if (!card.contains(e.target) && buttonGroup.style.display === 'flex') {
          buttonGroup.style.animation = 'fadeOutDown 0.2s forwards';
          setTimeout(() => {
            buttonGroup.style.display = 'none';
          }, 200);
        }
      });

      container.appendChild(card);
    });
  });
}

// Fungsi untuk memperbarui navbar dengan kategori terbaru
function updateNavbarCategories() {
  const navbar = document.querySelector('.navbar');
  const tabContainer = document.getElementById('dynamic-tabs');

  // Kosongkan navbar dan kontainer tab
  navbar.innerHTML = '';
  tabContainer.innerHTML = '';

  // Tambahkan tombol "Kelola Jenis Barang"
  const manageBtn = document.createElement('button');
  manageBtn.className = 'manage-category';
  manageBtn.textContent = '➕ Jenis Barang';
  manageBtn.onclick = showCategoryModal;
  navbar.appendChild(manageBtn);

  // Tambahkan tombol untuk setiap kategori yang valid
  categories.filter(cat => cat && typeof cat === 'string').forEach(category => {
    const button = document.createElement('button');
    button.textContent = capitalizeFirstLetter(category);
    button.onclick = () => showTab(category); // Panggil showTab saat tombol diklik
    navbar.insertBefore(button, manageBtn); // Sisipkan sebelum tombol manage

    // Buat konten tab untuk kategori jika belum ada
    if (!document.getElementById(category)) {
      const tabContent = document.createElement('div');
      tabContent.id = category;
      tabContent.className = 'tab-content';
      tabContent.innerHTML = `
        <div class="product-list" id="${category}-list"></div>
        <form class="add-form" onsubmit="addProduct(event, '${category}')">
          <b>Tambah barang</b>
          <p>Nama Barang</p>
          <input type="text" name="name" placeholder="Nama Barang" required />
          <p>Kode Barang</p>
          <input type="text" name="code" placeholder="Kode Barang" required />
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
          <input type="text" name="price" placeholder="Harga (Rp)" required min="100" oninput="formatRupiahInput(this)" />
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

  // Aktifkan tab pertama jika ada kategori
  if (categories.length > 0) {
    showTab(categories[0]);
  }
}

// Fungsi untuk memfilter produk berdasarkan istilah pencarian
function filterProducts(searchTerm) {
  searchTerm = searchTerm.toLowerCase().trim();
  const searchInput = document.getElementById('searchInput');
  const clearSearchButton = document.getElementById('clearSearchButton');
  const dynamicTabsContainer = document.getElementById('dynamic-tabs');
  let searchResultsTab = document.getElementById('searchResultsTab');

  // Tampilkan/sembunyikan tombol clear pencarian
  if (searchTerm.length > 0) {
    clearSearchButton.style.display = 'block';
  } else {
    clearSearchButton.style.display = 'none';
  }

  // Jika istilah pencarian kosong, kembali ke tab aktif terakhir
  if (!searchTerm) {
    if (searchResultsTab) {
      searchResultsTab.remove(); // Hapus tab hasil pencarian
    }
    // Sembunyikan semua tab kategori yang ada
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.style.display = 'none';
      tab.classList.remove('active');
    });
    // Tampilkan tab yang terakhir aktif
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && document.getElementById(savedTab)) {
      showTab(savedTab);
    } else if (categories.length > 0) {
      showTab(categories[0]);
    }
    return;
  }

  // Sembunyikan semua tab kategori yang ada
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
    tab.classList.remove('active');
  });

  // Buat atau perbarui tab hasil pencarian
  if (!searchResultsTab) {
    searchResultsTab = document.createElement('div');
    searchResultsTab.id = 'searchResultsTab';
    searchResultsTab.className = 'tab-content';
    dynamicTabsContainer.appendChild(searchResultsTab);
  }

  // Aktifkan tab hasil pencarian
  searchResultsTab.classList.add('active');
  searchResultsTab.style.display = 'block';

  let productsFoundInSearch = [];
  // Iterasi melalui semua produk untuk mencari yang cocok
  for (const categoryName in data) {
    if (data.hasOwnProperty(categoryName)) {
      data[categoryName].forEach(product => {
        const productName = product.name.toLowerCase();
        const productCode = product.code ? product.code.toLowerCase() : '';
        // Cek apakah nama produk atau kode produk cocok dengan istilah pencarian
        if (productName.includes(searchTerm) || productCode.includes(searchTerm)) {
          const originalIndex = data[categoryName].indexOf(product);
          productsFoundInSearch.push({ product, categoryName, originalIndex });
        }
      });
    }
  }

  let searchResultsHtml = '';
  if (productsFoundInSearch.length > 0) {
    searchResultsHtml += '<div class="product-list">';
    productsFoundInSearch.forEach(item => {
      const product = item.product;
      const category = item.categoryName;
      const originalIndex = item.originalIndex;
      const cartItem = cart.find(c => c.name === product.name);
      const cartQty = cartItem ? cartItem.qty : 0;
      const isLowStock = product.stock <= product.minStock;
      const isOutOfStock = product.stock <= 0;

      searchResultsHtml += `
        <div class="product-card">
          <div class="product-img-container">
            ${cartQty > 0 ? `<div class="product-badge">${cartQty}</div>` : ''}
            ${product.code ? `<div class="product-code-badge">${product.code}</div>` : ''}
            <img src="${product.image}" class="product-img" alt="${product.name}" loading="lazy">
          </div>
          <div class="product-info">
            <div>
              <h3 class="product-name">${product.name}</h3>
              <div class="product-price">Rp${formatRupiah(product.price)}</div>
              <div class="stock-info-container">
                <div class="stock-info">
                  <span class="stock-label">Stok:
                  <span class="stock-value ${isLowStock ? 'low-stock' : ''}">${product.stock}</span></span>
                </div>
              </div>
            </div>            
            <div class="quantity-controls">
              <button onclick="decreaseQuantity('${category}', ${originalIndex})" ${isOutOfStock ? 'disabled' : ''}>−</button>
              <input type="text" value="${cartQty}" id="qty-${category}-${originalIndex}" readonly />
              <button onclick="increaseQuantity('${category}', ${originalIndex})" ${isOutOfStock ? 'disabled' : ''}>+</button>
            </div>
            <div class="button-group">
              <button class="action-btn btn-edit" onclick="editProduct('${category}', ${originalIndex}); event.stopPropagation();">✏️</button>
              <button class="action-btn btn-delete" onclick="deleteProduct('${category}', ${originalIndex}); event.stopPropagation();">🗑️</button>
            </div>
          </div>
        </div>
      `;
    });
    searchResultsHtml += '</div>';
  } else {
    searchResultsHtml = '<div class="empty-state search-message">Tidak ditemukan produk yang cocok</div>';
  }
  searchResultsTab.innerHTML = searchResultsHtml;
  // Pastikan tombol kategori di navbar tidak aktif saat hasil pencarian ditampilkan
  document.querySelectorAll('.navbar button:not(.manage-category)').forEach(btn => {
    btn.classList.remove('active-category');
    btn.style.backgroundColor = '';
  });
  adjustContentMargin(); // Sesuaikan margin setelah hasil pencarian ditampilkan
}

// ===================== Fungsi Keranjang Belanja =====================
// Fungsi untuk membuka/menutup modal keranjang
function toggleCartModal() {
  const cartModal = document.getElementById('cartModal');
  const overlay = document.querySelector('.sidebar-overlay');

  if (cartModal.classList.contains('open')) {
    cartModal.classList.remove('open');
    overlay.style.display = 'none';
    document.body.classList.remove('modal-open');
    isCartModalOpen = false;
  } else {
    cartModal.classList.add('open');
    overlay.style.display = 'none'; // Overlay sidebar tidak diperlukan untuk modal keranjang
    document.body.classList.add('modal-open');
    renderCartModalContent(); // Render ulang konten keranjang
    isCartModalOpen = true;
  }
}

// Fungsi untuk menutup modal keranjang
function closeCartModal() {
  document.getElementById('cartModal').classList.remove('open');
  document.body.classList.remove('modal-open');
  isCartModalOpen = false;
}

// Fungsi untuk memperbarui badge kuantitas item di tombol keranjang
function updateCartBadge() {
  const cartBadge = document.getElementById('cartBadge');
  if (!cartBadge) {
    console.error('Elemen cartBadge tidak ditemukan');
    return;
  }
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  cartBadge.textContent = itemCount;
}

// Fungsi untuk merender isi modal keranjang
function renderCartModalContent() {
  const cartContent = document.getElementById('cartModalContent');
  const cartTotal = document.getElementById('cartTotal');
  const cartModalFooter = document.querySelector('.cart-modal-footer');

  if (cart.length === 0) {
    cartContent.innerHTML = '<div style="text-align: center; padding: 20px;">Keranjang kosong</div>';
    cartTotal.textContent = '0';
    // Sembunyikan bagian quick count jika keranjang kosong
    const quickCountSection = cartModalFooter.querySelector('.quick-count-section');
    if (quickCountSection) quickCountSection.remove();
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

  cartContent.innerHTML = html;
  cartTotal.textContent = formatRupiah(total);

  // Tambahkan bagian quick count jika belum ada
  let quickCountSection = cartModalFooter.querySelector('.quick-count-section');
  if (!quickCountSection) {
    quickCountSection = document.createElement('div');
    quickCountSection.className = 'quick-count-section';
    quickCountSection.innerHTML = `
      <div class="quick-count-buttons">
        <button onclick="calculateQuickChange(10000)">10.000</button>
        <button onclick="calculateQuickChange(20000)">20.000</button>
        <button onclick="calculateQuickChange(50000)">50.000</button>
        <button onclick="calculateQuickChange(100000)">100.000</button>
      </div>
      <div class="quick-count-result" id="quickCountResult">
        Kembalian: Rp0
      </div>
    `;
    cartModalFooter.appendChild(quickCountSection);
  } else {
    // Reset kembalian saat modal dibuka/dirender ulang
    document.getElementById('quickCountResult').textContent = 'Kembalian: Rp0';
  }
}

// Fungsi untuk menghitung kembalian cepat di modal keranjang
function calculateQuickChange(amountPaid) {
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const change = amountPaid - total;
  document.getElementById('quickCountResult').textContent = `Kembalian: Rp${formatRupiah(change > 0 ? change : 0)}`;
}

// Fungsi untuk mengurangi kuantitas item di keranjang
function decreaseCartItem(index) {
  if (cart[index].qty > 1) {
    cart[index].qty -= 1;
  } else {
    cart.splice(index, 1); // Hapus item jika kuantitas menjadi 0
  }
  saveToIndexedDB(STORE_NAMES.CART, cart).then(() => {
    renderCartModalContent();
    updateCartBadge();
    renderProducts(); // Perbarui tampilan produk (kuantitas di input)
  });
}

// Fungsi untuk menghapus item dari keranjang
function removeCartItem(index) {
  cart.splice(index, 1);
  saveToIndexedDB(STORE_NAMES.CART, cart).then(() => {
    renderCartModalContent();
    updateCartBadge();
    renderProducts(); // Perbarui tampilan produk (kuantitas di input)
  });
}

// Fungsi untuk menambah kuantitas produk ke keranjang
function increaseQuantity(category, index) {
  const item = data[category][index];
  if (item.stock <= 0) return; // Tidak bisa menambah jika stok habis

  const qtyInput = document.getElementById(`qty-${category}-${index}`);
  const currentQty = parseInt(qtyInput.value);

  // Cek apakah stok cukup
  if (currentQty >= item.stock) {
    showNotification(`Stok tidak cukup! Hanya tersedia ${item.stock} item.`);
    return;
  }

  qtyInput.value = currentQty + 1;
  updateCart(category, index, parseInt(qtyInput.value));

  const productName = data[category][index].name;
  showNotification(`Ditambahkan: ${productName} (${qtyInput.value}x)`);
}

// Fungsi untuk mengurangi kuantitas produk dari keranjang
function decreaseQuantity(category, index) {
  const qtyInput = document.getElementById(`qty-${category}-${index}`);
  const currentValue = parseInt(qtyInput.value);

  if (currentValue > 0) {
    qtyInput.value = currentValue - 1;
    updateCart(category, index, parseInt(qtyInput.value));

    const productName = data[category][index].name;
    showNotification(`Dikurangi: ${productName} (${qtyInput.value}x)`);
  }
}

// Fungsi untuk memperbarui keranjang belanja
async function updateCart(category, index, qty) {
  try {
    const product = data[category]?.[index];
    if (!product) {
      throw new Error('Produk tidak ditemukan');
    }

    const cartIndex = cart.findIndex(item => item.name === product.name);

    if (qty > 0) {
      // Buat objek item keranjang
      const cartItem = {
        name: product.name,
        price: product.price,
        qty: qty,
        category: product.category,
        image: product.image,
        code: product.code
      };

      if (cartIndex >= 0) {
        cart[cartIndex] = cartItem; // Perbarui item yang sudah ada
      } else {
        cart.push(cartItem); // Tambahkan item baru
      }
    } else if (cartIndex >= 0) {
      cart.splice(cartIndex, 1); // Hapus dari keranjang jika kuantitas 0
    }

    await saveToIndexedDB(STORE_NAMES.CART, cart); // Simpan perubahan ke IndexedDB
    updateCartBadge(); // Perbarui badge keranjang
    renderProducts(); // Render ulang produk untuk memperbarui tampilan kuantitas
  } catch (error) {
    console.error('Gagal memperbarui keranjang:', error);
    showNotification('Gagal memperbarui keranjang');
  }
}

// ===================== Fungsi Checkout & Pembayaran =====================
// Fungsi untuk menampilkan modal checkout
function showCheckoutModal(paymentTypeFromCart = null) {
  if (cart.length === 0) {
    showNotification('Keranjang kosong!');
    return;
  }

  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Reset diskon ke 0 saat modal dibuka
  document.getElementById('discountInput').value = 0;
  currentGrandTotalAfterDiscount = grandTotal; // Inisialisasi total setelah diskon

  const checkoutSummary = document.getElementById('checkoutSummary');
  checkoutSummary.innerHTML = `
    <div class="checkout-header">
      <h4>Ringkasan Pembelian</h4>
      <p>Total Item: ${itemCount}</p>
      <p class="original-total-amount">Subtotal: Rp${formatRupiah(grandTotal)}</p>
    </div>
    
    <div class="payment-input-section">
      <h4>Jumlah Pembayaran (untuk Cash)</h4>
      <div class="quick-payment-buttons">
        <button onclick="appendToAmount('100000')">100.000</button>
        <button onclick="appendToAmount('50000')">50.000</button>
        <button onclick="appendToAmount('20000')">20.000</button>
        <button onclick="appendToAmount('10000')">10.000</button>
      </div>
      
      <div class="manual-input">
        <input type="text" id="manualAmount" placeholder="Masukkan jumlah" value="${currentAmountInput}" oninput="formatRupiahInput(this); calculateChange(parseInt(this.value.replace(/\\./g, '')))">
        <button class="calculator-btn" onclick="deleteLastDigit()">⌫</button>
      </div>
    </div>
    
    <div class="payment-summary" id="paymentSummary" style="display: none;">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>Rp${formatRupiah(grandTotal)}</span>
      </div>
      <div class="summary-row discount-row">
        <span>Diskon (<span id="discountPercentageDisplay">0</span>%):</span>
        <span id="discountAmountDisplay">Rp0</span>
      </div>
      <div class="summary-row final-total-row">
        <span>Total Akhir:</span>
        <span id="finalTotalAmount">Rp${formatRupiah(grandTotal)}</span>
      </div>
      <div class="summary-row">
        <span>Dibayar:</span>
        <span id="amountPaid">Rp0</span>
      </div>
      <div class="summary-row highlight">
        <span>Kembalian:</span>
        <span id="changeAmount">Rp0</span>
      </div>
    </div>
  `;

  const modalActions = document.querySelector('#checkoutModal .modal-actions');
  modalActions.innerHTML = `
    <button class="btn-cash" onclick="processCheckout('Cash')"> Cash</button>
    <button class="btn-transfer" onclick="processCheckout('Transfer')"> Transfer</button>
    <button class="btn-cancel" onclick="closeCheckoutModal()">✖ Batal</button>
  `;

  // Jika dipanggil dari tombol Cash/Transfer di keranjang, langsung proses checkout
  if (paymentTypeFromCart) {
    modalActions.querySelector('.btn-cash').style.display = 'none';
    modalActions.querySelector('.btn-transfer').style.display = 'none';
    processCheckout(paymentTypeFromCart);
  }

  document.getElementById('checkoutModal').style.display = 'flex';
  document.body.classList.add('modal-open');
  currentAmountInput = ''; // Reset input manual saat modal dibuka
  applyDiscount(); // Panggil untuk menginisialisasi tampilan diskon
}

// Fungsi untuk menambahkan angka ke input jumlah pembayaran manual
function appendToAmount(number) {
  currentAmountInput += number;
  document.getElementById('manualAmount').value = formatRupiah(parseInt(currentAmountInput.replace(/\./g, '')));
  calculateChange(parseInt(currentAmountInput.replace(/\./g, '')));
}

// Fungsi untuk menghapus digit terakhir dari input jumlah pembayaran manual
function deleteLastDigit() {
  currentAmountInput = currentAmountInput.slice(0, -1);
  if (currentAmountInput === '') {
    document.getElementById('manualAmount').value = '';
    document.getElementById('paymentSummary').style.display = 'none';
  } else {
    document.getElementById('manualAmount').value = formatRupiah(parseInt(currentAmountInput.replace(/\./g, '')));
    calculateChange(parseInt(currentAmountInput.replace(/\./g, '')));
  }
}

// Fungsi untuk menutup modal checkout
function closeCheckoutModal() {
  document.body.style.overflow = '';
  document.getElementById('checkoutModal').style.display = 'none';
  currentAmountInput = ''; // Reset input manual
  document.body.classList.remove('modal-open');
}

// Fungsi untuk memproses checkout
async function processCheckout(paymentType) {
  let amountPaid;
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Untuk Cash dan Transfer, asumsikan pembayaran penuh
  amountPaid = total;

  const now = new Date().toLocaleString('id-ID');
  const grandTotal = total;

  // Perbarui stok untuk setiap item yang terjual
  cart.forEach(item => {
    const product = data[item.category].find(p => p.name === item.name);
    if (product) {
      product.stock -= item.qty;
    }
  });

  // Tambahkan transaksi ke riwayat penjualan
  sales.push({
    time: now,
    items: JSON.parse(JSON.stringify(cart)), // Salin objek item
    total: grandTotal,
    amountPaid: amountPaid,
    change: amountPaid - grandTotal,
    paymentType: paymentType
  });

  cart = []; // Kosongkan keranjang

  // Simpan perubahan ke database
  await Promise.all([
    saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
    saveToIndexedDB(STORE_NAMES.CART, cart),
    saveToIndexedDB(STORE_NAMES.SALES, sales)
  ]);

  // Perbarui UI
  closeCartModal();
  closeCheckoutModal();
  updateCartBadge();
  renderProducts();

  // Jika tabel penjualan sedang ditampilkan, perbarui juga
  if (document.getElementById('salesData').style.display === 'block') {
    renderSalesTable();
  }

  document.querySelector('.sidebar-overlay').style.display = 'none';

  showNotification(`Pembelian berhasil! Total: Rp${formatRupiah(grandTotal)} (${paymentType})`);
}

// Fungsi untuk menerapkan diskon di modal checkout
function applyDiscount() {
  const discountInput = document.getElementById('discountInput');
  let discountPercentage = parseFloat(discountInput.value);

  // Validasi input diskon
  if (isNaN(discountPercentage) || discountPercentage < 0) {
    discountPercentage = 0;
    discountInput.value = 0;
  } else if (discountPercentage > 100) {
    discountPercentage = 100;
    discountInput.value = 100;
  }

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = grandTotal * (discountPercentage / 100);
  currentGrandTotalAfterDiscount = grandTotal - discountAmount; // Hitung total setelah diskon

  // Perbarui tampilan diskon dan total akhir
  document.getElementById('discountPercentageDisplay').textContent = discountPercentage;
  document.getElementById('discountAmountDisplay').textContent = `Rp${formatRupiah(discountAmount)}`;
  document.getElementById('finalTotalAmount').textContent = `Rp${formatRupiah(currentGrandTotalAfterDiscount)}`;

  // Perbarui kembalian jika ada input manual
  const manualAmountInput = document.getElementById('manualAmount');
  if (manualAmountInput && manualAmountInput.value) {
    calculateChange(parseInt(manualAmountInput.value.replace(/\./g, '')));
  } else {
    // Jika tidak ada input manual, pastikan kembalian direset
    document.getElementById('amountPaid').textContent = `Rp0`;
    document.getElementById('changeAmount').textContent = `Rp0`;
    document.getElementById('paymentSummary').style.display = 'block';
  }
}

// Fungsi untuk menghitung kembalian di modal checkout
function calculateChange(amount) {
  const total = currentGrandTotalAfterDiscount; // Gunakan total setelah diskon
  const change = amount - total;

  document.getElementById('amountPaid').textContent = `Rp${formatRupiah(amount)}`;
  document.getElementById('changeAmount').textContent = `Rp${formatRupiah(change > 0 ? change : 0)}`;
  document.getElementById('paymentSummary').style.display = 'block';

  // Gulir ke bawah untuk melihat hasil perhitungan
  const checkoutSummary = document.getElementById('checkoutSummary');
  checkoutSummary.scrollTop = checkoutSummary.scrollHeight;
}

// ===================== Fungsi Manajemen Produk =====================
// Fungsi untuk menghapus produk
async function deleteProduct(category, index) {
  const productName = data[category][index].name;
  if (confirm(`Hapus barang "${productName}"?`)) {
    data[category].splice(index, 1); // Hapus dari data produk

    // Hapus dari keranjang jika ada
    for (let i = cart.length - 1; i >= 0; i--) {
      if (cart[i].name === productName) {
        cart.splice(i, 1);
      }
    }

    // Simpan perubahan
    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    await saveToIndexedDB(STORE_NAMES.CART, cart);

    renderProducts(); // Perbarui tampilan produk
    updateCartBadge(); // Perbarui badge keranjang
  }
}

// Fungsi untuk membuka modal edit produk
function editProduct(category, index) {
  const product = data[category][index];
  document.getElementById('editCategory').value = category;
  document.getElementById('editIndex').value = index;
  document.getElementById('editName').value = product.name;
  document.getElementById('editCode').value = product.code || ''; // Tampilkan kode barang

  document.getElementById('editPrice').value = product.price.toString();
  formatRupiahInput(document.getElementById('editPrice')); // Format tampilan harga

  document.getElementById('editStock').value = product.stock;
  document.getElementById('editMinStock').value = product.minStock;
  document.getElementById('editPreview').src = product.image;
  document.getElementById('editPreview').style.display = 'block';
  document.getElementById('editImageFile').value = ''; // Reset input file gambar

  document.getElementById('editModal').style.display = 'flex'; // Tampilkan modal
}

// Fungsi untuk menyimpan perubahan produk yang diedit
async function saveEditedProduct(event) {
  event.preventDefault();
  const form = event.target;
  const category = form.category.value;
  const index = parseInt(form.index.value);
  const name = form.name.value.trim();
  const code = form.code.value.trim();

  const priceString = form.price.value.replace(/\./g, '');
  const price = parseInt(priceString);
  const stock = parseInt(form.stock.value);
  const minStock = parseInt(form.minStock.value);
  const fileInput = document.getElementById('editImageFile');

  // Validasi input
  if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0 || isNaN(minStock) || minStock < 0) {
    showNotification("Harap isi semua data dengan benar!");
    return;
  }

  // Validasi duplikasi kode barang
  const originalProductName = data[category][index].name;
  if (isProductCodeDuplicate(code, originalProductName)) {
    showNotification(`Kode barang "${code}" sudah ada. Harap gunakan kode lain!`);
    return;
  }

  // Perbarui data produk
  data[category][index].name = name;
  data[category][index].code = code;
  data[category][index].price = price;
  data[category][index].stock = stock;
  data[category][index].minStock = minStock;

  // Jika ada gambar baru, kompres dan perbarui gambar
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    try {
      const compressedImage = await compressImage(file);
      data[category][index].image = compressedImage;
    } catch (error) {
      console.error("Gagal mengkompres gambar:", error);
      showNotification("Gagal mengkompres gambar. Silakan coba lagi.");
      return;
    }
  }

  await saveToIndexedDB(STORE_NAMES.PRODUCTS, data); // Simpan perubahan ke IndexedDB

  renderProducts(); // Perbarui tampilan produk
  updateCartBadge(); // Perbarui badge keranjang
  closeEditModal(); // Tutup modal edit
  showNotification(`Produk "${name}" berhasil diperbarui!`);
}

// Fungsi untuk mengkompres gambar sebelum diunggah
async function compressImage(file, maxSizeKB = 50) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        EXIF.getData(file, function() {
          const orientation = EXIF.getTag(this, 'Orientation');

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          let width = img.width;
          let height = img.height;
          const maxDimension = 800; // Batasi dimensi maksimum

          // Sesuaikan dimensi agar tidak melebihi maxDimension
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

          // Atur ukuran canvas berdasarkan orientasi
          if (orientation > 4 && orientation < 9) {
            canvas.width = height;
            canvas.height = width;
          } else {
            canvas.width = width;
            canvas.height = height;
          }

          // Terapkan transformasi orientasi
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

          let quality = 0.7; // Mulai dengan kualitas awal
          let compressedDataUrl;

          // Loop untuk menemukan kualitas terbaik di bawah maxSizeKB
          for (let i = 0; i < 5; i++) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            const sizeKB = (compressedDataUrl.length * 0.75) / 1024;

            if (sizeKB <= maxSizeKB) break; // Berhenti jika ukuran sudah sesuai

            quality -= 0.15; // Kurangi kualitas
            if (quality < 0.1) quality = 0.1; // Batasi kualitas minimum
          }

          resolve(compressedDataUrl);
        });
      };
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Fungsi untuk menambahkan produk baru
async function addProduct(event, category) {
  event.preventDefault();
  const form = event.target;
  const name = form.name.value.trim();
  const code = form.code.value.trim();
  const price = parseInt(form.price.value.replace(/\./g, '')); // Hapus titik sebelum konversi
  const stock = parseInt(form.stock.value);
  const minStock = parseInt(form.minStock.value);
  const fileInput = form.imageFile;

  // Validasi input
  if (!name || name.length < 2) {
    showNotification("Nama barang harus diisi (minimal 2 karakter)!");
    return;
  }
  if (!code) {
    showNotification("Kode barang harus diisi!");
    return;
  }
  if (isProductCodeDuplicate(code)) {
    showNotification(`Kode barang "${code}" sudah ada. Harap gunakan kode lain!`);
    return;
  }
  if (isNaN(price) || price < 100) {
    showNotification("Harga harus diisi (minimal Rp100)!");
    return;
  }
  if (isNaN(stock) || stock < 0) {
    showNotification("Stok harus diisi (tidak boleh negatif)!");
    return;
  }
  if (isNaN(minStock) || minStock < 0) {
    showNotification("Stok minimum harus diisi (tidak boleh negatif)!");
    return;
  }
  if (!fileInput.files[0]) {
    showNotification("Gambar produk wajib diupload!");
    return;
  }

  try {
    const compressedImage = await compressImage(fileInput.files[0]); // Kompres gambar

    const newProduct = {
      name,
      code,
      image: compressedImage,
      price,
      stock,
      minStock,
      category
    };

    if (!data[category]) data[category] = [];
    data[category].push(newProduct); // Tambahkan produk ke data

    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data); // Simpan ke IndexedDB

    form.reset(); // Reset form
    const preview = form.querySelector('img.preview');
    if (preview) {
      preview.style.display = 'none';
      preview.src = '';
    }
    renderProducts(); // Perbarui tampilan produk
    showNotification(`Produk "${name}" ditambahkan!`);
  } catch (error) {
    console.error("Gagal menambahkan produk:", error);
    showNotification("Gagal menambahkan produk! " + error.message);
  }
}

// Fungsi untuk memperbaiki orientasi gambar berdasarkan data EXIF
function fixImageOrientation(img, orientation) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Atur ukuran canvas berdasarkan orientasi
  if (orientation > 4) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }

  // Terapkan transformasi berdasarkan orientasi
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

// Fungsi untuk membuka kamera perangkat
function openCamera(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.removeAttribute('capture');
    input.setAttribute('capture', 'environment'); // Menggunakan kamera belakang
    input.click();
  }
}

// Fungsi untuk membuka galeri perangkat
function openGallery(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.removeAttribute('capture'); // Hapus atribut capture
    input.click();
  }
}

// Fungsi untuk menampilkan pratinjau gambar yang dipilih
function previewImage(event, context) {
  const file = event.target.files[0];
  if (!file) return;

  // Validasi format file
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showNotification('Hanya format JPEG/PNG/WEBP yang diizinkan!');
    return;
  }

  // Validasi ukuran file (maksimal 5MB)
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

// ===================== Fungsi Manajemen Kategori =====================
// Fungsi untuk menampilkan modal kategori
function showCategoryModal() {
  document.body.style.overflow = 'hidden'; // Mencegah scroll body
  renderCategoryList(); // Render daftar kategori
  document.getElementById('categoryModal').style.display = 'flex'; // Tampilkan modal
}

// Fungsi untuk menutup modal kategori
function closeCategoryModal() {
  document.getElementById('categoryModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

// Fungsi untuk merender daftar kategori di modal
function renderCategoryList() {
  const categoryList = document.getElementById('categoryList');
  categoryList.innerHTML = ''; // Kosongkan daftar

  if (categories.length === 0) {
    categoryList.innerHTML = '<div class="empty-state">Belum ada jenis barang</div>';
    return;
  }

  // Render setiap kategori
  categories.forEach((category, index) => {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.setAttribute('data-category-name', category);

    item.innerHTML = `
      <span id="categoryName-${index}">${capitalizeFirstLetter(category)}</span>
      <div class="category-actions">
        <button class="btn-edit-category" onclick="editCategoryName('${category}', ${index})">✏️ Edit</button>
        <button class="btn-delete-category" onclick="deleteCategory('${category}', ${index})">🗑️ Hapus</button>
      </div>
    `;
    categoryList.appendChild(item);
  });
}

// Fungsi untuk mengedit nama kategori
function editCategoryName(oldCategoryName, index) {
  const categoryItem = document.querySelector(`.category-item[data-category-name="${oldCategoryName}"]`);
  if (!categoryItem) return;

  const categoryNameSpan = categoryItem.querySelector(`#categoryName-${index}`);
  const categoryActionsDiv = categoryItem.querySelector('.category-actions');

  const originalName = categoryNameSpan.textContent; // Simpan nama lama untuk pembatalan

  // Ganti span dengan input field
  categoryNameSpan.innerHTML = `
    <input type="text" id="editCategoryInput-${index}" value="${originalName}" />
  `;

  // Ganti tombol aksi dengan tombol simpan/batal
  categoryActionsDiv.innerHTML = `
    <button class="btn-save-category" onclick="saveCategoryName('${oldCategoryName}', ${index})">💾 Simpan</button>
    <button class="btn-cancel-edit" onclick="cancelEditCategoryName('${oldCategoryName}', ${index}, '${originalName}')">✖️ Batal</button>
  `;

  document.getElementById(`editCategoryInput-${index}`).focus(); // Fokuskan pada input
}

// Fungsi untuk menyimpan nama kategori yang diedit
async function saveCategoryName(oldCategoryName, index) {
  const newCategoryInput = document.getElementById(`editCategoryInput-${index}`);
  const newCategoryName = newCategoryInput.value.trim().toLowerCase();

  // Validasi input
  if (!newCategoryName) {
    showNotification('Nama jenis barang tidak boleh kosong!');
    return;
  }
  if (newCategoryName === oldCategoryName) {
    cancelEditCategoryName(oldCategoryName, index, capitalizeFirstLetter(oldCategoryName));
    return;
  }
  if (categories.includes(newCategoryName)) {
    showNotification('Jenis barang dengan nama tersebut sudah ada!');
    return;
  }

  // Konfirmasi perubahan
  if (!confirm(`Ubah nama jenis barang dari "${capitalizeFirstLetter(oldCategoryName)}" menjadi "${capitalizeFirstLetter(newCategoryName)}"?`)) {
    cancelEditCategoryName(oldCategoryName, index, capitalizeFirstLetter(oldCategoryName));
    return;
  }

  try {
    // Perbarui nama kategori di array categories
    categories[index] = newCategoryName;
    categories.sort((a, b) => a.localeCompare(b)); // Urutkan kembali

    // Pindahkan produk dari kategori lama ke kategori baru
    if (data[oldCategoryName]) {
      data[newCategoryName] = data[oldCategoryName];
      delete data[oldCategoryName];
      data[newCategoryName].forEach(product => {
        product.category = newCategoryName; // Perbarui properti kategori di setiap produk
      });
    } else {
      data[newCategoryName] = [];
    }

    // Perbarui kategori item di keranjang
    cart.forEach(item => {
      if (item.category === oldCategoryName) {
        item.category = newCategoryName;
      }
    });

    // Simpan semua perubahan ke IndexedDB
    const categoriesToSave = categories.map(name => ({ name }));
    await Promise.all([
      saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave),
      saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
      saveToIndexedDB(STORE_NAMES.CART, cart)
    ]);

    // Perbarui UI
    updateNavbarCategories();
    renderCategoryList();
    renderProducts();
    updateCartBadge();
    showTab(newCategoryName); // Pindah ke tab kategori yang baru

    showNotification(`Jenis barang berhasil diubah menjadi "${capitalizeFirstLetter(newCategoryName)}"!`);
  } catch (error) {
    console.error("Gagal menyimpan perubahan kategori:", error);
    showNotification('Gagal menyimpan perubahan kategori!');
  }
}

// Fungsi untuk membatalkan edit nama kategori
function cancelEditCategoryName(oldCategoryName, index, originalDisplayName) {
  const categoryItem = document.querySelector(`.category-item[data-category-name="${oldCategoryName}"]`);
  if (!categoryItem) return;

  const categoryNameSpan = categoryItem.querySelector(`#categoryName-${index}`);
  const categoryActionsDiv = categoryItem.querySelector('.category-actions');

  categoryNameSpan.textContent = originalDisplayName; // Kembalikan teks asli

  // Kembalikan tombol aksi
  categoryActionsDiv.innerHTML = `
    <button class="btn-edit-category" onclick="editCategoryName('${oldCategoryName}', ${index})">✏️ Edit</button>
    <button class="btn-delete-category" onclick="deleteCategory('${oldCategoryName}', ${index})">🗑️ Hapus</button>
  `;
}

// Fungsi untuk menghapus kategori
async function deleteCategory(category, index) {
  if (!confirm(`Hapus jenis barang "${capitalizeFirstLetter(category)}"? Semua produk dalam kategori ini juga akan dihapus.`)) {
    return;
  }

  try {
    const removedCategory = categories.splice(index, 1)[0]; // Hapus dari array categories
    delete data[removedCategory]; // Hapus dari data produk
    cart = cart.filter(item => item.category !== removedCategory); // Hapus dari keranjang

    // Simpan perubahan ke database
    const categoriesToSave = categories.map(name => ({ name }));
    await Promise.all([
      saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave),
      saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
      saveToIndexedDB(STORE_NAMES.CART, cart)
    ]);

    // Hapus tab content dan tombol navbar yang terkait
    const tabContent = document.getElementById(removedCategory);
    if (tabContent) tabContent.remove();
    const navbarButtons = Array.from(document.querySelectorAll('.navbar button'));
    const buttonToRemove = navbarButtons.find(button =>
      button.textContent.trim().toLowerCase() === removedCategory.toLowerCase()
    );
    if (buttonToRemove) buttonToRemove.remove();

    // Jika kategori yang dihapus sedang aktif, pindah ke kategori pertama atau tampilkan pesan kosong
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab || activeTab.id === removedCategory) {
      if (categories.length > 0) {
        showTab(categories[0]);
      } else {
        // Kosongkan area produk dan navbar jika tidak ada kategori tersisa
        document.getElementById('dynamic-tabs').innerHTML = '<div class="empty-state">Tidak ada jenis barang. Tambahkan jenis barang baru untuk memulai.</div>';
        const navbar = document.querySelector('.navbar');
        navbar.innerHTML = '';
        const manageBtn = document.createElement('button');
        manageBtn.className = 'manage-category';
        manageBtn.textContent = '➕ Jenis Barang';
        manageBtn.onclick = showCategoryModal;
        navbar.appendChild(manageBtn);
      }
    }

    renderProducts(); // Perbarui tampilan produk
    updateCartBadge(); // Perbarui badge keranjang
    renderCategoryList(); // Perbarui daftar kategori di modal
    showNotification(`Jenis barang "${capitalizeFirstLetter(removedCategory)}" dihapus!`);
  } catch (error) {
    console.error("Gagal menghapus kategori:", error);
    showNotification("Gagal menghapus kategori!");
  }
}

// Fungsi untuk menambahkan kategori baru
function addNewCategory(event) {
  event.preventDefault();
  const input = document.getElementById('newCategoryName');
  const categoryName = input.value.trim().toLowerCase();

  // Validasi input
  if (!categoryName) {
    showNotification('Nama jenis barang tidak boleh kosong!');
    return;
  }
  if (categories.includes(categoryName)) {
    showNotification('Jenis barang sudah ada!');
    return;
  }

  categories.push(categoryName);
  // --- START OF MODIFICATION ---
  categories.sort((a, b) => a.localeCompare(b)); // Urutkan kategori secara alfabetis
  // --- END OF MODIFICATION ---

  const categoriesToSave = categories.map(name => ({ name }));
  saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave)
    .then(() => {
      updateNavbarCategories(); // Perbarui navbar
      renderCategoryList(); // Perbarui daftar kategori di modal
      showNotification('Jenis barang berhasil ditambahkan!');
      input.value = ''; // Kosongkan input
      // Opsional: Langsung tampilkan tab kategori yang baru ditambahkan
      showTab(categoryName);
    })
    .catch(err => {
      console.error('Gagal menambahkan kategori:', err);
      showNotification('Gagal menambahkan jenis barang!');
    });
}

// ===================== Fungsi Laporan Penjualan & Dashboard =====================
// Fungsi untuk menampilkan/menyembunyikan tabel penjualan (saat ini tidak digunakan langsung)
function toggleSales() {
  const salesDiv = document.getElementById('salesData');
  const salesBtn = document.getElementById('salesTab');

  if (salesDiv.style.display === 'block') {
    salesDiv.style.display = 'none';
    salesBtn.textContent = '📊 Lihat Data Penjualan';
  } else {
    renderSalesTable();
    salesDiv.style.display = 'block';
    salesDiv.style.overflowY = 'auto';
    salesBtn.textContent = '✖️ Tutup Data Penjualan';
  }
}

// Fungsi untuk merender tabel laporan penjualan
function renderSalesTable() {
  const salesDiv = document.getElementById('salesData');

  if (sales.length === 0) {
    salesDiv.innerHTML = '<div class="empty-state">Belum ada data penjualan</div>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th onclick="sortSalesTable('time')">Waktu ▲▼</th>
          <th onclick="sortSalesTable('name')">Barang ▲▼</th>
          <th onclick="sortSalesTable('total')">Total Item ▲▼</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;

  let grandTotal = 0;

  sales.forEach((sale, saleIndex) => {
    grandTotal += sale.total;

    // Kelompokkan item berdasarkan produk dalam penjualan yang sama
    const itemsByProduct = {};
    sale.items.forEach(item => {
      const key = `${item.name}-${item.category}`;
      if (!itemsByProduct[key]) {
        itemsByProduct[key] = {
          name: item.name,
          category: item.category,
          image: item.image,
          qty: 0,
          price: item.price,
          code: item.code
        };
      }
      itemsByProduct[key].qty += item.qty;
    });

    // Render setiap produk unik dalam penjualan ini
    Object.values(itemsByProduct).forEach(item => {
      html += `
        <tr class="sales-item-row">
          <td>${sale.time}</td>
          <td>
            <div class="sales-item">
              <img src="${item.image}" class="sales-item-img" alt="${item.name}">
              <div class="sales-item-info">
                <div class="sales-item-name">${item.name}</div>
                <div class="sales-item-category">${item.category}</div>
                <div class="sales-item-code">Kode: <strong>${item.code || '-'}</strong></div>
              </div>
            </div>
          </td>
          <td style="font-weight: bold; text-align: right;">
            <span class="sales-item-qty">${item.qty}x</span> Rp${formatRupiah(item.price * item.qty)}<br>
            <small>(${sale.paymentType || '-'})</small>
          </td>
          <td class="sales-actions">
            <button class="btn-delete-sales" onclick="deleteSalesItem(${saleIndex}, '${item.name}', '${item.category}')">Hapus</button>
          </td>
        </tr>
      `;
    });
  });

  html += `</tbody></table>`;
  html += `<div class="sales-total">Total Penjualan: Rp${formatRupiah(grandTotal)}</div>`;
  html += `
    <div class="sales-actions-bottom">
      <button id="downloadExcelBtn" onclick="downloadExcel()">⬇️ Download Data</button>
      <button id="deleteAllSalesBtn" onclick="deleteAllSalesRecords()">🗑️ Hapus Semua Data</button>
    </div>
  `;
  salesDiv.innerHTML = html;

  // Tambahkan indikator panah ke kolom yang diurutkan
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

// Fungsi untuk mengurutkan tabel penjualan
function sortSalesTable(column) {
  // Jika mengklik kolom yang sama, balik arah pengurutan
  if (currentSortColumn === column) {
    sortDirection *= -1;
  } else {
    currentSortColumn = column;
    sortDirection = 1;
  }

  // Gabungkan semua item penjualan ke dalam satu array untuk pengurutan
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

  // Urutkan item
  allItems.sort((a, b) => {
    if (column === 'name') {
      return a.name.localeCompare(b.name) * sortDirection;
    } else if (column === 'time') {
      return (new Date(a.time) - new Date(b.time)) * sortDirection;
    } else {
      return (a[column] - b[column]) * sortDirection;
    }
  });

  // Kelompokkan kembali item yang sudah diurutkan ke dalam catatan penjualan
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

  const sortedSales = Object.values(groupedSales); // Konversi kembali ke array

  renderSortedSalesTable(sortedSales); // Perbarui tampilan
}

// Fungsi untuk merender tabel penjualan yang sudah diurutkan
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
          <th onclick="sortSalesTable('name')">Barang ▲▼</th>
          <th onclick="sortSalesTable('total')">Total Item ▲▼</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;

  let grandTotal = 0;

  sortedSales.forEach((sale, saleIndex) => {
    grandTotal += sale.total;

    const itemsByProduct = {};
    sale.items.forEach(item => {
      const key = `${item.name}-${item.category}`;
      if (!itemsByProduct[key]) {
        itemsByProduct[key] = {
          name: item.name,
          category: item.category,
          image: item.image,
          qty: 0,
          price: item.price,
          code: item.code
        };
      }
      itemsByProduct[key].qty += item.qty;
    });

    Object.values(itemsByProduct).forEach(item => {
      html += `
        <tr class="sales-item-row">
          <td>${sale.time}</td>
          <td>
            <div class="sales-item">
              <img src="${item.image}" class="sales-item-img" alt="${item.name}">
              <div class="sales-item-info">
                <div class="sales-item-name">${item.name}</div>
                <div class="sales-item-category">${item.category}</div>
                <div class="sales-item-code">Kode: <strong>${item.code || '-'}</strong></div>
              </div>
            </div>
          </td>
          <td style="font-weight: bold; text-align: right;">
            <span class="sales-item-qty">${item.qty}x</span> Rp${formatRupiah(item.price * item.qty)}<br>
            <small>(${sale.paymentType || '-'})</small>
          </td>
          <td class="sales-actions">
            <button class="btn-delete-sales" onclick="deleteSalesRecord(${saleIndex})">Hapus</button>
          </td>
        </tr>
      `;
    });
  });

  html += `</tbody></table>`;
  html += `<div class="sales-total">Total Penjualan: Rp${formatRupiah(grandTotal)}</div>`;
  html += `<button id="downloadExcelBtn" onclick="downloadExcel()">⬇️ Download Data</button>`;

  salesDiv.innerHTML = html;

  // Tambahkan indikator panah ke kolom yang diurutkan
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

// Fungsi untuk menghapus item penjualan tertentu dari riwayat
async function deleteSalesItem(saleIndex, itemName, itemCategory) {
  if (confirm(`Apakah Anda yakin ingin menghapus item "${itemName}" dari record penjualan ini?`)) {
    const saleToModify = sales[saleIndex];

    if (saleToModify) {
      // Filter item yang akan dihapus dari array items dalam transaksi
      saleToModify.items = saleToModify.items.filter(item =>
        !(item.name === itemName && item.category === itemCategory)
      );

      // Jika tidak ada item tersisa dalam transaksi, hapus seluruh transaksi
      if (saleToModify.items.length === 0) {
        sales.splice(saleIndex, 1);
        showNotification(`Transaksi penjualan berhasil dihapus sepenuhnya.`);
      } else {
        // Jika masih ada item, hitung ulang total transaksi
        saleToModify.total = saleToModify.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        saleToModify.change = saleToModify.amountPaid - saleToModify.total; // Perbarui kembalian
        showNotification(`Item "${itemName}" berhasil dihapus dari transaksi.`);
      }

      await saveToIndexedDB(STORE_NAMES.SALES, sales); // Simpan perubahan

      renderSalesTable(); // Perbarui tampilan tabel penjualan
      renderTopProducts(); // Perbarui produk terlaris
    } else {
      showNotification('Transaksi penjualan tidak ditemukan.');
    }
  }
}

// Fungsi untuk menghapus seluruh record penjualan
async function deleteSalesRecord(index) {
  if (confirm("Apakah Anda yakin ingin menghapus record penjualan ini?")) {
    sales.splice(index, 1); // Hapus record dari array
    await saveToIndexedDB(STORE_NAMES.SALES, sales); // Simpan perubahan
    renderSalesTable(); // Perbarui tabel laporan penjualan
    renderTopProducts(); // Perbarui produk terlaris
  }
}

// Fungsi untuk menghapus semua data penjualan
async function deleteAllSalesRecords() {
  if (confirm("Apakah Anda yakin ingin menghapus SEMUA data penjualan?\nIni tidak dapat dibatalkan!")) {
    try {
      sales = []; // Kosongkan array sales
      await saveToIndexedDB(STORE_NAMES.SALES, sales); // Simpan array kosong ke IndexedDB
      renderSalesTable(); // Perbarui tampilan tabel penjualan
      renderTopProducts(); // Perbarui produk terlaris
      showNotification('Semua data penjualan berhasil dihapus!');
    } catch (error) {
      console.error("Gagal menghapus semua data penjualan:", error);
      showNotification('Gagal menghapus semua data penjualan!');
    }
  }
}

// Fungsi untuk mengunduh data penjualan dalam format Excel (.xlsx)
function downloadExcel() {
  try {
    if (sales.length === 0) {
      showNotification("Belum ada data penjualan untuk diunduh!");
      return;
    }

    const ws_data = [
      ["Waktu", "Nama Barang", "Kategori", "Kode Barang", "Jumlah", "Harga Satuan", "Total Item", "Total Pembayaran", "Kembalian", "Jenis Pembayaran"]
    ];

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const time = sale.time || '';
        const itemName = item.name || '';
        const itemCategory = item.category || '';
        const itemCode = item.code || '';
        const itemQty = item.qty || 0;
        const itemPrice = item.price || 0;
        const itemTotal = itemQty * itemPrice;

        const amountPaid = sale.amountPaid || 0;
        const changeAmount = sale.change || 0;
        const paymentType = sale.paymentType || '-';

        ws_data.push([
          time,
          itemName,
          itemCategory,
          itemCode,
          itemQty,
          itemPrice,
          itemTotal,
          amountPaid,
          changeAmount,
          paymentType
        ]);
      });
    });

    const grandTotalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    ws_data.push([]);
    ws_data.push(["TOTAL PENJUALAN KESELURUHAN", "", "", "", "", "", "", "", "", grandTotalSales]);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");

    XLSX.writeFile(wb, `Data_Penjualan_${new Date().toISOString().slice(0,10)}.xlsx`);

    showNotification("Data penjualan berhasil diunduh dalam format Excel!");
  } catch (error) {
    console.error("Gagal mengunduh data Excel:", error);
    showNotification("Gagal mengunduh data Excel!");
  }
}

// Fungsi untuk menampilkan modal dashboard
function showDashboard() {
  document.getElementById('dashboardModal').style.display = 'flex';
  showDashboardTab('salesReport'); // Set tab default ke Laporan Penjualan
  renderSalesTable(); // Muat data laporan penjualan
  renderTopProducts(); // Muat data produk terlaris
}

// Fungsi untuk menampilkan tab tertentu di dashboard
function showDashboardTab(tabId) {
  // Sembunyikan semua konten tab dashboard
  document.querySelectorAll('.dashboard-tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Hapus kelas 'active' dari semua tombol tab dashboard
  document.querySelectorAll('.dashboard-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // Tampilkan konten tab yang dipilih
  document.getElementById(tabId + 'Tab').classList.add('active');

  // Tambahkan kelas 'active' ke tombol tab yang diklik
  document.querySelector(`.dashboard-tab[onclick*="showDashboardTab('${tabId}')"]`).classList.add('active');
}

// Fungsi untuk merender daftar produk terlaris
function renderTopProducts() {
  const productSales = {};

  // Hitung total penjualan untuk setiap produk
  sales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productSales[item.name]) {
        productSales[item.name] = {
          name: item.name,
          image: item.image,
          category: item.category,
          code: item.code,
          totalQty: 0,
          totalRevenue: 0
        };
      }
      productSales[item.name].totalQty += item.qty;
      productSales[item.name].totalRevenue += item.qty * item.price;
    });
  });

  // Konversi ke array dan urutkan berdasarkan total kuantitas terjual
  const sortedProducts = Object.values(productSales).sort((a, b) => b.totalQty - a.totalQty);

  const container = document.getElementById('topProductsList');
  container.innerHTML = '';

  if (sortedProducts.length === 0) {
    container.innerHTML = '<div class="empty-state">Belum ada data penjualan</div>';
    return;
  }

  // Render setiap produk terlaris
  sortedProducts.forEach((product, index) => {
    const item = document.createElement('div');
    item.className = 'top-product-item';
    item.innerHTML = `
      <div class="top-product-info">
        <span>${index + 1}.</span>
        <img src="${product.image}" class="top-product-img" alt="${product.name}">
        <div>
          <div>${product.name}</div>
          <small>${product.category} - <strong>${product.code || '-'}</strong></small>
        </div>
      </div>
      <div>
        <div class="total-qty-display">
          <span class="total-qty-badge">${product.totalQty}</span> terjual
        </div>
        <div class="action-btn btn-soldout " style="color:white;">Rp${formatRupiah(product.totalRevenue)}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Fungsi untuk menampilkan tab penjualan di dashboard (saat ini tidak digunakan langsung)
function showSalesTab() {
  showDashboard();
  showDashboardTab('salesReport');
  renderSalesTable();
}

// ===================== Fungsi Backup & Restore =====================
// Fungsi untuk mengekspor semua data aplikasi
async function exportData() {
  try {
    // Ambil semua data dari IndexedDB
    const allData = {
      products: await loadFromIndexedDB(STORE_NAMES.PRODUCTS),
      cart: await loadFromIndexedDB(STORE_NAMES.CART),
      sales: await loadFromIndexedDB(STORE_NAMES.SALES),
      categories: await loadFromIndexedDB(STORE_NAMES.CATEGORIES),
      timestamp: new Date().toISOString() // Tambahkan timestamp
    };

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Buat elemen anchor untuk download
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_penjualan_${new Date().toISOString().slice(0,10)}.json`;

    document.body.appendChild(a);
    a.click(); // Picu download

    // Bersihkan URL objek setelah download
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

// Fungsi untuk mengimpor data dari file JSON
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);

      // Validasi struktur data yang diimpor
      if (!importedData ||
          !(importedData.products || importedData.cart || importedData.sales || importedData.categories)) {
        throw new Error("Format file tidak valid");
      }

      // Konfirmasi import
      if (!confirm(`Import data dari ${new Date(importedData.timestamp || new Date()).toLocaleString()}? Semua data saat ini akan diganti.`)) {
        return;
      }

      // Kosongkan data yang ada saat ini
      data = {};
      cart = [];
      sales = [];
      categories = [];

      // Proses data yang diimpor
      if (importedData.products && Array.isArray(importedData.products)) {
        // Rekonstruksi objek data dari array datar
        importedData.products.forEach(product => {
          if (!data[product.category]) {
            data[product.category] = [];
          }
          data[product.category].push(product);
        });
      }

      if (importedData.cart && Array.isArray(importedData.cart)) {
        cart = importedData.cart;
      }

      if (importedData.sales && Array.isArray(importedData.sales)) {
        sales = importedData.sales;
      }

      if (importedData.categories && Array.isArray(importedData.categories)) {
        categories = importedData.categories.map(c => c.name);
      }

      // Simpan data yang diimpor ke IndexedDB
      await Promise.all([
        saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
        saveToIndexedDB(STORE_NAMES.CART, cart),
        saveToIndexedDB(STORE_NAMES.SALES, sales),
        saveToIndexedDB(STORE_NAMES.CATEGORIES, importedData.categories || [])
      ]);

      // Muat ulang UI secara paksa
      await loadFromDatabase();

      showNotification('Data berhasil di-import!');
      // closeBackupModal(); // Jika ada modal backup terpisah
    } catch (error) {
      console.error('Gagal import data:', error);
      showNotification('Format file tidak valid! ' + error.message);
    }
  };

  reader.onerror = () => {
    showNotification('Gagal membaca file!');
  };

  reader.readAsText(file);
}

// Fungsi untuk menampilkan dialog import file
function showImportDialog() {
  document.getElementById('importFile').click();
}

// Fungsi untuk mereset semua data aplikasi
async function resetAllData() {
  if (confirm("Apakah Anda yakin ingin mereset SEMUA data?\nIni akan menghapus semua produk, penjualan, dan keranjang belanja.")) {
    try {
      // Kosongkan semua data
      data = {};
      cart = [];
      sales = [];
      categories = [];

      // Simpan data kosong ke IndexedDB
      await Promise.all([
        saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
        saveToIndexedDB(STORE_NAMES.CART, cart),
        saveToIndexedDB(STORE_NAMES.SALES, sales),
        saveToIndexedDB(STORE_NAMES.CATEGORIES, [])
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

// Fungsi untuk menampilkan/menyembunyikan submenu backup
function toggleBackupMenu(event) {
  event.preventDefault();
  event.stopPropagation();

  const submenu = document.getElementById('backupSubmenu');
  submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
}

// ===================== Fungsi Modal & Sidebar =====================
// Fungsi untuk membuka/menutup sidebar
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';

  // Mencegah scroll body saat sidebar terbuka
  document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

// Fungsi untuk menutup sidebar
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

// Fungsi untuk menampilkan modal info/bantuan
function showHelp() {
  document.getElementById('welcomeModal').style.display = 'flex';
}

// Fungsi untuk menutup modal selamat datang
function closeWelcomeModal() {
  document.getElementById('welcomeModal').style.display = 'none';
  localStorage.setItem('hasSeenWelcome', 'true'); // Set flag bahwa pengguna sudah melihat
  document.body.classList.remove('modal-open');
}

// Fungsi untuk mengecek dan menampilkan modal selamat datang
function checkWelcomeMessage() {
  const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
  if (!hasSeenWelcome) {
    document.getElementById('welcomeModal').style.display = 'flex';
  }
}

// Fungsi untuk menutup modal edit
function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

// Fungsi untuk menutup modal dashboard
function closeDashboard() {
  document.getElementById('dashboardModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

// Fungsi untuk menutup semua modal yang mungkin terbuka (dipicu oleh tombol Esc)
function closeAllModals() {
  const modalsToClose = [
    document.getElementById('sidebar'),
    document.getElementById('cartModal'),
    document.getElementById('welcomeModal'),
    document.getElementById('editModal'),
    document.getElementById('categoryModal'),
    document.getElementById('dashboardModal'),
    document.getElementById('checkoutModal')
  ];

  modalsToClose.forEach(modal => {
    if (modal) {
      if (modal.classList.contains('open')) {
        if (modal.id === 'sidebar') closeSidebar();
        else if (modal.id === 'cartModal') closeCartModal();
      } else if (modal.style.display === 'flex') {
        if (modal.id === 'welcomeModal') closeWelcomeModal();
        else if (modal.id === 'editModal') closeEditModal();
        else if (modal.id === 'categoryModal') closeCategoryModal();
        else if (modal.id === 'dashboardModal') closeDashboard();
        else if (modal.id === 'checkoutModal') closeCheckoutModal();
      }
    }
  });
}

// Fungsi untuk menutup modal saat klik di luar area modal
function setupModalCloseOnOutsideClick() {
  const modals = [
    document.getElementById('sidebar'),
    document.getElementById('cartModal'),
    document.getElementById('welcomeModal'),
    document.getElementById('editModal'),
    document.getElementById('categoryModal'),
    document.getElementById('dashboardModal'),
    document.getElementById('checkoutModal')
  ].filter(Boolean); // Filter elemen null jika tidak ada

  document.addEventListener('click', function(event) {
    modals.forEach(element => {
      let isOpen = false;
      if (element.classList.contains('sidebar')) {
        isOpen = element.classList.contains('open');
      } else {
        isOpen = element.style.display === 'flex';
      }

      const isClickInsideModal = element.contains(event.target);
      const isClickOnOpenerButton =
        event.target.closest('.menu-button') ||
        event.target.closest('#cartButton') ||
        event.target.closest('.manage-category') ||
        event.target.closest('[onclick*="showDashboard"]') ||
        event.target.closest('[onclick*="showHelp"]');

      if (isOpen && !isClickInsideModal && !isClickOnOpenerButton) {
        if (element.id === 'sidebar') {
          closeSidebar();
        } else if (element.id === 'cartModal') {
          closeCartModal();
        } else if (element.id === 'welcomeModal') {
          closeWelcomeModal();
        } else if (element.id === 'editModal') {
          closeEditModal();
        } else if (element.id === 'categoryModal') {
          closeCategoryModal();
        } else if (element.id === 'dashboardModal') {
          closeDashboard();
        } else if (element.id === 'checkoutModal') {
          closeCheckoutModal();
        }
      }
    });
  });
}

// ===================== Fungsi Lain-lain =====================
// Fungsi untuk mengaktifkan/menonaktifkan mode fullscreen
function toggleFullscreen() {
  const fullscreenButton = document.getElementById('fullscreenButton');

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      fullscreenButton.textContent = '⛶';
      fullscreenButton.classList.add('fullscreen-active');
    }).catch(err => {
      console.error('Gagal masuk mode fullscreen:', err);
      showNotification('Gagal masuk mode fullscreen');
    });
  } else {
    document.exitFullscreen().then(() => {
      fullscreenButton.textContent = '⛶';
      fullscreenButton.classList.remove('fullscreen-active');
    });
  }
}

// ===================== Event Listener Utama =====================
// Event listener saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', function() {
  // Inisialisasi database dan muat data
  openDatabase().then(() => {
    return loadFromDatabase();
  }).then(() => {
    // Perbarui UI setelah data dimuat
    adjustContentMargin();
    updateCartBadge();
    loadActiveTab(); // Muat tab yang terakhir aktif

    // Setup event listener untuk tombol keranjang
    document.getElementById('cartButton').addEventListener('click', toggleCartModal);

    // Setup event listener untuk tombol clear pencarian
    document.getElementById('clearSearchButton').addEventListener('click', function() {
      document.getElementById('searchInput').value = '';
      this.style.display = 'none';
      filterProducts(''); // Reset tampilan produk
      const savedTab = localStorage.getItem('activeTab');
      if (savedTab && document.getElementById(savedTab)) {
        showTab(savedTab);
      } else if (categories.length > 0) {
        showTab(categories[0]);
      }
    });

    // Setup event listener untuk input pencarian
    document.getElementById('searchInput').addEventListener('input', function() {
      filterProducts(this.value);
    });

    // Setup event listener untuk tombol fullscreen
    document.getElementById('fullscreenButton').addEventListener('click', toggleFullscreen);

    // Deteksi perubahan fullscreen untuk update tombol
    document.addEventListener('fullscreenchange', () => {
      const fullscreenButton = document.getElementById('fullscreenButton');
      if (document.fullscreenElement) {
        fullscreenButton.textContent = '⛶';
        fullscreenButton.classList.add('fullscreen-active');
      } else {
        fullscreenButton.textContent = '⛶';
        fullscreenButton.classList.remove('fullscreen-active');
      }
    });

    checkWelcomeMessage(); // Cek dan tampilkan pesan selamat datang
    setupModalCloseOnOutsideClick(); // Setup penutupan modal saat klik di luar
  }).catch(error => {
    console.error("Error dalam inisialisasi:", error);
    showNotification('Gagal memuat data!');
  });

  // Event listener untuk tombol Esc (menutup semua modal)
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeAllModals();
    }
  });
});
