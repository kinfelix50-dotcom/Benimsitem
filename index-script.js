let sepet;

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeParseJSON(key, defaultValue = {}) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Error parsing ${key} from localStorage:`, e);
    return defaultValue;
  }
}

function calculateDiscountedPrice(originalPrice, discountPercentage) {
  if (discountPercentage > 0 && discountPercentage <= 100) {
    return originalPrice * (1 - discountPercentage / 100);
  }
  return originalPrice;
}

// Çıkış fonksiyonunu global kapsama taşıdık
function logout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('currentUser');
  alert('Çıkış yapıldı.');
  window.location.assign('login.html');
}

// PDF yazdırma fonksiyonu
function printOrderAsPDF(orderId) {
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem('orders')) || [];
  } catch (e) {
    console.error('orders JSON parse hatası:', e.message, 'Değer:', localStorage.getItem('orders'));
    localStorage.setItem('orders', JSON.stringify([]));
    alert('Sipariş verileri bozuk, sıfırlandı.');
    return;
  }
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    alert('Sipariş bulunamadı!');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  const primaryColor = '#007bff';
  const secondaryColor = '#6c757d';
  const textColor = '#343a40';
  const lightBgColor = '#f8f9fa';

  let currentY = 20;
  const marginX = 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(primaryColor);
  doc.text('MehtapStore', marginX, currentY);
  currentY += 15;

  doc.setFillColor(lightBgColor);
  doc.rect(marginX, currentY - 5, doc.internal.pageSize.width - (2 * marginX), 45, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(textColor);
  doc.text('Siparis Bilgileri', marginX + 5, currentY);
  doc.text('Müsteri Bilgileri', marginX + (doc.internal.pageSize.width - (2 * marginX)) / 2 + 5, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(textColor);

  const orderInfoX = marginX + 5;
  const customerInfoX = marginX + (doc.internal.pageSize.width - (2 * marginX)) / 2 + 5;

  doc.text(`Ad Soyad: ${escapeHTML(order.fullName || 'Belirtilmemiş')}`, customerInfoX, currentY);
  currentY += 6;
  doc.text(`Tarih: ${new Date(order.date).toLocaleString('tr-TR')}`, orderInfoX, currentY);
  doc.text(`Telefon: ${escapeHTML(order.phone || 'Belirtilmemiş')}`, customerInfoX, currentY);
  currentY += 6;
  doc.text(`Durum: ${order.status === 'pending' ? 'Beklemede' : order.status === 'shipped' ? 'Kargoda' : 'Teslim Edildi'}`, orderInfoX, currentY);
  doc.text(`Adres: ${escapeHTML(order.address || 'Belirtilmemiş')}`, customerInfoX, currentY);
  currentY += 15;

  const tableData = [];
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach(item => {
      tableData.push([
        escapeHTML(item.ad || ''),
        Number(item.adet || 0),
        `${Number(item.fiyat || 0).toFixed(2)}`,
        `${Number((item.fiyat * item.adet) || 0).toFixed(2)}`
      ]);
    });
  }

  doc.autoTable({
    startY: currentY,
    head: [['Ürün Adı', 'Adet', 'Birim Fiyat', 'Toplam']],
    body: tableData,
    theme: 'striped',
    styles: {
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
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' }
    },
    didDrawPage: function (data) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor);
      doc.text(`Sayfa ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width - marginX, doc.internal.pageSize.height - 10, { align: 'right' });
    }
  });

  currentY = doc.autoTable.previous.finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(textColor);
  const totalText = `Genel Toplam: ${Number(order.total).toFixed(2)} TL`;
  const textWidth = doc.getStringUnitWidth(totalText) * doc.getFontSize() / doc.internal.scaleFactor;
  doc.text(totalText, doc.internal.pageSize.width - marginX - textWidth, currentY);
  currentY += 15;

  doc.save(`siparis_${escapeHTML(order.id)}.pdf`);
}

