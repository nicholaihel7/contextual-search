/**
 * ContextualSearchDemo.tsx
 * 
 * NE YAPAR?
 * =========
 * Kullanıcıya görsel bir arayüz sunar:
 * 1. Sol tarafta: Doküman metni (düzenlenebilir)
 * 2. Sağ tarafta: Doküman yapısı (ağaç görünümü)
 * 3. Altta: Arama kutusu ve sonuçlar
 * 
 * Kullanıcı arama yapınca:
 * - Hangi kelimelerin nerede geçtiğini gösterir
 * - En küçük ortak bağlamı vurgular
 * - "Bu kelimeler aynı paragrafta!" gibi sonuç verir
 */

import React, { useState, useMemo, useCallback } from 'react';

// ============================================
// DTree ve Parser (inline - tek dosyada çalışsın)
// ============================================

class DTreeNode {
  id: string;
  q1: number;
  q2: number;
  data: { type: string; content?: string; metadata?: any };
  parent: DTreeNode | null;
  children: DTreeNode[];

  constructor(id: string, q1: number, q2: number, data: any, parent: DTreeNode | null = null) {
    this.id = id;
    this.q1 = q1;
    this.q2 = q2;
    this.data = data;
    this.parent = parent;
    this.children = [];
  }

  contains(other: DTreeNode): boolean {
    return this.q1 < other.q1 && this.q2 > other.q2;
  }

  getDepth(): number {
    let depth = 0;
    let current: DTreeNode | null = this.parent;
    while (current) { depth++; current = current.parent; }
    return depth;
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
    const t = token.toLowerCase().trim();
    if (!this.index.has(t)) this.index.set(t, new Set());
    this.index.get(t)!.add(node);
  }

  get(token: string): DTreeNode[] {
    const t = token.toLowerCase().trim();
    return Array.from(this.index.get(t) || []);
  }

  getAllTokens(): string[] {
    return Array.from(this.index.keys());
  }
}

class DTree {
  root: DTreeNode;
  xref: TokenXref = new TokenXref();
  private nodeMap: Map<string, DTreeNode> = new Map();
  private nextId = 1;
  private q1Counter = 0;
  private SPACING = 1000;

  constructor(rootData?: any) {
    this.root = new DTreeNode('node_1', 0, Number.MAX_SAFE_INTEGER, rootData || { type: 'document' });
    this.nodeMap.set(this.root.id, this.root);
  }

  appendChild(parent: DTreeNode, data: any): DTreeNode {
    this.q1Counter += this.SPACING;
    const node = new DTreeNode(`node_${++this.nextId}`, this.q1Counter, 0, data, parent);
    parent.children.push(node);
    this.nodeMap.set(node.id, node);
    return node;
  }

  recalculateQ2() {
    let counter = 0;
    const traverse = (node: DTreeNode) => {
      for (const child of node.children) traverse(child);
      counter += this.SPACING;
      node.q2 = counter;
    };
    traverse(this.root);
  }

  findNCD(a: DTreeNode, b: DTreeNode): DTreeNode {
    if (a.id === b.id) return a;
    if (a.contains(b)) return a;
    if (b.contains(a)) return b;
    
    const ancestryA = a.getAncestryPath();
    const ancestryBIds = new Set(b.getAncestryPath().map(n => n.id));
    
    for (const ancestor of ancestryA) {
      if (ancestryBIds.has(ancestor.id)) return ancestor;
    }
    return this.root;
  }

  findNCDMultiple(nodes: DTreeNode[]): DTreeNode {
    if (nodes.length === 0) return this.root;
    return nodes.reduce((ncd, node) => this.findNCD(ncd, node));
  }

  searchAND(tokens: string[]): { context: DTreeNode; occurrences: Map<string, DTreeNode[]> } | null {
    const occurrences = new Map<string, DTreeNode[]>();
    const allNodes: DTreeNode[] = [];

    for (const token of tokens) {
      const nodes = this.xref.get(token);
      if (nodes.length === 0) return null;
      occurrences.set(token, nodes);
      allNodes.push(...nodes);
    }

    return { context: this.findNCDMultiple(allNodes), occurrences };
  }

  indexContent(node: DTreeNode, content: string) {
    const tokens = content.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^\wğüşıöçĞÜŞİÖÇ]/g, ''))
      .filter(w => w.length > 1);
    
    for (const t of tokens) this.xref.add(t, node);
    node.data.content = content;
  }

  getAllNodes(): DTreeNode[] {
    const nodes: DTreeNode[] = [];
    const traverse = (node: DTreeNode) => {
      nodes.push(node);
      for (const child of node.children) traverse(child);
    };
    traverse(this.root);
    return nodes;
  }

  getStats() {
    let maxDepth = 0;
    const calcDepth = (node: DTreeNode, d: number) => {
      maxDepth = Math.max(maxDepth, d);
      for (const child of node.children) calcDepth(child, d + 1);
    };
    calcDepth(this.root, 0);
    return { 
      nodeCount: this.nodeMap.size, 
      maxDepth, 
      tokenCount: this.xref.getAllTokens().length 
    };
  }
}

