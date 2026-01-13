/**
 * RealEstateLedger.ts
 * CTG + DTree Entegrasyonu
 * 
 * NE YAPAR?
 * =========
 * Real Estate projesi için iki sistemi birleştirir:
 * 
 * 1. CTG (Canonical Triple-Graph):
 *    - Her mülke benzersiz numara verir (Ledger ID)
 *    - Maslak Tower = 59
 *    - Versiyon 1 = 118 (fiyat güncelleme)
 *    - Hisse 1 = 39, Hisse 2 = 157
 * 
 * 2. DTree:
 *    - Mülk dokümanlarının yapısını tutar
 *    - Başlık, açıklama, özellikler, sözleşme maddeleri
 *    - "şartname" ve "ödeme" aynı maddede mi? sorusuna cevap
 * 
 * NEDEN İKİSİ BİRDEN?
 * ===================
 * CTG: Kim neye sahip, ne zaman değişti (ownership, history)
 * DTree: Doküman içinde ne nerede (contextual search)
 * 
 * Örnek:
 *   "Maslak Tower'ın sözleşmesinde taksit ve ceza aynı maddede mi?"
 *   → CTG ile Maslak Tower'ı bul (ID: 59)
 *   → DTree ile sözleşme dokümanında ara
 *   → Sonuç: "Evet, Madde 5.2'de ikisi de geçiyor"
 */

// ============================================
// CTG Engine (kısaltılmış versiyon)
// ============================================

class CTGEngine {
  getOddPart(n: number): number {
    while ((n & 1) === 0) n = n >> 1;
    return n;
  }

  getParent(n: number): number | null {
    if (n === 1) return null;
    if ((n & 1) === 0) return n >> 1;
    return this.getOddPart(3 * n + 1);
  }

  getAncestryChain(n: number): number[] {
    const chain: number[] = [n];
    let current = n;
    while (current !== 1) {
      const parent = this.getParent(current);
      if (parent === null) break;
      chain.push(parent);
      current = parent;
    }
    return chain;
  }

  findChildren(parentID: number, maxSearch: number = 20): number[] {
    const children: number[] = [];
    for (let k = 1; k <= maxSearch; k++) {
      const numerator = Math.pow(2, k) * parentID - 1;
      if (numerator % 3 === 0) {
        const candidate = numerator / 3;
        if (candidate > 0 && (candidate & 1) === 1) {
          if (this.getParent(candidate) === parentID) {
            children.push(candidate);
          }
        }
      }
    }
    return children.sort((a, b) => a - b);
  }

  mintNextChild(parentID: number, existingChildren: number[]): number {
    const existingSet = new Set(existingChildren);
    const admissible = this.findChildren(parentID, 30);
    for (const candidate of admissible) {
      if (!existingSet.has(candidate)) return candidate;
    }
    throw new Error(`No available child ID for parent ${parentID}`);
  }

  mintNextVersion(n: number): number {
    return n * 2;
  }
}

// ============================================
// DTree (kısaltılmış versiyon)
// ============================================

class DTreeNode {
  id: string;
  q1: number;
  q2: number;
  data: any;
  parent: DTreeNode | null;
  children: DTreeNode[] = [];

  constructor(id: string, q1: number, q2: number, data: any, parent: DTreeNode | null = null) {
    this.id = id; this.q1 = q1; this.q2 = q2; this.data = data; this.parent = parent;
  }

  contains(other: DTreeNode): boolean {
    return this.q1 < other.q1 && this.q2 > other.q2;
  }

  getAncestryPath(): DTreeNode[] {
    const path: DTreeNode[] = [this];
    let current: DTreeNode | null = this.parent;
    while (current) { path.push(current); current = current.parent; }
    return path;
  }
}

class TokenXref {
  private index: Map<string, Set<DTreeNode>> = new Map();
  
  add(token: string, node: DTreeNode) {
    const t = token.toLowerCase();
    if (!this.index.has(t)) this.index.set(t, new Set());
    this.index.get(t)!.add(node);
  }
  
  get(token: string): DTreeNode[] {
    return Array.from(this.index.get(token.toLowerCase()) || []);
  }
}

class DTree {
  root: DTreeNode;
  xref: TokenXref = new TokenXref();
  private nextId = 1;
  private q1Counter = 0;

