let sepet; // Sepet global olarak tanımlanıyor, DOMContentLoaded içinde başlatılacak.

// --- Helper Functions ---

function bildirimGoster(message, type) {
  console.log(`Bildirim (${type}): ${message}`);
}

function safeParseJSON(key, defaultValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error parsing JSON from localStorage for key "${key}":`, e);
    return defaultValue;
  }
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDetailText(text) {
  if (!text) return 'Detaylı açıklama mevcut değil.';
  const paragraphs = text.split('\n').filter(p => p.trim() !== '');
  return paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join('');
}

function calculateDiscountedPrice(originalPrice, discountPercentage) {
  return discountPercentage > 0 && discountPercentage <= 100 ? originalPrice * (1 - discountPercentage / 100) : originalPrice;
}

function printOrderAsPDF(orderId) {
  try {
    let orders = safeParseJSON('orders', []);
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      bildirimGoster('Sipariş bulunamadı!', 'danger');
      return;
    }

    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      console.error("jsPDF kütüphanesi yüklenmedi!");
      bildirimGoster('PDF oluşturma hatası: jsPDF kütüphanesi bulunamadı.', 'danger');
      return;
    }
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFont("Helvetica");
    const primaryColor = '#007bff';
    const secondaryColor = '#6c757d';
    const textColor = '#343a40';
    const lightBgColor = '#f8f9fa';

    let currentY = 20;
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.width;
    const availableWidth = pageWidth - (2 * marginX);
    const maxTextWidthForSplit = availableWidth / 2 - 10;
    const defaultLineHeight = 5;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(primaryColor);
    doc.text('MehtapStore', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    doc.setFillColor(lightBgColor);
    doc.rect(marginX, currentY - 5, availableWidth, 45, 'F');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.text('Müşteri Bilgileri', marginX + 5, currentY);
    doc.text('Sipariş Bilgileri', pageWidth / 2 + 54, currentY);
    currentY += 8;

    const customerInfoX = marginX + 5;
    const orderInfoRightEdgeX = pageWidth - marginX - 5;

    let tempCurrentY = currentY;
    const customerFullName = order.fullName || 'Belirtilmemiş';
    const splitFullName = doc.splitTextToSize(customerFullName, maxTextWidthForSplit);
    doc.text(splitFullName, customerInfoX, tempCurrentY);
    tempCurrentY += splitFullName.length * defaultLineHeight;

    const customerPhone = `Telefon: ${order.phone || 'Belirtilmemiş'}`;
    const splitPhone = doc.splitTextToSize(customerPhone, maxTextWidthForSplit);
    doc.text(splitPhone, customerInfoX, tempCurrentY);
    tempCurrentY += splitPhone.length * defaultLineHeight;

    const customerAddress = `Adres: ${order.address || 'Belirtilmemiş'}`;
    const splitAddress = doc.splitTextToSize(customerAddress, maxTextWidthForSplit);
    doc.text(splitAddress, customerInfoX, tempCurrentY);

    let orderInfoY = currentY;
    const dateText = `Tarih: ${new Date(order.date).toLocaleString('tr-TR')}`;
    doc.text(dateText, orderInfoRightEdgeX, orderInfoY, { align: 'right' });
    orderInfoY += defaultLineHeight;

    const statusText = {
      pending: 'Beklemede',
      shipped: 'Kargoda',
      delivered: 'Teslim Edildi'
    }[order.status] || 'Bilinmeyen Durum';
    doc.text(`Durum: ${statusText}`, orderInfoRightEdgeX, orderInfoY, { align: 'right' });
    orderInfoY += 15;

    currentY = Math.max(tempCurrentY, orderInfoY);

    const tableData = [];
    let totalOriginalPrice = 0;
    let totalDiscountAmount = 0;
    let totalNetPrice = 0;

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const originalPriceAtOrder = Number(item.originalPrice || item.fiyat || 0);
        const indirimOrani = Number(item.indirim || 0);
        const netFiyat = Number(item.fiyat || 0);
        const adet = Number(item.adet || 0);
        const indirimTutari = (originalPriceAtOrder - netFiyat) * adet;

        totalOriginalPrice += originalPriceAtOrder * adet;
        totalDiscountAmount += indirimTutari;
        totalNetPrice += netFiyat * adet;

        const productName = item.ad || '';
        tableData.push([
          productName,
          `${adet}`,
          `${originalPriceAtOrder.toFixed(2)} TL`,
          `%${indirimOrani}`,
          `${netFiyat.toFixed(2)} TL`,
          `${(netFiyat * adet).toFixed(2)} TL`
        ]);
      });
    }

    doc.autoTable({
      startY: currentY,
      head: [['Ürün Adı', 'Adet', 'Birim Fiyat', 'İndirim', 'Net Fiyat', 'Toplam']],
      body: tableData,
      theme: 'striped',
      styles: {
        font: 'Helvetica',
        fontSize: 9,
        cellPadding: 3,
        lineColor: '#dee2e6',
        lineWidth: 0.1,
        textColor: textColor
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: '#ffffff',
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 75, overflow: 'linebreak' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' }
      },
      didDrawPage: function(data) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor);
        doc.text(`Sayfa ${doc.internal.getNumberOfPages()}`, pageWidth - marginX, doc.internal.pageSize.height - 10, {
          align: 'right'
        });
      }
    });

    currentY = doc.autoTable.previous.finalY + 10;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(textColor);

    const summaryRightAlignX = pageWidth - marginX - 3;
    const summaryLineHeight = 8;

    const totalOriginalPriceText = `Genel Toplam: ${totalOriginalPrice.toFixed(2)} TL`;
    const totalDiscountAmountText = `Toplam İndirim: ${totalDiscountAmount.toFixed(2)} TL`;
    const totalNetPriceText = `Kalan Net Tutar: ${totalNetPrice.toFixed(2)} TL`;

    doc.text(totalOriginalPriceText, summaryRightAlignX, currentY, { align: 'right' });
    currentY += summaryLineHeight;
    doc.text(totalDiscountAmountText, summaryRightAlignX, currentY, { align: 'right' });
    currentY += summaryLineHeight;
    doc.text(totalNetPriceText, summaryRightAlignX, currentY, { align: 'right' });

    doc.save(`siparis_${escapeHTML(orderId)}.pdf`);
  } catch (err) {
    console.error('PDF oluşturma hatası:', err);
    bildirimGoster('PDF oluşturulamadı!', 'danger');
  }
}

function cancelOrder(orderId) {
  if (!confirm('Siparişi iptal etmek istiyor musunuz?')) return;
  let orders = safeParseJSON('orders', []);
  const order = orders.find(o => o.id === orderId);
  if (!order || order.status !== 'pending') {
    bildirimGoster('Sadece beklemedeki siparişler iptal edilebilir!', 'warning');
    return;
  }
  const urunler = safeParseJSON('urunler', []);
  order.items.forEach(item => {
    const guncelUrun = urunler.find(u => u.id === item.id);
    if (guncelUrun) {
      guncelUrun.stok += item.adet;
    }
  });
  localStorage.setItem('urunler', JSON.stringify(urunler));
  orders = orders.filter(o => o.id !== orderId);
  localStorage.setItem('orders', JSON.stringify(orders));
  bildirimGoster('Sipariş iptal edildi!', 'success');
  displayOrders();
}

function displayOrders() {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) {
    console.error('ordersList bulunamadı!');
    return;
  }
  const currentUser = safeParseJSON('currentUser', {});
  const orders = safeParseJSON('orders', []);
  const userOrders = orders.filter(o => o.userEmail === currentUser.email);
  ordersList.innerHTML = userOrders.length === 0 ? '<p class="text-muted">Henüz siparişiniz yok.</p>' : '';
  userOrders.forEach((order, idx) => {
    const safeOrderId = escapeHTML(String(order.id));
    const statusText = order.status === 'pending' ? 'Beklemede' : order.status === 'shipped' ? 'Kargoda' : 'Teslim Edildi';
    ordersList.innerHTML += `
      <div class="accordion-item">
        <h2 class="accordion-header" id="orderHeading${idx}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#orderCollapse${idx}" aria-expanded="false" aria-controls="orderCollapse${idx}">
            Sipariş #${safeOrderId} - ${new Date(order.date).toLocaleString('tr-TR')} (${statusText})
          </button>
        </h2>
        <div id="orderCollapse${idx}" class="accordion-collapse collapse" aria-labelledby="orderHeading${idx}" data-bs-parent="#ordersList">
          <div class="accordion-body">
            <p><strong>Toplam:</strong> ${Number(order.total || 0).toFixed(2)} TL</p>
            <table class="table table-sm">
              <thead><tr><th>Ürün</th><th>Adet</th><th>Fiyat</th></tr></thead>
              <tbody>
                ${order.items?.map(item => `
                  <tr>
                    <td><img src="${escapeHTML(item.resim || 'https://via.placeholder.com/50')}" class="order-item-img me-2" alt="${escapeHTML(item.ad || 'Ürün Resmi')}" onerror="this.src='https://via.placeholder.com/50'"> ${escapeHTML(item.ad || 'Ürün Adı Belirtilmemiş')}</td>
                    <td>${Number(item.adet || 0)}</td>
                    <td>${Number(item.fiyat * (item.adet || 0) || 0).toFixed(2)} TL</td>
                  </tr>
                `).join('') || '<tr><td colspan="3">Ürün bulunamadı</td></tr>'}
              </tbody>
            </table>
            <div class="text-end">
              <button class="btn btn-sm btn-info me-2" onclick="printOrderAsPDF('${safeOrderId}')"><i class="fas fa-file-pdf"></i> PDF İndir</button>
              ${order.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="cancelOrder('${safeOrderId}')">İptal Et</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  });
}

