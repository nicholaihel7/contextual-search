/**
 * DTree - Directed Tree with Dual Projection
 * 
 * Doküman yapısını temsil eden ağaç yapısı.
 * Her düğümün iki indeksi var: Q1 ve Q2 (dual projection)
 * 
 * Temel Kural:
 * A düğümü B düğümünü İÇERİR ⟺ A.q1 < B.q1 VE A.q2 > B.q2
 * (A, B'den önce başlar VE B'den sonra biter - interval containment)
 * 
 * Bu basit kural sayesinde:
 * - Containment O(1) ile kontrol edilir
 * - NCD (Nearest Common Dominator) hızlıca bulunur
 * - Incremental ekleme mümkün (kesirli indeksler)
 * 
 * Kullanım Alanları:
 * - Contextual Search: "Bu kelimeler aynı paragrafta mı?"
 * - Doküman yapısı: Journal > Article > Section > Paragraph > Sentence
 * - Real Estate: Property > Shares, Property > Updates
 */

export type NodeType = 
  | 'root'
  | 'document'
  | 'section'
  | 'paragraph'
  | 'sentence'
  | 'list'
  | 'list-item'
  | 'generic';

export interface DTreeNodeData {
  type: NodeType;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DTree Düğümü
 */
export class DTreeNode {
  public id: string;
  public q1: number;
  public q2: number;
  public data: DTreeNodeData;
  public parent: DTreeNode | null;
  public children: DTreeNode[];
  
  // Bidirectional linked list için (sibling navigation)
  public prevSibling: DTreeNode | null;
  public nextSibling: DTreeNode | null;

  constructor(
    id: string,
    q1: number,
    q2: number,
    data: DTreeNodeData,
    parent: DTreeNode | null = null
  ) {
    this.id = id;
    this.q1 = q1;
    this.q2 = q2;
    this.data = data;
    this.parent = parent;
    this.children = [];
    this.prevSibling = null;
    this.nextSibling = null;
  }

  /**
   * Bu düğüm other düğümünü içeriyor mu?
   * 
   * Dual Projection Kuralı:
   * A contains B ⟺ A.q1 < B.q1 AND A.q2 > B.q2
   * (A, B'den önce başlar VE B'den sonra biter)
   */
  contains(other: DTreeNode): boolean {
    return this.q1 < other.q1 && this.q2 > other.q2;
  }

  /**
   * Bu düğüm other düğümünün içinde mi?
   */
  isContainedBy(other: DTreeNode): boolean {
    return other.contains(this);
  }

  /**
   * İki düğüm aynı mı?
   */
  equals(other: DTreeNode): boolean {
    return this.id === other.id;
  }

  /**
   * Köke giden yol (ancestry chain)
   */
  getAncestryPath(): DTreeNode[] {
    const path: DTreeNode[] = [this];
    let current: DTreeNode | null = this.parent;
    while (current !== null) {
      path.push(current);
      current = current.parent;
    }
    return path;
  }

  /**
   * Yaprak düğüm mü?
   */
  isLeaf(): boolean {
    return this.children.length === 0;
  }

  /**
   * Kök düğüm mü?
   */
  isRoot(): boolean {
    return this.parent === null;
  }

  /**
   * Derinlik (root = 0)
   */
  getDepth(): number {
    let depth = 0;
    let current: DTreeNode | null = this.parent;
    while (current !== null) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Subtree'deki tüm düğümler (pre-order traversal)
   */
  getSubtree(): DTreeNode[] {
    const result: DTreeNode[] = [this];
    for (const child of this.children) {
      result.push(...child.getSubtree());
    }
    return result;
  }
}

/**
 * Token Cross-Reference
 * Kelimeleri yapısal düğümlere eşler
 */
export interface TokenOccurrence {
  token: string;
  node: DTreeNode;
  position?: number; // Düğüm içindeki pozisyon (opsiyonel)
}

export class TokenXref {
  private index: Map<string, Set<DTreeNode>>;