// Parser
function parseText(text: string): DTree {
  const tree = new DTree({ type: 'document' });
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    
    const paraNode = tree.appendChild(tree.root, { type: 'paragraph' });
    const sentences = trimmed.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
    
    for (const sent of sentences) {
      if (sent.trim()) {
        const sentNode = tree.appendChild(paraNode, { type: 'sentence' });
        tree.indexContent(sentNode, sent.trim());
      }
    }
  }
  
  tree.recalculateQ2();
  return tree;
}

// ============================================
// React Components
// ============================================

// Tip tanımları
interface SearchResult {
  context: DTreeNode;
  occurrences: Map<string, DTreeNode[]>;
}

// Türkçe tip isimleri
const typeNames: Record<string, string> = {
  document: '📄 Doküman',
  paragraph: '📝 Paragraf',
  sentence: '💬 Cümle',
  section: '📑 Bölüm',
};

// Renk paleti
const colors = {
  highlight: '#fef08a',      // Sarı vurgu
  contextBg: '#dcfce7',      // Yeşil bağlam
  nodeBg: '#f3f4f6',         // Gri düğüm
  primary: '#3b82f6',        // Mavi
  text: '#1f2937',           // Koyu gri
};

// TreeNode görsel component
const TreeNodeView: React.FC<{
  node: DTreeNode;
  depth: number;
  highlightedIds: Set<string>;
  contextId: string | null;
}> = ({ node, depth, highlightedIds, contextId }) => {
  const isHighlighted = highlightedIds.has(node.id);
  const isContext = node.id === contextId;
  
  const bgColor = isContext ? colors.contextBg : isHighlighted ? colors.highlight : 'transparent';
  const borderColor = isContext ? '#22c55e' : isHighlighted ? '#eab308' : '#e5e7eb';
  
  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        style={{
          padding: '4px 8px',
          marginBottom: '2px',
          backgroundColor: bgColor,
          borderLeft: `3px solid ${borderColor}`,
          borderRadius: '4px',
          fontSize: '13px',
        }}
      >
        <span style={{ color: '#6b7280', marginRight: '8px' }}>
          {typeNames[node.data.type] || node.data.type}
        </span>
        {node.data.content && (
          <span style={{ color: colors.text }}>
            {node.data.content.length > 60 
              ? node.data.content.substring(0, 60) + '...' 
              : node.data.content}
          </span>
        )}
        {isContext && (
          <span style={{ 
            marginLeft: '8px', 
            backgroundColor: '#22c55e', 
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            BAĞLAM
          </span>
        )}
      </div>
      {node.children.map(child => (
        <TreeNodeView
          key={child.id}
          node={child}
          depth={depth + 1}
          highlightedIds={highlightedIds}
          contextId={contextId}
        />
      ))}
    </div>
  );
};

// Ana Component
const ContextualSearchDemo: React.FC = () => {
  // Örnek doküman
  const defaultText = `Gizlilik Politikası

Bu belge, veri toplama ve işleme süreçlerimizi açıklar. Kullanıcı gizliliği bizim için çok önemlidir.

Veri Toplama

Kişisel verilerinizi toplarken şeffaf davranırız. İsim, e-posta ve telefon gibi bilgiler toplanabilir. Bu veriler güvenli sunucularda saklanır.

Güvenlik Önlemleri

Verilerinizi korumak için şifreleme kullanıyoruz. Düzenli güvenlik denetimleri yapılmaktadır. Yetkisiz erişime karşı sistemlerimiz korunmaktadır.

Kullanıcı Hakları

Verilerinizin silinmesini talep edebilirsiniz. Gizlilik ayarlarınızı istediğiniz zaman değiştirebilirsiniz.`;

  const [text, setText] = useState(defaultText);
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  // Dokümanı parse et
  const tree = useMemo(() => parseText(text), [text]);
  const stats = useMemo(() => tree.getStats(), [tree]);

  // Arama yap
  const handleSearch = useCallback(() => {
    const tokens = query.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^\wğüşıöçĞÜŞİÖÇ]/g, ''))
      .filter(w => w.length > 1);

    if (tokens.length === 0) {
      setSearchResult(null);
      return;
    }

    const result = tree.searchAND(tokens);
    setSearchResult(result);
  }, [query, tree]);

  // Enter tuşuyla arama
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Vurgulanan düğüm ID'leri
  const highlightedIds = useMemo(() => {
    const ids = new Set<string>();
    if (searchResult) {
      for (const nodes of searchResult.occurrences.values()) {
        for (const node of nodes) ids.add(node.id);
      }
    }
    return ids;
  }, [searchResult]);

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* Başlık */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.text }}>
          🔍 Contextual Search Demo
        </h1>
        <p style={{ color: '#6b7280', marginTop: '8px' }}>
          Yapısal bağlam ile akıllı arama - "Bu kelimeler aynı paragrafta mı?"
        </p>
      </div>

      {/* Ana içerik - 2 sütun */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        {/* Sol: Doküman */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            📄 Doküman
          </h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: '100%',
              height: '300px',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              lineHeight: '1.6',
              resize: 'vertical'
            }}
          />
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            color: '#6b7280' 
          }}>
            📊 {stats.nodeCount} düğüm | {stats.tokenCount} benzersiz kelime | {stats.maxDepth} seviye derinlik
          </div>
        </div>

        {/* Sağ: Ağaç yapısı */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            🌳 Yapı
          </h2>
          <div style={{
            height: '300px',
            overflow: 'auto',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '12px',
            backgroundColor: '#fafafa'
          }}>
            <TreeNodeView
              node={tree.root}
              depth={0}
              highlightedIds={highlightedIds}
              contextId={searchResult?.context.id || null}
            />
          </div>
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            color: '#6b7280' 
          }}>
            🟡 Sarı = Kelime bulundu | 🟢 Yeşil = Ortak bağlam
          </div>
        </div>
      </div>

      {/* Arama kutusu */}
      <div style={{ 
        backgroundColor: '#f9fafb', 
        padding: '16px', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Aranacak kelimeler (örn: veri gizlilik)"
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Ara
          </button>
        </div>
      </div>

      {/* Sonuçlar */}
      {searchResult && (
        <div style={{
          backgroundColor: colors.contextBg,
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #22c55e'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            ✅ Sonuç Bulundu!
          </h3>
          
          <div style={{ marginBottom: '12px' }}>
            <strong>Ortak Bağlam:</strong>{' '}
            <span style={{
              backgroundColor: '#22c55e',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              {typeNames[searchResult.context.data.type] || searchResult.context.data.type}
            </span>
            <span style={{ marginLeft: '8px', color: '#6b7280' }}>
              (Derinlik: {searchResult.context.getDepth()})
            </span>
          </div>

          <div style={{ fontSize: '14px' }}>
            <strong>Kelime Konumları:</strong>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              {Array.from(searchResult.occurrences.entries()).map(([token, nodes]) => (
                <li key={token} style={{ marginBottom: '4px' }}>
                  <strong>"{token}"</strong> → {nodes.map(n => 
                    `${typeNames[n.data.type]?.split(' ')[1] || n.data.type}`
                  ).join(', ')}
                </li>
              ))}
            </ul>
          </div>

          {searchResult.context.data.content && (
            <div style={{ 
              marginTop: '12px', 
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '4px',
              fontStyle: 'italic'
            }}>
              "{searchResult.context.data.content}"
            </div>
          )}
        </div>
      )}

      {query && !searchResult && (
        <div style={{
          backgroundColor: '#fef2f2',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #ef4444',
          color: '#991b1b'
        }}>
          ❌ Sonuç bulunamadı. Tüm kelimeler dokümanda geçmiyor.
        </div>
      )}

      {/* Açıklama */}
      <div style={{ 
        marginTop: '24px', 
        padding: '16px', 
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        <h3 style={{ fontWeight: '600', marginBottom: '8px' }}>💡 Bu nasıl çalışıyor?</h3>
        <ol style={{ paddingLeft: '20px' }}>
          <li><strong>Doküman parse edilir:</strong> Metin → Paragraflar → Cümleler</li>
          <li><strong>Kelimeler indekslenir:</strong> Her kelime hangi cümlede geçiyor?</li>
          <li><strong>Arama yapılır:</strong> Girilen kelimelerin geçtiği düğümler bulunur</li>
          <li><strong>Ortak bağlam hesaplanır:</strong> Tüm kelimeleri içeren EN KÜÇÜK yapısal birim</li>
        </ol>
        <p style={{ marginTop: '12px', color: '#0369a1' }}>
          <strong>Fark:</strong> Google "aynı sayfada" der, biz "aynı cümlede/paragrafta" deriz. 
          Bu matematiksel olarak kesin, tahmin değil!
        </p>
      </div>
    </div>
  );
};

export default ContextualSearchDemo;
