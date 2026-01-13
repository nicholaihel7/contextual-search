/**
 * HTML Parser - Web sayfalarını DTree'ye çevirir
 * 
 * NE YAPAR?
 * =========
 * Bir HTML dokümanı alır:
 *   <article>
 *     <section>
 *       <p>Veri gizliliği önemlidir.</p>
 *       <p>Kullanıcılar korunmalı.</p>
 *     </section>
 *   </article>
 * 
 * Bunu ağaç yapısına çevirir:
 *   article
 *   └── section
 *       ├── paragraph: "Veri gizliliği önemlidir."
 *       └── paragraph: "Kullanıcılar korunmalı."
 * 
 * Ve her kelimeyi indeksler:
 *   "veri" → [paragraph 1]
 *   "gizlilik" → [paragraph 1]
 *   "kullanıcı" → [paragraph 2]
 * 
 * NEDEN?
 * ======
 * Sonra "veri" ve "kullanıcı" aradığında,
 * ikisinin de içinde olduğu EN KÜÇÜK kutuyu bulabilelim.
 */

import { DTree, DTreeNode, NodeType, DTreeNodeData } from './dtree';

/**
 * HTML tag'ini DTree node tipine çevir
 */
function tagToNodeType(tagName: string): NodeType {
  const tag = tagName.toLowerCase();
  
  const mapping: Record<string, NodeType> = {
    // Doküman yapısı
    'html': 'document',
    'body': 'document',
    'article': 'document',
    'main': 'document',
    
    // Bölümler
    'section': 'section',
    'header': 'section',
    'footer': 'section',
    'nav': 'section',
    'aside': 'section',
    'div': 'section',
    
    // Paragraflar
    'p': 'paragraph',
    'blockquote': 'paragraph',
    'pre': 'paragraph',
    
    // Listeler
    'ul': 'list',
    'ol': 'list',
    'li': 'list-item',
    
    // Başlıklar (paragraf gibi davran)
    'h1': 'paragraph',
    'h2': 'paragraph',
    'h3': 'paragraph',
    'h4': 'paragraph',
    'h5': 'paragraph',
    'h6': 'paragraph',
  };
  
  return mapping[tag] || 'generic';
}

/**
 * Metin içeriğini cümlelere böl
 * Basit kural: nokta, ünlem veya soru işaretinden sonra böl
 */
function splitIntoSentences(text: string): string[] {
  // Boşlukları temizle
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  
  // Cümlelere böl (basit regex)
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  
  return sentences.filter(s => s.trim().length > 0);
}

/**
 * Metni tokenize et (kelimelere ayır)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\wğüşıöçĞÜŞİÖÇ]/g, '')) // Türkçe karakterler dahil
    .filter(word => word.length > 1); // Tek harfli kelimeleri atla
}

/**
 * HTML string'i parse et ve DTree döndür
 */
export function parseHTML(html: string): DTree {
  // Basit bir HTML parser (browser ortamında DOMParser kullanılır)
  // Node.js'de çalışması için basit regex-based parser
  
  const tree = new DTree({ type: 'document', metadata: { source: 'html' } });
  
  // HTML'i satırlara böl ve işle
  const lines = html.split('\n');
  let currentParent = tree.root;
  const parentStack: DTreeNode[] = [tree.root];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Açılış tag'i bul
    const openMatch = trimmed.match(/^<(\w+)[^>]*>/);
    if (openMatch) {
      const tagName = openMatch[1];
      const nodeType = tagToNodeType(tagName);
      
      // Yeni düğüm oluştur
      if (nodeType !== 'generic') {
        const newNode = tree.appendChild(currentParent, {
          type: nodeType,
          metadata: { tag: tagName }
        });
        parentStack.push(newNode);
        currentParent = newNode;
      }
      
      // Tag içindeki metni çıkar
      const textMatch = trimmed.match(/>([^<]+)</);
      if (textMatch) {
        const text = textMatch[1].trim();
        if (text) {
          // Cümlelere böl
          const sentences = splitIntoSentences(text);
          for (const sentence of sentences) {
            const sentenceNode = tree.appendChild(currentParent, {
              type: 'sentence',
              content: sentence
            });
            // Kelimeleri indeksle
            tree.indexContent(sentenceNode, sentence);
          }
        }
      }
    }
    
    // Kapanış tag'i bul
    const closeMatch = trimmed.match(/<\/(\w+)>/);
    if (closeMatch && parentStack.length > 1) {
      parentStack.pop();
      currentParent = parentStack[parentStack.length - 1];
    }
  }
  
  // Q2 değerlerini hesapla
  tree.recalculateQ2();
  
  return tree;
}

