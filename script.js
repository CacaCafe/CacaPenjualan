function adjustContentMargin() {
  const menuBarHeight = document.querySelector('.menu-bar').offsetHeight;
  const navbarHeight = document.querySelector('.navbar').offsetHeight;
  const totalHeight = menuBarHeight + navbarHeight + 0;
  document.body.style.marginTop = totalHeight + 'px';
  document.documentElement.style.setProperty('--total-header-height', `${totalHeight}px`);
}

window.addEventListener('load', adjustContentMargin);
window.addEventListener('resize', adjustContentMargin);

const DB_NAME = 'penjualan_barang_db';
const DB_VERSION = 4;
const STORE_NAMES = {
  PRODUCTS: 'products',
  CART: 'cart',
  SALES: 'sales',
  CATEGORIES: 'categories',
  PREORDERS: 'preorders',
  PAYMENT_METHODS: 'paymentMethods',
  TRANSFER_METHODS: 'transferMethods'
};
let db;
let data = {};
let categories = [];
let cart = [];
let sales = [];
let preOrders = [];
let currentAmountInput = '';
let currentGrandTotalAfterDiscount = 0;
let isCartModalOpen = false;
let currentSortColumn = null;
let sortDirection = 1;

let paymentMethods = [];
let transferMethods = [];

let selectedPaymentMethod = '';
let selectedTransferMethod = '';

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

      if (!db.objectStoreNames.contains(STORE_NAMES.PRODUCTS)) {
        db.createObjectStore(STORE_NAMES.PRODUCTS, { keyPath: ['category', 'name'] });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.CART)) {
        db.createObjectStore(STORE_NAMES.CART, { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.SALES)) {
        db.createObjectStore(STORE_NAMES.SALES, { keyPath: 'time' });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.CATEGORIES)) {
        db.createObjectStore(STORE_NAMES.CATEGORIES, { keyPath: 'name' });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.PREORDERS)) {
        db.createObjectStore(STORE_NAMES.PREORDERS, { keyPath: 'id', autoIncrement: true });
        console.log(`Object store '${STORE_NAMES.PREORDERS}' dibuat.`);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.PAYMENT_METHODS)) {
        db.createObjectStore(STORE_NAMES.PAYMENT_METHODS, { keyPath: 'name' });
        console.log(`Object store '${STORE_NAMES.PAYMENT_METHODS}' dibuat.`);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.TRANSFER_METHODS)) {
        db.createObjectStore(STORE_NAMES.TRANSFER_METHODS, { keyPath: 'name' });
        console.log(`Object store '${STORE_NAMES.TRANSFER_METHODS}' dibuat.`);
      }
    };
  });
}

function saveToIndexedDB(storeName, dataToSave) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database belum diinisialisasi."));
      return;
    }

    const transaction = db.transaction([storeName], 'readwrite');
    transaction.onerror = (event) => {
      console.error(`Transaksi gagal untuk store ${storeName}:`, event.target.error);
      reject(event.target.error);
    };
    transaction.oncomplete = () => {
      resolve();
    };

    const store = transaction.objectStore(storeName);
    const clearRequest = store.clear();

    clearRequest.onerror = (event) => {
      console.error(`Gagal menghapus data lama dari store ${storeName}:`, event.target.error);
      reject(event.target.error);
    };

    clearRequest.onsuccess = () => {
      let items = [];

      if (Array.isArray(dataToSave)) {
        items = dataToSave;
      } else if (typeof dataToSave === 'object' && dataToSave !== null) {
        items = Object.values(dataToSave).flat().filter(item => {
          if (storeName === STORE_NAMES.PRODUCTS) {
            return item.category && item.name;
          }
          return true;
        });
      }

      if (items.length === 0) {
        return;
      }

      items.forEach(item => {
        const addRequest = store.add(item);
        addRequest.onerror = (e) => {
          console.error(`Gagal menyimpan item ke store ${storeName}:`, item, e.target.error);
        };
      });
    };
  });
}

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

async function loadFromDatabase() {
  try {
    console.log("Membuka database...");
    await openDatabase();
    console.log("Database terbuka.");

    console.log("Memuat kategori...");
    const loadedCategories = await loadFromIndexedDB(STORE_NAMES.CATEGORIES);
    categories = Array.isArray(loadedCategories) && loadedCategories.length > 0 ?
      loadedCategories.map(c => c.name) :
      [];
    console.log("Kategori dimuat dan diproses:", categories);

    const loadedProducts = await loadFromIndexedDB(STORE_NAMES.PRODUCTS);
    data = {};
    if (Array.isArray(loadedProducts) && loadedProducts.length > 0) {
      loadedProducts.forEach(product => {
        if (product && product.category) {
          if (!data[product.category]) data[product.category] = [];
          data[product.category].push(product);
        } else {
          console.warn("Produk tidak valid saat dimuat:", product);
        }
      });
    }
    console.log("Produk dimuat dan diproses:", data);

    cart = Array.isArray(await loadFromIndexedDB(STORE_NAMES.CART)) ? await loadFromIndexedDB(STORE_NAMES.CART) : [];
    sales = Array.isArray(await loadFromIndexedDB(STORE_NAMES.SALES)) ? await loadFromIndexedDB(STORE_NAMES.SALES) : [];
    preOrders = Array.isArray(await loadFromIndexedDB(STORE_NAMES.PREORDERS)) ? await loadFromIndexedDB(STORE_NAMES.PREORDERS) : [];

    const loadedPaymentMethods = await loadFromIndexedDB(STORE_NAMES.PAYMENT_METHODS);
    paymentMethods = Array.isArray(loadedPaymentMethods) && loadedPaymentMethods.length > 0 ?
      loadedPaymentMethods.map(m => m.name) :
      ['Cash', 'Transfer'];

    const loadedTransferMethods = await loadFromIndexedDB(STORE_NAMES.TRANSFER_METHODS);
    transferMethods = Array.isArray(loadedTransferMethods) && loadedTransferMethods.length > 0 ?
      loadedTransferMethods.map(m => m.name) :
      ['Bank BCA', 'Bank Mandiri', 'OVO', 'GoPay'];

    console.log("Keranjang, penjualan, pre-order, dan metode pembayaran dimuat.");

    console.log("Data berhasil dimuat. Memperbarui UI...");
    updateNavbarCategories();
    renderProducts();
    updateCartBadge();
    if (categories.length > 0) {
      const savedTab = localStorage.getItem('activeTab');
      if (savedTab && document.getElementById(savedTab)) {
        showTab(savedTab);
      } else {
        showTab(categories[0]);
      }
    } else {
      document.getElementById('dynamic-tabs').innerHTML = '<div class="empty-state">Tidak ada jenis barang. Tambahkan jenis barang baru untuk memulai.</div>';
      const navbar = document.querySelector('.navbar');
      navbar.innerHTML = '';
      const manageBtn = document.createElement('button');
      manageBtn.className = 'manage-category';
      manageBtn.textContent = '➕ Jenis Barang';
      manageBtn.onclick = showCategoryModal;
      navbar.appendChild(manageBtn);
    }
    console.log("UI diperbarui.");
  } catch (error) {
    console.error("Gagal memuat data (detail):", error);
    showNotification('Gagal memuat data! Silakan coba muat ulang halaman atau reset data.');
    document.getElementById('dynamic-tabs').innerHTML = '<div class="empty-state" style="color: red;">Gagal memuat data. Mohon periksa konsol browser untuk detail kesalahan.</div>';
  }
}

async function saveAllData() {
  try {
    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    await saveToIndexedDB(STORE_NAMES.CART, cart);
    await saveToIndexedDB(STORE_NAMES.SALES, sales);
    const categoriesToSave = categories.map(name => ({ name }));
    await saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave);
    await saveToIndexedDB(STORE_NAMES.PREORDERS, preOrders);
    const paymentMethodsToSave = paymentMethods.map(name => ({ name }));
    await saveToIndexedDB(STORE_NAMES.PAYMENT_METHODS, paymentMethodsToSave);
    const transferMethodsToSave = transferMethods.map(name => ({ name }));
    await saveToIndexedDB(STORE_NAMES.TRANSFER_METHODS, transferMethodsToSave);
  } catch (error) {
    console.error("Gagal menyimpan data ke database:", error);
  }
}

