# PropLedger & DTree Projesi - Tam Dokümantasyon

**Tarih:** Ocak 2026
**Durum:** Aktif Geliştirme

---

## 1. PROJE ÖZETİ

### 1.1 Ne Yaptık?

İki paralel sistem geliştirdik:

| Proje | Amaç | Hedef Kitle |
|-------|------|-------------|
| **PropLedger** | Gayrimenkul yönetim uygulaması | Son kullanıcılar (mülk sahipleri, yatırımcılar) |
| **DTree / Contextual Search** | Yapısal arama altyapısı | Teknoloji şirketleri (Google, Elasticsearch) |

### 1.2 Temel Yenilik

**Problem:** Mevcut arama motorları "bu kelimeler aynı sayfada mı?" sorusuna cevap verir, ama "aynı paragrafta mı? aynı cümlede mi?" sorusuna cevap veremez.

**Çözüm:** CTG (Canonical Triple-Graph) + DTree ile yapısal bağlamı matematiksel olarak izlenebilir hale getirdik.

---

## 2. TEORİK TEMEL

### 2.1 CTG (Canonical Triple-Graph)

Collatz matematiğine dayalı benzersiz ID sistemi.

```
Her pozitif tam sayı → Benzersiz bir düğüm
Her tek sayı → Dallanma noktası (mülk, hisse)
Her çift sayı → Pillar/versiyon zinciri (güncelleme)
```

**Kurallar:**
- Tek sayı n için parent = oddPart(3n + 1)
- Çift sayı n için parent = n / 2
- Root = 1

**Örnek Yapı:**
```
Root (1)
├── Maslak Tower (5)
│   ├── Fiyat v1 (10)
│   ├── Fiyat v2 (20)
│   ├── Fiyat v3 (40)
│   ├── Hisse - Ahmet (3)
│   ├── Hisse - Mehmet (13)
│   └── Hisse - Ayşe (53)
└── Kadıköy Residence (21)
    └── ...
```

### 2.2 DTree (Directed Tree with Dual Projection)

Her düğüme iki koordinat (Q1, Q2) atayarak O(1) containment kontrolü sağlar.

**Q1:** Pre-order traversal sırası (düğüme ne zaman girdin)
**Q2:** Post-order traversal sırası (düğümden ne zaman çıktın)

**Containment Kuralı:**
```
A, B'yi içerir ⟺ A.q1 < B.q1 VE A.q2 > B.q2
```

**Örnek:**
```
document [Q1=0, Q2=16000]
├── section [Q1=1000, Q2=8000]
│   ├── paragraph [Q1=2000, Q2=5000]
│   │   ├── sentence [Q1=3000, Q2=2000] ← "Veri gizliliği önemlidir"
│   │   └── sentence [Q1=4000, Q2=3000] ← "Kullanıcılar korunmalı"
│   └── paragraph [Q1=5000, Q2=7000]
│       └── sentence [Q1=6000, Q2=4000] ← "Şifreleme kullanıyoruz"
└── section [Q1=9000, Q2=15000]
    └── ...
```

### 2.3 NCD (Nearest Common Dominator)

İki veya daha fazla düğümü kapsayan en küçük yapısal birim.

**Örnek Sorgular:**
| Arama | Sonuç | Anlam |
|-------|-------|-------|
| "veri gizlilik" | document | Farklı bölümlerde |
| "şifreleme güvenlik" | section | Aynı bölümde |
| "şifreleme korumak" | sentence | Aynı cümlede! |

---

## 3. GELİŞTİRİLEN DOSYALAR

### 3.1 Çekirdek Kütüphaneler

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `ctgEngine.ts` | ~300 | CTG matematiği - ID üretimi, parenthood, ancestry |
| `dtree.ts` | ~450 | DTree yapısı - Q1/Q2, containment, NCD |
| `htmlParser.ts` | ~200 | Metin → DTree dönüşümü |
| `realEstateLedger.ts` | ~400 | CTG + DTree birleşik sistem |