document.addEventListener('DOMContentLoaded', function () {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const navbarButtons = document.getElementById('navbarButtons');

  if (!navbarButtons) {
    console.error('navbarButtons elementi bulunamadı!');
  }

  function loadVitrins() {
    const vitrinBloklari = document.getElementById('vitrinBloklari');
    if (!vitrinBloklari) {
      console.error('Hata: vitrinBloklari elementi bulunamadı!');
      return;
    }

    vitrinBloklari.innerHTML = '';
    const urunler = safeParseJSON('urunler', []);
    const vitrinler = safeParseJSON('vitrinler', []);

    if (!Array.isArray(urunler) || !Array.isArray(vitrinler)) {
      console.error('Geçersiz veri formatı: urunler veya vitrinler dizi değil.');
      vitrinBloklari.innerHTML = '<p class="text-muted text-center w-100">Vitrin yüklenemedi, veri geçersiz.</p>';
      return;
    }

    let hasContent = false;

    function renderVitrin(title, productList) {
      if (!Array.isArray(productList) || productList.length === 0) return '';
      hasContent = true;
      let blockHtml = `
        <div class="vitrin-bolumu">
          <h2 class="text-center mb-4">${escapeHTML(title)}</h2>
          <div class="product-scroll-container">
      `;
      productList.forEach(urun => {
        if (!urun || !urun.id || !urun.ad || !urun.fiyat || !urun.resim) {
          console.warn('Geçersiz ürün verisi:', urun);
          return;
        }

        const indirimliFiyat = calculateDiscountedPrice(urun.fiyat, urun.indirim);

        blockHtml += `
          <div class="product-scroll-item">
            <div class="product-card shadow-sm h-100 position-relative">
              <img src="${escapeHTML(urun.resim)}" class="card-img-top product-image" alt="${escapeHTML(urun.ad)}" onerror="this.src='https://via.placeholder.com/160'">
              <div class="product-badges">
                ${urun.isNew ? '<span class="badge bg-primary text-white">Yeni</span>' : ''}
                ${urun.indirim > 0 ? `<span class="badge bg-danger text-white">%${urun.indirim} İndirim</span>` : ''}
              </div>
              <div class="card-body text-center">
                <h5 class="card-title">${escapeHTML(urun.ad)}</h5>
                ${urun.indirim > 0 ? `
                  <p class="card-text original-price">${Number(urun.fiyat).toFixed(2)} TL</p>
                  <p class="card-price discount-price">${indirimliFiyat.toFixed(2)} TL</p>
                ` : `
                  <p class="card-price">${Number(urun.fiyat).toFixed(2)} TL</p>
                `}
                <a href="urun-detay.html?id=${escapeHTML(urun.id)}" class="btn btn-outline-primary btn-sm">Detaylar</a>
                <button class="btn btn-success btn-sm sepete-ekle-carousel"
                        data-urun-id="${escapeHTML(urun.id)}"
                        data-urun-ad="${escapeHTML(urun.ad)}"
                        data-urun-fiyat="${indirimliFiyat}"
                        data-urun-resim="${escapeHTML(urun.resim)}"
                        data-urun-stok="${Number(urun.stok || 0)}"
                        data-urun-indirim="${Number(urun.indirim || 0)}"
                        ${urun.stok === 0 ? 'disabled' : ''}>
                  <i class="fas fa-shopping-cart"></i> Ekle
                </button>
              </div>
            </div>
          </div>
        `;
      });
      blockHtml += '</div></div>';
      return blockHtml;
    }

    let output = '';
    vitrinler.forEach(vitrin => {
      if (!vitrin || !vitrin.ad || !Array.isArray(vitrin.urunIds)) {
        console.warn('Geçersiz vitrin verisi:', vitrin);
        return;
      }
      const vitrinUrunleri = urunler.filter(urun => vitrin.urunIds.includes(urun.id));
      output += renderVitrin(vitrin.ad, vitrinUrunleri);
    });

    const featuredProducts = urunler.filter(urun => urun.isNew && urun.anasayfadaGoster === true);
    output += renderVitrin('Öne Çıkan Yeni Ürünler', featuredProducts);

    vitrinBloklari.innerHTML = hasContent
      ? output
      : '<p class="text-muted text-center w-100">Öne çıkan ürün veya vitrin bulunamadı.</p>';

    document.querySelectorAll('.sepete-ekle-carousel').forEach(button => {
      button.addEventListener('click', function () {
        const urun = {
          id: this.dataset.urunId,
          ad: this.dataset.urunAd,
          fiyat: parseFloat(this.dataset.urunFiyat),
          adet: 1,
          resim: this.dataset.urunResim,
          stok: parseInt(this.dataset.urunStok),
          indirim: parseFloat(this.dataset.urunIndirim),
          stokKodu: 'N/A'
        };
        sepet.ekle(urun);
      });
    });
  }

  function displayOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) {
      console.error('ordersList elementi bulunamadı!');
      return;
    }

    const currentUser = safeParseJSON('currentUser');
    const orders = safeParseJSON('orders', []);
    const userOrders = orders.filter(order => order.userEmail === currentUser.email);

    ordersList.innerHTML = '';
    if (userOrders.length === 0) {
      ordersList.innerHTML = '<p class="text-muted">Henüz siparişiniz yok.</p>';
      return;
    }

    userOrders.forEach((order, index) => {
      const safeOrderId = escapeHTML(order.id);
      const orderStatus = order.status === 'pending' ? 'Beklemede' : order.status === 'shipped' ? 'Kargoda' : 'Teslim Edildi';
      const orderElement = document.createElement('div');
      orderElement.className = 'accordion-item';
      orderElement.innerHTML = `
        <h2 class="accordion-header" id="orderHeading${index}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#orderCollapse${index}" aria-expanded="false" aria-controls="orderCollapse${index}">
            Sipariş #${safeOrderId} - ${new Date(order.date).toLocaleString('tr-TR')} (${orderStatus})
          </button>
        </h2>
        <div id="orderCollapse${index}" class="accordion-collapse collapse" aria-labelledby="orderHeading${index}" data-bs-parent="#ordersList">
          <div class="accordion-body">
            <p><strong>Ad Soyad:</strong> ${escapeHTML(order.fullName || 'Belirtilmemiş')}</p>
            <p><strong>Adres:</strong> ${escapeHTML(order.address || 'Belirtilmemiş')}</p>
            <p><strong>Telefon:</strong> ${escapeHTML(order.phone || 'Belirtilmemiş')}</p>
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Adet</th>
                  <th>Fiyat</th>
                </tr>
              </thead>
              <tbody>
                ${order.items && Array.isArray(order.items) ? order.items.map(item => `
                  <tr>
                    <td>
                      <img src="${escapeHTML(item.resim || '')}" class="order-item-img me-2" alt="${escapeHTML(item.ad || '')}" onerror="this.src='https://via.placeholder.com/50'">
                      ${escapeHTML(item.ad || '')}
                    </td>
                    <td>${Number(item.adet || 0)}</td>
                    <td>${Number((item.fiyat * item.adet) || 0).toFixed(2)} TL</td>
                  </tr>
                `).join('') : '<tr><td colspan="3">Ürün bulunamadı</td></tr>'}
              </tbody>
            </table>
            <p><strong>Toplam: ${Number(order.total).toFixed(2)} TL</strong></p>
            <div class="text-end">
              <button class="btn btn-sm btn-info me-2 print-order" data-order-id="${safeOrderId}">
                <i class="fas fa-file-pdf"></i> PDF İndir
              </button>
              ${order.status === 'pending' ? `
                <button class="btn btn-danger btn-sm cancel-order" data-order-id="${safeOrderId}">Siparişi İptal Et</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      ordersList.appendChild(orderElement);
    });

    document.querySelectorAll('.print-order').forEach(button => {
      button.addEventListener('click', () => printOrderAsPDF(button.dataset.orderId));
    });

    document.querySelectorAll('.cancel-order').forEach(button => {
      button.addEventListener('click', () => cancelOrder(button.dataset.orderId));
    });
  }

  function cancelOrder(orderId) {
    if (!confirm('Bu siparişi iptal etmek istediğinize emin misiniz?')) return;
    let orders = safeParseJSON('orders', []);
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') {
      alert('Sadece beklemede olan siparişler iptal edilebilir!');
      return;
    }

    const urunler = safeParseJSON('urunler', []);
    order.items.forEach(item => {
      const guncelUrun = urunler.find(u => u.id === item.id);
      if (guncelUrun) guncelUrun.stok += item.adet;
    });
    localStorage.setItem('urunler', JSON.stringify(urunler));
    orders = orders.filter(o => o.id !== orderId);
    localStorage.setItem('orders', JSON.stringify(orders));
    alert('Sipariş başarıyla iptal edildi!');
    displayOrders();
    urunleriGoster();
    loadVitrins();
  }

  class Sepet {
    constructor() {
      this.sepet = safeParseJSON('sepet', []);
      this.guncelle();
    }

    kaydet() {
      localStorage.setItem('sepet', JSON.stringify(this.sepet));
    }

    ekle(urun) {
      const urunlerLocal = safeParseJSON('urunler', []);
      const guncelUrunBilgisi = urunlerLocal.find(item => item.id === urun.id);
      if (!guncelUrunBilgisi) {
        alert("Ürün bilgisi bulunamadı!");
        return;
      }

      const mevcut = this.sepet.find(item => item.id === urun.id);
      const mevcutSepetAdedi = mevcut ? mevcut.adet : 0;
      const eklenecekAdet = urun.adet;
      const toplamAdet = mevcutSepetAdedi + eklenecekAdet;

      if (toplamAdet > guncelUrunBilgisi.stok) {
        alert(`Stok yetersiz! Maksimum eklenebilir adet: ${guncelUrunBilgisi.stok - mevcutSepetAdedi} adet.`);
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

      guncelUrunBilgisi.stok -= eklenecekAdet;
      localStorage.setItem('urunler', JSON.stringify(urunlerLocal));
      this.kaydet();
      this.guncelle();
      this.bildirimGoster();
      urunleriGoster();
      loadVitrins();
    }

    urunCikar(urunId, adet) {
      const mevcut = this.sepet.find(item => item.id === urunId);
      if (!mevcut) return;
      mevcut.adet -= adet;
      if (mevcut.adet <= 0) {
        this.sepet = this.sepet.filter(item => item.id !== urunId);
      }

      const urunler = safeParseJSON('urunler', []);
      const guncelUrun = urunler.find(item => item.id === urunId);
      if (guncelUrun) {
        guncelUrun.stok += adet;
        localStorage.setItem('urunler', JSON.stringify(urunler));
      }

      this.kaydet();
      this.guncelle();
      urunleriGoster();
      loadVitrins();
    }

    sepetiTemizle() {
      if (confirm('Sepeti tamamen boşaltmak istediğinize emin misiniz?')) {
        const urunler = safeParseJSON('urunler', []);
        this.sepet.forEach(item => {
          const guncelUrun = urunler.find(u => u.id === item.id);
          if (guncelUrun) guncelUrun.stok += item.adet;
        });
        this.sepet = [];
        localStorage.setItem('urunler', JSON.stringify(urunler));
        this.kaydet();
        this.guncelle();
        urunleriGoster();
        loadVitrins();
      }
    }

    guncelle() {
      const cartBadge = document.getElementById('cartBadge');
      if (cartBadge) {
        cartBadge.textContent = this.sepet.reduce((a, item) => a + item.adet, 0);
      }
    }

    bildirimGoster() {
      const bildirim = document.getElementById('sepetBildirim');
      if (bildirim) {
        bildirim.classList.remove('d-none');
        setTimeout(() => bildirim.classList.add('d-none'), 2000);
      }
    }
  }

  function getBenzersizKategoriler() {
    const urunler = safeParseJSON('urunler', []);
    return [...new Set(urunler.map(urun => urun.kategori).filter(kategori => kategori))];
  }

  function kategoriMenusuGuncelle() {
    const kategoriListesi = document.getElementById('kategoriListesi');
    if (!kategoriListesi) return;

    const kategoriler = getBenzersizKategoriler();
    while (kategoriListesi.children.length > 1) {
      kategoriListesi.removeChild(kategoriListesi.lastChild);
    }

    kategoriler.forEach(kategori => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'list-group-item list-group-item-action';
      a.dataset.kategori = kategori;
      a.textContent = kategori;
      kategoriListesi.appendChild(a);
    });

    kategoriListesi.querySelectorAll('.list-group-item').forEach(item => {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        const kategori = this.getAttribute('data-kategori');
        urunleriGoster(kategori);
        const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('kategoriOffcanvas'));
        if (offcanvas) offcanvas.hide();
      });
    });
  }

  function urunleriGoster(filtreKategori = null, aramaKelimesi = null) {
    const urunListesi = document.getElementById('productList');
    const productCarouselSection = document.querySelector('.product-carousel-section');
    if (!urunListesi) return;

    if (filtreKategori || aramaKelimesi) {
      if (productCarouselSection) productCarouselSection.style.display = 'none';
    } else {
      if (productCarouselSection) productCarouselSection.style.display = 'block';
    }

    urunListesi.innerHTML = '';
    const urunler = safeParseJSON('urunler', []);
    let filtrelenmisUrunler = urunler;

    if (!filtreKategori && !aramaKelimesi) {
      filtrelenmisUrunler = urunler.filter(urun => urun.anasayfadaGoster === true);
    }

    if (filtreKategori) {
      filtrelenmisUrunler = filtrelenmisUrunler.filter(urun => filtreKategori === 'hepsi' ? true : urun.kategori === filtreKategori);
    }

    if (aramaKelimesi) {
      const lowerCaseArama = aramaKelimesi.toLowerCase();
      filtrelenmisUrunler = filtrelenmisUrunler.filter(urun => urun.ad.toLowerCase().includes(lowerCaseArama));
    }

    if (filtrelenmisUrunler.length === 0) {
      urunListesi.innerHTML = '<div class="col-12"><p class="text-muted text-center">Ürün bulunamadı.</p></div>';
      return;
    }

    filtrelenmisUrunler.forEach(urun => {
      urun.stok = urun.stok !== undefined ? urun.stok : 0;
      const stokDurumu = urun.stok > 0 ? `${urun.stok} adet stokta` : '<span class="text-danger">Stokta yok</span>';
      const stokKodu = urun.stokKodu || 'Bilinmiyor';

      const indirimliFiyat = calculateDiscountedPrice(urun.fiyat, urun.indirim);

      const urunCard = document.createElement('div');
      urunCard.classList.add('col-6', 'col-md-4', 'col-lg-3');
      urunCard.innerHTML = `
        <div class="card product-card h-100 border-0 shadow-sm">
          <img src="${encodeURI(escapeHTML(urun.resim))}" class="product-image" alt="${escapeHTML(urun.ad)}" onerror="this.src='https://via.placeholder.com/130'">
          <div class="product-badges">
            ${urun.isNew ? '<span class="badge bg-primary text-white">Yeni</span>' : ''}
            ${urun.indirim > 0 ? `<span class="badge bg-danger text-white">%${urun.indirim} İndirim</span>` : ''}
          </div>
          <div class="card-body d-flex flex-column">
            <h5 class="card-title text-center">${escapeHTML(urun.ad)}</h5>
            <p class="card-text text-muted small text-center">Stok Kodu: ${escapeHTML(stokKodu)}</p>
            <p class="card-text text-muted small text-center">${stokDurumu}</p>
            <div class="text-center mt-auto">
              ${urun.indirim > 0 ? `
                <p class="card-text original-price">${Number(urun.fiyat).toFixed(2)} TL</p>
                <h4 class="card-price discount-price">${indirimliFiyat.toFixed(2)} TL</h4>
              ` : `
                <h4 class="card-price">${Number(urun.fiyat).toFixed(2)} TL</h4>
              `}
              <div class="d-flex flex-column align-items-center gap-2">
                <div class="input-group input-group-sm" style="width: 100px;">
                  <button class="btn btn-outline-secondary azalt" type="button" data-urun-id="${escapeHTML(urun.id)}">-</button>
                  <input type="number" class="form-control text-center adet-input" value="1" min="1" max="${urun.stok}">
                  <button class="btn btn-outline-secondary artir" type="button" data-urun-id="${escapeHTML(urun.id)}">+</button>
                </div>
                <button class="btn btn-primary btn-sm sepete-ekle mt-2"
                  data-urun-id="${escapeHTML(urun.id)}"
                  data-urun-ad="${escapeHTML(urun.ad)}"
                  data-urun-fiyat="${indirimliFiyat}"
                  data-urun-resim="${escapeHTML(urun.resim)}"
                  data-urun-stok="${urun.stok}"
                  data-urun-indirim="${urun.indirim || 0}"
                  ${urun.stok === 0 ? 'disabled' : ''}>
                  <i class="bi bi-cart-plus"></i> Sepete Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      urunListesi.appendChild(urunCard);

      urunCard.addEventListener('click', function (e) {
        if (!e.target.closest('.sepete-ekle') && !e.target.closest('.input-group') && 
!e.target.classList.contains('azalt') && !e.target.classList.contains('artir')) {
          window.location.href = `urun-detay.html?id=${escapeHTML(urun.id)}`;
        }
      });

      const azaltBtn = urunCard.querySelector('.azalt');
      const artirBtn = urunCard.querySelector('.artir');
      const inputEl = urunCard.querySelector('.adet-input');
      const sepeteEkleBtn = urunCard.querySelector('.sepete-ekle');

      azaltBtn.addEventListener('click', () => {
        let val = parseInt(inputEl.value);
        if (val > 1) inputEl.value = val - 1;
      });

      artirBtn.addEventListener('click', () => {
        let val = parseInt(inputEl.value);
        if (val < urun.stok) {
          inputEl.value = val + 1;
        }
      });

      inputEl.addEventListener('change', () => {
        let val = parseInt(inputEl.value);
        if (isNaN(val) || val < 1) {
          inputEl.value = 1;
        } else if (val > urun.stok) {
          inputEl.value = urun.stok;
        }
      });

      sepeteEkleBtn.addEventListener('click', function () {
        const urunBilgisi = safeParseJSON('urunler', []).find(p => p.id === this.dataset.urunId);
        const eklenecekAdet = parseInt(inputEl.value);
        if (!urunBilgisi ||!urunBilgisi.stok < eklenecekAdet) {
          alert(`Yetersiz stok! Sadece ${urunBilgisi ? urunBilgisi.stok : 0} adet eklenebilir.`);
          inputEl.value = urunBilgisi ? urunBilgisi.stok : 1;
          return;
        }

        const urun = {
          id: this.dataset.urunId,
          ad: this.dataset.urunAd,
          fiyat: parseFloat(this.dataset.urunFiyat),
          adet: eklenecekAdet,
          resim: this.dataset.urunResim,
          stok: parseInt(this.dataset.urunStok),
          indirim: parseFloat(this.dataset.urunIndirim),
          stokKodu: urunBilgisi.stokKodu || 'N/A'
        };
        sepet.ekle(urun);
        inputEl.value = '1';
      });
    });
  }

  // Adres Yönetimi Fonksiyonları
  function displayAddresses() {
    const addressList = document.getElementById('addressList');
    if (!addressList) return;

    const currentUser = safeParseJSON('currentUser');
    const addresses = currentUser.addresses || [];

    addressList.innerHTML = '';
    if (addresses.length === 0) {
      addressList.innerHTML = '<p class="text-muted">Henüz kaydedilmiş adresiniz yok.</p>';
      return;
    }

    addresses.forEach((address, index) => {
      const div = document.createElement('div');
      div.className = 'card mb-2';
      div.innerHTML = `
        <div class="card-body">
          <h6 class="card-title">Adres ${index + 1}</h6>
          <p class="mb-1"><strong>Ad Soyad:</strong> ${escapeHTML(address.fullName)}</p>
          <p class="mb-1"><strong>Adres:</strong> ${escapeHTML(address.address)}</p>
          <p class="mb-1"><strong>Telefon:</strong> ${escapeHTML(address.phoneNumber)}</p>
          <div class="text-end">
            <button class="btn btn-sm btn-primary edit-address me-2" data-index="${index}">
              <i class="bi bi-pencil"></i> Düzenle
            </button>
            <button class="btn btn-sm btn-danger delete-address" data-index="${index}">
              <i class="bi bi-trash"></i> Sil
            </button>
          </div>
        </div>
      `;
      addressList.appendChild(div);
    });

    document.querySelectorAll('.edit-address').forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.dataset.index);
        openAddressModal(index);
      });
    });

    document.querySelectorAll('.delete-address').forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.dataset.index);
        deleteAddress(index);
      });
    });
  }

  function openAddressModal(index = null) {
    const addressModalElement = document.getElementById('addressModal');
    if (!addressModalElement) {
      console.error('addressModal bulunamadı!');
      return;
    }
    const addressModal = new bootstrap.Modal(addressModalElement);
    const form = document.querySelector('#addressForm');
    const modalTitle = document.getElementById('addressModalLabel');
    const currentUser = safeParseJSON('currentUser');

    if (index !== null && currentUser.addresses && currentUser.addresses[index]) {
      modalTitle.textContent = 'Adresi Düzenle';
      const address = currentUser.addresses[index];
      form.querySelector('#fullName').value = address.fullName || '';
      form.querySelector('#address').value = address.address || '';
      form.querySelector('#phone').value = address.phoneNumber || '';
      form.dataset.index = index;
    } else {
      modalTitle.textContent = 'Yeni Adres Ekle';
      form.reset();
      delete form.dataset.index;
    }

    ['fullName', 'address', 'phone'].forEach(field => {
      const input = form.querySelector(`#${field}`);
      if (input) input.classList.remove('is-invalid');
    });

    addressModal.show();
  }

  function saveAddress(event) {
    event.preventDefault();
    const form = event.target;
    const fullNameInput = form.querySelector('#fullName');
    const addressInput = form.querySelector('#address');
    const phoneInput = form.querySelector('#phone');

    const fullName = fullNameInput.value.trim();
    const address = addressInput.value.trim();
    const phone = phoneInput.value.trim();

    let isValid = true;
    if (!fullName) {
      fullNameInput.classList.add('is-invalid');
      isValid = false;
    } else {
      fullNameInput.classList.remove('is-invalid');
    }

    if (!address) {
      addressInput.classList.add('is-invalid');
      isValid = false;
    } else {
      addressInput.classList.remove('is-invalid');
    }

    if (!phone.match(/^\d{10}$/)) {
      phoneInput.classList.add('is-invalid');
      isValid = false;
    } else {
      phoneInput.classList.remove('is-invalid');
    }

    if (!isValid) return;

    let currentUser = safeParseJSON('currentUser');
    let users = safeParseJSON('users', []);
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    if (userIndex === -1) {
      alert('Kullanıcı bulunamadı!');
      return;
    }

    if (!currentUser.addresses) {
      currentUser.addresses = [];
    }

    const addressData = {
      fullName: fullName,
      address: address,
      phoneNumber: phone
    };

    const formIndex = parseInt(form.dataset.index);
    if (!isNaN(formIndex)) {
      currentUser.addresses[formIndex] = addressData;
      alert('Adres güncellendi!');
    } else {
      currentUser.addresses.push(addressData);
      alert('Adres eklendi!');
    }

    users[userIndex] = { ...currentUser };
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    const addressModalInstance = bootstrap.Modal.getInstance(document.getElementById('addressModal'));
    if (addressModalInstance) addressModalInstance.hide();
    form.reset();
    displayAddresses();
  }

  function deleteAddress(index) {
    if (!confirm('Bu adresi silmek istediğinize emin misiniz?')) return;

    let currentUser = safeParseJSON('currentUser');
    let users = safeParseJSON('users', []);
    const userIndex = users.findIndex(u => u.email === currentUser.email);

    if (userIndex === -1) {
      alert('Kullanıcı bulunamadı!');
      return;
    }

    currentUser.addresses.splice(index, 1);
    users[userIndex] = { ...currentUser };
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    alert('Adres silindi!');
    displayAddresses();
  }

  function loadSavedAddresses() {
    const savedAddresses = document.getElementById('savedAddresses');
    if (!savedAddresses) return;

    const currentUser = safeParseJSON('currentUser');
    const addresses = currentUser.addresses || [];

    savedAddresses.innerHTML = '';
    if (addresses.length === 0) {
      savedAddresses.innerHTML = '<p class="text-muted small">Kayıtlı adres yok.</p>';
      return;
    }

    savedAddresses.innerHTML = '<h6>Kayıtlı Adresler</h6>';
    addresses.forEach((address, index) => {
      const button = document.createElement('button');
      button.className = 'btn btn-outline-primary btn-sm mb-2 me-2';
      button.textContent = `${escapeHTML(address.fullName)} - ${escapeHTML(address.address)}`;
      button.setAttribute('data-index', index);
      button.addEventListener('click', () => {
        const form = document.querySelector('#addressForm');
        if (form) {
          form.querySelector('#fullName').value = address.fullName || '';
          form.querySelector('#address').value = address.address || '';
          form.querySelector('#phone').value = address.phoneNumber || '';
        }
      });
      savedAddresses.appendChild(button);
    });
  }

  sepet = new Sepet();
  const currentLoggedInUser = safeParseJSON('currentUser');

  if (isLoggedIn === 'true') {
    if (navbarButtons) {
      navbarButtons.innerHTML = `
        <button class="btn btn-outline-light btn-sm btn-icon-only" data-bs-toggle="modal" data-bs-target="#profileModal" title="Profil">
          <i class="bi bi-person"></i>
        </button>
        ${currentLoggedInUser.role === 'admin' ? '<a href="urun-ekle-sil.html" class="btn btn-outline-light btn-sm btn-icon-only" title="Admin Paneli"><i class="fas fa-user-shield"></i></a>' : ''}
        <button class="btn btn-outline-light btn-sm btn-icon-only" onclick="logout()" title="Çıkış Yap">
          <i class="bi bi-box-arrow-right"></i>
        </button>
        <button class="btn btn-light position-relative btn-sm btn-icon-only" onclick="window.location.href='cart.html';" title="Sepet">
          <i class="bi bi-cart3"></i>
          <span id="cartBadge" class="cart-badge badge bg-danger rounded-pill">0</span>
        </button>
        <button class="btn btn-light btn-sm btn-icon-only" type="button" data-bs-toggle="offcanvas" data-bs-target="#kategoriOffcanvas" aria-controls="kategoriOffcanvas" title="Kategoriler">
          <i class="bi bi-list"></i>
        </button>
      `;
    }
    const profileUsername = document.getElementById('profileUsername');
    const profileEmail = document.getElementById('profileEmail');
    if (profileUsername && profileEmail) {
      profileUsername.value = escapeHTML(currentLoggedInUser.username || currentLoggedInUser.email || '');
      profileEmail.value = escapeHTML(currentLoggedInUser.email || '');
    }
  } else {
    if (navbarButtons) {
      navbarButtons.innerHTML = `
        <a href="kayit.html" class="btn btn-outline-light btn-sm btn-icon-only" title="Kayıt Ol"><i class="bi bi-person-plus"></i></a>
        <a href="login.html" class="btn btn-outline-light btn-sm btn-icon-only" title="Giriş Yap"><i class="bi bi-box-arrow-in-right"></i></a>
        <button class="btn btn-light position-relative btn-sm btn-icon-only" onclick="window.location.href='cart.html';" title="Sepet">
          <i class="bi bi-cart3"></i>
          <span id="cartBadge" class="cart-badge badge bg-danger rounded-pill">0</span>
        </button>
        <button class="btn btn-light btn-sm btn-icon-only" type="button" data-bs-toggle="offcanvas" data-bs-target="#kategoriOffcanvas" aria-controls="kategoriOffcanvas" title="Kategoriler">
          <i class="bi bi-list"></i>
        </button>
      `;
    }
  }

  urunleriGoster();
  kategoriMenusuGuncelle();
  loadVitrins();

  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const currentPassword = document.getElementById('currentPassword');
      const newPassword = document.getElementById('newPassword');
      const confirmNewPassword = document.getElementById('confirmNewPassword');

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        console.error("Şifre değiştirme formunda eksik input alanları!");
        return;
      }

      [currentPassword, newPassword, confirmNewPassword].forEach(field => {
        field.classList.remove('is-invalid');
      });

      let isValid = true;
      const updatedCurrentUser = safeParseJSON('currentUser');

      if (currentPassword.value !== updatedCurrentUser.password) {
        currentPassword.classList.add('is-invalid');
        isValid = false;
        alert('Mevcut şifreniz yanlış!');
      }

      if (newPassword.value.length < 6) {
        newPassword.classList.add('is-invalid');
        isValid = false;
        alert('Yeni şifre en az 6 karakter olmalıdır!');
      }

      if (newPassword.value !== confirmNewPassword.value) {
        confirmNewPassword.classList.add('is-invalid');
        isValid = false;
        alert('Yeni şifreler eşleşmiyor!');
      }

      if (!isValid) return;

      let users = safeParseJSON('users', []);
      const userIndex = users.findIndex(u => u.email === updatedCurrentUser.email);
      if (userIndex !== -1) {
        users[userIndex].password = newPassword.value;
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
        alert('Şifre başarıyla değiştirildi!');
        const profileModalInstance = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
        if (profileModalInstance) profileModalInstance.hide();
        currentPassword.value = '';
        newPassword.value = '';
        confirmNewPassword.value = '';
      }
    });
  }

  const addressForm = document.getElementById('addressForm');
  if (addressForm) {
    addressForm.addEventListener('submit', saveAddress);
  }

  const addAddressBtn = document.getElementById('addAddressBtn');
  if (addAddressBtn) {
    addAddressBtn.addEventListener('click', () => openAddressModal());
  }

  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    profileModal.addEventListener('show.bs.modal', () => {
      displayOrders();
      displayAddresses();
    });
  }

  const addressModal = document.getElementById('addressModal');
  if (addressModal) {
    addressModal.addEventListener('show.bs.modal', loadSavedAddresses);
  }

  const newsletterForm = document.querySelector('.newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      if (!emailInput) {
        console.error("E-posta bülteni formunda e-posta alanı bulunamadı!");
        return;
      }
      const email = emailInput.value.trim();
      if (email) {
        let subscribers = safeParseJSON('subscribers', []);
        if (!subscribers.includes(email)) {
          subscribers.push(email);
          localStorage.setItem('subscribers', JSON.stringify(subscribers));
          alert('Bültene başarıyla abone oldunuz!');
          newsletterForm.reset();
        } else {
          alert('Bu e-posta zaten abone!');
        }
      } else {
        alert('Lütfen geçerli bir e-posta adresi girin.');
      }
    });
  }

  const searchBtn = document.getElementById('searchBtn');
  const productSearch = document.getElementById('productSearch');

  if (searchBtn) {
    searchBtn.addEventListener('click', urunleriAra);
  }

  if (productSearch) {
    productSearch.addEventListener('keyup', function (e) {
      if (e.key === 'Enter') {
        urunleriAra();
      }
    });
  }

  function urunleriAra() {
    const searchValue = productSearch ? productSearch.value.trim() : '';
    urunleriGoster(null, searchValue);
  }

  let lastScrollY = 0;
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.innerWidth <= 768) {
        if (window.scrollY > lastScrollY && window.scrollY > navbar.offsetHeight) {
          navbar.style.transform = 'translateY(-100%)';
          navbar.style.transition = 'transform 0.3s ease-out';
        } else {
          navbar.style.transform = 'translateY(0)';
          navbar.style.transition = 'transform 0.3s ease-in';
        }
      } else {
        navbar.style.transform = 'translateY(0)';
      }
      lastScrollY = window.scrollY;
    });
  }
});