function showNotification(message) {
  let notification = document.getElementById('notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification';
    document.body.appendChild(notification);
  }
  
  notification.textContent = message;
  notification.style.display = 'flex';
  
  void notification.offsetWidth;
  
  notification.style.animation = 'fadeInUp 0.3s ease-out, fadeOutDown 0.5s ease 2.5s forwards';
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

function handleEditSuccess(data) {
  showNotification(`Produk "${data.name}" berhasil diperbarui!`);
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', { style: 'decimal' }).format(number);
}

function formatRupiahInput(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  
  if (value === '') {
    input.value = '';
    return;
  }
  
  const numberValue = parseInt(value);
  
  input.value = new Intl.NumberFormat('id-ID').format(numberValue);
  
  setTimeout(() => {
    input.setSelectionRange(input.value.length, input.value.length);
  }, 0);
}

function isProductCodeDuplicate(code, currentProductName = null) {
  for (const category in data) {
    if (data.hasOwnProperty(category)) {
      for (const product of data[category]) {
        if (product.code === code && product.name !== currentProductName) {
          return true;
        }
      }
    }
  }
  return false;
}

function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    if (tab.classList.contains('active')) {
      tab.style.opacity = '0';
      tab.style.transform = 'translateY(10px)';
      setTimeout(() => {
        tab.classList.remove('active');
        tab.style.display = 'none';
      }, 300);
    }
  });

  document.querySelectorAll('.navbar button:not(.manage-category)').forEach(btn => {
    btn.classList.remove('active-category');
    btn.style.backgroundColor = '';
  });

  const activeTab = document.getElementById(tabName);
  if (activeTab) {
    setTimeout(() => {
      activeTab.classList.add('active');
      activeTab.style.display = 'block';
      setTimeout(() => {
        activeTab.style.opacity = '1';
        activeTab.style.transform = 'translateY(0)';
        adjustContentMargin();
      }, 10);
    }, 300);
  }

  const activeButton = document.querySelector(`.navbar button[onclick="showTab('${tabName}')"]`);
  if (activeButton) {
    activeButton.classList.add('active-category');
    activeButton.style.backgroundColor = '#f25ef3';
  }

  localStorage.setItem('activeTab', tabName);

  const searchResultsTab = document.getElementById('searchResultsTab');
  if (searchResultsTab) {
    searchResultsTab.style.display = 'none';
    searchResultsTab.classList.remove('active');
  }

  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchButton').style.display = 'none';
}

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