  constructor() {
    this.index = new Map();
  }

  /**
   * Token'ı düğüme ekle
   */
  add(token: string, node: DTreeNode): void {
    const normalizedToken = token.toLowerCase().trim();
    if (!this.index.has(normalizedToken)) {
      this.index.set(normalizedToken, new Set());
    }
    this.index.get(normalizedToken)!.add(node);
  }

  /**
   * Birden fazla token ekle
   */
  addMany(tokens: string[], node: DTreeNode): void {
    for (const token of tokens) {
      this.add(token, node);
    }
  }

  /**
   * Token'ın geçtiği düğümleri getir
   */
  get(token: string): DTreeNode[] {
    const normalizedToken = token.toLowerCase().trim();
    const nodes = this.index.get(normalizedToken);
    return nodes ? Array.from(nodes) : [];
  }

  /**
   * Token var mı?
   */
  has(token: string): boolean {
    return this.index.has(token.toLowerCase().trim());
  }

  /**
   * Düğümü tüm token'lardan kaldır
   */
  removeNode(node: DTreeNode): void {
    for (const [, nodes] of this.index) {
      nodes.delete(node);
    }
  }

  /**
   * Tüm token'ları listele
   */
  getAllTokens(): string[] {
    return Array.from(this.index.keys());
  }

  /**
   * İstatistikler
   */
  getStats(): { tokenCount: number; totalOccurrences: number } {
    let totalOccurrences = 0;
    for (const nodes of this.index.values()) {
      totalOccurrences += nodes.size;
    }
    return {
      tokenCount: this.index.size,
      totalOccurrences,
    };
  }
}

/**
 * DTree - Ana Ağaç Yapısı
 */
export class DTree {
  public root: DTreeNode;
  public xref: TokenXref;
  private nodeMap: Map<string, DTreeNode>;
  private nextId: number;

  // Q1/Q2 için spacing (yeni düğümler araya girebilsin)
  private readonly INITIAL_SPACING = 1000;

  constructor(rootData?: DTreeNodeData) {
    this.nextId = 1;
    this.nodeMap = new Map();
    this.xref = new TokenXref();

    // Root düğümü oluştur
    this.root = new DTreeNode(
      this.generateId(),
      0, // Q1 = 0 (pre-order start)
      Number.MAX_SAFE_INTEGER, // Q2 = MAX (post-order, root closes last)
      rootData || { type: 'root' }
    );
    this.nodeMap.set(this.root.id, this.root);
  }

  /**
   * Unique ID üret
   */
  private generateId(): string {
    return `node_${this.nextId++}`;
  }

  /**
   * İki değer arasında orta nokta (incremental insertion için)
   */
  private midpoint(a: number, b: number): number {
    return (a + b) / 2;
  }

  // Global counter'lar - pre/post order için
  private q1Counter: number = 0;
  private q2Counter: number = 0;

  /**
   * Çocuk düğüm için Q1/Q2 hesapla
   * 
   * Dual Projection Kuralı:
   * - Q1: Pre-order sırası (parent'tan önce, child'lar soldan sağa)
   * - Q2: Post-order sırası (child'lar bittikten sonra parent kapanır)
   * 
   * Containment: A contains B ⟺ A.q1 < B.q1 AND A.q2 > B.q2
   * (A, B'den önce başlar VE B'den sonra biter)
   */
  private calculateChildIndices(
    parent: DTreeNode,
    afterSibling?: DTreeNode
  ): { q1: number; q2: number } {
    // Q1: Her yeni düğüm bir sonraki pre-order değeri alır
    this.q1Counter += this.INITIAL_SPACING;
    const q1 = this.q1Counter;

    // Q2: Şimdilik geçici değer, finalize'da düzeltilecek
    // Sibling'ler arasında Q2 artmalı ama parent'ınkinden küçük kalmalı
    const siblings = parent.children;
    
    let q2: number;
    if (siblings.length === 0 || !afterSibling) {
      // İlk çocuk veya başa ekleme
      q2 = parent.q2 + this.INITIAL_SPACING;
    } else {
      // Sibling'den sonra ekleme - Q2 de artmalı
      q2 = afterSibling.q2 + this.INITIAL_SPACING;
    }

    return { q1, q2 };
  }

