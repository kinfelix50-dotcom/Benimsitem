<script>
    let urunler = [];
    let kategoriler = [];
    let vitrinler = [];
    let siparisler = [];
    let duzenlenenUrunId = null;
    let duzenlenenVitrinId = null;
    const { jsPDF } = window.jspdf;

       // Güvenli JSON ayrıştırma (Geliştirilmiş Versiyon)
    function safeParseJSON(key, defaultValue) {
      try {
        const data = localStorage.getItem(key);
        if (data === null || data === undefined || data === "undefined") {
            // Veri bulunamadığında veya "undefined" stringi olduğunda uyarı ver
            console.warn(`safeParseJSON: Anahtar '${key}' bulunamadı veya 'undefined' stringi. Varsayılan değer döndürülüyor.`);
            return defaultValue;
        }
        const parsedData = JSON.parse(data);
        if (parsedData === null || parsedData === undefined) {
            // Ayrıştırılan veri null/undefined ise uyarı ver
            console.warn(`safeParseJSON: Anahtar '${key}' için ayrıştırılan veri boş/tanımsız. Varsayılan değer döndürülüyor. Ham veri:`, data);
            return defaultValue;
        }
        return parsedData;
      } catch (err) {
        // Ayrıştırma hatası durumunda daha detaylı bilgi logla
        const problematicData = localStorage.getItem(key);
        console.error(`safeParseJSON Hata: '${key}' anahtarı ayrıştırılamadı. Hata:`, err, `Sorunlu Veri:`, problematicData);
        bildirimGoster(`Veri hatası: '${key}' yüklenemedi. Konsolu kontrol edin.`, 'danger');
        return defaultValue;
      }
    }

    // HTML karakterlerini güvenli hale getir
    function escapeHTML(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')
        .replace(/\\/g, '\\\\');
    }

    // Ürün detayını paragraflara böl
    function formatDescriptionToParagraphs(text) {
      if (!text || text.trim() === '') return '<p class="text-muted">Detay açıklama yok</p>';
      return text.split('\n')
        .filter(line => line.trim())
        .map(line => `<p>${escapeHTML(line.trim())}</p>`)
        .join('');
    }

    // İndirimli fiyat hesapla
    function calculateDiscountedPrice(fiyat, indirim) {
      fiyat = Number(fiyat) || 0;
      indirim = Number(indirim) || 0;
      if (isNaN(fiyat) || fiyat < 0) return 0;
      if (indirim < 0 || indirim > 100) return fiyat;
      return indirim ? fiyat * (1 - indirim / 100) : fiyat;
    }

    // --- Sipariş Yönetimi (PDF Kısmı) ---
    function printOrderAsPDF(orderId) {
  try {
    let orders = safeParseJSON('orders', []);
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      bildirimGoster('Sipariş bulunamadı!', 'danger');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Font setup
    doc.addFileToVFS("DejaVuSans.ttf", DejaVuSans);
    doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
    doc.setFont("DejaVuSans");

    doc.addFileToVFS("DejaVu Sans Bold.ttf", DejaVuSans);
    doc.addFont("DejaVu Sans Bold.ttf", "DejaVuSans", "bold");
    doc.setFont("DejaVu Sans Bold");

    const primaryColor = '#007bff';
    const secondaryColor = '#6c757d';
    const textColor = '#343a00';
    const lightBgColor = '#f8f9fa';

    let currentY = 20;
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.width;
    const availableWidth = pageWidth - (2 * marginX);
    const maxTextWidthForSplit = availableWidth / 2 - 10;
    const defaultLineHeight = 5;

    // Header
    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(24);
    doc.setTextColor(primaryColor);
    doc.text('MehtapStore', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    // Info box
    doc.setFillColor(lightBgColor);
    doc.rect(marginX, currentY - 5, availableWidth, 45, 'F');

    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.text('Müşteri Bilgileri', marginX + 5, currentY);
    doc.text('Sipariş Bilgileri', pageWidth / 2 + 54, currentY);
    currentY += 8;

    const customerInfoX = marginX + 5;
    const orderInfoRightEdgeX = pageWidth - marginX - 5;

    let tempCurrentY = currentY;
    const customerFullName = escapeHTML(order.fullName || 'Belirtilmemiş');
    const splitFullName = doc.splitTextToSize(customerFullName, maxTextWidthForSplit);
    doc.text(splitFullName, customerInfoX, tempCurrentY);
    tempCurrentY += splitFullName.length * defaultLineHeight;

    const customerPhone = `Telefon: ${escapeHTML(order.phone || 'Belirtilmemiş')}`;
    const splitPhone = doc.splitTextToSize(customerPhone, maxTextWidthForSplit);
    doc.text(splitPhone, customerInfoX, tempCurrentY);
    tempCurrentY += splitPhone.length * defaultLineHeight;

    const customerAddress = `Adres: ${escapeHTML(order.address || 'Belirtilmemiş')}`;
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

    // Product table
    const tableData = [];
    let totalOriginalPrice = 0;
    let totalDiscountAmount = 0;
    let totalNetPrice = 0;

    const urunler = safeParseJSON('urunler', []);
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const urun = urunler.find(u => u.id === item.id);
        const originalPrice = Number(urun?.fiyat || item.fiyat);
        const indirimOrani = Number(item.indirim) || 0;
        const netFiyat = Number(item.fiyat);
        const adet = Number(item.adet) || 0;
        const indirimTutari = (originalPrice - netFiyat) * adet;
        totalOriginalPrice += originalPrice * adet;
        totalDiscountAmount += indirimTutari;
        totalNetPrice += netFiyat * adet;

        const productName = escapeHTML(item.ad || '');

        tableData.push([
          productName,
          `${adet}`,
          `${originalPrice.toFixed(2)} TL`,
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
        font: 'DejaVuSans',
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
        3: { cellWidth: 17, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' }
      },
      didDrawPage: function(data) {
        doc.setFont('DejaVuSans', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor);
        doc.text(`Sayfa ${doc.internal.getNumberOfPages()}`, pageWidth - marginX, doc.internal.pageSize.height - 10, {
          align: 'right'
        });
      }
    });

    currentY = doc.autoTable.previous.finalY + 10;

    doc.setFont('DejaVuSans', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(textColor);

    const summaryRightAlignX = pageWidth - marginX - 3;
    const summaryLineHeight = 8;

    const totalOriginalPriceText = `Genel Toplam: ${totalOriginalPrice.toFixed(2)} TL`;
    const totalDiscountAmountText = `Toplam İndirim: ${totalDiscountAmount.toFixed(2)} TL`;
    const totalNetPriceText = `Kalan Net Tutar: ${totalNetPrice.toFixed(2)} TL`;

    doc.text(totalOriginalPriceText, summaryRightAlignX - doc.getTextWidth(totalOriginalPriceText), currentY);
    currentY += summaryLineHeight;
    doc.text(totalDiscountAmountText, summaryRightAlignX - doc.getTextWidth(totalDiscountAmountText), currentY);
    currentY += summaryLineHeight;
    doc.text(totalNetPriceText, summaryRightAlignX - doc.getTextWidth(totalNetPriceText), currentY);

    doc.save(`siparis_${escapeHTML(orderId)}.pdf`);
  } catch (err) {
    console.error('PDF oluşturma hatası:', err);
    bildirimGoster('PDF oluşturulamadı!', 'danger');
  }
}
    
    

    // Verileri yükle
    function loadData() {
      try {
        urunler = safeParseJSON('urunler', []);
        urunler.forEach(urun => {
          delete urun.isNew; // isNew özelliğini kaldırın, eğer önceden eklenmişse
          urun.anasayfadaGoster = !!urun.anasayfadaGoster;
          urun.yeniUrun = !!urun.yeniUrun;
          urun.ucretsizKargo = !!urun.ucretsizKargo;
        });
        localStorage.setItem('urunler', JSON.stringify(urunler)); // Güncellenmiş ürünü geri kaydet

        kategoriler = safeParseJSON('kategoriler', []);
        vitrinler = safeParseJSON('vitrinler', []);
        siparisler = safeParseJSON('orders', []);
      } catch (err) {
        console.error('Veri yükleme hatası:', err);
        bildirimGoster('Veriler yüklenirken hata oluştu!', 'danger');
        urunler = [];
        kategoriler = [];
        vitrinler = [];
        siparisler = [];
      }
    }

    // Bildirim göster
    function bildirimGoster(mesaj, tip = 'success') {
      const bildirimAlani = document.getElementById('bildirimAlani');
      if (!bildirimAlani) return;
      bildirimAlani.innerHTML = `
        <div class="alert alert-${tip} alert-dismissible fade show" role="alert">
          ${escapeHTML(mesaj)}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
      bildirimAlani.classList.remove('d-none');
      setTimeout(() => {
        const alert = bildirimAlani.querySelector('.alert');
        if (alert) new bootstrap.Alert(alert).close();
        bildirimAlani.classList.add('d-none');
      }, 3000);
    }

    // Benzersiz ID oluştur
    function generateUniqueId(prefix = '') {
      return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // Stok kodu oluştur
    function stokKoduOlustur() {
      const mevcutKodlar = urunler.map(u => u.stokKodu || '');
      let maxNum = 0;
      mevcutKodlar.forEach(kod => {
        const num = parseInt(kod.replace('STK-', '')) || 0;
        if (num > maxNum) maxNum = num;
      });
      return `STK-${(maxNum + 1).toString().padStart(4, '0')}`;
    }

    // Ürün satırı oluştur (Tablo için)
    function olusturUrunSatiri(urun) {
      const indirimliFiyat = calculateDiscountedPrice(urun.fiyat, urun.indirim);
      let etiketlerHtml = '';
      if (urun.yeniUrun) etiketlerHtml += `<span class="badge bg-info me-1">Yeni Ürün</span>`;
      if (urun.ucretsizKargo) etiketlerHtml += `<span class="badge bg-success me-1">Ücretsiz Kargo</span>`;

      return `
        <tr>
          <td><img src="${escapeHTML(urun.resim)}" class="urun-row-img" alt="${escapeHTML(urun.ad)}" onerror="this.src='https://via.placeholder.com/45'"></td>
          <td>
            ${escapeHTML(urun.ad)}
            <div class="mt-1">${etiketlerHtml}</div>
          </td>
          <td>
            <span class="${urun.indirim ? 'text-decoration-line-through text-muted' : ''}">₺${urun.fiyat.toFixed(2)}</span>
            ${urun.indirim ? `<br><span class="text-danger">₺${indirimliFiyat.toFixed(2)}</span>` : ''}
          </td>
          <td>${urun.indirim ? `<span class="badge bg-danger">${urun.indirim}%</span>` : '-'}</td>
          <td>${urun.stok}</td>
          <td>${escapeHTML(urun.stokKodu || 'Yok')}</td>
          <td><span class="badge bg-${urun.anasayfadaGoster ? 'success' : 'secondary'}">${urun.anasayfadaGoster ? 'Evet' : 'Hayır'}</span></td>
          <td class="detay-column">
            ${urun.detay ? `
              <div class="text-muted small">${escapeHTML(urun.detay.substr(0, 50))}${urun.detay.length > 50 ? '...' : ''}</div>
              <button type="button" class="btn btn-link btn-sm detay-btn" data-id="${escapeHTML(urun.id)}">Detaylar</button>
            ` : '-'}
          </td>
          <td>
            <button type="button" class="btn btn-primary btn-sm me-1 duzenle-btn" data-id="${escapeHTML(urun.id)}"><i class="fas fa-edit"></i></button>
            <button type="button" class="btn btn-danger btn-sm sil-btn" data-id="${escapeHTML(urun.id)}"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
    }

    // Ürün detayı göster
    function detayGoster(urunId) {
      const urun = urunler.find(u => u.id === urunId);
      if (urun) {
        const modal = new bootstrap.Modal(document.getElementById('detayModal'));
        document.getElementById('detayModalIcerik').innerHTML = formatDescriptionToParagraphs(urun.detay);
        modal.show();
      }
    }

    // Ürünleri listele (Kategorilere göre akordeon yapısında)
    function urunleriGoster(filtre = '') {
      const urunlerListesiDiv = document.getElementById('urunlerListesi');
      const baslik = document.getElementById('urunListesiBaslik');
      if (!urunlerListesiDiv || !baslik) return;

      urunlerListesiDiv.innerHTML = '';
      let filtrelenmisUrunler = urunler;

      if (filtre) {
        const arama = filtre.toLowerCase();
        filtrelenmisUrunler = urunler.filter(u =>
          (u.ad && u.ad.toLowerCase().includes(arama)) || (u.stokKodu && u.stokKodu.toLowerCase().includes(arama))
        );
        baslik.textContent = 'Arama Sonuçları';
      } else {
        baslik.textContent = 'Kategorilere Göre';
      }

      if (!filtrelenmisUrunler.length) {
        urunlerListesiDiv.innerHTML = '<p class="text-muted text-center">Ürün bulunmamaktadır.</p>';
        return;
      }

      const accordionContainer = document.createElement('div');
      accordionContainer.id = 'urunKategoriAccordion';
      accordionContainer.className = 'accordion';

      const kategoriMap = new Map();
      kategoriler.forEach(k => kategoriMap.set(k, [])); // Mevcut kategorileri ekle
      // "Diğer" kategorisi için bir giriş olduğundan emin olun
      if (!kategoriMap.has('Diğer')) {
          kategoriMap.set('Diğer', []);
      }

      filtrelenmisUrunler.forEach(u => {
        const kat = u.kategori && kategoriMap.has(u.kategori) ? u.kategori : 'Diğer';
        kategoriMap.get(kat).push(u);
      });

      // Kategori başlıklarını alfabetik sıraya göre sırala
      Array.from(kategoriMap.keys()).sort((a, b) => {
        if (a === 'Diğer') return 1; // "Diğer" en sona
        if (b === 'Diğer') return -1;
        return a.localeCompare(b);
      }).forEach((kategori, index) => {
        const urunlerBuKategoride = kategoriMap.get(kategori);
        if (urunlerBuKategoride.length > 0) {
          const accordionItem = document.createElement('div');
          accordionItem.className = 'accordion-item';
          const headerId = `heading${index}`;
          const collapseId = `collapse${index}`;
          const isCollapsed = !filtre; // Arama yapıldığında otomatik açılması için
          const expanded = filtre ? 'true' : 'false';
          const showClass = filtre ? 'show' : '';

          accordionItem.innerHTML = `
            <h2 class="accordion-header" id="${headerId}">
              <button class="accordion-button ${isCollapsed ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${expanded}" aria-controls="${collapseId}">
                ${escapeHTML(kategori)} (${urunlerBuKategoride.length} Ürün)
              </button>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse ${showClass}" aria-labelledby="${headerId}" data-bs-parent="#urunKategoriAccordion">
              <div class="accordion-body p-0">
                <table class="table table-hover urun-table mb-0">
                  <thead>
                    <tr>
                      <th>Resim</th>
                      <th>Ürün Adı</th>
                      <th>Fiyat</th>
                      <th>İndirim</th>
                      <th>Stok</th>
                      <th>Stok Kodu</th>
                      <th>Anasayfada</th>
                      <th>Detay</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${urunlerBuKategoride.map(u => olusturUrunSatiri(u)).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
          accordionContainer.appendChild(accordionItem);
        }
      });

      urunlerListesiDiv.appendChild(accordionContainer);

      document.querySelectorAll('.detay-btn').forEach(btn => {
        btn.addEventListener('click', () => detayGoster(btn.dataset.id));
      });
      document.querySelectorAll('.duzenle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          urunDuzenle(btn.dataset.id);
        });
      });
      document.querySelectorAll('.sil-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          urunSil(btn.dataset.id);
        });
      });
    }

       // Vitrin bloklarını göster (REVİZE EDİLDİ - SADECE MANUEL VİTRİNLER GÖSTERİLİR)
    function vitrinBloklariGoster() {
      const vitrinListesi = document.getElementById('vitrinListesi');
      if (!vitrinListesi) return;

      vitrinListesi.innerHTML = ''; // Önceki içeriği temizle
      let hasContent = false;
      const accordionContainer = document.createElement('div');
      accordionContainer.id = 'vitrinAccordion';
      accordionContainer.className = 'accordion';

      // 1. Oluşturulmuş Vitrinler (Bu kısım, admin panelinde sizin manuel olarak oluşturduğunuz vitrinleri gösterir)
      vitrinler.forEach((v, index) => {
        const vitrinUrunleri = urunler.filter(u => v.urunIds.includes(u.id));

        // Yalnızca vitrin ürünleri varsa göster
        if (vitrinUrunleri.length > 0) {
          hasContent = true;
          const accordionItem = document.createElement('div');
          accordionItem.className = 'accordion-item mb-2'; // Her akordiyon itemi arasına boşluk

          const headerId = `vitrinHeading${index}`;
          const collapseId = `vitrinCollapse${index}`;

          // Ürün listesini HTML olarak oluştur
          let urunListHtml = '';
          vitrinUrunleri.forEach(u => {
            const indirimliFiyat = calculateDiscountedPrice(u.fiyat, u.indirim);
            urunListHtml += `
              <li class="list-group-item d-flex align-items-center p-2">
                <img src="${escapeHTML(u.resim)}" class="vitrin-urun-img me-3" alt="${escapeHTML(u.ad)}" onerror="this.src='https://via.placeholder.com/45'">
                <div class="flex-grow-1">
                  <h6 class="mb-0">${escapeHTML(u.ad)}</h6>
                  <p class="mb-0 text-muted small">
                    ${u.indirim > 0 ? `<span class="text-decoration-line-through me-1">₺${u.fiyat.toFixed(2)}</span>` : ''}
                    <span class="fw-bold text-success">₺${indirimliFiyat.toFixed(2)}</span>
                    <span class="badge bg-secondary ms-2">${escapeHTML(u.kategori)}</span>
                    ${u.stok > 0 ? `<span class="badge bg-primary ms-2">Stok: ${u.stok}</span>` : `<span class="badge bg-danger ms-2">Stok Yok</span>`}
                  </p>
                </div>
              </li>`;
          });

          accordionItem.innerHTML = `
            <h2 class="accordion-header" id="${headerId}">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                ${escapeHTML(v.ad)} (${vitrinUrunleri.length} Ürün)
                <div class="ms-auto me-3">
                  <button type="button" class="btn btn-primary btn-sm me-2 vitrin-duzenle-btn" data-id="${escapeHTML(v.id)}" onclick="event.stopPropagation();"><i class="fas fa-edit"></i> Düzenle</button>
                  <button type="button" class="btn btn-danger btn-sm vitrin-sil-btn" data-id="${escapeHTML(v.id)}" onclick="event.stopPropagation();"><i class="fas fa-trash"></i> Sil</button>
                </div>
              </button>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headerId}" data-bs-parent="#vitrinAccordion">
              <div class="accordion-body p-0">
                <ul class="list-group list-group-flush">
                    ${urunListHtml}
                </ul>
              </div>
            </div>
          `;
          accordionContainer.appendChild(accordionItem);
        }
      });

      // Eski "Anasayfada Öne Çıkanlar" bölümü artık burada YOKTUR.
      // Bu sayede sadece manuel oluşturduğunuz vitrinler listelenecektir.

      vitrinListesi.appendChild(accordionContainer);

      if (!hasContent) {
        vitrinListesi.innerHTML = '<p class="text-muted text-center">Henüz vitrin bulunmamaktadır.</p>';
      }

      // Event listener'ları burada ekle
      document.querySelectorAll('.vitrin-duzenle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            vitrinDuzenle(btn.dataset.id);
        });
      });
      document.querySelectorAll('.vitrin-sil-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            vitrinSil(btn.dataset.id);
        });
      });
    }


    // Siparişleri listele
    function siparisleriGoster() {
      const liste = document.getElementById('siparisListesi');
      if (!liste) return;
      liste.innerHTML = '<p class="text-muted">Siparişler yükleniyor...</p>';
      if (!siparisler.length) {
        liste.innerHTML = '<p class="text-muted">Henüz sipariş bulunmamaktadır.</p>';
        return;
      }

      // Geçerli siparişleri doğrula
      const validSiparisler = siparisler.filter(s => s.id && s.date && Array.isArray(s.items));
      if (validSiparisler.length !== siparisler.length) {
        console.warn('Geçersiz siparişler tespit edildi:', siparisler.filter(s => !s.id || !s.date || !Array.isArray(s.items)));
        bildirimGoster('Bazı siparişler hatalı, yalnızca geçerli siparişler gösteriliyor.', 'warning');
      }

      liste.innerHTML = '';
      validSiparisler.forEach((siparis, index) => {
        const id = escapeHTML(siparis.id || 'Bilinmeyen');
        const statusText = {
          pending: 'Beklemede',
          shipped: 'Kargoda',
          delivered: 'Teslim Edildi'
        }[siparis.status] || 'Bilinmeyen Durum';
        const statusBadge = {
          pending: 'bg-warning',
          shipped: 'bg-primary',
          delivered: 'bg-success'
        }[siparis.status] || 'bg-secondary';

        const hesaplananToplam = (siparis.items || []).reduce((sum, item) => {
          const urun = urunler.find(u => u.id === item.id);
          const orijinalFiyat = urun ? Number(urun.fiyat) : Number(item.fiyat) || 0;
          const indirim = Number(item.indirim) || 0;
          const indirimliFiyat = calculateDiscountedPrice(orijinalFiyat, indirim);
          return sum + (item.adet || 1) * indirimliFiyat;
        }, 0);

        const siparisElement = document.createElement('div');
        siparisElement.className = 'accordion-item';
        siparisElement.innerHTML = `
          <h2 class="accordion-header" id="siparisHeading${index}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#siparisCollapse${index}" aria-expanded="false" aria-controls="siparisCollapse${index}">
              Sipariş #${id} - ${siparis.date ? new Date(siparis.date).toLocaleString('tr-TR') : 'Bilinmeyen'} (<span class="badge ${statusBadge}">${statusText}</span>)
            </button>
          </h2>
          <div id="siparisCollapse${index}" class="accordion-collapse collapse" aria-labelledby="siparisHeading${index}" data-bs-parent="#siparisListesi">
            <div class="accordion-body">
              <p><strong>Ad Soyad:</strong> ${escapeHTML(siparis.fullName || 'Belirtilmemiş')}</p>
              <p><strong>Kullanıcı E-posta:</strong> ${escapeHTML(siparis.userEmail || 'Bilinmeyen')}</p>
              <p><strong>Adres:</strong> ${escapeHTML(siparis.address || 'Belirtilmemiş')}</p>
              <p><strong>Telefon:</strong> ${escapeHTML(siparis.phone || 'Belirtilmemiş')}</p>
              <ul class="list-group mb-3">
                ${(siparis.items || []).map(item => {
                  const urun = urunler.find(u => u.id === item.id);
                  const orijinalFiyat = urun ? Number(urun.fiyat) : Number(item.fiyat) || 0;
                  const indirim = Number(item.indirim) || 0;
                  const indirimliFiyat = calculateDiscountedPrice(orijinalFiyat, indirim);
                  return `
                    <li class="list-group-item d-flex align-items-center">
                      <img src="${escapeHTML(item.resim || '')}" class="order-item-img me-3" alt="${escapeHTML(item.ad || 'Bilinmeyen')}" onerror="this.src='https://via.placeholder.com/45'">
                      <div>
                        <h6 class="mb-1">${escapeHTML(item.ad || 'Bilinmeyen')}</h6>
                        <p class="mb-0 text-muted">
                          <small>Adet: ${item.adet || 1}</small><br>
                          <small>Fiyat: ₺${orijinalFiyat.toFixed(2)}</small>
                          ${indirim ? `<br><small>İndirim: %${indirim}</small>` : ''}
                          ${indirim ? `<br><span class="text-warning">İndirimli: ₺${indirimliFiyat.toFixed(2)}</span>` : ''}
                        </p>
                      </div>
                    </li>`;
                }).join('')}
              </ul>
              <p><strong>Toplam:</strong> ₺${hesaplananToplam.toFixed(2)}</p>
              
              
              <div class="text-end">
                <select class="siparis-durum form-select form-select-sm d-inline-block w-auto me-2" data-id="${id}">
                  <option value="" disabled ${!siparis.status ? 'selected' : ''}>Durum Seç</option>
                  <option value="pending" ${siparis.status === 'pending' ? 'selected' : ''}>Beklemede</option>
                  <option value="shipped" ${siparis.status === 'shipped' ? 'selected' : ''}>Kargoda</option>
                  <option value="delivered" ${siparis.status === 'delivered' ? 'selected' : ''}>Teslim Edildi</option>
                </select>
                <button type="button" class="btn btn-info btn-sm me-1 siparis-pdf-btn" data-id="${id}"><i class="fas fa-file-pdf"></i> PDF İndir</button>
                <button type="button" class="btn btn-danger btn-sm siparis-sil-btn" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>`;
        liste.appendChild(siparisElement);
      });

      document.querySelectorAll('.siparis-durum').forEach(select => {
        select.addEventListener('change', e => siparisDurumGuncelle(e.target.dataset.id, e.target.value));
      });
      document.querySelectorAll('.siparis-sil-btn').forEach(btn => {
        btn.addEventListener('click', () => siparisSil(btn.dataset.id));
      });
      document.querySelectorAll('.siparis-pdf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          printOrderAsPDF(btn.dataset.id);
        });
      });
    }

    // Sipariş durumunu güncelle
    function siparisDurumGuncelle(siparisId, yeniDurum) {
      const siparis = siparisler.find(s => s.id === siparisId);
      if (!siparis) {
        bildirimGoster('Sipariş bulunamadı!', 'danger');
        return;
      }
      siparis.status = yeniDurum;
      localStorage.setItem('orders', JSON.stringify(siparisler));
      bildirimGoster(`Sipariş durumu "${yeniDurum === 'pending' ? 'Beklemede' : yeniDurum === 'shipped' ? 'Kargoda' : 'Teslim Edildi'}" olarak güncellendi.`, 'success');
      siparisleriGoster();
      verileriYedekle(); // Durum güncellendiğinde yedekle
    }

    // Sipariş sil
    function siparisSil(siparisId) {
      if (!confirm(`Sipariş ${siparisId} silinsin mi?`)) return;
      const index = siparisler.findIndex(s => s.id === siparisId);
      if (index !== -1) {
        const siparis = siparisler[index];
        // İlgili ürünlerin stoklarını geri ekle
        siparis.items.forEach(item => {
          const u = urunler.find(u => u.id === item.id);
          if (u) {
              u.stok = (u.stok || 0) + (item.adet || 0); // Mevcut stoka ekle
          }
        });
        localStorage.setItem('urunler', JSON.stringify(urunler)); // Ürün stoklarını güncelle

        siparisler.splice(index, 1);
        localStorage.setItem('orders', JSON.stringify(siparisler));
        bildirimGoster('Sipariş silindi ve stoklar güncellendi!', 'success');
        siparisleriGoster();
        urunleriGoster(); // Ürün listesini stok güncellenmesi nedeniyle yenile
        verileriYedekle();
      } else {
        bildirimGoster('Sipariş bulunamadı!', 'danger');
      }
    }

    // Ürün ara
    function urunleriAra() {
      const arama = document.getElementById('urunArama').value.trim();
      urunleriGoster(arama);
      // Arama yapıldığında Ürün Yönetimi sekmesini aktif et
      const urunYonetimiTab = document.getElementById('urunYonetimi');
      const urunTabButton = document.getElementById('urun-tab');
      if (urunYonetimiTab) {
          urunYonetimiTab.classList.add('show', 'active');
          // Diğer tüm tabları ve butonlarını deaktif et
          document.querySelectorAll('.tab-pane').forEach(pane => {
              if (pane.id !== 'urunYonetimi') pane.classList.remove('show', 'active');
          });
          document.querySelectorAll('.nav-link').forEach(link => {
              if (link.id !== 'urun-tab') link.classList.remove('active');
          });
      }
      if (urunTabButton) urunTabButton.classList.add('active');
    }

    // Ürün kaydet
    function urunKaydet(e) {
      e.preventDefault();
      const ad = document.getElementById('urunAd').value.trim();
      const fiyat = parseFloat(document.getElementById('urunFiyat').value);
      const indirim = parseInt(document.getElementById('urunIndirim').value) || 0;
      const resim = document.getElementById('urunResim').value.trim();
      const kategori = document.getElementById('urunKategori').value.trim();
      const stok = parseInt(document.getElementById('urunStok').value);
      const anasayfadaGoster = document.getElementById('anasayfadaGoster').checked;
      const stokKodu = duzenlenenUrunId ? document.getElementById('stokKodu').value.trim() : stokKoduOlustur();
      const detay = document.getElementById('urunDetay').value.trim();
      const yeniUrun = document.getElementById('yeniUrun').checked;
      const ucretsizKargo = document.getElementById('ucretsizKargo').checked;

      if (!ad || isNaN(fiyat) || fiyat <= 0 || !resim || !kategori || isNaN(stok) || stok < 0 || indirim < 0 || indirim > 100) {
        bildirimGoster('Zorunlu alanları doğru doldurun! İndirim 0-100 arası.', 'danger');
        return;
      }

      // Stok kodunun benzersizliğini kontrol et (sadece yeni ürün eklenirken)
      if (!duzenlenenUrunId && urunler.some(u => u.stokKodu === stokKodu)) {
          bildirimGoster('Bu stok kodu zaten kullanımda, lütfen farklı bir kod girin veya boş bırakın.', 'danger');
          return;
      }
       // Düzenleme yaparken, eğer stok kodu değiştirildiyse ve yeni kod başkasına aitse kontrol et
       if (duzenlenenUrunId) {
           const existingProductWithSameStokKodu = urunler.find(u => u.stokKodu === stokKodu && u.id !== duzenlenenUrunId);
           if (existingProductWithSameStokKodu) {
               bildirimGoster('Bu stok kodu başka bir ürüne ait, lütfen farklı bir kod girin.', 'danger');
               return;
           }
       }


      const urun = {
        id: duzenlenenUrunId || generateUniqueId('u-'),
        ad,
        fiyat,
        indirim,
        resim,
        kategori,
        stok,
        stokKodu,
        anasayfadaGoster: !!anasayfadaGoster,
        detay,
        yeniUrun: !!yeniUrun,
        ucretsizKargo: !!ucretsizKargo
      };

      if (duzenlenenUrunId) {
        const i = urunler.findIndex(u => u.id === duzenlenenUrunId);
        if (i !== -1) {
          urunler[i] = urun;
          bildirimGoster('Ürün güncellendi!');
        }
      } else {
        urunler.push(urun);
        bildirimGoster('Ürün eklendi!');
      }

      localStorage.setItem('urunler', JSON.stringify(urunler));
      formuTemizle();
      urunleriGoster();
      vitrinBloklariGoster();
      urunSecenekleriniYukle(); // Vitrin ürün seçeneklerini güncelle
      verileriYedekle();
    }

    // Ürün sil
    function urunSil(id) {
      if (!confirm('Ürün silinsin mi? Bu işlem geri alınamaz!')) return;
      urunler = urunler.filter(u => u.id !== id);
      vitrinler.forEach(v => {
        v.urunIds = v.urunIds.filter(uId => uId !== id); // Silinen ürünü vitrinlerden de çıkar
      });
      // Sepet ve siparişlerdeki ürünü de kontrol edip güncelleyebilirsiniz
      // Sepetteki ürünleri güncelle (örneğin adedini 0 yap veya tamamen sil)
      let sepetItems = safeParseJSON('sepet', []);
      sepetItems = sepetItems.filter(item => item.id !== id);
      localStorage.setItem('sepet', JSON.stringify(sepetItems));

      // Siparişlerdeki ürünleri güncelle (silinen ürünün fiyatını ve adını koruyarak, ama artık mevcut olmadığını işaretleyerek)
      siparisler.forEach(siparis => {
          siparis.items = siparis.items.map(item => {
              if (item.id === id) {
                  return { ...item, ad: `[Silinmiş Ürün] ${item.ad}`, resim: 'https://via.placeholder.com/45/ccc/fff?text=Silindi' };
              }
              return item;
          });
      });
      localStorage.setItem('orders', JSON.stringify(siparisler));

      localStorage.setItem('vitrinler', JSON.stringify(vitrinler));
      localStorage.setItem('urunler', JSON.stringify(urunler));
      bildirimGoster('Ürün silindi!', 'success');
      formuTemizle();
      urunleriGoster();
      vitrinBloklariGoster();
      urunSecenekleriniYukle();
      siparisleriGoster(); // Siparişler de güncellendiği için listeyi yenile
      verileriYedekle();
    }

    // Ürün düzenle
    function urunDuzenle(id) {
      const u = urunler.find(u => u.id === id);
      if (u) {
        duzenlenenUrunId = id;
        document.getElementById('urunAd').value = u.ad;
        document.getElementById('urunFiyat').value = u.fiyat;
        document.getElementById('urunIndirim').value = u.indirim || 0;
        document.getElementById('urunResim').value = u.resim;
        document.getElementById('urunKategori').value = u.kategori;
        document.getElementById('urunStok').value = u.stok;
        document.getElementById('stokKodu').value = u.stokKodu || ''; // Yeni eklenen stokKodu için varsayılan değer
        document.getElementById('anasayfadaGoster').checked = u.anasayfadaGoster;
        document.getElementById('yeniUrun').checked = u.yeniUrun;
        document.getElementById('ucretsizKargo').checked = u.ucretsizKargo;
        document.getElementById('urunDetay').value = u.detay || '';
        document.getElementById('ekleDuzenleBtn').innerHTML = '<i class="fas fa-save me-2"></i>Kaydet';
        document.getElementById('urunFormBaslik').textContent = 'Ürün Düzenle'; // Başlığı güncelle

         // Ürün Yönetimi sekmesini aktif et
        const urunYonetimiTab = document.getElementById('urunYonetimi');
        const urunTabButton = document.getElementById('urun-tab');
        if (urunYonetimiTab) {
            urunYonetimiTab.classList.add('show', 'active');
            document.querySelectorAll('.tab-pane').forEach(pane => {
                if (pane.id !== 'urunYonetimi') pane.classList.remove('show', 'active');
            });
            document.querySelectorAll('.nav-link').forEach(link => {
                if (link.id !== 'urun-tab') link.classList.remove('active');
            });
        }
        if (urunTabButton) urunTabButton.classList.add('active');
      }
    }

    // Formu temizle
    function formuTemizle() {
      document.getElementById('urunForm').reset();
      document.getElementById('urunId').value = ''; // Bu satır aslında gereksiz çünkü ID otomatik oluşturuluyor
      document.getElementById('stokKodu').value = stokKoduOlustur(); // Yeni ürün için otomatik stok kodu oluştur
      document.getElementById('ekleDuzenleBtn').innerHTML = '<i class="fas fa-plus-circle me-2"></i>Ekle';
      document.getElementById('urunFormBaslik').textContent = 'Yeni Ürün Ekle'; // Başlığı sıfırla
      duzenlenenUrunId = null;
    }

    // Kategorileri yükle
    function kategorileriYukle() {
      const select = document.getElementById('urunKategori');
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Kategori Seç</option>';
      kategoriler.forEach(k => {
        const option = document.createElement('option');
        option.value = k;
        option.textContent = k;
        select.appendChild(option);
      });

      const kategoriListesi = document.getElementById('kategoriListesi');
      if (!kategoriListesi) return;
      kategoriListesi.innerHTML = '';
      if (!kategoriler.length) {
        kategoriListesi.innerHTML = '<p class="text-muted text-center">Kategori bulunmamaktadır.</p>';
        return;
      }

      kategoriler.forEach(k => {
        const li = document.createElement('li');
        li.className = 'list-group-item kategori-list-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
          ${escapeHTML(k)}
          <div>
            <button type="button" class="btn btn-primary btn-sm me-1 kategori-duzenle-btn" data-kategori="${escapeHTML(k)}"><i class="fas fa-edit"></i></button>
            <button type="button" class="btn btn-danger btn-sm kategori-sil-btn" data-kategori="${escapeHTML(k)}"><i class="fas fa-trash"></i></button>
          </div>`;
        kategoriListesi.appendChild(li);
      });

      document.querySelectorAll('.kategori-duzenle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const kategori = btn.dataset.kategori;
          document.getElementById('duzenlenenKategori').value = kategori;
          document.getElementById('eskiKategori').value = kategori;
          new bootstrap.Modal(document.getElementById('kategoriDuzenleModal')).show();
        });
      });
      document.querySelectorAll('.kategori-sil-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const kategori = btn.dataset.kategori;
          if (urunler.some(u => u.kategori === kategori)) {
            bildirimGoster('Bu kategoriye ait ürünler var, önce onları silin veya kategoriyi değiştirin!', 'danger');
            return;
          }
          if (confirm(`"${kategori}" kategorisi silinsin mi?`)) {
            kategoriler = kategoriler.filter(k => k !== kategori);
            localStorage.setItem('kategoriler', JSON.stringify(kategoriler));
            kategorileriYukle();
            bildirimGoster('Kategori silindi!', 'success');
            verileriYedekle();
          }
        });
      });
    }

    // Kategori ekle
    function kategoriEkle() {
      const yeniKategori = document.getElementById('yeniKategori').value.trim();
      if (!yeniKategori) {
        bildirimGoster('Kategori adı girin!', 'danger');
        return;
      }
      if (kategoriler.includes(yeniKategori)) {
        bildirimGoster('Bu kategori zaten var!', 'danger');
        return;
      }
      kategoriler.push(yeniKategori);
      localStorage.setItem('kategoriler', JSON.stringify(kategoriler));
      document.getElementById('yeniKategori').value = '';
      kategorileriYukle();
      bildirimGoster('Kategori eklendi!', 'success');
      verileriYedekle();
    }
    

   // Kategori düzenle
