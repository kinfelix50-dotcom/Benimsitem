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
    const effectiveDiscount = 1 - (discountPercentage / 100);
    return discountedPrice / effectiveDiscount;
  }
  return discountedPrice;
}

// Sepet sınıfı tanımı
class Sepet {
  constructor() {
    this.sepet = safeParseJSON('sepet', []); // Varsayılan boş dizi
    this.cartNote = safeParseJSON('cartNote', ''); // Sepet açıklaması
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
      // Eğer fiyatta manuel değişiklik yapılmamışsa (indirim 0 değilse), güncel fiyatı kullan.
      if (mevcut.indirim !== 0) {
          mevcut.fiyat = calculateDiscountedPrice(guncelUrunBilgisi.fiyat, guncelUrunBilgisi.indirim);
          mevcut.indirim = guncelUrunBilgisi.indirim || 0;
      }
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
    this.cartNote = '';
    localStorage.removeItem('cartNote');
    localStorage.setItem('urunler', JSON.stringify(urunler));
    this.kaydet();
    this.render();
    this.updateNavBar();
    bildirimiGoster('Sepetiniz temizlendi!', 'info');
  }

  // Sipariş tamamlandığında sepeti temizle
  clearCartForOrder() {
    this.sepet = [];
    this.cartNote = '';
    localStorage.removeItem('cartNote');
    this.kaydet();
    this.render();
    this.updateNavBar();
  }

