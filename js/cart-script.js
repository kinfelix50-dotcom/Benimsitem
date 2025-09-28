// Global değişkenler
let sepet;
let tempAddressData = null; // Geçici adres verisi

// HTML özel karakterlerini kaçış karakterlerine dönüştür
function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// LocalStorage'dan JSON verisini güvenli bir şekilde al
function safeParseJSON(key, defaultValue) {
  try {
    const data = localStorage.getItem(key);
    if (data === null || data === undefined) {
      return defaultValue;
    }
    const parsedData = JSON.parse(data);
    if (parsedData === null || parsedData === undefined) {
      return defaultValue;
    }
    return parsedData;
  } catch (e) {
    console.error(`${key} anahtarından veri ayrıştırılırken hata oluştu:`, e);
    return defaultValue;
  }
}

// İndirimli fiyatı hesapla
function calculateDiscountedPrice(originalPrice, discountPercentage) {
  if (discountPercentage > 0 && discountPercentage <= 100) {
    return originalPrice * (1 - discountPercentage / 100);
  }
  return originalPrice;
}

// Brüt fiyatı hesapla (indirimli fiyat ve indirim yüzdesine göre)
function calculateOriginalPrice(discountedPrice, discountPercentage) {
  if (discountPercentage > 0 && discountPercentage <= 100) {
    return discountedPrice / (1 - discountPercentage / 100);
  }
  return discountedPrice;
}

// Sepet sınıfı tanımı
class Sepet {
  constructor() {
    this.sepet = safeParseJSON('sepet', []); // Varsayılan boş dizi
    this.render();
    this.updateNavBar();
  }

  // Sepeti localStorage'a kaydet
  kaydet() {
    localStorage.setItem('sepet', JSON.stringify(this.sepet));
  }

  // Ürün ekle
  ekle(urun) {
    const urunlerLocal = safeParseJSON('urunler', []); // Varsayılan boş dizi
    const guncelUrunBilgisi = urunlerLocal.find(item => item.id === urun.id);
    if (!guncelUrunBilgisi) {
      bildirimiGoster('Ürün bilgisi bulunamadı!', 'danger');
      return;
    }

    const mevcut = this.sepet.find(item => item.id === urun.id);
    const mevcutSepetAdedi = mevcut ? mevcut.adet : 0;
    const eklenecekAdet = urun.adet || 1;

    // Ürünün mevcut stok durumunu kontrol et (eklenecek adet kalan stoktan fazla mı?)
    if (eklenecekAdet > guncelUrunBilgisi.stok) {
      bildirimiGoster(`Stok yetersiz! Maksimum eklenebilir adet: ${guncelUrunBilgisi.stok} adet`, 'warning');
      return;
    }

    if (mevcut) {
      mevcut.adet += eklenecekAdet;
      mevcut.fiyat = calculateDiscountedPrice(guncelUrunBilgisi.fiyat, guncelUrunBilgisi.indirim);
      mevcut.indirim = guncelUrunBilgisi.indirim || 0;
    } else {
      this.sepet.push({
        ...urun,
        fiyat: calculateDiscountedPrice(guncelUrunBilgisi.fiyat, guncelUrunBilgisi.indirim),
        stok: guncelUrunBilgisi.stok,
        indirim: guncelUrunBilgisi.indirim || 0
      });
    }

    // Genel ürün listesindeki stoktan düş
    guncelUrunBilgisi.stok -= eklenecekAdet;
    localStorage.setItem('urunler', JSON.stringify(urunlerLocal));
    this.kaydet();
    this.render();
    this.updateNavBar();
    bildirimiGoster('Ürün sepete eklendi!', 'success');
  }

  // Ürün çıkar
  urunCikar(urunId, adet) {
    const mevcut = this.sepet.find(item => item.id === urunId);
    if (!mevcut) return;

    const urunler = safeParseJSON('urunler', []);
    const guncelUrun = urunler.find(item => item.id === urunId);

    mevcut.adet -= adet;
    if (guncelUrun) {
      guncelUrun.stok += adet; // Genel ürün listesindeki stoku geri ekle
      localStorage.setItem('urunler', JSON.stringify(urunler));
    }

    if (mevcut.adet <= 0) {
      this.sepet = this.sepet.filter(item => item.id !== urunId);
    }

    this.kaydet();
    this.render();
    this.updateNavBar();
  }