class Sepet {
  constructor() {
    this.sepet = safeParseJSON('sepet', []);
    this.guncelle();
  }
  kaydet() { localStorage.setItem('sepet', JSON.stringify(this.sepet)); }
  ekle(urun) {
    const urunler = safeParseJSON('urunler', []);
    const guncelUrun = urunler.find(item => item.id === urun.id);
    if (!guncelUrun) {
      bildirimGoster('Ürün bilgisi bulunamadı!', 'danger');
      return false;
    }
    const mevcut = this.sepet.find(item => item.id === urun.id);
    const mevcutAdet = mevcut ? mevcut.adet : 0;
    const toplamAdet = mevcutAdet + urun.adet;
    if (toplamAdet > guncelUrun.stok) {
      bildirimGoster(`Stok yetersiz! Maksimum: ${guncelUrun.stok - mevcutAdet} adet.`, 'warning');
      return false;
    }
    if (mevcut) { mevcut.adet += urun.adet; } else { this.sepet.push({ ...urun, stok: guncelUrun.stok }); }
    guncelUrun.stok -= urun.adet;
    localStorage.setItem('urunler', JSON.stringify(urunler));
    this.kaydet();
    this.guncelle();
    this.bildirim();
    return true;
  }
  guncelle() {
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) cartBadge.textContent = this.sepet.reduce((sum, item) => sum + item.adet, 0);
  }
  bildirim() {
    const bild = document.getElementById('sepetBildirim');
    if (bild) { bild.classList.remove('d-none'); setTimeout(() => bild.classList.add('d-none'), 2000); }
  }
}