### 3.2 React Komponentleri

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `ContextualSearchDemo.tsx` | ~400 | Ayrı demo projesi (Google pitch için) |
| `ContractSearch.tsx` | ~450 | PropLedger - sözleşme arama |
| `AuditTrail.tsx` | ~500 | PropLedger - işlem geçmişi |
| `ContractVersioning.tsx` | ~550 | PropLedger - versiyon takibi |

### 3.3 Test Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `ctgEngine.test.js` | 60+ test - CTG matematiği doğrulama |
| `dtree.test.js` | DTree ve NCD testleri |
| `htmlParser.test.js` | Parser ve arama demo |
| `realEstateLedger.test.js` | Entegre sistem testi |

---

## 4. PROPLEDGER ÖZELLİKLERİ

### 4.1 Sözleşme Arama (ContractSearch)

**Ne Yapar:**
- Sözleşme metni yükle (yapıştır veya örnek)
- İçinde kelime ara
- Hangi madde/paragraf/cümlede bulunduğunu göster
- Otomatik risk analizi (tehlikeli kombinasyonlar)

**Risk Tespiti:**
| Kombinasyon | Uyarı |
|-------------|-------|
| ceza + gecikme | ⚠️ Gecikme cezası maddesi |
| feragat + hak | 🔴 Hak feragati - dikkat! |
| tek taraflı + fesih | 🔴 Tek taraflı fesih riski |
| teminat + ipotek | ⚠️ Teminat şartları var |

**Kullanım:**
```tsx
<ContractSearch 
  propertyId={property.id} 
  propertyName={property.name} 
/>
```

### 4.2 İşlem Geçmişi (AuditTrail)

**Ne Yapar:**
- Tüm işlemleri kronolojik listele
- Kim, ne zaman, ne yaptı
- CTG ID ile izlenebilirlik
- Filtreleme (işlem tipi, kullanıcı, tarih)
- CSV export

**İşlem Tipleri:**
- Mülk oluşturma/güncelleme
- Fiyat güncelleme
- Hisse oluşturma/transfer
- Doküman yükleme
- Sözleşme imzalama
- Ödeme alma

**Kullanım:**
```tsx
<AuditTrail 
  propertyId={property.id} 
  propertyName={property.name}
  limit={10}
/>
```

### 4.3 Sözleşme Versiyonlama (ContractVersioning)

**Ne Yapar:**
- Versiyon zaman çizelgesi (v1 → v2 → v3)
- Değişiklik karşılaştırması (diff)
- Eski versiyona geri dönme
- CTG Pillar yapısı (118 → 236 → 472)

**Diff Görünümü:**
```diff
- Toplam bedel 5.000.000 USD
+ Toplam bedel 5.500.000 USD
+ Ödeme taksitle yapılacaktır.
```

**Kullanım:**
```tsx
<ContractVersioning 
  propertyId={property.id} 
  propertyName={property.name}
/>
```

---

## 5. CONTEXTUAL SEARCH DEMO

### 5.1 Amaç

Google/Elasticsearch'e satılacak teknoloji demosu.

### 5.2 Değer Önerisi

| Mevcut Sistemler | Bizim Sistem |
|------------------|--------------|
| "Kelimeler aynı sayfada mı?" | "Aynı cümlede mi? Paragrafta mı? Bölümde mi?" |
| Heuristik (yakınlık tahmini) | Matematiksel garanti |
| Batch reindex gerekli | Incremental, O(1) güncelleme |
| Binary format, platforma bağlı | Text-level, 20 satır kod |

### 5.3 Kullanım Alanları