  constructor(data?: any) {
    this.root = new DTreeNode('node_1', 0, Number.MAX_SAFE_INTEGER, data || { type: 'document' });
  }

  appendChild(parent: DTreeNode, data: any): DTreeNode {
    this.q1Counter += 1000;
    const node = new DTreeNode(`node_${++this.nextId}`, this.q1Counter, 0, data, parent);
    parent.children.push(node);
    return node;
  }

  recalculateQ2() {
    let counter = 0;
    const traverse = (node: DTreeNode) => {
      for (const child of node.children) traverse(child);
      counter += 1000;
      node.q2 = counter;
    };
    traverse(this.root);
  }

  indexContent(node: DTreeNode, content: string) {
    const tokens = content.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    for (const t of tokens) this.xref.add(t, node);
    node.data.content = content;
  }

  findNCD(a: DTreeNode, b: DTreeNode): DTreeNode {
    if (a.contains(b)) return a;
    if (b.contains(a)) return b;
    const ancestryB = new Set(b.getAncestryPath().map(n => n.id));
    for (const ancestor of a.getAncestryPath()) {
      if (ancestryB.has(ancestor.id)) return ancestor;
    }
    return this.root;
  }

  searchAND(tokens: string[]): { context: DTreeNode; matches: Map<string, DTreeNode[]> } | null {
    const matches = new Map<string, DTreeNode[]>();
    const allNodes: DTreeNode[] = [];
    
    for (const token of tokens) {
      const nodes = this.xref.get(token);
      if (nodes.length === 0) return null;
      matches.set(token, nodes);
      allNodes.push(...nodes);
    }
    
    let ncd = allNodes[0];
    for (let i = 1; i < allNodes.length; i++) {
      ncd = this.findNCD(ncd, allNodes[i]);
    }
    
    return { context: ncd, matches };
  }
}

// ============================================
// Real Estate Ledger - Birleşik Sistem
// ============================================

interface PropertyMetadata {
  name: string;
  address: string;
  type: 'apartment' | 'office' | 'land' | 'commercial';
  area: number; // m²
  createdAt: Date;
}

interface PropertyVersion {
  versionId: number;     // CTG ID (118, 236, ...)
  timestamp: Date;
  price: number;
  currency: string;
  notes: string;
}

interface PropertyShare {
  shareId: number;       // CTG ID (39, 157, ...)
  ownerName: string;
  percentage: number;
  acquiredAt: Date;
}

interface Property {
  ledgerId: number;      // CTG ID (59)
  metadata: PropertyMetadata;
  versions: PropertyVersion[];
  shares: PropertyShare[];
  documents: DTree;      // Doküman yapısı
}

export class RealEstateLedger {
  private ctg: CTGEngine;
  private properties: Map<number, Property>;
  
  constructor() {
    this.ctg = new CTGEngine();
    this.properties = new Map();
  }

  /**
   * Yeni mülk oluştur
   * 
   * @param parentId - Üst kategori ID'si (1 = root, veya başka bir mülk)
   * @param metadata - Mülk bilgileri
   * @returns Oluşturulan mülkün Ledger ID'si
   */
  createProperty(parentId: number, metadata: PropertyMetadata): number {
    // Mevcut çocukları bul
    const existingChildren = Array.from(this.properties.keys())
      .filter(id => this.ctg.getParent(id) === parentId);
    
    // Yeni ID mint et
    const ledgerId = this.ctg.mintNextChild(parentId, existingChildren);
    
    // Boş doküman ağacı oluştur
    const documents = new DTree({ 
      type: 'property-docs', 
      propertyId: ledgerId,
      propertyName: metadata.name 
    });
    
    const property: Property = {
      ledgerId,
      metadata,
      versions: [],
      shares: [],
      documents
    };
    
    this.properties.set(ledgerId, property);
    return ledgerId;
  }

  /**
   * Fiyat güncelleme (yeni versiyon)
   */
  updatePrice(propertyId: number, price: number, currency: string, notes: string): number {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error(`Property ${propertyId} not found`);
    
    // Son versiyon ID'sini bul
    const lastVersionId = property.versions.length > 0
      ? property.versions[property.versions.length - 1].versionId
      : propertyId;
    
    // Yeni versiyon ID = 2 * önceki
    const versionId = this.ctg.mintNextVersion(lastVersionId);
    
    property.versions.push({
      versionId,
      timestamp: new Date(),
      price,
      currency,
      notes
    });
    
    return versionId;
  }