  // Sepeti ekrana render et
  render() {
    const cartItemsDiv = document.getElementById('cartItems');
    const totalPriceSpan = document.getElementById('totalPrice'); // Net Tutar (Bireysel İndirimli)
    const totalOriginalPriceSpan = document.getElementById('totalOriginalPrice');
    const totalDiscountSpan = document.getElementById('totalDiscount');

    if (!cartItemsDiv || !totalPriceSpan || !totalOriginalPriceSpan || !totalDiscountSpan) return;

    cartItemsDiv.innerHTML = '';
    let total = 0; // Net Tutar (Ekstra İndirim Öncesi)
    let totalOriginal = 0;
    let totalDiscountAmount = 0; // Bireysel indirim toplamı

    if (this.sepet.length === 0) {
      cartItemsDiv.innerHTML = '<p class="text-muted text-center p-3 border rounded bg-white">Sepetinizde ürün bulunmamaktadır.</p>';
      totalPriceSpan.textContent = '0.00';
      totalOriginalPriceSpan.textContent = '0.00';
      totalDiscountSpan.textContent = '0.00';
      
      // Ekstra indirim ve final total sıfırlama
      this.finalTotal = 0;
      const extraDiscountAmountSpan = document.getElementById('extraDiscountAmount');
      const finalTotalPriceSpan = document.getElementById('finalTotalPrice');
      if (extraDiscountAmountSpan) extraDiscountAmountSpan.textContent = '0.00';
      if (finalTotalPriceSpan) finalTotalPriceSpan.textContent = '0.00';
      
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

              <div class="d-flex align-items-center mt-1">
                <small class="text-muted fw-bold me-1">Birim Fiyat:</small>
                <input type="number"
                     class="form-control form-control-sm price-input"
                     value="${item.fiyat.toFixed(2)}"
                     data-id="${escapeHTML(item.id)}"
                     min="0.01"
                     step="0.01"
                     style="width: 110px; display: inline-block; font-size: 0.9rem; height: 28px;">
                <span class="ms-1 small fw-bold">TL</span>
              </div>

              <div class="d-flex align-items-center mt-1">
                <small class="text-muted fw-bold me-1">İndirim (%):</small>
                <input type="number" 
                     class="form-control form-control-sm discount-input" 
                     value="${item.indirim || 0}" 
                     data-id="${escapeHTML(item.id)}"
                     min="0" 
                     max="100" 
                     step="1"
                     style="width: 85px; display: inline-block; font-size: 0.8rem; height: 28px;">
                <span class="ms-1 small fw-bold">%</span>
              </div>
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

    // Ana toplamları güncelle
    totalOriginalPriceSpan.textContent = totalOriginal.toFixed(2);
    totalDiscountSpan.textContent = totalDiscountAmount.toFixed(2);
    totalPriceSpan.textContent = total.toFixed(2); // Net Tutar (Ek İndirim Öncesi)


    // --- MANUEL GENEL İNDİRİM UYGULAMA MANTIĞI ---
    const manualDiscountPercentInput = document.getElementById('manualDiscountPercent');
    const extraDiscountAmountSpan = document.getElementById('extraDiscountAmount');
    const finalTotalPriceSpan = document.getElementById('finalTotalPrice');

    const manualDiscountPercentage = safeParseJSON('manualDiscountPercentage', 0);
    
    if(manualDiscountPercentInput) {
        manualDiscountPercentInput.value = manualDiscountPercentage;
    }

    let extraDiscountAmount = 0;
    let finalTotal = total; // Net Tutar (Bireysel indirimli)

    if (manualDiscountPercentage > 0) {
        extraDiscountAmount = total * (manualDiscountPercentage / 100);
        finalTotal = total - extraDiscountAmount;
    }
    
    // Final toplamı sınıf değişkenine kaydet (sipariş için kullanılacak)
    this.finalTotal = finalTotal; 

    if (extraDiscountAmountSpan) {
        extraDiscountAmountSpan.textContent = extraDiscountAmount.toFixed(2);
        // Genel indirim tutarını bireysel indirimlere ekle
        this.totalDiscountAmount = totalDiscountAmount + extraDiscountAmount;
    } else {
         this.totalDiscountAmount = totalDiscountAmount;
    }
    
    if (finalTotalPriceSpan) {
        finalTotalPriceSpan.textContent = finalTotal.toFixed(2);
    }
    // --- MANUEL GENEL İNDİRİM SONU ---

    // Açıklama alanını doldur
    const cartNoteTextarea = document.getElementById('cartNote');
    if (cartNoteTextarea) {
        cartNoteTextarea.value = this.cartNote;
    }

    this.addEventListeners();
  }

  // Manuel input ile fiyat güncelleme fonksiyonu
  handlePriceInput(inputElement) {
    const id = inputElement.dataset.id;
    let newPrice = parseFloat(inputElement.value);

    // Geçersiz girişleri (boş veya 0'dan küçük) kontrol et
    if (isNaN(newPrice) || newPrice <= 0) {
        newPrice = 0.01; // En az 0.01 yap
    }
    
    // Fiyatı iki ondalık basamağa yuvarla ve input değerini güncelle
    newPrice = parseFloat(newPrice.toFixed(2));
    inputElement.value = newPrice.toFixed(2);
    
    // Local Storage'daki sepet verisini güncelle
    const itemIndex = this.sepet.findIndex(item => item.id === id);

    if (itemIndex !== -1) {
        this.sepet[itemIndex].fiyat = newPrice;
        this.sepet[itemIndex].indirim = 0; // Manuel fiyat girişi indirimleri sıfırlar.

        this.kaydet(); 

        this.render(); 
        this.updateNavBar(); 
        
        bildirimiGoster('Ürün fiyatı manuel olarak güncellendi.', 'success');
    } else {
        bildirimiGoster('Ürün sepetten çıkarıldı veya bulunamadı!', 'danger');
    }
  }

  // Manuel ürün indirim yüzdesi güncelleme fonksiyonu (YENİ)
  handleDiscountInput(inputElement) {
    const id = inputElement.dataset.id;
    let discount = parseInt(inputElement.value);

    // İndirim yüzdesini doğrula (0-100 arası)
    if (isNaN(discount) || discount < 0) discount = 0;
    if (discount > 100) discount = 100;
    
    // Input değerini geçerli aralığa göre güncelle
    inputElement.value = discount;

    // Sepetten ürünü bul
    const itemIndex = this.sepet.findIndex(item => item.id === id);
    if (itemIndex === -1) {
        bildirimiGoster('Ürün sepetten çıkarıldı veya bulunamadı!', 'danger');
        return;
    }

    const item = this.sepet[itemIndex];
    
    // Ürünlerden orijinal fiyatı al
    const urunler = safeParseJSON('urunler', []);
    const urun = urunler.find(u => u.id === id);
    const originalPrice = urun ? urun.fiyat : item.fiyat / (1 - (item.indirim / 100) || 0);
    
    // İndirimi güncelle ve yeni fiyatı hesapla
    item.indirim = discount;
    item.fiyat = calculateDiscountedPrice(originalPrice, discount);

    this.kaydet();
    this.render();
    this.updateNavBar();
    
    bildirimiGoster(`Ürün için indirim %${discount} olarak ayarlandı.`, 'success');
  }

  // Manuel Genel İndirim güncelleme fonksiyonu (YENİ)
  handleManualDiscount(inputElement) {
    let newDiscount = parseFloat(inputElement.value);

    // Giriş Kontrolü: 0 ile 100 arasında olmalı
    if (isNaN(newDiscount) || newDiscount < 0 || newDiscount > 100) {
        newDiscount = Math.min(100, Math.max(0, newDiscount || 0)); 
        inputElement.value = newDiscount;
        bildirimiGoster('İndirim yüzdesi 0 ile 100 arasında olmalıdır!', 'warning');
    }
    
    // Local Storage'a kaydet
    localStorage.setItem('manualDiscountPercentage', JSON.stringify(newDiscount));

    // Sepeti yeniden render et (bu, summary'i de güncelleyecektir)
    this.render(); 
    
    bildirimiGoster(`Ekstra sepet indirimi %${newDiscount} olarak ayarlandı.`, 'info');
  }

  // Sepet açıklama alanı güncelleme fonksiyonu
  handleCartNoteInput(textareaElement) {
    this.cartNote = textareaElement.value.trim();
    localStorage.setItem('cartNote', JSON.stringify(this.cartNote));
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

    // Adet Input alanı için (manuel adet girişi)
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
    
    // 💰 FİYAT INPUT İÇİN (Manuel Fiyat Değişikliği)
    cartItemsDiv.querySelectorAll('.price-input').forEach(input => {
      input.addEventListener('change', (e) => {
        this.handlePriceInput(e.target);
      });
    });

    // 📊 İNDİRİM INPUT İÇİN (YENİ)
    cartItemsDiv.querySelectorAll('.discount-input').forEach(input => {
      input.addEventListener('change', (e) => {
        this.handleDiscountInput(e.target);
      });
    });

    // 🎯 MANUEL GENEL İNDİRİM INPUT İÇİN (YENİ)
    const manualDiscountInput = document.getElementById('manualDiscountPercent');
    if(manualDiscountInput) {
        manualDiscountInput.addEventListener('change', (e) => {
            this.handleManualDiscount(e.target);
        });
    }

    // 📝 SEPET AÇIKLAMA ALANI İÇİN
    const cartNoteTextarea = document.getElementById('cartNote');
    if (cartNoteTextarea) {
        cartNoteTextarea.addEventListener('input', (e) => {
            this.handleCartNoteInput(e.target);
        });
    }
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
  let confirmTotal = 0; // Bireysel indirimli net sepet toplamı (Ekstra indirim öncesi)
  let confirmTotalOriginal = 0;
  let confirmTotalDiscountAmount = 0; // Bireysel indirim tutarı

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
  
  // Yeni Ekstra İndirim ve Final Total Hesaplama
  const manualDiscountPercentage = safeParseJSON('manualDiscountPercentage', 0);
  let extraDiscountAmountFromManual = 0;
  let finalTotalForOrder = confirmTotal;

  if (manualDiscountPercentage > 0) {
      extraDiscountAmountFromManual = confirmTotal * (manualDiscountPercentage / 100);
      finalTotalForOrder = confirmTotal - extraDiscountAmountFromManual;
  }
  
  // Toplam indirim tutarını güncelle
  confirmTotalDiscountAmount += extraDiscountAmountFromManual;


  confirmOrderItemsDiv.innerHTML = orderSummaryHtml;
  document.getElementById('confirmTotalOriginalPrice').textContent = confirmTotalOriginal.toFixed(2);
  document.getElementById('confirmTotalDiscount').textContent = confirmTotalDiscountAmount.toFixed(2);
  document.getElementById('confirmTotalPrice').textContent = finalTotalForOrder.toFixed(2); // Final Net Tutar

  // Açıklama alanını göster
  const confirmNoteDiv = document.getElementById('confirmNote');
  if (confirmNoteDiv) {
    confirmNoteDiv.innerHTML = sepet.cartNote ? `<strong>Açıklama:</strong> ${escapeHTML(sepet.cartNote)}` : '<em>Açıklama yok</em>';
  }

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
  
  // Final toplamı kullan
  const finalTotalForOrder = sepet.finalTotal || sepet.sepet.reduce((sum, item) => sum + item.fiyat * item.adet, 0);


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
    total: finalTotalForOrder.toFixed(2), // Final net tutar
    status: 'pending',
    fullName: addressData.fullName,
    address: addressData.address,
    phone: addressData.phoneNumber,
    note: sepet.cartNote || '' // Sepet açıklaması
  };
  console.log('Sipariş kaydediliyor, note:', order.note);

  const orders = safeParseJSON('orders', []);
  orders.push(order);
  localStorage.setItem('orders', JSON.stringify(orders));

  if (addressData.saveAddress) {
    adresiProfiliKaydet(addressData.fullName, addressData.address, addressData.phoneNumber);
  }

  sepet.clearCartForOrder();
  // Ekstra indirim oranını temizle
  localStorage.removeItem('manualDiscountPercentage');
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

// Sepeti PDF olarak indir
function exportCartToPDF() {
  if (sepet.sepet.length === 0) {
    bildirimiGoster('Sepet boş, PDF oluşturulamadı!', 'warning');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      console.error('jsPDF kütüphanesi yüklenmedi!');
      bildirimiGoster('PDF kütüphanesi yüklenemedi! Konsolu kontrol edin.', 'danger');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    // Font ayarları
    if (typeof DejaVuSans !== 'undefined') {
      try {
        doc.addFileToVFS('DejaVuSans.ttf', DejaVuSans);
        doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
        doc.setFont('DejaVuSans', 'normal');
      } catch (err) {
        console.warn('DejaVuSans fontu yüklenemedi, Helvetica kullanılıyor:', err);
        doc.setFont('Helvetica', 'normal');
      }
    } else {
      doc.setFont('Helvetica', 'normal');
    }

    const primaryColor = '#007bff';
    const secondaryColor = '#6c757d';
    const textColor = '#343a40';
    const lightBgColor = '#f8f9fa';
    let currentY = 20;
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.width;
    const availableWidth = pageWidth - (2 * marginX);
    const defaultLineHeight = 5;

    // Header
    doc.setFontSize(24);
    doc.setTextColor(primaryColor);
    doc.text('MehtapStore', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    doc.setFontSize(18);
    doc.text('Sepet Özeti', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    // Product table
    const tableData = [];
    let totalOriginalPrice = 0;
    let totalDiscountAmount = 0;
    let totalNetPrice = 0;

    sepet.sepet.forEach(item => {
      const urunler = safeParseJSON('urunler', []);
      const urun = urunler.find(u => u.id === item.id);
      const originalPrice = calculateOriginalPrice(item.fiyat, item.indirim);
      const indirimOrani = item.indirim || 0;
      const adet = item.adet;
      const indirimTutari = (originalPrice - item.fiyat) * adet;
      totalOriginalPrice += originalPrice * adet;
      totalDiscountAmount += indirimTutari;
      totalNetPrice += item.fiyat * adet;

      const productName = escapeHTML(item.ad);
      tableData.push([
        productName,
        `${adet}`,
        "Adet",
        `${originalPrice.toFixed(2)} TL`,
        `%${indirimOrani}`,
        `${item.fiyat.toFixed(2)} TL`,
        `${(item.fiyat * adet).toFixed(2)} TL`
      ]);
    });

    doc.autoTable({
      startY: currentY,
      head: [['Ürün Adı', 'Adet', 'Birim', 'Birim Fiyat', 'İndirim', 'Net Fiyat', 'Toplam']],
      body: tableData,
      theme: 'striped',
      styles: {
        font: typeof DejaVuSans !== 'undefined' ? 'DejaVuSans' : 'Helvetica',
        fontSize: 8,
        cellPadding: 2,
        lineColor: '#dee2e6',
        lineWidth: 0.1,
        textColor: textColor,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: '#ffffff',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: {
        halign: 'left'
      },
      didParseCell: function(data) {
        if (data.column.index === 0 && data.cell.text) {
          const text = data.cell.text.join('').trim();
          if (text.length > 40) {
            data.cell.text = doc.splitTextToSize(text.substring(0, 40) + '...', 50);
          }
        }
      },
      didDrawPage: function(data) {
        doc.setFont(typeof DejaVuSans !== 'undefined' ? 'DejaVuSans' : 'Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(secondaryColor);
        doc.text(`Sayfa ${doc.internal.getNumberOfPages()}`, pageWidth - marginX, doc.internal.pageSize.height - 10, {
          align: 'right'
        });
      }
    });

    currentY = doc.autoTable.previous.finalY + 10;

    // Ekstra indirim hesaplama
    const manualDiscountPercentage = safeParseJSON('manualDiscountPercentage', 0);
    let extraDiscountAmount = 0;
    let finalNetPrice = totalNetPrice;
    if (manualDiscountPercentage > 0) {
      extraDiscountAmount = totalNetPrice * (manualDiscountPercentage / 100);
      finalNetPrice = totalNetPrice - extraDiscountAmount;
    }

    doc.setFontSize(10);
    doc.setTextColor(textColor);
    const summaryRightAlignX = pageWidth - marginX - 3;
    const summaryLineHeight = 6;

    const totalOriginalPriceText = `Genel Toplam: ${totalOriginalPrice.toFixed(2)} TL`;
    const totalDiscountAmountText = `Toplam İndirim: ${(totalDiscountAmount + extraDiscountAmount).toFixed(2)} TL`;
    const totalNetPriceText = `Kalan Net Tutar: ${finalNetPrice.toFixed(2)} TL`;

    doc.text(totalOriginalPriceText, summaryRightAlignX - doc.getTextWidth(totalOriginalPriceText), currentY);
    currentY += summaryLineHeight;
    doc.text(totalDiscountAmountText, summaryRightAlignX - doc.getTextWidth(totalDiscountAmountText), currentY);
    currentY += summaryLineHeight;
    doc.text(totalNetPriceText, summaryRightAlignX - doc.getTextWidth(totalNetPriceText), currentY);
    currentY += summaryLineHeight * 2;

    // Sipariş açıklaması
    const cartNote = safeParseJSON('cartNote', '');
    if (cartNote.trim()) {
      doc.setFontSize(10);
      doc.setTextColor(textColor);
      doc.text('Sipariş Açıklaması:', marginX, currentY);
      currentY += summaryLineHeight;
      const noteLines = doc.splitTextToSize(cartNote, availableWidth);
      doc.text(noteLines, marginX, currentY);
      currentY += noteLines.length * summaryLineHeight + summaryLineHeight;
    }

    doc.save(`sepet_${new Date().toISOString().split('T')[0]}.pdf`);
    bildirimiGoster('Sepet PDF\'ye aktarıldı!', 'success');
  } catch (err) {
    console.error('PDF oluşturma hatası:', err);
    bildirimiGoster('PDF oluşturulamadı! Konsolu kontrol edin.', 'danger');
  }
}

// Sepeti Excel olarak indir
function exportCartToExcel() {

  const rows = sepet.sepet.map(item => {
    const urunler = safeParseJSON('urunler', []);
    const urun = urunler.find(u => u.id === item.id) || {};
    const stokKodu = item.stokKodu || urun.stokKodu || urun.id || '';
    const originalPrice = calculateOriginalPrice(item.fiyat, item.indirim);
    const netFiyat = item.fiyat;
    const adet = item.adet;
    const indirim = item.indirim || 0;
    const toplam = netFiyat * adet;

    return {
      'Ürün Kodu': stokKodu,
      'Ürün Adı': item.ad || '',
      'Adet': adet,
      'Birim': 'Adet',
      'Fiyat': Number(originalPrice.toFixed(2)),
      'İndirim': `%${indirim}`,
      'Net Fiyat': Number(netFiyat.toFixed(2)),
      'Toplam': Number(toplam.toFixed(2))
    };
  });

  // Alt toplamları hesapla
  let totalBrut = 0;
  let totalIndirim = 0;
  let totalNet = 0;
  sepet.sepet.forEach(item => {
    const originalPrice = calculateOriginalPrice(item.fiyat, item.indirim);
    const netFiyat = item.fiyat;
    const adet = item.adet;
    totalBrut += originalPrice * adet;
    totalIndirim += (originalPrice - netFiyat) * adet;
    totalNet += netFiyat * adet;
  });

  // Ekstra indirim
  const manualDiscountPercentage = safeParseJSON('manualDiscountPercentage', 0);
  let extraIndirim = 0;
  let finalNet = totalNet;
  if (manualDiscountPercentage > 0) {
    extraIndirim = totalNet * (manualDiscountPercentage / 100);
    finalNet = totalNet - extraIndirim;
  }

  // Boş satır ve alt toplamlar ekle
  rows.push({});
  rows.push({
    'Ürün Kodu': '',
    'Ürün Adı': 'Toplam Brüt Tutar',
    'Adet': '',
    'Birim': '',
    'Fiyat': '',
    'İndirim': '',
    'Net Fiyat': '',
    'Toplam': Number(totalBrut.toFixed(2))
  });
  rows.push({
    'Ürün Kodu': '',
    'Ürün Adı': 'Toplam İndirim',
    'Adet': '',
    'Birim': '',
    'Fiyat': '',
    'İndirim': '',
    'Net Fiyat': '',
    'Toplam': Number((totalIndirim + extraIndirim).toFixed(2))
  });
  rows.push({
    'Ürün Kodu': '',
    'Ürün Adı': 'Net Tutar',
    'Adet': '',
    'Birim': '',
    'Fiyat': '',
    'İndirim': '',
    'Net Fiyat': '',
    'Toplam': Number(finalNet.toFixed(2))
  });

  // Sipariş açıklaması
  const cartNote = safeParseJSON('cartNote', '');
  if (cartNote.trim()) {
    rows.push({});
    rows.push({
      'Ürün Kodu': '',
      'Ürün Adı': 'Sipariş Açıklaması',
      'Adet': '',
      'Birim': '',
      'Fiyat': '',
      'İndirim': '',
      'Net Fiyat': '',
      'Toplam': cartNote
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['Ürün Kodu','Ürün Adı','Adet','Birim','Fiyat','İndirim','Net Fiyat','Toplam'] });
  ws['!cols'] = [ { wch: 15 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 } ];
  XLSX.utils.book_append_sheet(wb, ws, 'Sepet');

  const filename = `sepet_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  bildirimiGoster('Excel dosyası indiriliyor...', 'success');
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

  const exportCartToPDFBtn = document.getElementById('exportCartToPDFBtn');
  if (exportCartToPDFBtn) {
    exportCartToPDFBtn.addEventListener('click', exportCartToPDF);
  }

  const exportCartToExcelBtn = document.getElementById('exportCartToExcelBtn');
  if (exportCartToExcelBtn) {
    exportCartToExcelBtn.addEventListener('click', exportCartToExcel);
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