function renderProducts() {
  const validCategories = categories.filter(cat => cat && typeof cat === 'string');
  validCategories.forEach(category => {
    const container = document.getElementById(`${category}-list`);
    if (!container) {
      console.warn(`Kontainer produk untuk kategori "${category}" tidak ditemukan.`);
      return;
    }

    container.innerHTML = '';

    if (data[category] && Array.isArray(data[category])) {
      data[category].forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const isLowStock = item.stock <= item.minStock;
        const isOutOfStock = item.stock <= 0;

        const cartItem = cart.find(c => c.name === item.name);
        const cartQty = cartItem ? cartItem.qty : 0;

        card.innerHTML = `
          <div class="product-img-container">
            ${cartQty > 0 ? `<div class="product-badge">${cartQty}</div>` : ''}
            ${item.code ? `<div class="product-code-badge">${item.code}</div>` : ''}
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

        const imgContainer = card.querySelector('.product-img-container');
        const buttonGroup = card.querySelector('.button-group');

        imgContainer.addEventListener('click', (e) => {
          e.stopPropagation();
          
          document.querySelectorAll('.button-group').forEach(group => {
            if (group !== buttonGroup && group.style.display === 'flex') {
              group.style.animation = 'fadeOutDown 0.2s forwards';
              setTimeout(() => {
                group.style.display = 'none';
              }, 200);
            }
          });

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

        buttonGroup.addEventListener('click', (e) => {
          if (e.target === buttonGroup) { 
            e.stopPropagation();
            buttonGroup.style.animation = 'fadeOutDown 0.2s forwards';
            setTimeout(() => {
              buttonGroup.style.display = 'none';
            }, 200);
          }
        });

        document.addEventListener('click', (e) => {
          if (buttonGroup.style.display === 'flex' && !card.contains(e.target)) {
            buttonGroup.style.animation = 'fadeOutDown 0.2s forwards';
            setTimeout(() => {
              buttonGroup.style.display = 'none';
            }, 200);
          }
        });

        container.appendChild(card);
      });
    } else {
      console.warn(`Tidak ada data produk untuk kategori "${category}".`);
    }
  });
}

function updateNavbarCategories() {
  const navbar = document.querySelector('.navbar');
  const tabContainer = document.getElementById('dynamic-tabs');

  navbar.innerHTML = '';
  tabContainer.innerHTML = '';

  const manageBtn = document.createElement('button');
  manageBtn.className = 'manage-category';
  manageBtn.textContent = '➕ Jenis Barang';
  manageBtn.onclick = showCategoryModal;
  navbar.appendChild(manageBtn);

  categories.filter(cat => cat && typeof cat === 'string').forEach(category => {
    const button = document.createElement('button');
    button.textContent = capitalizeFirstLetter(category);
    button.onclick = () => showTab(category);
    navbar.insertBefore(button, manageBtn);

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
          <input type="text" name="price" placeholder="Harga (Rp)" required oninput="formatRupiahInput(this)" inputmode="numeric" pattern="[0-9.]*" />
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

  if (categories.length > 0) {
    showTab(categories[0]);
  }
}

function filterProducts(searchTerm) {
  searchTerm = searchTerm.toLowerCase().trim();
  const searchInput = document.getElementById('searchInput');
  const clearSearchButton = document.getElementById('clearSearchButton');
  const dynamicTabsContainer = document.getElementById('dynamic-tabs');
  let searchResultsTab = document.getElementById('searchResultsTab');

  if (searchTerm.length > 0) {
    clearSearchButton.style.display = 'block';
  } else {
    clearSearchButton.style.display = 'none';
  }

  if (!searchTerm) {
    if (searchResultsTab) {
      searchResultsTab.remove();
    }
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.style.display = 'none';
      tab.classList.remove('active');
    });
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && document.getElementById(savedTab)) {
      showTab(savedTab);
    } else if (categories.length > 0) {
      showTab(categories[0]);
    }
    return;
  }

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
    tab.classList.remove('active');
  });

  if (!searchResultsTab) {
    searchResultsTab = document.createElement('div');
    searchResultsTab.id = 'searchResultsTab';
    searchResultsTab.className = 'tab-content';
    dynamicTabsContainer.appendChild(searchResultsTab);
  }

  searchResultsTab.classList.add('active');
  searchResultsTab.style.display = 'block';

  let productsFoundInSearch = [];
  for (const categoryName in data) {
    if (data.hasOwnProperty(categoryName)) {
      data[categoryName].forEach(product => {
        const productName = product.name.toLowerCase();
        const productCode = product.code ? product.code.toLowerCase() : '';
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
  document.querySelectorAll('.navbar button:not(.manage-category)').forEach(btn => {
    btn.classList.remove('active-category');
    btn.style.backgroundColor = '';
  });
  adjustContentMargin();
}

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
    overlay.style.display = 'none';
    document.body.classList.add('modal-open');
    renderCartModalContent();
    isCartModalOpen = true;
  }
}

function closeCartModal() {
  document.getElementById('cartModal').classList.remove('open');
  document.body.classList.remove('modal-open');
  isCartModalOpen = false;
}

function updateCartBadge() {
  const cartBadge = document.getElementById('cartBadge');
  if (!cartBadge) {
    console.error('Elemen cartBadge tidak ditemukan');
    return;
  }
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  cartBadge.textContent = itemCount;
}

function renderCartModalContent() {
  const cartContent = document.getElementById('cartModalContent');
  const cartTotal = document.getElementById('cartTotal');
  const cartModalFooter = document.querySelector('.cart-modal-footer');

  if (cart.length === 0) {
    cartContent.innerHTML = '<div style="text-align: center; padding: 20px;">Keranjang kosong</div>';
    cartTotal.textContent = '0';
    const quickCountSection = cartModalFooter.querySelector('.quick-count-section');
    if (quickCountSection) quickCountSection.remove();

    const checkoutBtn = cartModalFooter.querySelector('.btn-checkout-cart');
    if (checkoutBtn) checkoutBtn.remove();
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
    document.getElementById('quickCountResult').textContent = 'Kembalian: Rp0';
  }

  let checkoutBtn = cartModalFooter.querySelector('.btn-checkout-cart');
  if (!checkoutBtn) {
    checkoutBtn = document.createElement('button');
    checkoutBtn.className = 'btn-checkout-cart';
    checkoutBtn.textContent = 'Checkout';
    checkoutBtn.onclick = showCheckoutConfirmationModal;
    cartModalFooter.appendChild(checkoutBtn);
  }
}

function calculateQuickChange(amountPaid) {
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const change = amountPaid - total;
  const quickCountResultElement = document.getElementById('quickCountResult');
  if (change < 0) {
    quickCountResultElement.innerHTML = `Kembalian: <span style="color: red;">Kurang Rp${formatRupiah(Math.abs(change))}</span>`;
  } else {
    quickCountResultElement.textContent = `Kembalian: Rp${formatRupiah(change)}`;
  }
}

function decreaseCartItem(index) {
  if (cart[index].qty > 1) {
    cart[index].qty -= 1;
  } else {
    cart.splice(index, 1);
  }
  saveToIndexedDB(STORE_NAMES.CART, cart).then(() => {
    renderCartModalContent();
    updateCartBadge();
    renderProducts();
  });
}

function removeCartItem(index) {
  cart.splice(index, 1);
  saveToIndexedDB(STORE_NAMES.CART, cart).then(() => {
    renderCartModalContent();
    updateCartBadge();
    renderProducts();
  });
}

function increaseQuantity(category, index) {
  const item = data[category][index];
  if (item.stock <= 0) return;

  const qtyInput = document.getElementById(`qty-${category}-${index}`);
  const currentQty = parseInt(qtyInput.value);

  if (currentQty >= item.stock) {
    showNotification(`Stok tidak cukup! Hanya tersedia ${item.stock} item.`);
    return;
  }

  qtyInput.value = currentQty + 1;
  updateCart(category, index, parseInt(qtyInput.value));

  const productName = data[category][index].name;
  showNotification(`Ditambahkan: ${productName} (${qtyInput.value}x)`);
}

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

async function updateCart(category, index, qty) {
  try {
    const product = data[category]?.[index];
    if (!product) {
      throw new Error('Produk tidak ditemukan');
    }

    const cartIndex = cart.findIndex(item => item.name === product.name);

    if (qty > 0) {
      const cartItem = {
        name: product.name,
        price: product.price,
        qty: qty,
        category: product.category,
        image: product.image,
        code: product.code
      };

      if (cartIndex >= 0) {
        cart[cartIndex] = cartItem;
      } else {
        cart.push(cartItem);
      }
    } else if (cartIndex >= 0) {
      cart.splice(cartIndex, 1);
    }

    await saveToIndexedDB(STORE_NAMES.CART, cart);
    updateCartBadge();
    renderProducts();
  } catch (error) {
    console.error('Gagal memperbarui keranjang:', error);
    showNotification('Gagal memperbarui keranjang');
  }
}

function showCheckoutModal(paymentTypeFromCart = null) {
  if (cart.length === 0) {
    showNotification('Keranjang kosong!');
    return;
  }

  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  document.getElementById('discountInput').value = 0;
  currentGrandTotalAfterDiscount = grandTotal;

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

  if (paymentTypeFromCart) {
    modalActions.querySelector('.btn-cash').style.display = 'none';
    modalActions.querySelector('.btn-transfer').style.display = 'none';
    processCheckout(paymentTypeFromCart);
  }

  document.getElementById('checkoutModal').style.display = 'flex';
  document.body.classList.add('modal-open');
  currentAmountInput = '';
  applyDiscount();
}

function showCheckoutConfirmationModal() {
  if (cart.length === 0) {
    showNotification('Keranjang kosong!');
    return;
  }

  closeCartModal();

  const checkoutConfirmationModal = document.getElementById('checkoutConfirmationModal');
  const checkoutConfirmationContent = document.getElementById('checkoutConfirmationContent');
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  document.getElementById('checkoutGrandTotal').textContent = formatRupiah(grandTotal);

  checkoutConfirmationContent.innerHTML = `
    <div class="checkout-confirmation-header">
      <h4>Pilih Metode Pembayaran</h4>
      <p>Total Belanja: <strong>Rp<span id="checkoutGrandTotal">${formatRupiah(grandTotal)}</span></strong></p>
    </div>
    <div class="payment-method-options" id="mainPaymentMethodButtons">
    </div>

    <div id="dynamicTransferMethodContainer" style="display: none;">
      <label for="transferMethodInput">Pilih Metode Transfer:</label>
      <div class="payment-method-options" id="dynamicTransferMethodButtons">
      </div>
      <input type="text" id="transferDetailsInput" placeholder="No. Rekening/ID E-Wallet/Keterangan" style="display: none;">
    </div>

    <button class="btn-confirm-payment" id="confirmPaymentButton" style="display:none;">Konfirmasi Pembayaran</button>
    <button class="btn-cancel-confirmation" onclick="closeCheckoutConfirmationModal()">Batal</button>
    <button class="btn-manage-payment" onclick="openPaymentMethodModal()">Kelola Metode Pembayaran</button>
  `;

  renderMainPaymentMethodButtons();

  checkoutConfirmationModal.style.display = 'flex';
  document.body.classList.add('modal-open');

  selectedPaymentMethod = '';
  selectedTransferMethod = '';
  document.getElementById('confirmPaymentButton').style.display = 'none';
  document.getElementById('transferDetailsInput').style.display = 'none';
  document.getElementById('dynamicTransferMethodContainer').style.display = 'none';
}

function renderMainPaymentMethodButtons() {
  const container = document.getElementById('mainPaymentMethodButtons');
  container.innerHTML = '';

  ['Cash', 'Transfer'].forEach(method => {
    const button = document.createElement('button');
    button.className = `btn-payment-option btn-${method.toLowerCase().replace(/\s/g, '-')}`;
    button.textContent = method;
    button.onclick = () => selectPaymentMethod(method);
    container.appendChild(button);
  });
}

function renderDynamicTransferMethods() {
  const container = document.getElementById('dynamicTransferMethodButtons');
  container.innerHTML = '';

  if (transferMethods.length === 0) {
    container.innerHTML = '<p style="text-align: center; font-size: 14px; color: #777;">Belum ada metode transfer. Tambahkan di "Kelola Metode Pembayaran".</p>';
    return;
  }

  transferMethods.forEach(method => {
    const button = document.createElement('button');
    button.className = `btn-payment-option btn-transfer-dynamic`;
    button.textContent = method;
    button.onclick = (event) => selectTransferMethod(method, event.target);
    container.appendChild(button);
  });
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  selectedTransferMethod = '';

  const dynamicTransferMethodContainer = document.getElementById('dynamicTransferMethodContainer');
  const transferDetailsInput = document.getElementById('transferDetailsInput');
  const confirmPaymentButton = document.getElementById('confirmPaymentButton');

  document.querySelectorAll('#mainPaymentMethodButtons .btn-payment-option').forEach(btn => {
    btn.classList.remove('active');
  });
  const selectedMainButton = document.querySelector(`#mainPaymentMethodButtons .btn-${method.toLowerCase().replace(/\s/g, '-')}`);
  if (selectedMainButton) {
    selectedMainButton.classList.add('active');
  }

  document.querySelectorAll('#dynamicTransferMethodButtons .btn-transfer-dynamic').forEach(btn => {
    btn.classList.remove('active');
  });

  if (method.toLowerCase() === 'cash') {
    dynamicTransferMethodContainer.style.display = 'none';
    transferDetailsInput.style.display = 'none';
    transferDetailsInput.required = false;
    confirmPaymentButton.style.display = 'block';
    confirmPaymentButton.onclick = () => processCheckout('Cash', '');
  } else if (method.toLowerCase() === 'transfer') {
    dynamicTransferMethodContainer.style.display = 'block';
    renderDynamicTransferMethods();
    transferDetailsInput.style.display = 'none';
    transferDetailsInput.required = false;
    confirmPaymentButton.style.display = 'none';
  }
}

function selectTransferMethod(method, clickedButton) {
  console.log('selectTransferMethod called with:', method);
  selectedTransferMethod = method;
  const confirmPaymentButton = document.getElementById('confirmPaymentButton');

  document.querySelectorAll('#dynamicTransferMethodButtons .btn-transfer-dynamic').forEach(btn => {
    btn.classList.remove('active');
  });
  if (clickedButton) {
    clickedButton.classList.add('active');
  }

  console.log('confirmPaymentButton display before:', confirmPaymentButton.style.display);
  confirmPaymentButton.style.display = 'block';
  console.log('confirmPaymentButton display after:', confirmPaymentButton.style.display);

  confirmPaymentButton.onclick = () => {
    console.log('Attempting checkout with method:', selectedTransferMethod);
    processCheckout(selectedTransferMethod, '');
  };
}

function closeCheckoutConfirmationModal() {
  document.getElementById('checkoutConfirmationModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

function appendToAmount(number) {
  currentAmountInput += number;
  document.getElementById('manualAmount').value = formatRupiah(parseInt(currentAmountInput.replace(/\./g, '')));
  calculateChange(parseInt(currentAmountInput.replace(/\./g, '')));
}

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

function closeCheckoutModal() {
  document.body.style.overflow = '';
  document.getElementById('checkoutModal').style.display = 'none';
  currentAmountInput = '';
  document.body.classList.remove('modal-open');
}

async function processCheckout(paymentType, paymentDetails = '') {
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let amountPaid = total;

  const grandTotal = total;
  const finalPaymentMethod = paymentType;

  const confirmMessage = `Apakah Anda ingin membeli item ini seharga Rp${formatRupiah(grandTotal)} dengan metode ${finalPaymentMethod}?`;
  if (!confirm(confirmMessage)) {
    return;
  }

  const now = new Date().toLocaleString('id-ID');

  cart.forEach(item => {
    const product = data[item.category].find(p => p.name === item.name);
    if (product) {
      product.stock -= item.qty;
    }
  });

  sales.push({
    time: now,
    items: JSON.parse(JSON.stringify(cart)),
    total: grandTotal,
    amountPaid: amountPaid,
    change: amountPaid - grandTotal,
    paymentType: finalPaymentMethod,
    paymentDetails: paymentDetails
  });

  cart = [];

  await Promise.all([
    saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
    saveToIndexedDB(STORE_NAMES.CART, cart),
    saveToIndexedDB(STORE_NAMES.SALES, sales)
  ]);

  closeCartModal();
  closeCheckoutModal();
  closeCheckoutConfirmationModal();
  updateCartBadge();
  renderProducts();

  if (document.getElementById('salesData').style.display === 'block') {
    renderSalesTable();
  }

  document.querySelector('.sidebar-overlay').style.display = 'none';

  showNotification(`Pembelian berhasil! Total: Rp${formatRupiah(grandTotal)} (${finalPaymentMethod})`);
}

function applyDiscount() {
  const discountInput = document.getElementById('discountInput');
  let discountPercentage = parseFloat(discountInput.value);

  if (isNaN(discountPercentage) || discountPercentage < 0) {
    discountPercentage = 0;
    discountInput.value = 0;
  } else if (discountPercentage > 100) {
    discountPercentage = 100;
    discountInput.value = 100;
  }

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = grandTotal * (discountPercentage / 100);
  currentGrandTotalAfterDiscount = grandTotal - discountAmount;

  document.getElementById('discountPercentageDisplay').textContent = discountPercentage;
  document.getElementById('discountAmountDisplay').textContent = `Rp${formatRupiah(discountAmount)}`;
  document.getElementById('finalTotalAmount').textContent = `Rp${formatRupiah(currentGrandTotalAfterDiscount)}`;

  const manualAmountInput = document.getElementById('manualAmount');
  if (manualAmountInput && manualAmountInput.value) {
    calculateChange(parseInt(manualAmountInput.value.replace(/\./g, '')));
  } else {
    document.getElementById('amountPaid').textContent = `Rp0`;
    document.getElementById('changeAmount').textContent = `Rp0`;
    document.getElementById('paymentSummary').style.display = 'block';
  }
}

function calculateChange(amount) {
  const total = currentGrandTotalAfterDiscount;
  const change = amount - total;

  document.getElementById('amountPaid').textContent = `Rp${formatRupiah(amount)}`;
  document.getElementById('changeAmount').textContent = `Rp${formatRupiah(change > 0 ? change : 0)}`;
  document.getElementById('paymentSummary').style.display = 'block';

  const checkoutSummary = document.getElementById('checkoutSummary');
  checkoutSummary.scrollTop = checkoutSummary.scrollHeight;
}

async function deleteProduct(category, index) {
  const productName = data[category][index].name;
  if (confirm(`Hapus barang "${productName}"?`)) {
    data[category].splice(index, 1);

    for (let i = cart.length - 1; i >= 0; i--) {
      if (cart[i].name === productName) {
        cart.splice(i, 1);
      }
    }

    await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
    await saveToIndexedDB(STORE_NAMES.CART, cart);

    renderProducts();
    updateCartBadge();
  }
}

function editProduct(category, index) {
  const product = data[category][index];
  document.getElementById('editCategory').value = category;
  document.getElementById('editIndex').value = index;
  document.getElementById('editName').value = product.name;
  document.getElementById('editCode').value = product.code || '';
  
  document.getElementById('editPrice').value = formatRupiah(product.price);
  
  document.getElementById('editStock').value = product.stock;
  document.getElementById('editMinStock').value = product.minStock;
  document.getElementById('editPreview').src = product.image;
  document.getElementById('editPreview').style.display = 'block';
  document.getElementById('editImageFile').value = '';

  document.getElementById('editModal').style.display = 'flex';
}
async function saveEditedProduct(event) {
  event.preventDefault();
  const form = event.target;
  const name = form.name.value.trim();
  const code = form.code.value.trim();
  
  const price = parseInt(form.price.value.replace(/[^0-9]/g, '')) || 0;

  const stock = parseInt(form.stock.value);
  const minStock = parseInt(form.minStock.value);

  if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0 || isNaN(minStock) || minStock < 0) {
    showNotification("Harap isi semua data dengan benar!");
    return;
  }

  const category = document.getElementById('editCategory').value;
  const index = document.getElementById('editIndex').value;

  data[category][index].name = name;
  data[category][index].code = code;
  data[category][index].price = price;
  data[category][index].stock = stock;
  data[category][index].minStock = minStock;

  await saveToIndexedDB(STORE_NAMES.PRODUCTS, data);
  renderProducts();
  closeEditModal();
  showNotification(`Produk "${name}" berhasil diperbarui!`);
}

async function addProduct(event, category) {
  event.preventDefault();
  const form = event.target;
  const name = form.name.value.trim();
  const code = form.code.value.trim();
  
  const price = parseInt(form.price.value.replace(/[^0-9]/g, '')) || 0;

  const stock = parseInt(form.stock.value);
  const minStock = parseInt(form.minStock.value);
  const fileInput = form.imageFile;

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
    const compressedImage = await compressImage(fileInput.files[0]);

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
    showNotification("Gagal menambahkan produk! " + error.message);
  }
}

async function addProduct(event, category) {
  event.preventDefault();
  const form = event.target;
  const name = form.name.value.trim();
  const code = form.code.value.trim();

  const priceString = form.price.value.replace(/\./g, '').replace(',', '.');
  const price = parseFloat(priceString);

  const stock = parseInt(form.stock.value);
  const minStock = parseInt(form.minStock.value);
  const fileInput = form.imageFile;

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
    const compressedImage = await compressImage(fileInput.files[0]);

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
    showNotification("Gagal menambahkan produk! " + error.message);
  }
}

function fixImageOrientation(img, orientation) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (orientation > 4 && orientation < 9) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, img.width, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, img.width, img.height); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, img.height); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, img.height, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, img.height, img.width); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, img.width); break;
    default: ctx.transform(1, 0, 0, 1, 0, 0); break;
  }

  ctx.drawImage(img, 0, 0);
  img.src = canvas.toDataURL();
}