  /**
   * Hisse oluştur
   */
  createShare(propertyId: number, ownerName: string, percentage: number): number {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error(`Property ${propertyId} not found`);
    
    // Mevcut hisse ID'leri
    const existingShareIds = property.shares.map(s => s.shareId);
    
    // Yeni hisse ID mint et (mülkün çocuğu)
    const shareId = this.ctg.mintNextChild(propertyId, existingShareIds);
    
    property.shares.push({
      shareId,
      ownerName,
      percentage,
      acquiredAt: new Date()
    });
    
    return shareId;
  }

  /**
   * Doküman ekle (sözleşme, şartname vb.)
   */
  addDocument(propertyId: number, title: string, content: string): void {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error(`Property ${propertyId} not found`);
    
    const docNode = property.documents.appendChild(property.documents.root, {
      type: 'document',
      title
    });
    
    // İçeriği paragraflara böl
    const paragraphs = content.split(/\n\s*\n/);
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      
      const paraNode = property.documents.appendChild(docNode, { type: 'paragraph' });
      
      // Cümlelere böl
      const sentences = para.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
      for (const sent of sentences) {
        if (sent.trim()) {
          const sentNode = property.documents.appendChild(paraNode, { type: 'sentence' });
          property.documents.indexContent(sentNode, sent.trim());
        }
      }
    }
    
    property.documents.recalculateQ2();
  }

  /**
   * Doküman içinde ara
   */
  searchInDocuments(propertyId: number, query: string): {
    found: boolean;
    context?: string;
    matches?: { token: string; location: string }[];
  } {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error(`Property ${propertyId} not found`);
    
    const tokens = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    if (tokens.length === 0) return { found: false };
    
    const result = property.documents.searchAND(tokens);
    if (!result) return { found: false };
    
    const matches = Array.from(result.matches.entries()).map(([token, nodes]) => ({
      token,
      location: nodes.map(n => n.data.type).join(', ')
    }));
    
    return {
      found: true,
      context: result.context.data.type,
      matches
    };
  }

  /**
   * Mülk bilgilerini getir
   */
  getProperty(propertyId: number): Property | undefined {
    return this.properties.get(propertyId);
  }

  /**
   * Ancestry zincirini getir (kim kimin altında)
   */
  getAncestry(propertyId: number): number[] {
    return this.ctg.getAncestryChain(propertyId);
  }

  /**
   * Tüm mülkleri listele
   */
  getAllProperties(): Property[] {
    return Array.from(this.properties.values());
  }

  /**
   * Özet istatistikler
   */
  getStats(): {
    totalProperties: number;
    totalShares: number;
    totalVersions: number;
  } {
    let totalShares = 0;
    let totalVersions = 0;
    
    for (const property of this.properties.values()) {
      totalShares += property.shares.length;
      totalVersions += property.versions.length;
    }
    
    return {
      totalProperties: this.properties.size,
      totalShares,
      totalVersions
    };
  }
}

// ============================================
// Demo & Test
// ============================================