function kategoriYukle() {
  const urunler = safeParseJSON('urunler', []);
  const kategoriler = [...new Set(urunler.map(u => u.kategori).filter(k => k))].sort();
  const liste = document.getElementById('kategoriListesi');
  if (!liste) {
    console.error('Kategori listesi bulunamadı!');
    return;
  }
  liste.innerHTML = '<a href="#" class="list-group-item list-group-item-action" data-kategori="hepsi">Tüm Ürünler</a>';
  kategoriler.forEach(k => {
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'list-group-item list-group-item-action';
    a.dataset.kategori = k;
    a.textContent = k;
    liste.appendChild(a);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `index.html?kategori=${encodeURIComponent(k)}`;
      const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('kategoriOffcanvas'));
      if (offcanvas) offcanvas.hide();
    });
  });
}

function navbarGuncelle() {
  const navbarButtons = document.getElementById('navbarButtons');
  if (!navbarButtons) {
    console.error('navbarButtons bulunamadı!');
    return;
  }
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const user = safeParseJSON('currentUser', {});
  navbarButtons.innerHTML = isLoggedIn === 'true' ? `
    <button class="btn btn-outline-light btn-sm btn-icon-only" data-bs-toggle="modal" data-bs-target="#profileModal" title="Profil">
      <i class="bi bi-person"></i>
    </button>
    ${user.role === 'admin' ? `
      <a href="urun-ekle-sil.html" class="btn btn-outline-light btn-sm btn-icon-only" title="Admin Paneli">
        <i class="fas fa-user-shield"></i>
      </a>
    ` : ''}
    <button class="btn btn-outline-light btn-sm btn-icon-only" onclick="logout()" title="Çıkış Yap">
      <i class="bi bi-box-arrow-right"></i>
    </button>
    <button class="btn btn-light position-relative btn-sm btn-icon-only" onclick="window.location.href='cart.html'" title="Sepet">
      <i class="bi bi-cart3"></i>
      <span id="cartBadge" class="cart-badge badge bg-danger rounded-pill">0</span>
    </button>
    <button class="btn btn-light btn-sm btn-icon-only" type="button" data-bs-toggle="offcanvas" data-bs-target="#kategoriOffcanvas" aria-controls="kategoriOffcanvas" title="Kategoriler">
      <i class="bi bi-list"></i>
    </button>
  ` : `
    <a href="kayit.html" class="btn btn-outline-light btn-sm btn-icon-only" title="Kayıt Ol">
      <i class="bi bi-person-plus"></i>
    </a>
    <a href="login.html" class="btn btn-outline-light btn-sm btn-icon-only" title="Giriş Yap">
      <i class="bi bi-box-arrow-in-right"></i>
    </a>
    <button class="btn btn-light position-relative btn-sm btn-icon-only" onclick="window.location.href='cart.html'" title="Sepet">
      <i class="bi bi-cart3"></i>
      <span id="cartBadge" class="cart-badge badge bg-danger rounded-pill">0</span>
    </button>
    <button class="btn btn-light btn-sm btn-icon-only" type="button" data-bs-toggle="offcanvas" data-bs-target="#kategoriOffcanvas" aria-controls="kategoriOffcanvas" title="Kategoriler">
      <i class="bi bi-list"></i>
    </button>
  `;
  const profileUsername = document.getElementById('profileUsername');
  const profileEmail = document.getElementById('profileEmail');
  if (profileUsername && profileEmail) {
    profileUsername.value = user.username || user.email || '';
    profileEmail.value = user.email || '';
  }
  displayOrders();
}