  // Sepeti temizle
  sepetiTemizle(askConfirmation = true) {
    if (askConfirmation && !confirm('Sepeti tamamen boşaltmak istediğinize emin misiniz?')) return;

    const urunler = safeParseJSON('urunler', []);
    this.sepet.forEach(item => {
      const guncelUrun = urunler.find(u => u.id === item.id);
      if (guncelUrun) guncelUrun.stok += item.adet;
    });

    this.sepet = [];
    localStorage.setItem('urunler', JSON.stringify(urunler));
    this.kaydet();
    this.render();
    this.updateNavBar();
    bildirimiGoster('Sepetiniz temizlendi!', 'info');
  }

  // Sipariş tamamlandığında sepeti temizle
  clearCartForOrder() {
    this.sepet = [];
    this.kaydet();
    this.render();
    this.updateNavBar();
  }

  // Sepeti ekrana render et
  render() {
    const cartItemsDiv = document.getElementById('cartItems');
    const totalPriceSpan = document.getElementById('totalPrice');
    const totalOriginalPriceSpan = document.getElementById('totalOriginalPrice');
    const totalDiscountSpan = document.getElementById('totalDiscount');

    if (!cartItemsDiv || !totalPriceSpan || !totalOriginalPriceSpan || !totalDiscountSpan) return;

    cartItemsDiv.innerHTML = '';
    let total = 0;
    let totalOriginal = 0;
    let totalDiscountAmount = 0;

    if (this.sepet.length === 0) {
      cartItemsDiv.innerHTML = '<p class="text-muted text-center p-3 border rounded bg-white">Sepetinizde ürün bulunmamaktadır.</p>';
      totalPriceSpan.textContent = '0.00';
      totalOriginalPriceSpan.textContent = '0.00';
      totalDiscountSpan.textContent = '0.00';
      return;
    }

    const sortedCart = [...this.sepet].sort((a, b) => {
      const aHasDiscount = a.indirim && a.indirim > 0;
      const bHasDiscount = b.indirim && b.indirim > 0;
      if (aHasDiscount && !bHasDiscount) return -1;
      if (!aHasDiscount && bHasDiscount) return 1;
      return a.fiyat - b.fiyat;
    });

    sortedCart.forEach(item => {
      const urunlerLocal = safeParseJSON('urunler', []);
      const guncelUrunBilgisi = urunlerLocal.find(u => u.id === item.id);
      const currentMaxAvailableStock = (guncelUrunBilgisi ? guncelUrunBilgisi.stok : 0) + item.adet;

      const originalPricePerItem = calculateOriginalPrice(item.fiyat, item.indirim);
      const itemTotal = item.fiyat * item.adet;
      const itemOriginalTotal = originalPricePerItem * item.adet;
      const itemDiscountAmount = itemOriginalTotal - itemTotal;

      total += itemTotal;
      totalOriginal += itemOriginalTotal;
      totalDiscountAmount += itemDiscountAmount;

      const originalPriceClass = (item.indirim && item.indirim > 0) ? 'text-muted text-decoration-line-through' : 'text-dark';

      const div = document.createElement('div');
      div.className = 'cart-item d-flex align-items-center mb-3 p-3 border rounded shadow-sm bg-white';
      div.innerHTML = `
        <img src="${escapeHTML(item.resim)}" class="cart-item-img me-3" alt="${escapeHTML(item.ad)}" onerror="this.src='https://via.placeholder.com/60/ccc/fff?text=No+Img'">
        <div class="d-flex flex-column flex-grow-1 me-3">
            <h6 class="mb-1 fw-bold text-black">${escapeHTML(item.ad)}</h6>
            <div class="price-details d-flex flex-column mb-2">
                <span class="${originalPriceClass} small fw-bold">Brüt: ${originalPricePerItem.toFixed(2)} TL</span>
                ${item.indirim > 0 ? `<span class="text-success small fw-bold">İndirim: %${item.indirim}</span>` : ''}
                <span class="text-primary small fw-bold">Net: ${item.fiyat.toFixed(2)} TL</span>
            </div>
            <div class="input-group input-group-sm quantity-control mt-2" data-id="${escapeHTML(item.id)}">
                <button class="btn btn-outline-secondary azalt" type="button" data-id="${escapeHTML(item.id)}">-</button>
                <input type="number" class="form-control text-center quantity-input" value="${item.adet}" min="1" max="${currentMaxAvailableStock}" data-id="${escapeHTML(item.id)}">
                <button class="btn btn-outline-secondary artir" type="button" data-id="${escapeHTML(item.id)}">+</button>
            </div>
        </div>
        <div class="ms-auto d-flex flex-column align-items-end">
            <p class="mb-2 fw-bold text-nowrap">${itemTotal.toFixed(2)} TL</p>
            <button class="btn btn-danger btn-sm remove-item" data-id="${escapeHTML(item.id)}" title="Ürünü Kaldır" aria-label="Ürünü Kaldır">
                <i class="bi bi-trash"></i>
            </button>
        </div>
      `;
      cartItemsDiv.appendChild(div);
    });

    totalPriceSpan.textContent = total.toFixed(2);
    totalOriginalPriceSpan.textContent = totalOriginal.toFixed(2);
    totalDiscountSpan.textContent = totalDiscountAmount.toFixed(2);

    this.addEventListeners();
  }

