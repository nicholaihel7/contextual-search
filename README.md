# CTG/DTree - Yapısal Bağlamsal Arama

> **"Bu kelimeler aynı cümlede mi, aynı paragrafta mı?"** sorusuna matematiksel olarak kesin cevap veren arama altyapısı.

---

## 🎯 Problem

Google'da "privacy data" aradığınızda:
- ✅ İki kelime aynı **sayfada** mı? → Cevap verebilir
- ❌ İki kelime aynı **paragrafta** mı? → Cevap veremez
- ❌ İki kelime aynı **cümlede** mi? → Cevap veremez

## 💡 Çözüm

CTG/DTree ile:
- Her yapısal birim (doküman, bölüm, paragraf, cümle) benzersiz ID alır
- Q1/Q2 koordinatları ile O(1) containment kontrolü
- NCD (Nearest Common Dominator) ile en küçük ortak bağlam

```
Arama: "şifreleme korumak"
Sonuç: ✅ Cümle seviyesinde bulundu!
       → "Verilerinizi korumak için şifreleme kullanıyoruz."
```

---

## 📁 Proje Yapısı

```
├── src/
│   ├── core/
│   │   ├── ctgEngine.ts      # CTG matematiği (Collatz bazlı ID)
│   │   └── dtree.ts          # DTree yapısı (Q1/Q2 projeksiyon)
│   ├── parser/
│   │   └── htmlParser.ts     # Metin → DTree dönüşümü
│   ├── components/
│   │   ├── ContextualSearchDemo.tsx  # Ana demo UI
│   │   ├── ContractSearch.tsx        # Sözleşme arama
│   │   ├── AuditTrail.tsx            # İşlem geçmişi
│   │   └── ContractVersioning.tsx    # Versiyon takibi
│   └── realEstateLedger.ts   # CTG + DTree birleşik sistem
├── tests/
│   ├── ctgEngine.test.js     # CTG testleri (60+)
│   └── dtree.test.js         # DTree ve NCD testleri
└── docs/
    └── PROJECT_DOCUMENTATION.md  # Tam dokümantasyon
```

---

## 🧮 Temel Kavramlar

### CTG (Canonical Triple-Graph)

Collatz matematiğine dayalı benzersiz ID sistemi:

```
Root (1)
├── Mülk A (5)
│   ├── Versiyon 1 (10)    ← 5 × 2
│   ├── Versiyon 2 (20)    ← 10 × 2
│   ├── Hisse 1 (3)        ← oddPart(3×5+1) = 1, child of 5
│   └── Hisse 2 (13)
└── Mülk B (21)
```

**Kurallar:**
- Tek sayı n → parent = oddPart(3n + 1)
- Çift sayı n → parent = n / 2

### DTree (Dual Projection)

Her düğüme iki koordinat:
- **Q1:** Pre-order (düğüme giriş sırası)
- **Q2:** Post-order (düğümden çıkış sırası)

**Containment:** A, B'yi içerir ⟺ `A.q1 < B.q1 && A.q2 > B.q2`

```
document [Q1=0, Q2=16000]
└── section [Q1=1000, Q2=8000]
    └── paragraph [Q1=2000, Q2=5000]
        └── sentence [Q1=3000, Q2=2000]
```

### NCD (Nearest Common Dominator)

İki düğümü kapsayan en küçük ortak ata:

| Arama | Sonuç | Anlam |
|-------|-------|-------|
| "veri gizlilik" | document | Farklı bölümlerde |
| "şifreleme güvenlik" | section | Aynı bölümde |
| "şifreleme korumak" | sentence | Aynı cümlede! ✓ |

---

## 🚀 Hızlı Başlangıç

### Testleri Çalıştır

```bash
# CTG testleri
node tests/ctgEngine.test.js

# DTree testleri
node tests/dtree.test.js
```

### Demo (React)

```tsx
import ContextualSearchDemo from './src/components/ContextualSearchDemo';

function App() {
  return <ContextualSearchDemo />;
}
```

---

## 📊 Karşılaştırma

| Özellik | Google/Elasticsearch | CTG/DTree |
|---------|---------------------|-----------|
| Sayfa içi arama | ✅ | ✅ |
| Paragraf içi arama | ❌ | ✅ |
| Cümle içi arama | ❌ | ✅ |
| Matematiksel garanti | ❌ (heuristik) | ✅ |
| Incremental güncelleme | ❌ (reindex) | ✅ O(1) |
| Text-level persistence | ❌ (binary) | ✅ |

---

## 🎯 Kullanım Alanları

| Alan | Örnek Sorgu |
|------|-------------|
| **Hukuk** | "tazminat" ve "ihlal" aynı maddede mi? |
| **Tıp** | "tansiyon" ve "ilaç" aynı notta mı? |
| **Finans** | "risk" ve "hedge" aynı paragrafta mı? |
| **Kod** | "authenticate" ve "token" aynı fonksiyonda mı? |
| **Güvenlik** | "malloc" ve "strcpy" aynı blokta mı? |

---

## 📚 Dokümantasyon

Detaylı dokümantasyon için: [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md)

---

## 🔗 İlgili Projeler

- **PropLedger:** Bu altyapıyı kullanan gayrimenkul yönetim uygulaması
- **Contextual Search Demo:** Lovable'da çalışan interaktif demo

---

## 📄 Lisans

MIT

---

## 👥 Katkıda Bulunanlar

- Enis Abi - Teori ve vizyon
- Sinan - Geliştirme
- Claude (Anthropic) - Implementasyon desteği