function previewImage(event, context) {
  const file = event.target.files[0];
  if (!file) return;

  const previewId = context === 'edit' ? 'editPreview' : `imagePreview-${context}`;
  const preview = document.getElementById(previewId);
  const reader = new FileReader();

  reader.onload = function(e) {
    preview.src = e.target.result;
    preview.style.display = 'block';
  };

  reader.readAsDataURL(file);
}

async function compressImage(file, maxSizeKB = 50) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        let width = img.width;
        let height = img.height;
        const maxDimension = 800;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height *= maxDimension / width;
            width = maxDimension;
          } else {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.7;
        let compressedDataUrl;

        for (let i = 0; i < 5; i++) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const sizeKB = (compressedDataUrl.length * 0.75) / 1024;
          if (sizeKB <= maxSizeKB) break;
          quality -= 0.15;
          if (quality < 0.1) quality = 0.1;
        }
        resolve(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openCamera(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.setAttribute('capture', 'environment');
    input.click();
  }
}

document.getElementById('fullscreenButton').addEventListener('click', toggleFullscreen);
document.getElementById('refreshButton').addEventListener('click', function() {
  location.reload();
});

function openGallery(context) {
  const inputId = context === 'edit' ? 'editImageFile' : `imageInput-${context}`;
  const input = document.getElementById(inputId);
  if (input) {
    input.removeAttribute('capture');
    input.click();
  }
}