function kategoriDuzenle() {
  const eskiKategori = document.getElementById('eskiKategori').value;
  const yeniKategori = document.getElementById('duzenlenenKategori').value.trim();
  if (!yeniKategori) {
    bildirimGoster('Yeni kategori adı girin!', 'danger');
    return;
  }
  if (kategoriler.includes(yeniKategori) && yeniKategori !== eskiKategori) { // <-- This is the problematic line
    bildirimGoster('Bu kategori zaten var!', 'danger');
    return;
  }
  const index = kategoriler.indexOf(eskiKategori);
  if (index !== -1) {
    kategoriler[index] = yeniKategori;
    urunler.forEach(u => {
      if (u.kategori === eskiKategori) u.kategori = yeniKategori;
    });
    localStorage.setItem('kategoriler', JSON.stringify(kategoriler));
    localStorage.setItem('urunler', JSON.stringify(urunler));
    kategorileriYukle();
    urunleriGoster();
    bildirimGoster('Kategori güncellendi!', 'success');
    new bootstrap.Modal(document.getElementById('kategoriDuzenleModal')).hide();
    verileriYedekle();
  }
}


        // Vitrin ürün seçeneklerini yükle
    function urunSecenekleriniYukle() {
      const vitrinUrunSecimi = document.getElementById('vitrinUrunSecimi');
      if (!vitrinUrunSecimi) return;
      vitrinUrunSecimi.innerHTML = '';
      if (urunler.length === 0) {
        vitrinUrunSecimi.innerHTML = '<p class="text-muted text-center">Henüz ürün bulunmamaktadır. Vitrin oluşturmak için ürün ekleyin.</p>';
        return;
      }
      urunler.forEach(u => {
        const indirimliFiyat = calculateDiscountedPrice(u.fiyat, u.indirim);
        // İndirim etiketi için HTML
        const indirimEtiketi = u.indirim > 0 ? `<span class="badge bg-danger ms-2">İndirimli (%${u.indirim})</span>` : '';

        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
          <input class="form-check-input vitrin-urun-checkbox" type="checkbox" value="${escapeHTML(u.id)}" id="vitrinUrun${escapeHTML(u.id)}">
          <label class="form-check-label" for="vitrinUrun${escapeHTML(u.id)}">
            ${escapeHTML(u.ad)} (₺${indirimliFiyat.toFixed(2)}) - Stok: ${u.stok}
            ${indirimEtiketi} 
          </label>`;
        vitrinUrunSecimi.appendChild(div);
      });
    }


    // Vitrin kaydet
    function vitrinKaydet(e) {
      e.preventDefault();
      try {
        const adInput = document.getElementById('vitrinAdi');
        const seciliUrunlerCheckboxes = document.querySelectorAll('.vitrin-urun-checkbox:checked');

        const ad = adInput.value.trim();
        const seciliUrunler = Array.from(seciliUrunlerCheckboxes).map(cb => cb.value);

        if (!ad) {
          bildirimGoster('Vitrin adı boş olamaz!', 'danger');
          adInput.focus();
          return;
        }
        if (seciliUrunler.length === 0) {
          bildirimGoster('Lütfen vitrine en az bir ürün seçin!', 'danger');
          return;
        }

        const isNewVitrin = duzenlenenVitrinId === null;

        if (isNewVitrin && vitrinler.some(v => v.ad.toLowerCase() === ad.toLowerCase())) {
            bildirimGoster('Bu isimde bir vitrin zaten var! Lütfen farklı bir isim girin.', 'danger');
            adInput.focus();
            return;
        }
        // Düzenleme modunda, isim değişikliği yapıldıysa ve yeni isim başka bir vitrine aitse kontrol et
        if (!isNewVitrin) {
            const existingVitrin = vitrinler.find(v => v.id === duzenlenenVitrinId);
            if (existingVitrin && existingVitrin.ad.toLowerCase() !== ad.toLowerCase()) {
                if (vitrinler.some(v => v.ad.toLowerCase() === ad.toLowerCase() && v.id !== duzenlenenVitrinId)) {
                    bildirimGoster('Bu isimde başka bir vitrin zaten var! Lütfen farklı bir isim girin.', 'danger');
                    adInput.focus();
                    return;
                }
            }
        }


        const vitrin = {
          id: isNewVitrin ? generateUniqueId('v-') : duzenlenenVitrinId,
          ad: ad,
          urunIds: seciliUrunler
        };

        if (isNewVitrin) {
          vitrinler.push(vitrin);
          bildirimGoster('Vitrin başarıyla eklendi!', 'success');
        } else {
          const i = vitrinler.findIndex(v => v.id === duzenlenenVitrinId);
          if (i !== -1) {
            vitrinler[i] = vitrin;
            bildirimGoster('Vitrin başarıyla güncellendi!', 'success');
          } else {
            bildirimGoster('Vitrin bulunamadı, güncelleme başarısız!', 'danger');
            return; // Hata durumunda işlemi durdur
          }
        }

        localStorage.setItem('vitrinler', JSON.stringify(vitrinler));
        document.getElementById('vitrinForm').reset();
        duzenlenenVitrinId = null;
        document.getElementById('vitrinEkleDuzenleBtn').innerHTML = '<i class="fas fa-plus-circle me-2"></i>Ekle';
        document.getElementById('vitrinFormBaslik').textContent = 'Yeni Vitrin Ekle';
        urunSecenekleriniYukle(); // Seçimleri sıfırlamak ve güncel ürün listesini göstermek için
        vitrinBloklariGoster(); // Vitrin listesini güncelle
        verileriYedekle(); // Verileri yedekle
      } catch (error) {
        console.error('Vitrin kaydetme hatası:', error);
        bildirimGoster('Vitrin kaydedilirken bir hata oluştu: ' + error.message, 'danger');
      }
    }

    // Vitrin düzenle
    function vitrinDuzenle(id) {
      const vitrin = vitrinler.find(v => v.id === id);
      if (vitrin) {
        duzenlenenVitrinId = id;
        document.getElementById('vitrinAdi').value = vitrin.ad;
        document.querySelectorAll('.vitrin-urun-checkbox').forEach(cb => {
          cb.checked = vitrin.urunIds.includes(cb.value);
        });
        document.getElementById('vitrinEkleDuzenleBtn').innerHTML = '<i class="fas fa-save me-2"></i>Kaydet';
        document.getElementById('vitrinFormBaslik').textContent = 'Vitrin Düzenle';

        // Vitrin Yönetimi sekmesini aktif et
        const vitrinYonetimiTab = document.getElementById('vitrinYonetimi');
        const vitrinTabButton = document.getElementById('vitrin-tab');
        if (vitrinYonetimiTab) {
            vitrinYonetimiTab.classList.add('show', 'active');
            document.querySelectorAll('.tab-pane').forEach(pane => {
                if (pane.id !== 'vitrinYonetimi') pane.classList.remove('show', 'active');
            });
            document.querySelectorAll('.nav-link').forEach(link => {
                if (link.id !== 'vitrin-tab') link.classList.remove('active');
            });
        }
        if (vitrinTabButton) vitrinTabButton.classList.add('active');
      }
    }

    // Vitrin sil
    function vitrinSil(id) {
      if (!confirm('Vitrin silinsin mi? Bu işlem geri alınamaz!')) return;
      vitrinler = vitrinler.filter(v => v.id !== id);
      localStorage.setItem('vitrinler', JSON.stringify(vitrinler));
      bildirimGoster('Vitrin silindi!', 'success');
      vitrinBloklariGoster();
      verileriYedekle();
    }

    // Verileri yedekle
    function verileriYedekle() {
      const data = {
        urunler,
        kategoriler,
        vitrinler,
        siparisler: safeParseJSON('orders', []) // 'orders' anahtarından al
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mehtapstore_yedek_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      bildirimGoster('Veriler başarıyla yedeklendi!', 'success');
    }

    // Verileri geri yükle
    function verileriGeriYukle(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          // Her bir veri setini LocalStorage'a kaydederken geçerlilik kontrolü yap
          localStorage.setItem('urunler', JSON.stringify(data.urunler || []));
          localStorage.setItem('kategoriler', JSON.stringify(data.kategoriler || []));
          localStorage.setItem('vitrinler', JSON.stringify(data.vitrinler || []));
          localStorage.setItem('orders', JSON.stringify(data.siparisler || [])); // 'orders' olarak kaydet

          bildirimGoster('Veriler geri yüklendi!', 'success');
          // Tüm listeleri ve formları yeniden yükle
          loadData();
          urunleriGoster();
          kategorileriYukle();
          vitrinBloklariGoster();
          siparisleriGoster();
          urunSecenekleriniYukle();
          formuTemizle(); // Ürün formunu temizle
          document.getElementById('vitrinForm').reset(); // Vitrin formunu temizle
          duzenlenenVitrinId = null;
        } catch (err) {
          console.error('Geri yükleme hatası:', err);
          bildirimGoster('Geçersiz yedek dosyası veya veri hatası!', 'danger');
        }
      };
      reader.readAsText(file);
    }

    // Sayfa yüklendiğinde çalışacak kodlar
    document.addEventListener('DOMContentLoaded', () => {
      loadData(); // Tüm verileri LocalStorage'dan yükle
      urunleriGoster(); // Ürünleri listele
      kategorileriYukle(); // Kategorileri yükle
      urunSecenekleriniYukle(); // Vitrin ürün seçeneklerini yükle
      vitrinBloklariGoster(); // Vitrinleri göster
      siparisleriGoster(); // Siparişleri göster
      formuTemizle(); // Ürün formu alanını başlangıçta temizle ve stok kodu oluştur
      document.getElementById('vitrinForm').reset(); // Vitrin formunu da başlangıçta temizle

      // Event Listener'lar
      document.getElementById('urunForm').addEventListener('submit', urunKaydet);
      document.getElementById('kategoriEkleBtn').addEventListener('click', kategoriEkle);
      document.getElementById('kategoriDuzenleKaydetBtn').addEventListener('click', kategoriDuzenle);
      document.getElementById('vitrinForm').addEventListener('submit', vitrinKaydet);
      document.getElementById('aramaButonu').addEventListener('click', urunleriAra);
      document.getElementById('urunArama').addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Enter tuşunun form submit etmesini engelle
            urunleriAra();
        }
      });
      document.getElementById('yedekleBtn').addEventListener('click', verileriYedekle);
      document.getElementById('geriYukleBtn').addEventListener('click', () => {
        document.getElementById('geriYukleInput').click(); // Gizli input'u tetikle
      });
      document.getElementById('geriYukleInput').addEventListener('change', verileriGeriYukle);
    });
</script>