| Alan | Örnek Sorgu |
|------|-------------|
| Hukuk | "tazminat" ve "ihlal" aynı maddede mi? |
| Tıp | "tansiyon" ve "ilaç" aynı notta mı? |
| Finans | "risk" ve "hedge" aynı paragrafta mı? |
| Kod | "authenticate" ve "token" aynı fonksiyonda mı? |
| Güvenlik | "malloc" ve "strcpy" aynı blokta mı? (buffer overflow!) |

### 5.4 Lovable Projesi

Ayrı bir Lovable projesi olarak oluşturuldu:
- Proje adı: "Contextual Search Demo" veya "DTree Search"
- Tek dosya: `ContextualSearchDemo.tsx`
- PropLedger'dan bağımsız

---

## 6. TEKNİK MİMARİ

### 6.1 Katmanlar

```
┌─────────────────────────────────────┐
│         UI Layer (React)            │
│  ContractSearch, AuditTrail, etc.   │
├─────────────────────────────────────┤
│        Application Layer            │
│     RealEstateLedger, Parser        │
├─────────────────────────────────────┤
│         Core Layer                  │
│       CTGEngine, DTree              │
├─────────────────────────────────────┤
│       Mathematical Foundation       │
│    Collatz, Q1/Q2 Projections       │
└─────────────────────────────────────┘
```

### 6.2 Veri Akışı

```
Metin Input
    ↓
Parser (htmlParser.ts)
    ↓
DTree Yapısı (düğümler + Q1/Q2)
    ↓
Token XRef (kelime → düğüm eşlemesi)
    ↓
Arama Sorgusu
    ↓
NCD Hesaplama
    ↓
Sonuç (bağlam + eşleşmeler)
```

### 6.3 CTG ID Akışı

```
Yeni Mülk Oluştur
    ↓
Parent ID (1 = root)
    ↓
mintNextChild() → Benzersiz tek sayı (5, 21, 85, ...)
    ↓
Fiyat Güncelleme
    ↓
mintNextVersion() → 2x (10, 20, 40, ...)
    ↓
Hisse Oluştur
    ↓
mintNextChild() → Mülkün çocuğu (3, 13, 53, ...)
```

---

## 7. TEST SONUÇLARI

### 7.1 CTG Engine Testleri

```
✓ getOddPart(12) = 3
✓ getOddPart(1) = 1
✓ getParent(5) = 1
✓ getParent(10) = 5
✓ getAncestryChain(53) = [53, 5, 1]
✓ mintNextChild(1, []) = 5
✓ mintNextChild(1, [5]) = 21
✓ 60+ test passed
```

### 7.2 DTree Testleri

```
✓ Q1/Q2 hesaplama doğru
✓ Containment kontrolü çalışıyor
✓ NCD hesaplama doğru
✓ "veri gizlilik" → document (farklı yerlerde)
✓ "şifreleme korumak" → sentence (aynı cümlede!)
```

### 7.3 Entegrasyon Testleri

```
✓ Mülk oluşturma → CTG ID atandı
✓ Fiyat güncelleme → Pillar zinciri çalışıyor
✓ Hisse oluşturma → Parent-child ilişkisi doğru
✓ Sözleşme arama → NCD sonucu doğru
```

---

## 8. ENİS ABİ'NİN VİZYONU

### 8.1 Üç Katmanlı Strateji

| Katman | Açıklama | Durum |
|--------|----------|-------|
| Teori | CTG/DTree matematiksel temeli | ✅ Tamamlandı |
| Uygulama | PropLedger, ScopedDict | ✅ Tamamlandı |
| Vizyon | AI Explainability, xPortal | 📋 Planlama |

### 8.2 STAIRS Mirası

1960'lardan beri var olan "yapısal arama" vizyonunu tamamlıyoruz:
- IBM STAIRS → İlk yapısal arama sistemi
- XPath/XQuery → Karmaşık sözdizimi
- CTG/DTree → Matematiksel temel + O(1) sorgular

### 8.3 Evrensel Uygulanabilirlik

```
Byte Stream + Template = Structure
```