  /**
   * Q2 değerlerini post-order olarak yeniden hesapla
   * Bu metod ağaç yapısı değiştikten sonra çağrılmalı
   */
  recalculateQ2(): void {
    let counter = 0;
    const traverse = (node: DTreeNode) => {
      for (const child of node.children) {
        traverse(child);
      }
      counter += this.INITIAL_SPACING;
      node.q2 = counter;
    };
    traverse(this.root);
  }

  /**
   * Yeni düğüm ekle
   */
  addNode(
    parent: DTreeNode,
    data: DTreeNodeData,
    afterSibling?: DTreeNode
  ): DTreeNode {
    const { q1, q2 } = this.calculateChildIndices(parent, afterSibling);
    const node = new DTreeNode(this.generateId(), q1, q2, data, parent);

    // Sibling bağlantıları
    if (afterSibling) {
      node.prevSibling = afterSibling;
      node.nextSibling = afterSibling.nextSibling;
      if (afterSibling.nextSibling) {
        afterSibling.nextSibling.prevSibling = node;
      }
      afterSibling.nextSibling = node;

      // Children array'e doğru pozisyona ekle
      const index = parent.children.indexOf(afterSibling);
      parent.children.splice(index + 1, 0, node);
    } else {
      // En başa ekle
      if (parent.children.length > 0) {
        const firstChild = parent.children[0];
        node.nextSibling = firstChild;
        firstChild.prevSibling = node;
      }
      parent.children.unshift(node);
    }

    this.nodeMap.set(node.id, node);
    return node;
  }

  /**
   * Düğümü sona ekle (en yaygın kullanım)
   */
  appendChild(parent: DTreeNode, data: DTreeNodeData): DTreeNode {
    const lastChild = parent.children[parent.children.length - 1];
    return this.addNode(parent, data, lastChild);
  }

  /**
   * ID ile düğüm bul
   */
  getNode(id: string): DTreeNode | undefined {
    return this.nodeMap.get(id);
  }

  /**
   * Düğümü sil (ve subtree'sini)
   */
  removeNode(node: DTreeNode): void {
    if (node.isRoot()) {
      throw new Error('Root düğüm silinemez');
    }

    // Subtree'deki tüm düğümleri xref'ten ve map'ten kaldır
    const subtree = node.getSubtree();
    for (const n of subtree) {
      this.xref.removeNode(n);
      this.nodeMap.delete(n.id);
    }

    // Parent'tan kaldır
    const parent = node.parent!;
    const index = parent.children.indexOf(node);
    parent.children.splice(index, 1);

    // Sibling bağlantılarını güncelle
    if (node.prevSibling) {
      node.prevSibling.nextSibling = node.nextSibling;
    }
    if (node.nextSibling) {
      node.nextSibling.prevSibling = node.prevSibling;
    }
  }

  /**
   * Containment kontrolü (A, B'yi içeriyor mu?)
   */
  contains(a: DTreeNode, b: DTreeNode): boolean {
    return a.contains(b);
  }

  /**
   * Nearest Common Dominator (NCD) - İki düğümün en yakın ortak atası
   * 
   * Kural: NCD'nin Q1 ve Q2'si her iki düğümünkinden de küçük olmalı
   */
  findNCD(nodeA: DTreeNode, nodeB: DTreeNode): DTreeNode {
    // Aynı düğüm
    if (nodeA.equals(nodeB)) {
      return nodeA;
    }

    // Biri diğerini içeriyorsa
    if (nodeA.contains(nodeB)) return nodeA;
    if (nodeB.contains(nodeA)) return nodeB;

    // Her iki düğümün ancestry'sini al
    const ancestryA = nodeA.getAncestryPath();
    const ancestryB = new Set(nodeB.getAncestryPath().map(n => n.id));

    // A'nın ancestry'sinde B'nin ancestry'siyle kesişen ilk düğüm
    for (const ancestor of ancestryA) {
      if (ancestryB.has(ancestor.id)) {
        return ancestor;
      }
    }

    // Her zaman en azından root'ta kesişmeli
    return this.root;
  }