/**
 * Düz metin parse et (HTML değil)
 * Her satırı paragraf, her cümleyi sentence olarak al
 */
export function parsePlainText(text: string, title?: string): DTree {
  const tree = new DTree({ 
    type: 'document', 
    metadata: { title: title || 'Untitled', source: 'plaintext' } 
  });
  
  // Paragraflara böl (boş satırlar ayırıcı)
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    
    // Paragraf düğümü
    const paraNode = tree.appendChild(tree.root, { type: 'paragraph' });
    
    // Cümlelere böl
    const sentences = splitIntoSentences(trimmed);
    for (const sentence of sentences) {
      const sentenceNode = tree.appendChild(paraNode, {
        type: 'sentence',
        content: sentence
      });
      tree.indexContent(sentenceNode, sentence);
    }
  }
  
  tree.recalculateQ2();
  return tree;
}

/**
 * Basit bir arama arayüzü
 * Kullanımı kolay olsun diye wrapper
 */
export class DocumentSearcher {
  private tree: DTree;
  
  constructor(tree: DTree) {
    this.tree = tree;
  }
  
  /**
   * AND araması - tüm kelimeler aynı bağlamda olmalı
   * 
   * Örnek:
   *   search("veri gizlilik") 
   *   → Her iki kelimenin de geçtiği en küçük yapısal birim
   */
  search(query: string): SearchResult | null {
    const tokens = tokenize(query);
    if (tokens.length === 0) return null;
    
    const result = this.tree.searchAND(tokens);
    if (!result) return null;
    
    return {
      query: query,
      tokens: tokens,
      context: {
        id: result.context.id,
        type: result.context.data.type,
        content: result.context.data.content,
        depth: result.context.getDepth()
      },
      matches: this.formatMatches(result.occurrences)
    };
  }
  
  /**
   * Sonuçları okunabilir formata çevir
   */
  private formatMatches(occurrences: Map<string, DTreeNode[]>): MatchInfo[] {
    const matches: MatchInfo[] = [];
    
    for (const [token, nodes] of occurrences) {
      for (const node of nodes) {
        matches.push({
          token,
          nodeId: node.id,
          nodeType: node.data.type,
          content: node.data.content || '',
          path: node.getAncestryPath().map(n => n.data.type).reverse().join(' > ')
        });
      }
    }
    
    return matches;
  }
  
  /**
   * Doküman istatistikleri
   */
  getStats(): DocumentStats {
    const treeStats = this.tree.getStats();
    return {
      nodeCount: treeStats.nodeCount,
      maxDepth: treeStats.maxDepth,
      tokenCount: treeStats.tokenCount,
      tokens: this.tree.xref.getAllTokens()
    };
  }
}

// Tip tanımları
export interface SearchResult {
  query: string;
  tokens: string[];
  context: {
    id: string;
    type: NodeType;
    content?: string;
    depth: number;
  };
  matches: MatchInfo[];
}

export interface MatchInfo {
  token: string;
  nodeId: string;
  nodeType: NodeType;
  content: string;
  path: string;
}

export interface DocumentStats {
  nodeCount: number;
  maxDepth: number;
  tokenCount: number;
  tokens: string[];
}

// Kolaylık fonksiyonları
export function createSearcherFromHTML(html: string): DocumentSearcher {
  const tree = parseHTML(html);
  return new DocumentSearcher(tree);
}

export function createSearcherFromText(text: string, title?: string): DocumentSearcher {
  const tree = parsePlainText(text, title);
  return new DocumentSearcher(tree);
}