function showCategoryModal() {
  document.body.style.overflow = 'hidden';
  renderCategoryList();
  document.getElementById('categoryModal').style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('categoryModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

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

function editCategoryName(oldCategoryName, index) {
  const categoryItem = document.querySelector(`.category-item[data-category-name="${oldCategoryName}"]`);
  if (!categoryItem) return;

  const categoryNameSpan = categoryItem.querySelector(`#categoryName-${index}`);
  const categoryActionsDiv = categoryItem.querySelector('.category-actions');

  const originalName = categoryNameSpan.textContent;

  categoryNameSpan.innerHTML = `
    <input type="text" id="editCategoryInput-${index}" value="${originalName}" />
  `;

  categoryActionsDiv.innerHTML = `
    <button class="btn-save-category" onclick="saveCategoryName('${oldCategoryName}', ${index})">💾 Simpan</button>
    <button class="btn-cancel-edit" onclick="cancelEditCategoryName('${oldCategoryName}', ${index}, '${originalName}')">✖️ Batal</button>
  `;

  document.getElementById(`editCategoryInput-${index}`).focus();
}

async function saveCategoryName(oldCategoryName, index) {
  const newCategoryInput = document.getElementById(`editCategoryInput-${index}`);
  const newCategoryName = newCategoryInput.value.trim().toLowerCase();

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

  if (!confirm(`Ubah nama jenis barang dari "${capitalizeFirstLetter(oldCategoryName)}" menjadi "${capitalizeFirstLetter(newCategoryName)}"?`)) {
    cancelEditCategoryName(oldCategoryName, index, capitalizeFirstLetter(oldCategoryName));
    return;
  }

  try {
    categories[index] = newCategoryName;
    categories.sort((a, b) => a.localeCompare(b));

    if (data[oldCategoryName]) {
      data[newCategoryName] = data[oldCategoryName];
      delete data[oldCategoryName];
      data[newCategoryName].forEach(product => {
        product.category = newCategoryName;
      });
    } else {
      data[newCategoryName] = [];
    }

    cart.forEach(item => {
      if (item.category === oldCategoryName) {
        item.category = newCategoryName;
      }
    });

    const categoriesToSave = categories.map(name => ({ name }));
    await Promise.all([
      saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave),
      saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
      saveToIndexedDB(STORE_NAMES.CART, cart)
    ]);

    updateNavbarCategories();
    renderCategoryList();
    renderProducts();
    updateCartBadge();
    showTab(newCategoryName);

    showNotification(`Jenis barang berhasil diubah menjadi "${capitalizeFirstLetter(newCategoryName)}"!`);
  } catch (error) {
    console.error("Gagal menyimpan perubahan kategori:", error);
    showNotification('Gagal menyimpan perubahan kategori!');
  }
}

function cancelEditCategoryName(oldCategoryName, index, originalDisplayName) {
  const categoryItem = document.querySelector(`.category-item[data-category-name="${oldCategoryName}"]`);
  if (!categoryItem) return;

  const categoryNameSpan = categoryItem.querySelector(`#categoryName-${index}`);
  const categoryActionsDiv = categoryItem.querySelector('.category-actions');

  categoryNameSpan.textContent = originalDisplayName;

  categoryActionsDiv.innerHTML = `
    <button class="btn-edit-category" onclick="editCategoryName('${oldCategoryName}', ${index})">✏️ Edit</button>
    <button class="btn-delete-category" onclick="deleteCategory('${oldCategoryName}', ${index})">🗑️ Hapus</button>
  `;
}

async function deleteCategory(category, index) {
  if (!confirm(`Hapus jenis barang "${capitalizeFirstLetter(category)}"? Semua produk dalam kategori ini juga akan dihapus.`)) {
    return;
  }

  try {
    const removedCategory = categories.splice(index, 1)[0];
    delete data[removedCategory];
    cart = cart.filter(item => item.category !== removedCategory);

    const categoriesToSave = categories.map(name => ({ name }));
    await Promise.all([
      saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave),
      saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
      saveToIndexedDB(STORE_NAMES.CART, cart)
    ]);

    const tabContent = document.getElementById(removedCategory);
    if (tabContent) tabContent.remove();
    const navbarButtons = Array.from(document.querySelectorAll('.navbar button'));
    const buttonToRemove = navbarButtons.find(button =>
      button.textContent.trim().toLowerCase() === removedCategory.toLowerCase()
    );
    if (buttonToRemove) buttonToRemove.remove();

    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab || activeTab.id === removedCategory) {
      if (categories.length > 0) {
        showTab(categories[0]);
      } else {
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

    renderProducts();
    updateCartBadge();
    renderCategoryList();
    showNotification(`Jenis barang "${capitalizeFirstLetter(removedCategory)}" dihapus!`);
  } catch (error) {
    console.error("Gagal menghapus kategori:", error);
    showNotification("Gagal menghapus kategori!");
  }
}

function addNewCategory(event) {
  event.preventDefault();
  const input = document.getElementById('newCategoryName');
  const categoryName = input.value.trim().toLowerCase();

  if (!categoryName) {
    showNotification('Nama jenis barang tidak boleh kosong!');
    return;
  }
  if (categories.includes(categoryName)) {
    showNotification('Jenis barang sudah ada!');
    return;
  }

  categories.push(categoryName);
  categories.sort((a, b) => a.localeCompare(b));

  const categoriesToSave = categories.map(name => ({ name }));
  saveToIndexedDB(STORE_NAMES.CATEGORIES, categoriesToSave)
    .then(() => {
      updateNavbarCategories();
      renderCategoryList();
      showNotification('Jenis barang berhasil ditambahkan!');
      input.value = '';
      showTab(categoryName);
    })
    .catch(err => {
      console.error('Gagal menambahkan kategori:', err);
      showNotification('Gagal menambahkan jenis barang!');
    });
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
    salesDiv.style.overflowY = 'auto';
    salesBtn.textContent = '✖️ Tutup Data Penjualan';
  }
}

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
          <th id="sortSalesTable('time')">Waktu</th>
          <th id="sortSalesTable('name')">Barang</th>
          <th id="sortSalesTable('total')">Total Item</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;

  let grandTotal = 0;
  let totalCash = 0;
  let totalTransfer = 0;

  sales.forEach((sale, saleIndex) => {
    grandTotal += sale.total;
    if (sale.paymentType && sale.paymentType.toLowerCase() === 'cash') {
      totalCash += sale.total;
    } else if (sale.paymentType && sale.paymentType.toLowerCase() !== 'cash') {
      totalTransfer += sale.total;
    }
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
            <small>(${sale.paymentType || '-'} ${sale.paymentDetails ? ` - ${sale.paymentDetails}` : ''})</small>
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
    <div class="sales-total" style="font-size:15px; margin-top:0;">
      <span style="color:#27ae60;">Total Cash: Rp${formatRupiah(totalCash)}</span><br>
      <span style="color:#2980b9;">Total Transfer: Rp${formatRupiah(totalTransfer)}</span>
    </div>
  `;
  html += `
    <div class="sales-actions-bottom">
      <button id="downloadExcelBtn" onclick="downloadExcel()">⬇️ Download Data</button>
      <button id="deleteAllSalesBtn" onclick="deleteAllSalesRecords()">🗑️ Hapus Semua Data</button>
    </div>
  `;
  salesDiv.innerHTML = html;

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

function sortSalesTable(column) {
  if (currentSortColumn === column) {
    sortDirection *= -1;
  } else {
    currentSortColumn = column;
    sortDirection = 1;
  }

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

  allItems.sort((a, b) => {
    if (column === 'name') {
      return a.name.localeCompare(b.name) * sortDirection;
    } else if (column === 'time') {
      return (new Date(a.time) - new Date(b.time)) * sortDirection;
    } else {
      return (a[column] - b[column]) * sortDirection;
    }
  });

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

  const sortedSales = Object.values(groupedSales);

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
  html += `
    <div class="sales-total" style="font-size:15px; margin-top:0;">
      <span style="color:#27ae60;">Total Cash: Rp${formatRupiah(totalCash)}</span><br>
      <span style="color:#2980b9;">Total Transfer: Rp${formatRupiah(totalTransfer)}</span>
    </div>
  `;
  html += `
    <div class="sales-actions-bottom">
      <button id="downloadExcelBtn" onclick="downloadExcel()">⬇️ Download Data</button>
      <button id="deleteAllSalesBtn" onclick="deleteAllSalesRecords()">🗑️ Hapus Semua Data</button>
    </div>
  `;
  salesDiv.innerHTML = html;

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

async function deleteSalesItem(saleIndex, itemName, itemCategory) {
  if (confirm(`Apakah Anda yakin ingin menghapus item "${itemName}" dari record penjualan ini?`)) {
    const saleToModify = sales[saleIndex];

    if (saleToModify) {
      saleToModify.items = saleToModify.items.filter(item =>
        !(item.name === itemName && item.category === itemCategory)
      );

      if (saleToModify.items.length === 0) {
        sales.splice(saleIndex, 1);
        showNotification(`Transaksi penjualan berhasil dihapus sepenuhnya.`);
      } else {
        saleToModify.total = saleToModify.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        saleToModify.change = saleToModify.amountPaid - saleToModify.total;
        showNotification(`Item "${itemName}" berhasil dihapus dari transaksi.`);
      }

      await saveToIndexedDB(STORE_NAMES.SALES, sales);

      renderSalesTable();
      renderTopProducts();
    } else {
      showNotification('Transaksi penjualan tidak ditemukan.');
    }
  }
}

async function deleteSalesRecord(index) {
  if (confirm("Apakah Anda yakin ingin menghapus record penjualan ini?")) {
    sales.splice(index, 1);
    await saveToIndexedDB(STORE_NAMES.SALES, sales);
    renderSalesTable();
    renderTopProducts();
  }
}

async function deleteAllSalesRecords() {
  if (confirm("Apakah Anda yakin ingin menghapus SEMUA data penjualan?\nIni tidak dapat dibatalkan!")) {
    try {
      sales = [];
      await saveToIndexedDB(STORE_NAMES.SALES, sales);
      renderSalesTable();
      renderTopProducts();
      showNotification('Semua data penjualan berhasil dihapus!');
    } catch (error) {
      console.error("Gagal menghapus semua data penjualan:", error);
      showNotification('Gagal menghapus semua data penjualan!');
    }
  }
}

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

function showDashboard() {
  document.getElementById('dashboardModal').style.display = 'flex';
  showDashboardTab('salesReport');
  renderSalesTable();
  renderTopProducts();
}

function showDashboardTab(tabId) {
  document.querySelectorAll('.dashboard-tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  document.querySelectorAll('.dashboard-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  document.getElementById(tabId + 'Tab').classList.add('active');

  document.querySelector(`.dashboard-tab[onclick*="showDashboardTab('${tabId}')"]`).classList.add('active');
}

function renderTopProducts() {
  const productSales = {};

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

  const sortedProducts = Object.values(productSales).sort((a, b) => b.totalQty - a.totalQty);

  const container = document.getElementById('topProductsList');
  container.innerHTML = '';

  if (sortedProducts.length === 0) {
    container.innerHTML = '<div class="empty-state">Belum ada data penjualan</div>';
    return;
  }

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

function showSalesTab() {
  showDashboard();
  showDashboardTab('salesReport');
  renderSalesTable();
}

async function exportData() {
  try {
    const allData = {
      products: await loadFromIndexedDB(STORE_NAMES.PRODUCTS),
      cart: await loadFromIndexedDB(STORE_NAMES.CART),
      sales: await loadFromIndexedDB(STORE_NAMES.SALES),
      categories: await loadFromIndexedDB(STORE_NAMES.CATEGORIES),
      preorders: await loadFromIndexedDB(STORE_NAMES.PREORDERS),
      paymentMethods: await loadFromIndexedDB(STORE_NAMES.PAYMENT_METHODS),
      transferMethods: await loadFromIndexedDB(STORE_NAMES.TRANSFER_METHODS),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_penjualan_${new Date().toISOString().slice(0,10)}.json`;

    document.body.appendChild(a);
    a.click();

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

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);

      if (!importedData ||
          !(importedData.products || importedData.cart || importedData.sales || importedData.categories || importedData.preorders || importedData.paymentMethods || importedData.transferMethods)) {
        throw new Error("Format file tidak valid");
      }

      if (!confirm(`Import data dari ${new Date(importedData.timestamp || new Date()).toLocaleString()}? Semua data saat ini akan diganti.`)) {
        return;
      }

      data = {};
      cart = [];
      sales = [];
      categories = [];
      preOrders = [];
      paymentMethods = [];
      transferMethods = [];

      if (importedData.products && Array.isArray(importedData.products)) {
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

      if (importedData.preorders && Array.isArray(importedData.preorders)) {
        preOrders = importedData.preorders;
      }

      if (importedData.paymentMethods && Array.isArray(importedData.paymentMethods)) {
        paymentMethods = importedData.paymentMethods.map(m => m.name);
      }

      if (importedData.transferMethods && Array.isArray(importedData.transferMethods)) {
        transferMethods = importedData.transferMethods.map(m => m.name);
      }

      await Promise.all([
        saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
        saveToIndexedDB(STORE_NAMES.CART, cart),
        saveToIndexedDB(STORE_NAMES.SALES, sales),
        saveToIndexedDB(STORE_NAMES.CATEGORIES, importedData.categories || []),
        saveToIndexedDB(STORE_NAMES.PREORDERS, preOrders),
        saveToIndexedDB(STORE_NAMES.PAYMENT_METHODS, importedData.paymentMethods || []),
        saveToIndexedDB(STORE_NAMES.TRANSFER_METHODS, importedData.transferMethods || [])
      ]);

      await loadFromDatabase();

      showNotification('Data berhasil di-import!');
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

function showImportDialog() {
  document.getElementById('importFile').click();
}

async function resetAllData() {
  if (confirm("Apakah Anda yakin ingin mereset SEMUA data?\nIni akan menghapus semua produk, penjualan, dan keranjang belanja.")) {
    try {
      data = {};
      cart = [];
      sales = [];
      categories = [];
      preOrders = [];
      paymentMethods = ['Cash', 'Transfer'];
      transferMethods = ['Bank BCA', 'Bank Mandiri', 'OVO', 'GoPay'];

      await Promise.all([
        saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
        saveToIndexedDB(STORE_NAMES.CART, cart),
        saveToIndexedDB(STORE_NAMES.SALES, sales),
        saveToIndexedDB(STORE_NAMES.CATEGORIES, []),
        saveToIndexedDB(STORE_NAMES.PREORDERS, []),
        saveToIndexedDB(STORE_NAMES.PAYMENT_METHODS, paymentMethods.map(name => ({ name }))),
        saveToIndexedDB(STORE_NAMES.TRANSFER_METHODS, transferMethods.map(name => ({ name })))
      ]);

      renderProducts();
      updateCartBadge();
      renderCategoryList();
      updateNavbarCategories();
      renderPreOrderList();
      renderDynamicTransferMethods();
      populateProductSelect();

      showNotification('Semua data telah direset!');
    } catch (error) {
      console.error("Gagal mereset data:", error);
      showNotification('Gagal mereset data!');
    }
  }
}

function toggleBackupMenu(event) {
  event.preventDefault();
  event.stopPropagation();

  const submenu = document.getElementById('backupSubmenu');
  submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';

  document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

function showHelp() {
  document.getElementById('welcomeModal').style.display = 'flex';
}

function closeWelcomeModal() {
  document.getElementById('welcomeModal').style.display = 'none';
  localStorage.setItem('hasSeenWelcome', 'true');
  document.body.classList.remove('modal-open');
}

function checkWelcomeMessage() {
  const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
  if (!hasSeenWelcome) {
    document.getElementById('welcomeModal').style.display = 'flex';
  }
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

function closeDashboard() {
  document.getElementById('dashboardModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

function showPreOrder() {
  document.getElementById('preOrderModal').style.display = 'flex';
  document.body.classList.add('modal-open');
  populateProductSelect();
  showPreOrderTab('addPreOrder');
  renderPreOrderList();
}

function closePreOrderModal() {
  document.getElementById('preOrderModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

function showPreOrderTab(tabId) {
  document.querySelectorAll('.preorder-tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });
  document.querySelectorAll('.preorder-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  document.getElementById(tabId + 'Tab').classList.add('active');
  document.getElementById(tabId + 'Tab').style.display = 'block';
  document.querySelector(`.preorder-tab[onclick*="showPreOrderTab('${tabId}')"]`).classList.add('active');

  if (tabId === 'listPreOrder') {
    renderPreOrderList();
  }
}

function populateProductSelect() {
  const selectElement = document.getElementById('poProductSelect');
  selectElement.innerHTML = '';

  const allProducts = Object.values(data).flat();

  if (allProducts.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Tidak ada barang tersedia';
    option.disabled = true;
    selectElement.appendChild(option);
    return;
  }

  allProducts.forEach(product => {
    const option = document.createElement('option');
    option.value = product.name;
    option.textContent = `${product.name} (Stok: ${product.stock}, Rp${formatRupiah(product.price)})`;
    option.dataset.price = product.price;
    option.dataset.category = product.category;
    option.dataset.image = product.image;
    option.dataset.code = product.code;
    selectElement.appendChild(option);
  });

  if (!selectElement.choices) {
    selectElement.choices = new Choices(selectElement, {
      removeItemButton: true,
      searchEnabled: true,
      placeholder: true,
      placeholderValue: 'Pilih barang...',
      itemSelectText: 'Pilih',
      noResultsText: 'Tidak ditemukan',
      noChoicesText: 'Tidak ada pilihan',
      shouldSort: false
    });

    selectElement.choices.passedElement.element.addEventListener('change', function(event) {
      updateSelectedProductsDisplay();
    });
  } else {
    selectElement.choices.setChoices(allProducts.map(product => ({
      value: product.name,
      label: `${product.name} (Stok: ${product.stock}, Rp${formatRupiah(product.price)})`,
      customProperties: {
        price: product.price,
        category: product.category,
        image: product.image,
        code: product.code
      }
    })), 'value', 'label', true);
  }
  updateSelectedProductsDisplay();

  const poPaymentMethodSelect = document.getElementById('poPaymentMethod');
  poPaymentMethodSelect.innerHTML = '';
  const allPaymentOptions = [...paymentMethods, ...transferMethods];
  allPaymentOptions.forEach(method => {
    const option = document.createElement('option');
    option.value = method;
    option.textContent = method;
    poPaymentMethodSelect.appendChild(option);
  });
}

function updateSelectedProductsDisplay() {
  const selectElement = document.getElementById('poProductSelect');
  const displayDiv = document.getElementById('selectedPoProducts');
  displayDiv.innerHTML = '';
  let totalCalculatedPrice = 0;

  const selectedOptions = selectElement.choices ? selectElement.choices.getValue(true) : Array.from(selectElement.selectedOptions).map(opt => opt.value);

  if (selectedOptions.length === 0) {
    displayDiv.innerHTML = '<p>Belum ada barang yang dipilih.</p>';
    document.getElementById('poPrice').value = '';
    return;
  }

  selectedOptions.forEach(productName => {
    const product = Object.values(data).flat().find(p => p.name === productName);
    if (product) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'selected-product-item';
      itemDiv.innerHTML = `
        <span>${product.name}</span>
        <input type="number" class="po-product-qty" data-product-name="${product.name}" value="1" min="1" oninput="updatePoProductQuantity(this)">
        <span>x Rp${formatRupiah(product.price)}</span>
        <button type="button" onclick="removePoProduct('${product.name}')">×</button>
      `;
      displayDiv.appendChild(itemDiv);
      totalCalculatedPrice += product.price * 1;
    }
  });
  document.getElementById('poPrice').value = formatRupiah(totalCalculatedPrice);
}

function updatePoProductQuantity(inputElement) {
  const productName = inputElement.dataset.productName;
  const newQty = parseInt(inputElement.value);
  if (isNaN(newQty) || newQty < 1) {
    inputElement.value = 1;
    return;
  }

  const product = Object.values(data).flat().find(p => p.name === productName);
  if (product && newQty > product.stock) {
    showNotification(`Stok untuk ${product.name} hanya ${product.stock}.`);
    inputElement.value = product.stock;
    return;
  }

  let total = 0;
  document.querySelectorAll('.selected-product-item').forEach(itemDiv => {
    const name = itemDiv.querySelector('.po-product-qty').dataset.productName;
    const qty = parseInt(itemDiv.querySelector('.po-product-qty').value);
    const prod = Object.values(data).flat().find(p => p.name === name);
    if (prod) {
      total += prod.price * qty;
    }
  });
  document.getElementById('poPrice').value = formatRupiah(total);
}

function removePoProduct(productName) {
  const selectElement = document.getElementById('poProductSelect');
  if (selectElement.choices) {
    selectElement.choices.removeItemsByValue(productName);
  }
  updateSelectedProductsDisplay();
}

function toggleTransferDetails() {
  const paymentMethod = document.getElementById('poPaymentMethod').value;
  const transferDetailsInput = document.getElementById('poTransferDetails');
  if (transferMethods.includes(paymentMethod)) {
    transferDetailsInput.style.display = 'block';
    transferDetailsInput.required = true;
  } else {
    transferDetailsInput.style.display = 'none';
    transferDetailsInput.required = false;
    transferDetailsInput.value = '';
  }
}
 
async function addPreOrder(event) {
  event.preventDefault();
  event.stopPropagation(); 
  const form = document.getElementById('addPreOrderForm');
  const customerName = document.getElementById('poCustomerName').value.trim();
  const selectedProductsRaw = document.getElementById('poProductSelect').choices.getValue();
  const paymentMethod = document.getElementById('poPaymentMethod').value;
  const transferDetails = document.getElementById('poTransferDetails').value.trim();
  const price = parseInt(document.getElementById('poPrice').value.replace(/\./g, ''));
  const address = document.getElementById('poAddress').value.trim();
  const contact = document.getElementById('poContact').value.trim();
  const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;

  if (!customerName || selectedProductsRaw.length === 0 || isNaN(price) || price <= 0 || !contact) {
    showNotification('Harap lengkapi semua data wajib!');
    return;
  }
  if (transferMethods.includes(paymentMethod) && !transferDetails) {
    showNotification('Detail pembayaran wajib diisi untuk metode transfer!');
    return;
  }

  const poItems = [];
  let totalCalculatedPrice = 0;
  for (const selectedOption of selectedProductsRaw) {
    const productName = selectedOption.value;
    const qtyInput = document.querySelector(`.po-product-qty[data-product-name="${productName}"]`);
    const qty = qtyInput ? parseInt(qtyInput.value) : 1;

    const product = Object.values(data).flat().find(p => p.name === productName);
    if (product) {
      if (qty > product.stock) {
        showNotification(`Stok untuk ${product.name} hanya ${product.stock}. PreOrder tidak dapat disimpan.`);
        return;
      }
      poItems.push({
        name: product.name,
        category: product.category,
        code: product.code,
        image: product.image,
        price: product.price,
        qty: qty
      });
      totalCalculatedPrice += product.price * qty;
    }
  }

  if (totalCalculatedPrice !== price) {
    if (!confirm(`Total harga yang dihitung (${formatRupiah(totalCalculatedPrice)}) berbeda dengan yang dimasukkan (${formatRupiah(price)}). Lanjutkan?`)) {
      return;
    }
  }

  const newPreOrder = {
    customerName,
    items: poItems,
    payment: {
      method: paymentMethod,
      details: transferMethods.includes(paymentMethod) ? transferDetails : ''
    },
    totalPrice: price,
    address,
    contact,
    deliveryMethod,
    status: 'Pending',
    orderDate: new Date().toLocaleString('id-ID')
  };

  preOrders.push(newPreOrder);

  try {
    await saveToIndexedDB(STORE_NAMES.PREORDERS, preOrders);
    showNotification('PreOrder berhasil ditambahkan!');
    form.reset();

    document.getElementById('poProductSelect').choices.clearStore();
    document.getElementById('selectedPoProducts').innerHTML = '<p>Belum ada barang yang dipilih.</p>';
    populateProductSelect();

    document.getElementById('poTransferDetails').style.display = 'none';
    renderPreOrderList();
    showPreOrderTab('listPreOrder');
  } catch (error) {
    console.error('Gagal menyimpan PreOrder:', error);
    showNotification('Gagal menyimpan PreOrder!');
  }
}

function renderPreOrderList() {
  const preOrderListDiv = document.getElementById('preOrderList');
  preOrderListDiv.innerHTML = '';

  if (preOrders.length === 0) {
    preOrderListDiv.innerHTML = '<div class="empty-state">Belum ada data PreOrder.</div>';
    return;
  }

  preOrders.forEach((po, index) => {
    const poCard = document.createElement('div');
    poCard.className = `preorder-card ${po.status === 'Completed' ? 'completed' : ''}`;
    poCard.innerHTML = `
      <div class="preorder-header">
        <h4>${po.customerName}</h4>
        <span class="preorder-status ${po.status.toLowerCase()}">${po.status}</span>
      </div>
      <div class="preorder-details">
        <p><strong>Tanggal Order:</strong> ${po.orderDate}</p>
        <p><strong>Barang:</strong></p>
        <ul>
          ${po.items.map(item => `<li>${item.qty}x ${item.name} (Rp${formatRupiah(item.price)})</li>`).join('')}
        </ul>
        <p><strong>Total Harga:</strong> Rp${formatRupiah(po.totalPrice)}</p>
        <p><strong>Pembayaran:</strong> ${po.payment.method} ${po.payment.details ? `(${po.payment.details})` : ''}</p>
        ${po.address ? `<p><strong>Alamat:</strong> ${po.address}</p>` : ''}
        <p><strong>Kontak:</strong> ${po.contact}</p>
        <p><strong>Pengambilan:</strong> ${po.deliveryMethod}</p>
      </div>
      <div class="preorder-actions">
        ${po.status === 'Pending' ? `<button class="btn-complete-po" onclick="completePreOrder(${index})">✅ Sudah Diambil</button>` : ''}
        <button class="btn-delete-po" onclick="deletePreOrder(${index})">🗑️ Hapus</button>
      </div>
    `;
    preOrderListDiv.appendChild(poCard);
  });
}

async function completePreOrder(index) {
  if (confirm('Konfirmasi bahwa PreOrder ini sudah diambil? Stok barang akan dikurangi.')) {
    const po = preOrders[index];

    let stockUpdateSuccess = true;
    for (const poItem of po.items) {
      const product = Object.values(data).flat().find(p => p.name === poItem.name && p.category === poItem.category);
      if (product) {
        if (product.stock >= poItem.qty) {
          product.stock -= poItem.qty;
        } else {
          showNotification(`Stok ${product.name} tidak cukup (${product.stock} tersedia, ${poItem.qty} dibutuhkan). PreOrder tidak dapat diselesaikan.`);
          stockUpdateSuccess = false;
          break;
        }
      } else {
        showNotification(`Produk "${poItem.name}" tidak ditemukan dalam inventaris. PreOrder tidak dapat diselesaikan.`);
        stockUpdateSuccess = false;
        break;
      }
    }

    if (stockUpdateSuccess) {
      po.status = 'Completed';
      po.completionDate = new Date().toLocaleString('id-ID');

      sales.push({
        time: po.completionDate,
        items: JSON.parse(JSON.stringify(po.items)),
        total: po.totalPrice,
        amountPaid: po.totalPrice,
        change: 0,
        paymentType: po.payment.method,
        isPreOrder: true,
        preOrderId: po.id
      });

      await Promise.all([
        saveToIndexedDB(STORE_NAMES.PREORDERS, preOrders),
        saveToIndexedDB(STORE_NAMES.PRODUCTS, data),
        saveToIndexedDB(STORE_NAMES.SALES, sales)
      ]);

      showNotification('PreOrder berhasil diselesaikan dan stok diperbarui!');
      renderPreOrderList();
      renderProducts();
      if (document.getElementById('salesData').style.display === 'block') {
        renderSalesTable();
      }
      renderTopProducts();
    }
  }
}

async function deletePreOrder(index) {
  if (confirm('Apakah Anda yakin ingin menghapus PreOrder ini?')) {
    preOrders.splice(index, 1);
    await saveToIndexedDB(STORE_NAMES.PREORDERS, preOrders);
    showNotification('PreOrder berhasil dihapus!');
    renderPreOrderList();
  }
}

function openPaymentMethodModal() {
  document.getElementById('paymentMethodModal').style.display = 'flex';
  document.body.classList.add('modal-open');
  renderPaymentMethodList();
}

function closePaymentMethodModal() {
  document.getElementById('paymentMethodModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

function renderPaymentMethodList() {
  const paymentMethodListDiv = document.getElementById('paymentMethodList');
  paymentMethodListDiv.innerHTML = '';

  if (transferMethods.length === 0) {
    paymentMethodListDiv.innerHTML = '<div class="empty-state">Belum ada metode transfer.</div>';
    return;
  }

  transferMethods.forEach((method, index) => {
    const item = document.createElement('div');
    item.className = 'payment-method-item';
    item.setAttribute('data-method-name', method);

    item.innerHTML = `
      <span id="methodName-${index}">${method}</span>
      <div class="payment-method-actions">
        <button class="btn-edit-method" onclick="editPaymentMethodName('${method}', ${index})">✏️ Edit</button>
        <button class="btn-delete-method" onclick="deletePaymentMethod('${method}', ${index})">🗑️ Hapus</button>
      </div>
    `;
    paymentMethodListDiv.appendChild(item);
  });
}

async function addNewPaymentMethod(event) {
  event.preventDefault();
  const input = document.getElementById('newPaymentMethodName');
  const newMethodName = input.value.trim();

  if (!newMethodName) {
    showNotification('Nama metode pembayaran tidak boleh kosong!');
    return;
  }
  if (transferMethods.includes(newMethodName)) {
    showNotification('Metode pembayaran dengan nama tersebut sudah ada!');
    return;
  }

  transferMethods.push(newMethodName);
  transferMethods.sort((a, b) => a.localeCompare(b));

  try {
    await saveToIndexedDB(STORE_NAMES.TRANSFER_METHODS, transferMethods.map(name => ({ name })));
    renderPaymentMethodList();
    showNotification('Metode pembayaran berhasil ditambahkan!');
    input.value = '';
    populateProductSelect();
    renderDynamicTransferMethods();
  } catch (error) {
    console.error('Gagal menambahkan metode pembayaran:', error);
    showNotification('Gagal menambahkan metode pembayaran!');
  }
}

function editPaymentMethodName(oldMethodName, index) {
  const methodItem = document.querySelector(`.payment-method-item[data-method-name="${oldMethodName}"]`);
  if (!methodItem) return;

  const methodNameSpan = methodItem.querySelector(`#methodName-${index}`);
  const methodActionsDiv = methodItem.querySelector('.payment-method-actions');

  const originalName = methodNameSpan.textContent;

  methodNameSpan.innerHTML = `
    <input type="text" id="editMethodInput-${index}" value="${originalName}" />
  `;

  methodActionsDiv.innerHTML = `
    <button class="btn-save-method" onclick="savePaymentMethodName('${oldMethodName}', ${index})">💾 Simpan</button>
    <button class="btn-cancel-edit" onclick="cancelEditPaymentMethodName('${oldMethodName}', ${index}, '${originalName}')">✖️ Batal</button>
  `;

  document.getElementById(`editMethodInput-${index}`).focus();
}

async function savePaymentMethodName(oldMethodName, index) {
  const newMethodInput = document.getElementById(`editMethodInput-${index}`);
  const newMethodName = newMethodInput.value.trim();

  if (!newMethodName) {
    showNotification('Nama metode pembayaran tidak boleh kosong!');
    return;
  }
  if (newMethodName === oldMethodName) {
    cancelEditPaymentMethodName(oldMethodName, index, oldMethodName);
    return;
  }
  if (transferMethods.includes(newMethodName)) {
    showNotification('Metode pembayaran dengan nama tersebut sudah ada!');
    return;
  }

  if (!confirm(`Ubah nama metode pembayaran dari "${oldMethodName}" menjadi "${newMethodName}"?`)) {
    cancelEditPaymentMethodName(oldMethodName, index, oldMethodName);
    return;
  }

  try {
    transferMethods[index] = newMethodName;
    transferMethods.sort((a, b) => a.localeCompare(b));

    await saveToIndexedDB(STORE_NAMES.TRANSFER_METHODS, transferMethods.map(name => ({ name })));
    renderPaymentMethodList();
    showNotification('Metode pembayaran berhasil diubah!');
    populateProductSelect();
    renderDynamicTransferMethods();
  } catch (error) {
    console.error('Gagal menyimpan perubahan metode pembayaran:', error);
    showNotification('Gagal menyimpan perubahan metode pembayaran!');
  }
}

function cancelEditPaymentMethodName(oldMethodName, index, originalDisplayName) {
  const methodItem = document.querySelector(`.payment-method-item[data-method-name="${oldMethodName}"]`);
  if (!methodItem) return;

  const methodNameSpan = methodItem.querySelector(`#methodName-${index}`);
  const methodActionsDiv = methodItem.querySelector('.payment-method-actions');

  methodNameSpan.textContent = originalDisplayName;

  methodActionsDiv.innerHTML = `
    <button class="btn-edit-method" onclick="editPaymentMethodName('${oldMethodName}', ${index})">✏️ Edit</button>
    <button class="btn-delete-method" onclick="deletePaymentMethod('${oldMethodName}', ${index})">🗑️ Hapus</button>
  `;
}

async function deletePaymentMethod(methodName, index) {
  if (!confirm(`Apakah Anda yakin ingin menghapus metode pembayaran "${methodName}"?`)) {
    return;
  }

  try {
    transferMethods.splice(index, 1);
    await saveToIndexedDB(STORE_NAMES.TRANSFER_METHODS, transferMethods.map(name => ({ name })));
    renderPaymentMethodList();
    showNotification('Metode pembayaran berhasil dihapus!');
    populateProductSelect();
    renderDynamicTransferMethods();
  } catch (error) {
    console.error('Gagal menghapus metode pembayaran:', error);
    showNotification('Gagal menghapus metode pembayaran!');
  }
}

function closeAllModals() {
  const modalsToClose = [
    document.getElementById('sidebar'),
    document.getElementById('cartModal'),
    document.getElementById('welcomeModal'),
    document.getElementById('editModal'),
    document.getElementById('categoryModal'),
    document.getElementById('dashboardModal'),
    document.getElementById('checkoutModal'),
    document.getElementById('preOrderModal'),
    document.getElementById('checkoutConfirmationModal'),
    document.getElementById('paymentMethodModal')
  ];

  modalsToClose.forEach(modal => {
    if (modal) {
      if (modal.classList.contains('sidebar')) {
        closeSidebar();
      } else if (modal.classList.contains('open') || modal.style.display === 'flex') {
        if (modal.id === 'cartModal') closeCartModal();
        else if (modal.id === 'welcomeModal') closeWelcomeModal();
        else if (modal.id === 'editModal') closeEditModal();
        else if (modal.id === 'categoryModal') closeCategoryModal();
        else if (modal.id === 'dashboardModal') closeDashboard();
        else if (modal.id === 'checkoutModal') closeCheckoutModal();
        else if (modal.id === 'preOrderModal') closePreOrderModal();
        else if (modal.id === 'checkoutConfirmationModal') closeCheckoutConfirmationModal();
        else if (modal.id === 'paymentMethodModal') closePaymentMethodModal();
      }
    }
  });
}

function setupModalCloseOnOutsideClick() {
  const modals = [
    document.getElementById('sidebar'),
    document.getElementById('cartModal'),
    document.getElementById('welcomeModal'),
    document.getElementById('editModal'),
    document.getElementById('categoryModal'),
    document.getElementById('dashboardModal'),
    document.getElementById('checkoutModal'),
    document.getElementById('preOrderModal'),
    document.getElementById('checkoutConfirmationModal'),
    document.getElementById('paymentMethodModal')
  ].filter(Boolean);

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
        event.target.closest('[onclick*="showHelp"]') ||
        event.target.closest('[onclick*="showPreOrder"]') ||
        event.target.closest('.btn-checkout-cart') ||
        event.target.closest('.btn-manage-payment');

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
        } else if (element.id === 'preOrderModal') {
          closePreOrderModal();
        } else if (element.id === 'checkoutConfirmationModal') {
          closeCheckoutConfirmationModal();
        } else if (element.id === 'paymentMethodModal') {
          closePaymentMethodModal();
        }
      }
    });
  });
}

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

document.addEventListener('DOMContentLoaded', function() {
  loadFromDatabase().then(() => {
    adjustContentMargin();

    document.getElementById('cartButton').addEventListener('click', toggleCartModal);

    document.getElementById('clearSearchButton').addEventListener('click', function() {
      document.getElementById('searchInput').value = '';
      this.style.display = 'none';
      filterProducts('');
      const savedTab = localStorage.getItem('activeTab');
      if (savedTab && document.getElementById(savedTab)) {
        showTab(savedTab);
      } else if (categories.length > 0) {
        showTab(categories[0]);
      }
    });

    document.getElementById('searchInput').addEventListener('input', function() {
      filterProducts(this.value);
    });

    document.getElementById('fullscreenButton').addEventListener('click', toggleFullscreen);

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

    checkWelcomeMessage();
    setupModalCloseOnOutsideClick();
  }).catch(error => {
    console.error("Error dalam inisialisasi DOMContentLoaded:", error);
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeAllModals();
    }
  });
});