  /**
   * Birden fazla düğüm için NCD
   */
  findNCDMultiple(nodes: DTreeNode[]): DTreeNode {
    if (nodes.length === 0) {
      return this.root;
    }
    if (nodes.length === 1) {
      return nodes[0];
    }

    let ncd = nodes[0];
    for (let i = 1; i < nodes.length; i++) {
      ncd = this.findNCD(ncd, nodes[i]);
    }
    return ncd;
  }

  /**
   * Contextual Search - AND sorgusu
   * 
   * Verilen tüm token'ların geçtiği en dar yapısal bağlamı bulur.
   * "privacy AND data" → Her ikisinin de geçtiği en küçük paragraf/bölüm
   */
  searchAND(tokens: string[]): { context: DTreeNode; occurrences: Map<string, DTreeNode[]> } | null {
    const occurrences = new Map<string, DTreeNode[]>();
    const allNodes: DTreeNode[] = [];

    for (const token of tokens) {
      const nodes = this.xref.get(token);
      if (nodes.length === 0) {
        // Token bulunamadı, AND sorgusu başarısız
        return null;
      }
      occurrences.set(token, nodes);
      allNodes.push(...nodes);
    }

    const context = this.findNCDMultiple(allNodes);
    return { context, occurrences };
  }

  /**
   * Contextual Search - OR sorgusu
   * 
   * Verilen token'lardan herhangi birinin geçtiği tüm bağlamları bulur.
   */
  searchOR(tokens: string[]): { contexts: DTreeNode[]; occurrences: Map<string, DTreeNode[]> } {
    const occurrences = new Map<string, DTreeNode[]>();
    const allNodes: DTreeNode[] = [];

    for (const token of tokens) {
      const nodes = this.xref.get(token);
      occurrences.set(token, nodes);
      allNodes.push(...nodes);
    }

    // Her occurrence'ın parent'ını context olarak döndür (veya kendisi leaf değilse)
    const contexts = [...new Set(allNodes.map(n => n.isLeaf() ? n.parent || n : n))];
    return { contexts, occurrences };
  }

  /**
   * Belirli bir seviyeye "lift" et (örn: sentence → paragraph)
   */
  liftToLevel(node: DTreeNode, targetType: NodeType): DTreeNode {
    let current: DTreeNode | null = node;
    while (current !== null) {
      if (current.data.type === targetType) {
        return current;
      }
      current = current.parent;
    }
    return this.root;
  }

  /**
   * Düğüm içeriğini tokenize edip xref'e ekle
   */
  indexContent(node: DTreeNode, content: string): void {
    // Basit tokenization (gerçek uygulamada daha sofistike olabilir)
    const tokens = content
      .toLowerCase()
      .split(/\s+/)
      .map(t => t.replace(/[^\w]/g, ''))
      .filter(t => t.length > 0);

    this.xref.addMany(tokens, node);
    node.data.content = content;
  }

  /**
   * Subtree'yi kopyala (bağımsız bir kopya)
   */
  copySubtree(node: DTreeNode): DTreeNode {
    const copy = new DTreeNode(
      this.generateId(),
      node.q1,
      node.q2,
      { ...node.data },
      null // Parent yok, bağımsız kopya
    );

    for (const child of node.children) {
      const childCopy = this.copySubtreeRecursive(child, copy);
      copy.children.push(childCopy);
    }

    // Sibling bağlantılarını kur
    for (let i = 0; i < copy.children.length; i++) {
      if (i > 0) {
        copy.children[i].prevSibling = copy.children[i - 1];
      }
      if (i < copy.children.length - 1) {
        copy.children[i].nextSibling = copy.children[i + 1];
      }
    }

    return copy;
  }