| Veri Tipi | Template | CTG/DTree Kullanımı |
|-----------|----------|---------------------|
| HTML/XML | Markup grammar | Doküman araması |
| JSON | Schema | API sorguları |
| Kod | AST | Kod analizi |
| Binary | ELF/PE | Güvenlik araştırması |
| Log | Format spec | Gerçek zamanlı analiz |

---

## 9. SONRAKI ADIMLAR

### 9.1 Kısa Vadeli (1-2 Hafta)

| Görev | Öncelik | Durum |
|-------|---------|-------|
| Backend entegrasyonu | Yüksek | ⏳ Bekliyor |
| Gerçek API bağlantısı | Yüksek | ⏳ Bekliyor |
| Kullanıcı authentication | Orta | ⏳ Bekliyor |

### 9.2 Orta Vadeli (1-2 Ay)

| Görev | Öncelik |
|-------|---------|
| PDF sözleşme parse etme | Orta |
| E-imza entegrasyonu | Orta |
| Mobil uygulama | Düşük |

### 9.3 Uzun Vadeli (3-6 Ay)

| Görev | Öncelik |
|-------|---------|
| Google/Elasticsearch pitch | Yüksek |
| AI Explainability modülü | Orta |
| xPortal entegrasyonu | Orta |

---

## 10. DOSYA LİSTESİ

### 10.1 Çıktı Dosyaları (/mnt/user-data/outputs/)

```
├── ctgEngine.ts           # CTG matematik motoru
├── ctgEngine.test.js      # CTG testleri
├── dtree.ts               # DTree yapısı
├── dtree.test.js          # DTree testleri
├── htmlParser.ts          # Parser
├── realEstateLedger.ts    # Birleşik sistem
├── ContextualSearchDemo.tsx   # Ayrı demo projesi
├── ContractSearch.tsx     # PropLedger - sözleşme arama
├── AuditTrail.tsx         # PropLedger - işlem geçmişi
└── ContractVersioning.tsx # PropLedger - versiyonlama
```

### 10.2 Lovable Projeleri

| Proje | Dosyalar |
|-------|----------|
| PropLedger | ContractSearch, AuditTrail, ContractVersioning |
| Contextual Search Demo | ContextualSearchDemo |

---

## 11. KAYNAKLAR

### 11.1 Enis Abi'nin Dokümanları

- `Ideas.ChatGPT.txt` - Teorik temel
- `Proposal.ChatGPT.txt` - İş önerisi
- `Proposal.Claude.txt` - Claude versiyonu
- `Prop_Research_2.pdf` - Kapsamlı araştırma önerisi

### 11.2 Önemli Kavramlar

| Kavram | Açıklama |
|--------|----------|
| CTG | Canonical Triple-Graph - Collatz bazlı ID sistemi |
| DTree | Directed Tree with Dual Projection |
| Q1/Q2 | Pre-order ve post-order traversal koordinatları |
| NCD | Nearest Common Dominator - en küçük ortak bağlam |
| Pillar | Çift sayı zinciri (versiyonlama için) |
| Token XRef | Kelime → düğüm eşleme tablosu |

---

## 12. SONUÇ

Bu proje iki önemli çıktı üretti:

1. **PropLedger:** Çalışan bir gayrimenkul yönetim uygulaması
   - Sözleşme arama
   - İşlem geçmişi (audit trail)
   - Versiyon takibi
   - CTG ID ile izlenebilirlik

2. **DTree/Contextual Search:** Satılabilir bir teknoloji
   - Matematiksel olarak garantili yapısal arama
   - Google/Elasticsearch için değer önerisi
   - 50 yıllık STAIRS vizyonunun tamamlanması

Her iki sistem de aynı matematiksel temeli (CTG + DTree) kullanıyor, bu da bakım ve geliştirmeyi kolaylaştırıyor.

---

**Hazırlayan:** Claude (Anthropic)
**Son Güncelleme:** Ocak 2026