export function runDemo() {
  console.log('========================================');
  console.log('   REAL ESTATE LEDGER DEMO');
  console.log('========================================\n');

  const ledger = new RealEstateLedger();

  // 1. Mülk oluştur
  console.log('📍 Mülk oluşturuluyor...');
  const maslakTower = ledger.createProperty(1, {
    name: 'Maslak Tower',
    address: 'Maslak, Sarıyer, İstanbul',
    type: 'office',
    area: 5000,
    createdAt: new Date()
  });
  console.log(`   Maslak Tower oluşturuldu, Ledger ID: ${maslakTower}`);

  const kadikoyApartment = ledger.createProperty(1, {
    name: 'Kadıköy Residence',
    address: 'Moda, Kadıköy, İstanbul',
    type: 'apartment',
    area: 120,
    createdAt: new Date()
  });
  console.log(`   Kadıköy Residence oluşturuldu, Ledger ID: ${kadikoyApartment}`);

  // 2. Fiyat güncellemeleri
  console.log('\n💰 Fiyat güncellemeleri...');
  const v1 = ledger.updatePrice(maslakTower, 5000000, 'USD', 'İlk değerleme');
  console.log(`   Maslak Tower v1: ${v1} (5M USD)`);
  
  const v2 = ledger.updatePrice(maslakTower, 5500000, 'USD', 'Piyasa artışı');
  console.log(`   Maslak Tower v2: ${v2} (5.5M USD)`);

  // 3. Hisse payları
  console.log('\n👥 Hisseler oluşturuluyor...');
  const share1 = ledger.createShare(maslakTower, 'Ahmet Yılmaz', 40);
  console.log(`   Hisse 1 (Ahmet, %40): ${share1}`);
  
  const share2 = ledger.createShare(maslakTower, 'Mehmet Kaya', 35);
  console.log(`   Hisse 2 (Mehmet, %35): ${share2}`);
  
  const share3 = ledger.createShare(maslakTower, 'Ayşe Demir', 25);
  console.log(`   Hisse 3 (Ayşe, %25): ${share3}`);

  // 4. Doküman ekle
  console.log('\n📄 Sözleşme ekleniyor...');
  ledger.addDocument(maslakTower, 'Satış Sözleşmesi', `
    Madde 1: Taraflar
    Bu sözleşme alıcı ve satıcı arasında imzalanmıştır.
    Taraflar tüm şartları kabul etmiştir.

    Madde 2: Ödeme Koşulları
    Toplam bedel taksitle ödenecektir.
    Gecikme durumunda ceza uygulanır.
    Taksit planı ekte belirtilmiştir.

    Madde 3: Devir ve Teslim
    Mülkün devri ödemenin tamamlanmasından sonra yapılır.
    Teslim tarihi sözleşmede belirtilmiştir.
  `);
  console.log('   Sözleşme eklendi ve indekslendi');

  // 5. Doküman içinde ara
  console.log('\n🔍 Doküman aramaları...');
  
  const search1 = ledger.searchInDocuments(maslakTower, 'taksit ceza');
  console.log(`   "taksit ceza": ${search1.found ? '✅ Bulundu' : '❌ Bulunamadı'}`);
  if (search1.found) {
    console.log(`   Bağlam: ${search1.context}`);
  }

  const search2 = ledger.searchInDocuments(maslakTower, 'devir teslim');
  console.log(`   "devir teslim": ${search2.found ? '✅ Bulundu' : '❌ Bulunamadı'}`);
  if (search2.found) {
    console.log(`   Bağlam: ${search2.context}`);
  }

  const search3 = ledger.searchInDocuments(maslakTower, 'ipotek haciz');
  console.log(`   "ipotek haciz": ${search3.found ? '✅ Bulundu' : '❌ Bulunamadı'}`);

  // 6. Ancestry
  console.log('\n🌳 Ancestry zincirleri...');
  console.log(`   Maslak Tower: [${ledger.getAncestry(maslakTower).join(' → ')}]`);
  console.log(`   Hisse 1: [${ledger.getAncestry(share1).join(' → ')}]`);

  // 7. Özet
  console.log('\n📊 Özet:');
  const stats = ledger.getStats();
  console.log(`   Toplam mülk: ${stats.totalProperties}`);
  console.log(`   Toplam hisse: ${stats.totalShares}`);
  console.log(`   Toplam versiyon: ${stats.totalVersions}`);

  // 8. Detaylı mülk bilgisi
  console.log('\n📋 Maslak Tower Detay:');
  const property = ledger.getProperty(maslakTower);
  if (property) {
    console.log(`   Ad: ${property.metadata.name}`);
    console.log(`   Adres: ${property.metadata.address}`);
    console.log(`   Alan: ${property.metadata.area} m²`);
    console.log(`   Versiyonlar: ${property.versions.map(v => v.versionId).join(', ')}`);
    console.log(`   Hisseler: ${property.shares.map(s => `${s.ownerName}(%${s.percentage})`).join(', ')}`);
  }

  console.log('\n========================================');
  console.log('   DEMO TAMAMLANDI ✓');
  console.log('========================================\n');

  return ledger;
}

// Node.js'de çalıştırılırsa demo'yu başlat
if (typeof require !== 'undefined' && require.main === module) {
  runDemo();
}