  // Event Listener'ları ayırma
  addEventListeners() {
    const cartItemsDiv = document.getElementById('cartItems');

    // Azalt butonu için
    cartItemsDiv.querySelectorAll('.azalt').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const input = cartItemsDiv.querySelector(`.quantity-input[data-id="${id}"]`);
        let value = parseInt(input.value);
        if (value > 1) {
          this.urunCikar(id, 1);
        } else if (value === 1) {
          const item = this.sepet.find(i => i.id === id);
          if (item && confirm(`${escapeHTML(item.ad)} ürününü sepetten kaldırmak istediğinize emin misiniz?`)) {
            this.urunCikar(id, item.adet);
            bildirimiGoster(`${escapeHTML(item.ad)} sepetten kaldırıldı.`, 'danger');
          }
        }
      });
    });

    // Artır butonu için
    cartItemsDiv.querySelectorAll('.artir').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const input = cartItemsDiv.querySelector(`.quantity-input[data-id="${id}"]`);
        const mevcutUrun = this.sepet.find(item => item.id === id);
        if (!mevcutUrun) {
          bildirimiGoster('Ürün sepetten çıkarıldı veya bulunamadı!', 'danger');
          return;
        }

        // Güncel stok bilgisini al
        const urunlerLocal = safeParseJSON('urunler', []);
        const guncelUrunBilgisi = urunlerLocal.find(item => item.id === id);
        if (!guncelUrunBilgisi) {
          bildirimiGoster('Ürün bilgisi bulunamadı!', 'danger');
          return;
        }

        // Toplam kullanılabilir stok: mevcut stok + sepetteki adet
        const maxStok = guncelUrunBilgisi.stok + mevcutUrun.adet;
        const mevcutAdet = parseInt(input.value);

        if (mevcutAdet < maxStok) {
          this.ekle({ id: id, adet: 1 });
        } else {
          bildirimiGoster(`Bu ürünün maksimum stok adedi ${maxStok}!`, 'warning');
        }
      });
    });

    // Sil butonu için
    cartItemsDiv.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = this.sepet.find(i => i.id === id);
        if (item && confirm(`${escapeHTML(item.ad)} ürününü sepetten kaldırmak istediğinize emin misiniz?`)) {
          this.urunCikar(id, item.adet);
          bildirimiGoster(`${escapeHTML(item.ad)} sepetten kaldırıldı.`, 'danger');
        }
      });
    });

    // Input alanı için (manuel adet girişi)
    cartItemsDiv.querySelectorAll('.quantity-input').forEach(input => {
      input.addEventListener('change', (e) => {
        this.handleQuantityInput(e.target);
      });
      input.addEventListener('input', (e) => {
        if (e.target.value === '') {
          // Boş girişte herhangi bir işlem yapmadan bekle
        }
      });
    });
  }

  // Manuel input ile adet güncelleme fonksiyonu
  handleQuantityInput(inputElement) {
    const id = inputElement.dataset.id;
    let newAdet = inputElement.value.trim();
    const maxStok = parseInt(inputElement.max);

    // Geçersiz veya boş giriş kontrolü
    if (newAdet === '' || isNaN(newAdet) || parseInt(newAdet) < 1) {
      newAdet = 1;
      inputElement.value = newAdet;
      bildirimiGoster('Adet en az 1 olmalıdır!', 'warning');
    } else {
      newAdet = parseInt(newAdet);
    }

    // Maksimum stok kontrolü
    if (newAdet > maxStok) {
      bildirimiGoster(`Maksimum stok adedi: ${maxStok}!`, 'warning');
      newAdet = maxStok;
      inputElement.value = newAdet;
    }

    const mevcutUrun = this.sepet.find(item => item.id === id);
    if (!mevcutUrun) {
      bildirimiGoster('Ürün sepetten çıkarıldı veya bulunamadı!', 'danger');
      return;
    }

    const eskiAdet = mevcutUrun.adet;
    const adetFarki = newAdet - eskiAdet;

    // Stok güncellemesi
    const urunlerLocal = safeParseJSON('urunler', []);
    const guncelUrunBilgisi = urunlerLocal.find(item => item.id === id);
    if (guncelUrunBilgisi) {
      guncelUrunBilgisi.stok -= adetFarki;
      localStorage.setItem('urunler', JSON.stringify(urunlerLocal));
    }

    mevcutUrun.adet = newAdet;
    if (mevcutUrun.adet <= 0) {
      this.sepet = this.sepet.filter(item => item.id !== id);
      bildirimiGoster(`${escapeHTML(mevcutUrun.ad)} sepetten kaldırıldı.`, 'danger');
    } else {
      bildirimiGoster('Adet güncellendi!', 'success');
    }

    this.kaydet();
    this.render();
    this.updateNavBar();
  }

  // Navbar'ı güncelle
  updateNavBar() {
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
      cartBadge.textContent = this.sepet.reduce((sum, item) => sum + item.adet, 0);
    }
  }
}

