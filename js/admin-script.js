<script>
    let urunler = [];
    let kategoriler = [];
    let vitrinler = [];
    let siparisler = [];
    let uyeler = []; // uyeler dizisi eklenmeli
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
        // ... (PDF fonksiyonu içeriği, orijinal kodda mevcut) ...
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
        uyeler = safeParseJSON('uyeler', []); // Üyeleri yükle
      } catch (err) {
        console.error('Veri yükleme hatası:', err);
        bildirimGoster('Veriler yüklenirken hata oluştu!', 'danger');
        urunler = [];
        kategoriler = [];
        vitrinler = [];
        siparisler = [];
        uyeler = [];
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

      // Stoğu tükenen ürünleri gizleme ayarını kontrol et
      const hideOutOfStock = localStorage.getItem('adminHideOutOfStock') === '1';
      if (hideOutOfStock && (urun.stok <= 0 || urun.stok === undefined)) {
          return ''; // Gizlenecekse boş döndür
      }


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
          <td>${urun.stok || 0}</td>
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

      // Stoğu tükenen ürünleri gizleme ayarını kontrol et
      const hideOutOfStock = localStorage.getItem('adminHideOutOfStock') === '1';
      if (hideOutOfStock) {
        filtrelenmisUrunler = filtrelenmisUrunler.filter(u => u.stok > 0 || u.stok === undefined);
      }
      // Stok gizleme checkbox'ının durumunu ayarla
      const stokGizleCheckbox = document.getElementById('stoktaOlmayanlariGizle');
      if(stokGizleCheckbox) {
          stokGizleCheckbox.checked = hideOutOfStock;
      }

      if (!filtrelenmisUrunler.length) {
        urunlerListesiDiv.innerHTML = `<p class="text-muted text-center">${filtre ? 'Arama sonucu ürün bulunmamaktadır.' : 'Ürün bulunmamaktadır.'}</p>`;
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
        // Eğer ürünün kategorileri dizisi varsa tüm uygun kategorilere ekle
        if (Array.isArray(u.kategoriler) && u.kategoriler.length) {
          let atandi = false;
          u.kategoriler.forEach(cat => {
            if (kategoriMap.has(cat)) {
              kategoriMap.get(cat).push(u);
              atandi = true;
            }
          });
          if (!atandi) kategoriMap.get('Diğer').push(u);
        } else {
          const kat = u.kategori && kategoriMap.has(u.kategori) ? u.kategori : 'Diğer';
          kategoriMap.get(kat).push(u);
        }
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

    // Ürün kaydetme, düzenleme, silme, arama ve diğer tüm fonksiyonlar (Orijinal kodda olduğu gibi)
    function urunKaydet(e) {
      // ... (Orijinal urunKaydet fonksiyon içeriği) ...
      e.preventDefault();

      const form = e.target;
      const formData = new FormData(form);

      const yeniUrun = {
        id: duzenlenenUrunId || generateUniqueId('P'),
        ad: formData.get('urunAdi'),
        fiyat: parseFloat(formData.get('fiyat')) || 0,
        resim: formData.get('resimLink'),
        detay: formData.get('detay'),
        stok: parseInt(formData.get('stok')) || 0,
        stokKodu: formData.get('stokKodu') || stokKoduOlustur(),
        indirim: parseInt(formData.get('indirim')) || 0,
        kategoriler: Array.from(form.querySelectorAll('input[name="kategoriler[]"]:checked')).map(cb => cb.value),
        anasayfadaGoster: form.querySelector('#anasayfadaGoster').checked,
        yeniUrun: form.querySelector('#yeniUrun').checked,
        ucretsizKargo: form.querySelector('#ucretsizKargo').checked,
      };

      if (!yeniUrun.ad || !yeniUrun.fiyat) {
        bildirimGoster('Ürün Adı ve Fiyat alanları zorunludur.', 'warning');
        return;
      }

      if (duzenlenenUrunId) {
        // Düzenleme
        const index = urunler.findIndex(u => u.id === duzenlenenUrunId);
        if (index !== -1) {
          urunler[index] = yeniUrun;
          bildirimGoster('Ürün başarıyla güncellendi!', 'success');
        }
        duzenlenenUrunId = null;
      } else {
        // Yeni ürün ekleme
        // Stok kodu tekrar kontrolü
        if (urunler.some(u => u.stokKodu === yeniUrun.stokKodu)) {
            yeniUrun.stokKodu = stokKoduOlustur();
        }
        urunler.push(yeniUrun);
        bildirimGoster('Ürün başarıyla eklendi!', 'success');
      }

      localStorage.setItem('urunler', JSON.stringify(urunler));
      urunleriGoster();
      urunSecenekleriniYukle(); // Vitrin seçim alanlarını güncelle
      vitrinBloklariGoster(); // Vitrin bloklarını güncelle
      formuTemizle();
    }

    function urunDuzenle(id) {
        // ... (Orijinal urunDuzenle fonksiyon içeriği) ...
      const urun = urunler.find(u => u.id === id);
      if (urun) {
        duzenlenenUrunId = id;
        document.getElementById('urunAdi').value = urun.ad;
        document.getElementById('fiyat').value = urun.fiyat.toFixed(2);
        document.getElementById('resimLink').value = urun.resim;
        document.getElementById('detay').value = urun.detay;
        document.getElementById('stok').value = urun.stok;
        document.getElementById('stokKodu').value = urun.stokKodu || '';
        document.getElementById('stokKodu').readOnly = true; // Stok kodunu düzenlemede değiştirilemez yap
        document.getElementById('indirim').value = urun.indirim || 0;
        document.getElementById('urunFormBaslik').textContent = 'Ürün Düzenle';
        document.getElementById('urunKaydetBtn').textContent = 'Kaydet';

        // Checkbox'ları ayarla
        document.getElementById('anasayfadaGoster').checked = urun.anasayfadaGoster;
        document.getElementById('yeniUrun').checked = urun.yeniUrun;
        document.getElementById('ucretsizKargo').checked = urun.ucretsizKargo;

        // Kategori checkbox'larını ayarla
        document.querySelectorAll('input[name="kategoriler[]"]').forEach(cb => {
          cb.checked = Array.isArray(urun.kategoriler) && urun.kategoriler.includes(cb.value);
        });

        // Form alanına odaklan
        document.getElementById('urunAdi').focus();
      }
    }

    function urunSil(id) {
        // ... (Orijinal urunSil fonksiyon içeriği) ...
      if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
        urunler = urunler.filter(u => u.id !== id);
        localStorage.setItem('urunler', JSON.stringify(urunler));
        bildirimGoster('Ürün başarıyla silindi!', 'success');
        urunleriGoster();
        urunSecenekleriniYukle();
        vitrinBloklariGoster();
        formuTemizle(); // Eğer silinen ürün düzenleniyorsa formu temizle
      }
    }

    function urunleriAra() {
        // ... (Orijinal urunleriAra fonksiyon içeriği) ...
      const arama = document.getElementById('urunArama').value.trim();
      urunleriGoster(arama);
    }

    function formuTemizle() {
        // ... (Orijinal formuTemizle fonksiyon içeriği) ...
      document.getElementById('urunForm').reset();
      document.getElementById('urunFormBaslik').textContent = 'Yeni Ürün Ekle';
      document.getElementById('urunKaydetBtn').textContent = 'Ekle';
      document.getElementById('stokKodu').value = stokKoduOlustur();
      document.getElementById('stokKodu').readOnly = false;
      duzenlenenUrunId = null;

      // Kategori checkbox'larının tümünü temizle
      document.querySelectorAll('input[name="kategoriler[]"]').forEach(cb => {
          cb.checked = false;
      });
    }

    // Kategorileri yükle/göster (Orijinal kodda olduğu gibi)
    function kategorileriYukle() {
        // ... (Orijinal kategorileriYukle fonksiyon içeriği) ...
      const kategoriListesi = document.getElementById('kategoriListesi');
      const kategoriSecimAlani = document.getElementById('kategoriSecimAlani');
      if (!kategoriListesi || !kategoriSecimAlani) return;

      kategoriListesi.innerHTML = '';
      kategoriSecimAlani.innerHTML = ''; // Ürün formu için kategori seçenekleri

      if (!kategoriler.length) {
        kategoriListesi.innerHTML = '<p class="text-muted text-center">Henüz kategori bulunmamaktadır.</p>';
      } else {
        kategoriler.forEach(kategori => {
          // Kategori Listesi
          const li = document.createElement('li');
          li.className = 'list-group-item d-flex justify-content-between align-items-center';
          li.innerHTML = `
            ${escapeHTML(kategori)}
            <div>
              <button type="button" class="btn btn-sm btn-primary me-2 kategori-duzenle-btn" data-kategori="${escapeHTML(kategori)}"><i class="fas fa-edit"></i></button>
              <button type="button" class="btn btn-sm btn-danger kategori-sil-btn" data-kategori="${escapeHTML(kategori)}"><i class="fas fa-trash"></i></button>
            </div>
          `;
          kategoriListesi.appendChild(li);

          // Ürün Formu Checkbox
          kategoriSecimAlani.innerHTML += `
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="checkbox" id="kategori-${escapeHTML(kategori)}" name="kategoriler[]" value="${escapeHTML(kategori)}">
              <label class="form-check-label" for="kategori-${escapeHTML(kategori)}">${escapeHTML(kategori)}</label>
            </div>
          `;
        });
      }

      // Dinleyicileri yeniden ekle
      document.querySelectorAll('.kategori-duzenle-btn').forEach(btn => {
        btn.addEventListener('click', () => kategoriDuzenleModalAc(btn.dataset.kategori));
      });
      document.querySelectorAll('.kategori-sil-btn').forEach(btn => {
        btn.addEventListener('click', () => kategoriSil(btn.dataset.kategori));
      });

      // Düzenleme yapılıyorsa checkbox'ları ayarla
      if (duzenlenenUrunId) {
          const urun = urunler.find(u => u.id === duzenlenenUrunId);
          if (urun && Array.isArray(urun.kategoriler)) {
              document.querySelectorAll('input[name="kategoriler[]"]').forEach(cb => {
                  cb.checked = urun.kategoriler.includes(cb.value);
              });
          }
      }
    }

    function kategoriEkle() {
        // ... (Orijinal kategoriEkle fonksiyon içeriği) ...
      const input = document.getElementById('yeniKategoriAdi');
      const yeniKategori = input.value.trim();

      if (yeniKategori && !kategoriler.includes(yeniKategori)) {
        kategoriler.push(yeniKategori);
        localStorage.setItem('kategoriler', JSON.stringify(kategoriler));
        bildirimGoster(`'${escapeHTML(yeniKategori)}' kategorisi başarıyla eklendi!`, 'success');
        input.value = '';
        kategorileriYukle();
        urunleriGoster(document.getElementById('urunArama').value); // Ürün listesini kategorilerle güncelle
      } else if (yeniKategori) {
        bildirimGoster(`'${escapeHTML(yeniKategori)}' zaten mevcut.`, 'warning');
      }
    }

    function kategoriSil(kategori) {
        // ... (Orijinal kategoriSil fonksiyon içeriği) ...
      if (confirm(`'${kategori}' kategorisini silmek istediğinizden emin misiniz? Bu kategoriye ait ürünler 'Diğer' kategorisine taşınacaktır.`)) {
        kategoriler = kategoriler.filter(k => k !== kategori);
        localStorage.setItem('kategoriler', JSON.stringify(kategoriler));

        // Bu kategoriye sahip ürünlerin kategorisini güncelle (aslında urunleriGoster() otomatik olarak 'Diğer'e atar, ama LocalStorage'da veriyi temizleyelim)
        urunler.forEach(urun => {
          if (Array.isArray(urun.kategoriler)) {
              urun.kategoriler = urun.kategoriler.filter(k => k !== kategori);
          } else if (urun.kategori === kategori) {
              delete urun.kategori; // Eski tekil kategori alanını temizle
          }
        });
        localStorage.setItem('urunler', JSON.stringify(urunler));


        bildirimGoster(`'${escapeHTML(kategori)}' kategorisi başarıyla silindi!`, 'success');
        kategorileriYukle();
        urunleriGoster(document.getElementById('urunArama').value);
        urunSecenekleriniYukle(); // Vitrin seçim alanlarını güncelle
      }
    }

    function kategoriDuzenleModalAc(eskiKategori) {
        // ... (Orijinal kategoriDuzenleModalAc fonksiyon içeriği) ...
      document.getElementById('eskiKategoriAdi').value = eskiKategori;
      document.getElementById('yeniKategoriAdiDuzenle').value = eskiKategori;
      const modal = new bootstrap.Modal(document.getElementById('kategoriDuzenleModal'));
      modal.show();
    }

    function kategoriDuzenle() {
        // ... (Orijinal kategoriDuzenle fonksiyon içeriği) ...
      const eskiKategori = document.getElementById('eskiKategoriAdi').value;
      const yeniKategori = document.getElementById('yeniKategoriAdiDuzenle').value.trim();

      if (!yeniKategori || yeniKategori === eskiKategori) {
        bildirimGoster('Yeni kategori adı boş olamaz veya eski adıyla aynı olamaz.', 'warning');
        return;
      }

      if (kategoriler.includes(yeniKategori)) {
        bildirimGoster(`'${escapeHTML(yeniKategori)}' zaten mevcut.`, 'warning');
        return;
      }

      // Kategoriler dizisini güncelle
      const index = kategoriler.indexOf(eskiKategori);
      if (index !== -1) {
        kategoriler[index] = yeniKategori;
      }
      localStorage.setItem('kategoriler', JSON.stringify(kategoriler));

      // Ürünlerin kategori bilgilerini güncelle
      urunler.forEach(urun => {
        if (Array.isArray(urun.kategoriler)) {
            const catIndex = urun.kategoriler.indexOf(eskiKategori);
            if (catIndex !== -1) {
                urun.kategoriler[catIndex] = yeniKategori;
            }
        } else if (urun.kategori === eskiKategori) {
            urun.kategori = yeniKategori;
        }
      });
      localStorage.setItem('urunler', JSON.stringify(urunler));

      bildirimGoster(`'${escapeHTML(eskiKategori)}' başarıyla '${escapeHTML(yeniKategori)}' olarak güncellendi!`, 'success');
      kategorileriYukle();
      urunleriGoster(document.getElementById('urunArama').value);
      urunSecenekleriniYukle(); // Vitrin seçim alanlarını güncelle
      bootstrap.Modal.getInstance(document.getElementById('kategoriDuzenleModal')).hide();
    }

    // Vitrin yönetim fonksiyonları (Orijinal kodda olduğu gibi)
    function urunSecenekleriniYukle() {
        // ... (Orijinal urunSecenekleriniYukle fonksiyon içeriği) ...
      const vitrinUrunListesi = document.getElementById('vitrinUrunListesi');
      if (!vitrinUrunListesi) return;

      vitrinUrunListesi.innerHTML = '';
      urunler.forEach(urun => {
        const checkbox = document.createElement('div');
        checkbox.className = 'form-check';
        checkbox.innerHTML = `
          <input class="form-check-input" type="checkbox" id="urun-${escapeHTML(urun.id)}" name="urunIds" value="${escapeHTML(urun.id)}">
          <label class="form-check-label" for="urun-${escapeHTML(urun.id)}">${escapeHTML(urun.ad)} (${escapeHTML(urun.stokKodu || 'Yok')})</label>
        `;
        vitrinUrunListesi.appendChild(checkbox);
      });
    }

    function vitrinKaydet(e) {
        // ... (Orijinal vitrinKaydet fonksiyon içeriği) ...
      e.preventDefault();

      const form = e.target;
      const formData = new FormData(form);

      const vitrinAd = formData.get('vitrinAd');
      const urunIds = Array.from(form.querySelectorAll('input[name="urunIds"]:checked')).map(cb => cb.value);
      const yeniUrunGosterimi = form.querySelector('#yeniUrunGosterimi').checked;
      const indirimliUrunGosterimi = form.querySelector('#indirimliUrunGosterimi').checked;

      if (!vitrinAd && !yeniUrunGosterimi && !indirimliUrunGosterimi) {
        bildirimGoster('Vitrin Adı girmeli veya otomatik vitrin seçeneklerinden en az birini seçmelisiniz.', 'warning');
        return;
      }

      if (duzenlenenVitrinId) {
        // Düzenleme
        const index = vitrinler.findIndex(v => v.id === duzenlenenVitrinId);
        if (index !== -1) {
          vitrinler[index] = {
            id: duzenlenenVitrinId,
            ad: vitrinAd,
            urunIds: urunIds,
            yeniUrunGosterimi: yeniUrunGosterimi,
            indirimliUrunGosterimi: indirimliUrunGosterimi
          };
          bildirimGoster('Vitrin başarıyla güncellendi!', 'success');
        }
        duzenlenenVitrinId = null;
      } else {
        // Yeni vitrin ekleme
        const yeniVitrin = {
          id: generateUniqueId('V'),
          ad: vitrinAd,
          urunIds: urunIds,
          yeniUrunGosterimi: yeniUrunGosterimi,
          indirimliUrunGosterimi: indirimliUrunGosterimi
        };
        vitrinler.push(yeniVitrin);
        bildirimGoster('Vitrin başarıyla eklendi!', 'success');
      }

      localStorage.setItem('vitrinler', JSON.stringify(vitrinler));
      vitrinBloklariGoster();
      form.reset();
      document.getElementById('vitrinKaydetBtn').textContent = 'Ekle';
      document.getElementById('vitrinFormBaslik').textContent = 'Yeni Vitrin Ekle';
    }

    function vitrinDuzenle(id) {
        // ... (Orijinal vitrinDuzenle fonksiyon içeriği) ...
      const vitrin = vitrinler.find(v => v.id === id);
      if (vitrin) {
        duzenlenenVitrinId = id;
        document.getElementById('vitrinAd').value = vitrin.ad;
        document.getElementById('yeniUrunGosterimi').checked = vitrin.yeniUrunGosterimi;
        document.getElementById('indirimliUrunGosterimi').checked = vitrin.indirimliUrunGosterimi;
        document.getElementById('vitrinFormBaslik').textContent = 'Vitrin Düzenle';
        document.getElementById('vitrinKaydetBtn').textContent = 'Kaydet';

        // Ürün checkbox'larını ayarla
        document.querySelectorAll('input[name="urunIds"]').forEach(cb => {
          cb.checked = vitrin.urunIds.includes(cb.value);
        });

        // Form alanına odaklan
        document.getElementById('vitrinAd').focus();
      }
    }

    function vitrinSil(id) {
        // ... (Orijinal vitrinSil fonksiyon içeriği) ...
      if (confirm('Bu vitrini silmek istediğinizden emin misiniz?')) {
        vitrinler = vitrinler.filter(v => v.id !== id);
        localStorage.setItem('vitrinler', JSON.stringify(vitrinler));
        bildirimGoster('Vitrin başarıyla silindi!', 'success');
        vitrinBloklariGoster();
        // Eğer silinen vitrin düzenleniyorsa formu temizle
        if (duzenlenenVitrinId === id) {
            document.getElementById('vitrinForm').reset();
            document.getElementById('vitrinKaydetBtn').textContent = 'Ekle';
            document.getElementById('vitrinFormBaslik').textContent = 'Yeni Vitrin Ekle';
            duzenlenenVitrinId = null;
        }
      }
    }

    function vitrinBloklariGoster() {
        // ... (Orijinal vitrinBloklariGoster fonksiyon içeriği) ...
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

        // Yalnızca vitrin ürünleri varsa veya otomatik gösterim ayarlanmışsa göster
        if (vitrinUrunleri.length > 0 || v.yeniUrunGosterimi || v.indirimliUrunGosterimi) {
            hasContent = true;
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item mb-2'; // Her akordiyon itemi arasına boşluk

            const headerId = `vitrinHeading${index}`;
            const collapseId = `vitrinCollapse${index}`;

            // Otomatik vitrinler için ürünleri hesapla
            let otomatikUrunler = [];
            if (v.yeniUrunGosterimi) {
                otomatikUrunler = otomatikUrunler.concat(urunler.filter(u => u.yeniUrun && !vitrinUrunleri.some(vu => vu.id === u.id)));
            }
            if (v.indirimliUrunGosterimi) {
                otomatikUrunler = otomatikUrunler.concat(urunler.filter(u => u.indirim > 0 && !vitrinUrunleri.some(vu => vu.id === u.id) && !otomatikUrunler.some(ou => ou.id === u.id)));
            }

            const tumUrunler = vitrinUrunleri.concat(otomatikUrunler);

            // Ürün listesini HTML olarak oluştur
            let urunListHtml = '';
            tumUrunler.forEach(u => {
                const indirimliFiyat = calculateDiscountedPrice(u.fiyat, u.indirim);
                urunListHtml += `
                    <li class="list-group-item d-flex align-items-center p-2">
                        <img src="${escapeHTML(u.resim)}" class="vitrin-urun-img me-3" alt="${escapeHTML(u.ad)}" onerror="this.src='https://via.placeholder.com/45'">
                        <div class="flex-grow-1">
                            <h6 class="mb-0">${escapeHTML(u.ad)}</h6>
                            <p class="mb-0 text-muted small">
                                ${u.indirim > 0 ? `<span class="text-decoration-line-through me-1">₺${u.fiyat.toFixed(2)}</span>` : ''}
                                <span class="fw-bold text-success">₺${indirimliFiyat.toFixed(2)}</span>
                                <span class="badge bg-secondary ms-2">${escapeHTML(Array.isArray(u.kategoriler) ? u.kategoriler.join(', ') : (u.kategori || ''))}</span>
                                ${u.stok > 0 ? `<span class="badge bg-primary ms-2">Stok: ${u.stok}</span>` : `<span class="badge bg-danger ms-2">Stok Yok</span>`}
                            </p>
                        </div>
                    </li>
                `;
            });

            // Otomatik gösterim etiketlerini ayarla
            let otomatikEtiketler = '';
            if(v.yeniUrunGosterimi) otomatikEtiketler += '<span class="badge bg-info me-2">Oto: Yeni Ürün</span>';
            if(v.indirimliUrunGosterimi) otomatikEtiketler += '<span class="badge bg-warning text-dark me-2">Oto: İndirimli</span>';


            accordionItem.innerHTML = `
                <h2 class="accordion-header" id="${headerId}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                        ${escapeHTML(v.ad)} (${tumUrunler.length} Ürün)
                        <div class="ms-3">${otomatikEtiketler}</div>
                        <div class="ms-auto me-3">
                            <button type="button" class="btn btn-primary btn-sm me-2 vitrin-duzenle-btn" data-id="${escapeHTML(v.id)}" onclick="event.stopPropagation();"><i class="fas fa-edit"></i> Düzenle</button>
                            <button type="button" class="btn btn-danger btn-sm vitrin-sil-btn" data-id="${escapeHTML(v.id)}" onclick="event.stopPropagation();"><i class="fas fa-trash"></i> Sil</button>
                        </div>
                    </button>
                </h2>
                <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headerId}" data-bs-parent="#vitrinAccordion">
                    <div class="accordion-body p-0">
                        <ul class="list-group list-group-flush">
                            ${urunListHtml || '<li class="list-group-item text-muted">Bu vitrinde gösterilecek ürün bulunmamaktadır.</li>'}
                        </ul>
                    </div>
                </div>
            `;
            accordionContainer.appendChild(accordionItem);
        }
      });


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

    // Siparişleri listele (Orijinal kodda olduğu gibi)
    function siparisleriGoster() {
        // ... (Orijinal siparisleriGoster fonksiyon içeriği) ...
      const liste = document.getElementById('siparisListesi');
      if (!liste) return;
      liste.innerHTML = '';

      if (!siparisler.length) {
        liste.innerHTML = '<p class="text-muted text-center">Henüz sipariş bulunmamaktadır.</p>';
        return;
      }

      // Yeni siparişleri en üste koymak için sırala
      const siraliSiparisler = [...siparisler].sort((a, b) => new Date(b.date) - new Date(a.date));

      siraliSiparisler.forEach((siparis, index) => {
        const id = escapeHTML(siparis.id || 'Bilinmeyen');
        const statusText = {
          pending: 'Beklemede',
          shipped: 'Kargoda',
          delivered: 'Teslim Edildi'
        }[siparis.status] || 'Bilinmeyen Durum';
        const statusClass = {
          pending: 'warning',
          shipped: 'primary',
          delivered: 'success'
        }[siparis.status] || 'secondary';

        const toplamTutar = (siparis.items || []).reduce((sum, item) => sum + (Number(item.fiyat) * Number(item.adet || 1)), 0);

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${id}</td>
          <td>${escapeHTML(siparis.fullName || 'Anonim')}</td>
          <td>${escapeHTML(siparis.phone || 'Yok')}</td>
          <td><span class="badge bg-${statusClass}">${statusText}</span></td>
          <td>${new Date(siparis.date).toLocaleDateString('tr-TR')}</td>
          <td>₺${toplamTutar.toFixed(2)}</td>
          <td>
            <button type="button" class="btn btn-info btn-sm me-1 siparis-detay-btn" data-id="${id}" title="Detay"><i class="fas fa-eye"></i></button>
            <button type="button" class="btn btn-secondary btn-sm me-1 siparis-pdf-btn" data-id="${id}" title="PDF"><i class="fas fa-file-pdf"></i></button>
            <button type="button" class="btn btn-danger btn-sm siparis-sil-btn" data-id="${id}" title="Sil"><i class="fas fa-trash"></i></button>
          </td>
        `;
        liste.appendChild(row);
      });

      document.querySelectorAll('.siparis-detay-btn').forEach(btn => {
        btn.addEventListener('click', () => siparisDetayGoster(btn.dataset.id));
      });
      document.querySelectorAll('.siparis-pdf-btn').forEach(btn => {
        btn.addEventListener('click', () => printOrderAsPDF(btn.dataset.id));
      });
      document.querySelectorAll('.siparis-sil-btn').forEach(btn => {
        btn.addEventListener('click', () => siparisSil(btn.dataset.id));
      });
    }

    function siparisDetayGoster(id) {
        // ... (Orijinal siparisDetayGoster fonksiyon içeriği) ...
      const siparis = siparisler.find(s => s.id === id);
      if (!siparis) {
        bildirimGoster('Sipariş detayı bulunamadı!', 'danger');
        return;
      }

      const modalBaslik = document.getElementById('siparisDetayModalBaslik');
      const modalIcerik = document.getElementById('siparisDetayModalIcerik');
      const durumSecim = document.getElementById('siparisDurumSecim');
      const kaydetBtn = document.getElementById('siparisDurumKaydetBtn');

      if (!modalBaslik || !modalIcerik || !durumSecim || !kaydetBtn) return;

      modalBaslik.textContent = `Sipariş Detayları: ${escapeHTML(id)}`;
      durumSecim.value = siparis.status || 'pending';

      let urunListesiHtml = '<ul class="list-group mb-3">';
      const urunlerListesi = safeParseJSON('urunler', []); // Ürün verilerini al

      (siparis.items || []).forEach(item => {
        const urunData = urunlerListesi.find(u => u.id === item.id);
        const urunAdi = item.ad || urunData?.ad || 'Bilinmeyen Ürün';
        const fiyat = Number(item.fiyat).toFixed(2);
        const adet = Number(item.adet || 1);
        const toplam = (fiyat * adet).toFixed(2);

        urunListesiHtml += `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            ${escapeHTML(urunAdi)}
            <span class="badge bg-secondary">
              ${adet} x ₺${fiyat} = ₺${toplam}
            </span>
          </li>
        `;
      });
      urunListesiHtml += '</ul>';

      const toplamTutar = (siparis.items || []).reduce((sum, item) => sum + (Number(item.fiyat) * Number(item.adet || 1)), 0);

      modalIcerik.innerHTML = `
        <h5 class="mb-3">Müşteri Bilgileri</h5>
        <p><strong>Adı Soyadı:</strong> ${escapeHTML(siparis.fullName || 'Anonim')}</p>
        <p><strong>Telefon:</strong> ${escapeHTML(siparis.phone || 'Yok')}</p>
        <p><strong>Adres:</strong> ${escapeHTML(siparis.address || 'Yok')}</p>
        <p><strong>Not:</strong> ${escapeHTML(siparis.note || 'Yok')}</p>
        <hr>
        <h5 class="mb-3">Sipariş Bilgileri</h5>
        <p><strong>Tarih:</strong> ${new Date(siparis.date).toLocaleDateString('tr-TR')} ${new Date(siparis.date).toLocaleTimeString('tr-TR')}</p>
        <p><strong>Toplam Tutar:</strong> <span class="fw-bold text-success">₺${toplamTutar.toFixed(2)}</span></p>
        <hr>
        <h5 class="mb-3">Ürünler</h5>
        ${urunListesiHtml}
      `;

      // Kaydet butonuna sipariş ID'sini ata
      kaydetBtn.dataset.siparisId = id;

      const modal = new bootstrap.Modal(document.getElementById('siparisDetayModal'));
      modal.show();
    }

    function siparisDurumGuncelle(id, yeniDurum) {
        // ... (Orijinal siparisDurumGuncelle fonksiyon içeriği) ...
      const index = siparisler.findIndex(s => s.id === id);
      if (index !== -1) {
        siparisler[index].status = yeniDurum;
        localStorage.setItem('orders', JSON.stringify(siparisler));
        bildirimGoster(`Sipariş #${id} durumu başarıyla güncellendi: ${yeniDurum}`, 'success');
        siparisleriGoster(); // Listeyi yeniden yükle
        bootstrap.Modal.getInstance(document.getElementById('siparisDetayModal')).hide();
      } else {
        bildirimGoster('Sipariş bulunamadı!', 'danger');
      }
    }

    function siparisSil(id) {
        // ... (Orijinal siparisSil fonksiyon içeriği) ...
      if (confirm(`Sipariş #${id} silmek istediğinizden emin misiniz?`)) {
        siparisler = siparisler.filter(s => s.id !== id);
        localStorage.setItem('orders', JSON.stringify(siparisler));
        bildirimGoster('Sipariş başarıyla silindi!', 'success');
        siparisleriGoster();
      }
    }

    // Üye Yönetim fonksiyonları (Orijinal kodda olduğu gibi)
    function uyeleriGoster() {
        // ... (Orijinal uyeleriGoster fonksiyon içeriği) ...
      const liste = document.getElementById('uyeListesi');
      if (!liste) return;

      liste.innerHTML = '';
      if (!uyeler.length) {
        liste.innerHTML = '<p class="text-muted text-center">Henüz kayıtlı üye bulunmamaktadır.</p>';
        return;
      }

      uyeler.forEach((uye, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td>${escapeHTML(uye.fullName || 'Anonim')}</td>
          <td>${escapeHTML(uye.email || 'Yok')}</td>
          <td>${escapeHTML(uye.phone || 'Yok')}</td>
          <td>${new Date(uye.registrationDate).toLocaleDateString('tr-TR')}</td>
          <td>
            <button type="button" class="btn btn-danger btn-sm uye-sil-btn" data-id="${escapeHTML(uye.id)}"><i class="fas fa-trash"></i> Sil</button>
          </td>
        `;
        liste.appendChild(row);
      });

      document.querySelectorAll('.uye-sil-btn').forEach(btn => {
        btn.addEventListener('click', () => uyeSil(btn.dataset.id));
      });
    }

    function uyeSil(id) {
        // ... (Orijinal uyeSil fonksiyon içeriği) ...
      if (confirm('Bu üyeyi silmek istediğinizden emin misiniz?')) {
        uyeler = uyeler.filter(u => u.id !== id);
        localStorage.setItem('uyeler', JSON.stringify(uyeler));

        bildirimGoster('Üye başarıyla silindi!', 'success');
        uyeleriGoster();
      }
    }


    // Veri Yedekleme ve Geri Yükleme (Orijinal kodda olduğu gibi)
    function verileriYedekle() {
        // ... (Orijinal verileriYedekle fonksiyon içeriği) ...
      const yedekData = {
        urunler: urunler,
        kategoriler: kategoriler,
        vitrinler: vitrinler,
        orders: siparisler,
        uyeler: uyeler
      };
      const jsonStr = JSON.stringify(yedekData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const filename = `mehtapstore_yedek_${new Date().toISOString().slice(0, 10)}.json`;
      saveAs(blob, filename);
      bildirimGoster('Veriler başarıyla yedeklendi!', 'success');
    }

    function verileriGeriYukle(event) {
        // ... (Orijinal verileriGeriYukle fonksiyon içeriği) ...
      const file = event.target.files[0];
      if (!file) return;

      if (!confirm(`Tüm mevcut verilerinizin üzerine yazılacaktır. Geri yükleme işlemine devam etmek istediğinizden emin misiniz?`)) {
          document.getElementById('geriYukleInput').value = ''; // Input'u temizle
          return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const yedekData = JSON.parse(e.target.result);

          if (!yedekData.urunler || !yedekData.kategoriler || !yedekData.vitrinler || !yedekData.orders || !yedekData.uyeler) {
              throw new Error('Yedek dosyası eksik veya hatalı veri içeriyor.');
          }

          localStorage.setItem('urunler', JSON.stringify(yedekData.urunler));
          localStorage.setItem('kategoriler', JSON.stringify(yedekData.kategoriler));
          localStorage.setItem('vitrinler', JSON.stringify(yedekData.vitrinler));
          localStorage.setItem('orders', JSON.stringify(yedekData.orders));
          localStorage.setItem('uyeler', JSON.stringify(yedekData.uyeler));

          bildirimGoster('Veriler başarıyla geri yüklendi! Sayfa yenileniyor...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1000);

        } catch (err) {
          console.error('Geri yükleme hatası:', err);
          bildirimGoster(`Geri yükleme başarısız: Geçersiz dosya formatı veya veri. Detay: ${err.message}`, 'danger');
        } finally {
            document.getElementById('geriYukleInput').value = '';
        }
      };
      reader.readAsText(file);
    }

    //---------------------------------------------------------
    // *** KRİTİK DÜZELTME KISMI: İnitialization (Başlatma) Fonksiyonu ***
    // Bu fonksiyon, sayfa yüklendiğinde LocalStorage kontrolünü yapar
    // ve iptal durumunda tüm listeleme işlemlerini durdurur.
    //---------------------------------------------------------
    function init() {
        loadData(); // 1. LocalStorage'dan mevcut verileri yükle (urunler boşsa [] olur)

        // *** DÜZELTME BAŞLANGICI ***
        // 2. LocalStorage boşsa urunler.json'dan yükleme onayı al
        if (urunler.length === 0) {
            if (confirm('LocalStorage\'da ürün bulunamadı. urunler.json dosyasından otomatik yüklemek ister misiniz? (Mevcut verileri silebilir!)')) {
                // Kullanıcı "Tamam" dedi. Fetch işlemi başlıyor...
                fetch('urunler.json')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('urunler.json dosyası yüklenemedi: ' + response.statusText);
                        }
                        return response.json();
                    })
                    .then(data => {
                        urunler = data; 
                        localStorage.setItem('urunler', JSON.stringify(urunler)); 
                        bildirimGoster('Ürünler urunler.json dosyasından başarıyla yüklendi!', 'success');
                        
                        // Başarılı yüklemeden sonra listeleri güncelle
                        urunleriGoster();
                        urunSecenekleriniYukle(); 
                        vitrinBloklariGoster(); 
                    })
                    .catch(error => {
                        console.error("urunler.json yükleme hatası:", error);
                        bildirimGoster(`Hata: urunler.json yüklenemedi. ${error.message}`, 'error');
                        urunleriGoster(); // Hata olsa bile boş listeyi göster
                    });
                
                // Fetch asenkron bir işlem olduğu için, bu noktada fonksiyonun
                // geri kalan senkron listeleme çağrılarını durduruyoruz.
                return; 
            } else {
                // Kullanıcı "İptal" dedi.
                bildirimGoster('Ürün yükleme işlemi iptal edildi.', 'info');
                return; // **KRİTİK DÜZELTME: İptal edilirse fonksiyonu tamamen sonlandır.**
            }
        }
        // *** DÜZELTME BİTİŞİ ***
        
        // Eğer LocalStorage'da ürün varsa (urunler.length > 0) 
        // veya confirm diyalog hiç açılmadıysa/atlandıysa, 
        // normal listeleme işlemlerine devam et.
        urunleriGoster(); 
        kategorileriYukle();
        urunSecenekleriniYukle(); 
        vitrinBloklariGoster();
        siparisleriGoster();
        uyeleriGoster(); // Üyeleri göster

        formuTemizle(); 
        document.getElementById('vitrinForm').reset(); 

        // Fiyat gizleme toggle'ının başlangıç durumunu ayarla
        const fiyatlariGizleToggle = document.getElementById('fiyatlariGizle');
        if (fiyatlariGizleToggle) {
            const hide = localStorage.getItem('adminHidePrices') === '1';
            fiyatlariGizleToggle.checked = hide;
            console.log('Admin toggle initial checked:', hide);
        }
    }


    // Sayfa yüklendiğinde çalışacak kodlar
    document.addEventListener('DOMContentLoaded', () => {
      
      // *** DÜZELTME: Eski yükleme çağrıları yerine init() çağırılıyor ***
      init(); // Sayfa başlatma ve kontrol mekanizmasını çalıştır

      // Olay Dinleyicileri (Event Listeners)
      document.getElementById('urunForm').addEventListener('submit', urunKaydet);
      document.getElementById('kategoriEkleBtn').addEventListener('click', kategoriEkle);
      document.getElementById('kategoriDuzenleKaydetBtn').addEventListener('click', kategoriDuzenle);
      document.getElementById('vitrinForm').addEventListener('submit', vitrinKaydet);
      document.getElementById('aramaButonu').addEventListener('click', urunleriAra);
      
      // Sipariş Durum Kaydet butonu dinleyicisi
      document.getElementById('siparisDurumKaydetBtn').addEventListener('click', function() {
          const id = this.dataset.siparisId;
          const yeniDurum = document.getElementById('siparisDurumSecim').value;
          siparisDurumGuncelle(id, yeniDurum);
      });


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
      
      // Fiyat gizleme toggle event listener
      const fiyatlariGizleToggle = document.getElementById('fiyatlariGizle');
      if (fiyatlariGizleToggle) {
        fiyatlariGizleToggle.addEventListener('change', function() {
          const hide = this.checked ? '1' : '0';
          localStorage.setItem('adminHidePrices', hide);
          console.log('Admin localStorage set adminHidePrices:', hide);
          bildirimGoster('Fiyat gizleme ayarı güncellendi!', 'success');
        });
      }

      // YENİ KISIM: Stoğu Bitenleri Gizle özelliği için olay dinleyicisi
      const stokGizleCheckbox = document.getElementById('stoktaOlmayanlariGizle');
      if (stokGizleCheckbox) {
        // Checkbox'ın durumu değiştiğinde, localStorage'a kaydet ve listeyi yeniden yükle
        stokGizleCheckbox.addEventListener('change', () => {
          const hide = stokGizleCheckbox.checked ? '1' : '0';
          localStorage.setItem('adminHideOutOfStock', hide);
          bildirimGoster(`Stoğu tükenen ürünler ${hide === '1' ? 'gizlendi' : 'gösterildi'}`, 'info');
          urunleriGoster(document.getElementById('urunArama').value);
        });
      }
    });
</script>