function urunGoster() {
  const params = new URLSearchParams(window.location.search);
  const urunId = params.get('id') || params.get('Id');
  const urunler = safeParseJSON('urunler', []);
  const mainContent = document.getElementById('mainContent');
  if (!mainContent) {
    console.error('mainContent bulunamadı!');
    return;
  }

  if (!urunId) {
    mainContent.innerHTML = '<p class="text-center text-muted">Ürün ID belirtilmemiş. Lütfen bir ürün seçin: <a href="index.html">Ürün listesine dön</a></p>';
    setTimeout(() => window.location.href = 'index.html', 3000);
    return;
  }
  const urun = urunler.find(u => u.id == urunId);
  if (!urun) {
    mainContent.innerHTML = '<p class="text-center text-muted">Ürün bulunamadı (ID: ' + escapeHTML(urunId) + '). <a href="index.html">Ürün listesine dön</a></p>';
    return;
  }

  // Hata ayıklama için ürün bilgilerini konsola yazdır
  console.log('Ürün Bilgileri:', JSON.stringify({
    id: urun.id,
    ad: urun.ad,
    isNew: urun.isNew, // Bu satır konsolda isNew'in tam değerini gösterir
    ucretsizKargo: urun.ucretsizKargo,
    indirim: urun.indirim
  }, null, 2));

  // isNew kontrolü: urun.isNew'in truthy bir değer olup olmadığını kontrol eder.
  // Yani undefined, null, 0, false, boş string dışında herhangi bir değer varsa true döner.
  const isNew = !!urun.isNew; // Bu değişiklik, isNew'i kesin olarak boolean yapar

  mainContent.innerHTML = `
    <div class="row">
      <div class="col-md-6 position-relative">
        <img id="urunResim" class="product-img img-fluid" src="${escapeHTML(urun.resim || 'https://via.placeholder.com/400')}" alt="${escapeHTML(urun.ad || 'Ürün Resmi')}" data-bs-toggle="modal" data-bs-target="#resimModal">
        <div id="urunBadges" class="product-badges">
          ${isNew ? '<span class="badge bg-primary text-white">Yeni</span>' : ''}
          ${urun.indirim ? `<span class="badge bg-danger text-white">%${escapeHTML(String(urun.indirim))} İndirim</span>` : ''}
          ${urun.ucretsizKargo === true || urun.ucretsizKargo === 'true' ? '<span class="badge bg-success text-white">Ücretsiz Kargo</span>' : ''}
        </div>
      </div>
      <div class="col-md-6">
        <h2 id="urunAdi">${escapeHTML(urun.ad || 'Belirtilmemiş')}</h2>
        <p id="urunKategori" class="text-muted mb-1">Kategori: ${escapeHTML(urun.kategori || 'Belirtilmemiş')}</p>
        <p id="urunStokKodu" class="text-muted mb-3">Stok Kodu: ${escapeHTML(urun.stokKodu || 'Bilinmiyor')}</p>
        <div class="mb-3">
          <p id="urunFiyat" class="original-price-text ${urun.indirim > 0 && calculateDiscountedPrice(urun.fiyat || 0, urun.indirim || 0) < urun.fiyat ? '' : 'd-none'}">${(urun.fiyat || 0).toFixed(2)} TL</p>
          <h4 id="urunIndirimliFiyat" class="product-price-text">${calculateDiscountedPrice(urun.fiyat || 0, urun.indirim || 0).toFixed(2)} TL</h4>
        </div>
        <p id="urunStok" class="stock-status mb-3">Stok: ${urun.stok > 0 ? `${urun.stok} adet` : 'Tükenmiş'}</p>
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="input-group quantity-input">
            <button class="btn btn-outline-secondary" type="button" onclick="adetAyarla(-1)">-</button>
            <input type="number" id="adetInput" class="form-control text-center" value="1" min="1">
            <button class="btn btn-outline-secondary" type="button" onclick="adetAyarla(1)">+</button>
          </div>
          <button id="sepeteEkleBtn" class="btn btn-primary ${urun.stok <= 0 ? 'disabled' : ''}">
            <i class="bi bi-cart-plus"></i> Sepete Ekle
          </button>
        </div>
        <a href="index.html" class="btn btn-outline-secondary mb-3">Geri Dön</a>
        <div class="accordion" id="urunDetayAccordion">
          <div class="accordion-item">
            <h2 class="accordion-header" id="detayHeading">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#detayCollapse" aria-expanded="false" aria-controls="detayCollapse">
                Ürün Detay
              </button>
            </h2>
            <div id="detayCollapse" class="accordion-collapse collapse" aria-labelledby="detayHeading" data-bs-parent="#urunDetayAccordion">
              <div class="accordion-body urun-detay-text">
                ${formatDetailText(urun.detay)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('urunStok').classList.toggle('stock-out', urun.stok <= 0);
  document.getElementById('modalResim').src = urun.resim || 'https://via.placeholder.com/400';
  document.getElementById('sepeteEkleBtn').addEventListener('click', () => {
    const adetInput = document.getElementById('adetInput');
    const adet = parseInt(adetInput ? adetInput.value : 1);
    const urunSepet = {
      id: urun.id,
      ad: urun.ad,
      fiyat: calculateDiscountedPrice(urun.fiyat || 0, urun.indirim || 0),
      adet,
      resim: urun.resim || 'https://via.placeholder.com/400',
      stok: urun.stok,
      indirim: urun.indirim || 0,
      originalPrice: urun.fiyat || 0,
      stokKodu: urun.stokKodu || '',
      detay: urun.detay || ''
    };
    if (sepet.ekle(urunSepet) && adetInput) {
      adetInput.value = 1;
    }
  });
}


function adetAyarla(deger) {
  const input = document.getElementById('adetInput');
  const urunId = new URLSearchParams(window.location.search).get('id') || new URLSearchParams(window.location.search).get('Id');
  const urunler = safeParseJSON('urunler', []);
  const urun = urunler.find(u => u.id == urunId);
  if (input && urun) {
    let yeniAdet = parseInt(input.value) + deger;
    if (yeniAdet < 1) yeniAdet = 1;
    if (yeniAdet > urun.stok) {
      bildirimGoster(`Stok: ${urun.stok} adet`, 'info');
      yeniAdet = urun.stok;
    }
    input.value = yeniAdet;
  }
}

function logout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('currentUser');
  bildirimGoster('Çıkış yapıldı!', 'success');
  window.location.href = 'login.html';
}

function initializePasswordForm() {
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (!changePasswordForm) {
    console.error('Şifre formu bulunamadı!');
    return;
  }
  changePasswordForm.addEventListener('submit', e => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmNewPassword');
    const currentUser = safeParseJSON('currentUser', {});

    [currentPassword, newPassword, confirmPassword].forEach(field => field?.classList.remove('is-invalid'));
    let isValid = true;

    if (currentPassword.value !== currentUser.password) {
      currentPassword.classList.add('is-invalid');
      bildirimGoster('Mevcut şifre yanlış.', 'danger');
      isValid = false;
    }
    if (newPassword.value.length < 6) {
      newPassword.classList.add('is-invalid');
      bildirimGoster('Yeni şifre en az 6 karakter olmalı.', 'danger');
      isValid = false;
    }
    if (newPassword.value !== confirmPassword.value) {
      confirmPassword.classList.add('is-invalid');
      bildirimGoster('Yeni şifreler eşleşmiyor.', 'danger');
      isValid = false;
    }

    if (!isValid) return;

    let users = safeParseJSON('users', []);
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword.value;
      localStorage.setItem('users', JSON.stringify(users));
      localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
      bildirimGoster('Şifre başarıyla değiştirildi!', 'success');
      const profileModal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
      if (profileModal) profileModal.hide();
      currentPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
    } else {
      bildirimGoster('Kullanıcı bulunamadı, şifre değiştirilemedi.', 'danger');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  sepet = new Sepet();
  kategoriYukle();
  navbarGuncelle();
  urunGoster();
  initializePasswordForm();
});