// Bildirim gösterme fonksiyonu
function bildirimiGoster(mesaj, tur = 'success') {
  const bildirimDiv = document.getElementById('sepetBildirim');
  if (!bildirimDiv) return;

  bildirimDiv.className = 'alert text-center py-2 fixed-top w-100 d-none';
  bildirimDiv.textContent = mesaj;
  bildirimDiv.classList.add(`alert-${tur}`, 'animate__animated', 'animate__fadeInDown');
  bildirimDiv.classList.remove('d-none');

  setTimeout(() => {
    bildirimDiv.classList.add('animate__fadeOutUp');
    setTimeout(() => {
      bildirimDiv.classList.add('d-none');
      bildirimDiv.classList.remove('animate__fadeOutUp', 'animate__fadeInDown', `alert-${tur}`, 'animate__animated');
    }, 500);
  }, 2000);
}

// Kayıtlı adresleri yükle
function loadSavedAddresses() {
  const savedAddressesDiv = document.getElementById('savedAddresses');
  if (!savedAddressesDiv) return;

  const currentUser = safeParseJSON('currentUser', {});
  const users = safeParseJSON('users', []);
  const userFromUsers = users.find(u => u.email === currentUser.email);
  const addresses = userFromUsers ? (userFromUsers.addresses || []) : [];

  savedAddressesDiv.innerHTML = '';
  if (addresses.length === 0) {
    savedAddressesDiv.innerHTML = '<p class="text-muted small text-center mb-0">Kayıtlı adres bulunamadı. Lütfen yeni adres girin.</p>';
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'list-group list-group-flush';
  addresses.forEach((address, index) => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.innerHTML = `
      <div>
        <h6 class="mb-1">${escapeHTML(address.fullName)}</h6>
        <p class="mb-1 text-muted small">${escapeHTML(address.address)}</p>
        <p class="mb-0 text-muted small">${escapeHTML(address.phoneNumber)}</p>
      </div>
      <button type="button" class="btn btn-sm btn-outline-success use-address-btn" data-index="${index}" title="Bu adresi kullan">
        <i class="bi bi-check-circle"></i>
      </button>
    `;
    ul.appendChild(li);
  });
  savedAddressesDiv.appendChild(ul);

  savedAddressesDiv.querySelectorAll('.use-address-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.dataset.index);
      const selectedAddress = addresses[index];
      if (confirm(`Bu adresi kullanmak istediğinize emin misiniz?\nAd Soyad: ${escapeHTML(selectedAddress.fullName)}\nAdres: ${escapeHTML(selectedAddress.address)}\nTelefon: ${escapeHTML(selectedAddress.phoneNumber)}`)) {
        tempAddressData = {
          fullName: selectedAddress.fullName,
          address: selectedAddress.address,
          phoneNumber: selectedAddress.phoneNumber,
          saveAddress: true
        };
        const addressModalInstance = bootstrap.Modal.getInstance(document.getElementById('addressModal'));
        if (addressModalInstance) {
          addressModalInstance.hide();
        }
        showConfirmOrderModal();
      }
    });
  });
}