  private copySubtreeRecursive(node: DTreeNode, newParent: DTreeNode): DTreeNode {
    const copy = new DTreeNode(
      this.generateId(),
      node.q1,
      node.q2,
      { ...node.data },
      newParent
    );

    for (const child of node.children) {
      const childCopy = this.copySubtreeRecursive(child, copy);
      copy.children.push(childCopy);
    }

    return copy;
  }

  /**
   * Ağacı JSON olarak serialize et (save için)
   */
  serialize(): string {
    const serializeNode = (node: DTreeNode): object => ({
      id: node.id,
      q1: node.q1,
      q2: node.q2,
      data: node.data,
      children: node.children.map(serializeNode),
    });

    return JSON.stringify({
      tree: serializeNode(this.root),
      xref: this.serializeXref(),
    }, null, 2);
  }

  private serializeXref(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const token of this.xref.getAllTokens()) {
      result[token] = this.xref.get(token).map(n => n.id);
    }
    return result;
  }

  /**
   * JSON'dan ağacı restore et
   */
  static deserialize(json: string): DTree {
    const data = JSON.parse(json);
    const tree = new DTree();
    
    // Root'u güncelle
    tree.root.id = data.tree.id;
    tree.root.q1 = data.tree.q1;
    tree.root.q2 = data.tree.q2;
    tree.root.data = data.tree.data;
    tree.nodeMap.set(tree.root.id, tree.root);

    // Çocukları recursive oluştur
    const restoreChildren = (parentNode: DTreeNode, childrenData: any[]) => {
      for (let i = 0; i < childrenData.length; i++) {
        const childData = childrenData[i];
        const child = new DTreeNode(
          childData.id,
          childData.q1,
          childData.q2,
          childData.data,
          parentNode
        );
        
        parentNode.children.push(child);
        tree.nodeMap.set(child.id, child);

        // Sibling bağlantıları
        if (i > 0) {
          child.prevSibling = parentNode.children[i - 1];
          parentNode.children[i - 1].nextSibling = child;
        }

        // Recursive
        if (childData.children && childData.children.length > 0) {
          restoreChildren(child, childData.children);
        }
      }
    };

    if (data.tree.children) {
      restoreChildren(tree.root, data.tree.children);
    }

    // Xref'i restore et
    if (data.xref) {
      for (const [token, nodeIds] of Object.entries(data.xref)) {
        for (const nodeId of nodeIds as string[]) {
          const node = tree.getNode(nodeId);
          if (node) {
            tree.xref.add(token, node);
          }
        }
      }
    }

    // nextId'yi güncelle
    tree.nextId = Math.max(...Array.from(tree.nodeMap.keys())
      .map(id => parseInt(id.replace('node_', '')) || 0)) + 1;

    return tree;
  }

  /**
   * Debug: Ağacı yazdır
   */
  print(node: DTreeNode = this.root, indent: string = ''): void {
    const info = `${node.data.type}[${node.id}] Q1=${node.q1.toFixed(1)} Q2=${node.q2.toFixed(1)}`;
    const content = node.data.content ? ` "${node.data.content.substring(0, 30)}..."` : '';
    console.log(`${indent}${info}${content}`);
    for (const child of node.children) {
      this.print(child, indent + '  ');
    }
  }

  /**
   * İstatistikler
   */
  getStats(): {
    nodeCount: number;
    maxDepth: number;
    tokenCount: number;
  } {
    let maxDepth = 0;
    const calculateDepth = (node: DTreeNode, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      for (const child of node.children) {
        calculateDepth(child, depth + 1);
      }
    };
    calculateDepth(this.root, 0);

    return {
      nodeCount: this.nodeMap.size,
      maxDepth,
      tokenCount: this.xref.getStats().tokenCount,
    };
  }
}

// Singleton export
export const createDTree = (rootData?: DTreeNodeData) => new DTree(rootData);