// Sipariş onay modalını göster
function showConfirmOrderModal() {
  if (!tempAddressData) {
    bildirimiGoster('Adres bilgileri eksik veya boş, lütfen önce adres girin.', 'warning');
    const addressModalInstance = bootstrap.Modal.getInstance(document.getElementById('addressModal'));
    if (addressModalInstance) {
      addressModalInstance.show();
    } else {
      new bootstrap.Modal(document.getElementById('addressModal')).show();
    }
    return;
  }

  document.getElementById('confirmFullName').textContent = escapeHTML(tempAddressData.fullName);
  document.getElementById('confirmAddress').textContent = escapeHTML(tempAddressData.address);
  document.getElementById('confirmPhone').textContent = escapeHTML(tempAddressData.phoneNumber);

  const confirmOrderItemsDiv = document.getElementById('confirmOrderItems');
  let orderSummaryHtml = '';
  let confirmTotal = 0;
  let confirmTotalOriginal = 0;
  let confirmTotalDiscountAmount = 0;

  const sortedConfirmItems = [...sepet.sepet].sort((a, b) => {
    const aHasDiscount = a.indirim && a.indirim > 0;
    const bHasDiscount = b.indirim && b.indirim > 0;
    if (aHasDiscount && !bHasDiscount) return -1;
    if (!aHasDiscount && bHasDiscount) return 1;
    return a.fiyat - b.fiyat;
  });

  sortedConfirmItems.forEach(item => {
    const originalPrice = calculateOriginalPrice(item.fiyat, item.indirim);
    const itemTotal = item.fiyat * item.adet;
    const itemOriginalTotal = originalPrice * item.adet;
    const itemDiscountAmount = itemOriginalTotal - itemTotal;

    confirmTotal += itemTotal;
    confirmTotalOriginal += itemOriginalTotal;
    confirmTotalDiscountAmount += itemDiscountAmount;

    const confirmOriginalPriceClass = (item.indirim && item.indirim > 0) ? 'text-muted text-decoration-line-through' : '';

    orderSummaryHtml += `
      <div class="d-flex justify-content-between align-items-center py-1">
          <span class="small">${escapeHTML(item.ad)} (x${item.adet})</span>
          <div class="price-details text-end">
              <p class="mb-0 small fw-bold ${confirmOriginalPriceClass}">Brüt: ${itemOriginalTotal.toFixed(2)} TL</p>
              ${item.indirim > 0 ? `<p class="mb-0 small">İndirim: -%${item.indirim}</p>` : ''}
              <p class="mb-0 small fw-bold">Net: ${item.fiyat.toFixed(2)} TL</p>
          </div>
      </div>
    `;
  });
  confirmOrderItemsDiv.innerHTML = orderSummaryHtml;
  document.getElementById('confirmTotalOriginalPrice').textContent = confirmTotalOriginal.toFixed(2);
  document.getElementById('confirmTotalDiscount').textContent = confirmTotalDiscountAmount.toFixed(2);
  document.getElementById('confirmTotalPrice').textContent = confirmTotal.toFixed(2);

  const confirmModal = new bootstrap.Modal(document.getElementById('confirmOrderModal'));
  confirmModal.show();
}

// Siparişi tamamla
function submitOrder(addressData) {
  const currentUser = safeParseJSON('currentUser', {});
  if (!currentUser.email) {
    bildirimiGoster('Sipariş vermek için giriş yapmalısınız!', 'danger');
    setTimeout(() => window.location.href = 'login.html', 1500);
    return;
  }

  if (sepet.sepet.length === 0) {
    bildirimiGoster('Sepetiniz boş!', 'warning');
    return;
  }

  if (!addressData || !addressData.fullName || !addressData.address || !addressData.phoneNumber) {
    bildirimiGoster('Sipariş için adres bilgileri eksik!', 'danger');
    return;
  }

  const order = {
    id: 'ORD-' + Date.now(),
    userEmail: currentUser.email,
    date: new Date().toISOString(),
    items: sepet.sepet.map(item => ({
      id: item.id,
      ad: item.ad,
      fiyat: item.fiyat,
      adet: item.adet,
      resim: item.resim,
      indirim: item.indirim || 0
    })),
    total: sepet.sepet.reduce((sum, item) => sum + item.fiyat * item.adet, 0),
    status: 'pending',
    fullName: addressData.fullName,
    address: addressData.address,
    phone: addressData.phoneNumber
  };

  const orders = safeParseJSON('orders', []);
  orders.push(order);
  localStorage.setItem('orders', JSON.stringify(orders));

  if (addressData.saveAddress) {
    adresiProfiliKaydet(addressData.fullName, addressData.address, addressData.phoneNumber);
  }

  sepet.clearCartForOrder();
  tempAddressData = null;
  bildirimiGoster('Siparişiniz başarıyla alındı!', 'success');
  setTimeout(() => window.location.href = 'index.html', 2000);
}

// Adresi profile kaydet
function adresiProfiliKaydet(fullName, address, phone) {
  const currentUser = safeParseJSON('currentUser', {});
  let users = safeParseJSON('users', []);
  const userIndex = users.findIndex(u => u.email === currentUser.email);

  if (userIndex === -1) {
    console.error('Kullanıcı bulunamadı veya giriş yapılmamış.');
    return;
  }

  if (!users[userIndex].addresses) {
    users[userIndex].addresses = [];
  }

  const addressData = {
    fullName: fullName,
    address: address,
    phoneNumber: phone
  };

  const addressExists = users[userIndex].addresses.some(
    addr => addr.fullName === fullName && addr.address === address && addr.phoneNumber === phone
  );

  if (!addressExists) {
    users[userIndex].addresses.push(addressData);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
    bildirimiGoster('Adresiniz profilinize kaydedildi.', 'info');
  }
}

// Çıkış yap fonksiyonu
function cikisYap() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('currentUser');
  bildirimiGoster('Çıkış yapıldı.', 'info');
  setTimeout(() => window.location.href = 'index.html', 1500);
}

// DOM yüklendiğinde çalışacak kod
document.addEventListener('DOMContentLoaded', () => {
  sepet = new Sepet();
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const navbarButtons = document.getElementById('navbarButtons');
  const currentUser = safeParseJSON('currentUser', {});

  if (navbarButtons) {
    if (isLoggedIn === 'true' && currentUser && currentUser.email) {
      navbarButtons.innerHTML = `
        <a href="index.html" class="btn btn-light btn-sm btn-icon-only" title="Geri Dön" aria-label="Geri Dön">
          <i class="bi bi-arrow-left"></i>
        </a>                
        
        <a href="index.html" class="btn btn-light btn-sm btn-icon-only" title="Profil" aria-label="Profil">
          <i class="bi bi-person"></i>
        </a>
        <a href="index.html" class="btn btn-light position-relative btn-icon-only" title="Sepet" aria-label="Sepet">
          <i class="bi bi-cart3"></i>
          <span id="cartBadge" class="cart-badge badge bg-danger rounded-pill" aria-label="Sepet ürün sayısı">${sepet.sepet.reduce((sum, item) => sum + item.adet, 0)}</span>
        </a>
      `;
    } else {
      navbarButtons.innerHTML = `
        <a href="index.html" class="btn btn-outline-light btn-icon-only" title="Geri Dön" aria-label="Geri Dön">
          <i class="bi bi-arrow-left"></i>
        </a>
        <a href="kayit.html" class="btn btn-outline-light btn-icon-only" title="Kayıt Ol" aria-label="Kayıt Ol">
          <i class="bi bi-person-plus"></i>
        </a>
        <a href="login.html" class="btn btn-outline-light btn-icon-only" title="Giriş Yap" aria-label="Giriş Yap">
          <i class="bi bi-box-arrow-in-right"></i>
        </a>
        <a href="index.html" class="btn btn-light position-relative btn-icon-only" title="Sepet" aria-label="Sepet">
          <i class="bi bi-cart3"></i>
          <span id="cartBadge" class="cart-badge badge bg-danger rounded-pill" aria-label="Sepet ürün sayısı">${sepet.sepet.reduce((sum, item) => sum + item.adet, 0)}</span>
        </a>
      `;
    }
  }

  const clearCartBtn = document.getElementById('clearCartBtn');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => sepet.sepetiTemizle(true));
  }

  const submitOrderBtn = document.getElementById('submitOrderBtn');
  const addressModalElement = document.getElementById('addressModal');
  if (submitOrderBtn && addressModalElement) {
    const addressModalInstance = new bootstrap.Modal(addressModalElement);
    submitOrderBtn.addEventListener('click', () => {
      if (isLoggedIn !== 'true') {
        bildirimiGoster('Sipariş vermek için giriş yapmalısınız!', 'danger');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
      }
      if (sepet.sepet.length === 0) {
        bildirimiGoster('Sepetiniz boş!', 'warning');
        return;
      }
      addressModalInstance.show();
    });
  }

  const addressForm = document.getElementById('addressForm');
  if (addressForm) {
    addressForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addressForm.classList.add('was-validated');

      const fullNameInput = addressForm.querySelector('#fullName');
      const addressInput = addressForm.querySelector('#address');
      const phoneInput = addressForm.querySelector('#phone');
      const saveAddressCheckbox = addressForm.querySelector('#saveAddress');

      let isValid = true;
      if (!fullNameInput.value.trim()) { isValid = false; fullNameInput.classList.add('is-invalid'); } else { fullNameInput.classList.remove('is-invalid'); }
      if (!addressInput.value.trim()) { isValid = false; addressInput.classList.add('is-invalid'); } else { addressInput.classList.remove('is-invalid'); }
      if (!phoneInput.value.trim() || !/^\d{10}$/.test(phoneInput.value.trim())) { isValid = false; phoneInput.classList.add('is-invalid'); } else { phoneInput.classList.remove('is-invalid'); }

      if (!isValid) return;

      tempAddressData = {
        fullName: fullNameInput.value.trim(),
        address: addressInput.value.trim(),
        phoneNumber: phoneInput.value.trim(),
        saveAddress: saveAddressCheckbox.checked
      };

      const addressModalInstance = bootstrap.Modal.getInstance(addressModalElement);
      if (addressModalInstance) {
        addressModalInstance.hide();
      }
      showConfirmOrderModal();
      addressForm.classList.remove('was-validated');
    });
  }

  const editAddressBtn = document.getElementById('editAddressBtn');
  const confirmOrderModalElement = document.getElementById('confirmOrderModal');
  if (editAddressBtn && confirmOrderModalElement && addressModalElement) {
    editAddressBtn.addEventListener('click', () => {
      if (!tempAddressData) {
        bildirimiGoster('Düzenlenecek adres bilgisi bulunamadı!', 'warning');
        return;
      }

      const addressForm = document.getElementById('addressForm');
      if (addressForm) {
        addressForm.querySelector('#fullName').value = tempAddressData.fullName || '';
        addressForm.querySelector('#address').value = tempAddressData.address || '';
        addressForm.querySelector('#phone').value = tempAddressData.phoneNumber || '';
        addressForm.querySelector('#saveAddress').checked = tempAddressData.saveAddress || false;
        addressForm.classList.remove('was-validated');
      }

      const confirmModalInstance = bootstrap.Modal.getInstance(confirmOrderModalElement);
      if (confirmModalInstance) {
        confirmModalInstance.hide();
      }

      const addressModalInstance = new bootstrap.Modal(addressModalElement);
      addressModalInstance.show();
    });
  }

  const finalSubmitOrderBtn = document.getElementById('finalSubmitOrderBtn');
  if (finalSubmitOrderBtn && confirmOrderModalElement) {
    finalSubmitOrderBtn.addEventListener('click', () => {
      submitOrder(tempAddressData);
      const confirmModalInstance = bootstrap.Modal.getInstance(confirmOrderModalElement);
      if (confirmModalInstance) {
        confirmModalInstance.hide();
      }
    });
  }

  if (addressModalElement) {
    addressModalElement.addEventListener('show.bs.modal', () => {
      loadSavedAddresses();
      const addressForm = document.getElementById('addressForm');
      if (addressForm) {
        if (!tempAddressData) {
          addressForm.reset();
        } else {
          addressForm.querySelector('#fullName').value = tempAddressData.fullName || '';
          addressForm.querySelector('#address').value = tempAddressData.address || '';
          addressForm.querySelector('#phone').value = tempAddressData.phoneNumber || '';
          addressForm.querySelector('#saveAddress').checked = tempAddressData.saveAddress || false;
        }
        addressForm.classList.remove('was-validated');
        addressForm.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
      }
    });
  }
});
