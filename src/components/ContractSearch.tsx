/**
 * ContractSearch.tsx
 * PropLedger için Sözleşme Arama Komponenti
 * 
 * Kullanım:
 * 1. Mülk detay sayfasına ekle
 * 2. Kullanıcı sözleşme metni yapıştırır
 * 3. İçinde arama yapar
 * 4. Hangi maddede/paragrafta bulunduğunu görür
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Search, FileText, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ============================================
// DTree Engine (Inline)
// ============================================

class DTreeNode {
  id: string;
  q1: number;
  q2: number;
  data: { type: string; content?: string; title?: string };
  parent: DTreeNode | null;
  children: DTreeNode[] = [];

  constructor(id: string, q1: number, q2: number, data: any, parent: DTreeNode | null = null) {
    this.id = id;
    this.q1 = q1;
    this.q2 = q2;
    this.data = data;
    this.parent = parent;
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
    if (t.length < 2) return;
    if (!this.index.has(t)) this.index.set(t, new Set());
    this.index.get(t)!.add(node);
  }

  get(token: string): DTreeNode[] {
    return Array.from(this.index.get(token.toLowerCase().trim()) || []);
  }

  getAllTokens(): string[] {
    return Array.from(this.index.keys());
  }
}

class ContractDTree {
  root: DTreeNode;
  xref: TokenXref = new TokenXref();
  private nextId = 1;
  private q1Counter = 0;

  constructor() {
    this.root = new DTreeNode('node_1', 0, Number.MAX_SAFE_INTEGER, { type: 'contract', title: 'Sözleşme' });
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
    const tokens = content.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^\wğüşıöçĞÜŞİÖÇ]/g, ''))
      .filter(w => w.length > 1);
    
    for (const t of tokens) this.xref.add(t, node);
    node.data.content = content;
  }

  findNCD(a: DTreeNode, b: DTreeNode): DTreeNode {
    if (a.id === b.id) return a;
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

  getStats() {
    let nodeCount = 0;
    let maxDepth = 0;
    const traverse = (node: DTreeNode, depth: number) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);
      for (const child of node.children) traverse(child, depth + 1);
    };
    traverse(this.root, 0);
    return { nodeCount, maxDepth, tokenCount: this.xref.getAllTokens().length };
  }
}

// ============================================
// Parser
// ============================================

function parseContract(text: string): ContractDTree {
  const tree = new ContractDTree();
  
  // Maddeleri bul (Madde 1:, MADDE 2., 1., 1-, vs.)
  const sections = text.split(/(?=(?:MADDE|Madde|madde)\s*\d+|(?:^|\n)\s*\d+[\.\-\)]\s)/m);
  
  let sectionIndex = 0;
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    
    sectionIndex++;
    
    // Madde başlığını çıkar
    const titleMatch = trimmed.match(/^(?:(?:MADDE|Madde|madde)\s*(\d+)[:\.\-]?\s*(.*)|((\d+)[\.\-\)]\s*(.*)))/);
    let title = `Bölüm ${sectionIndex}`;
    let content = trimmed;
    
    if (titleMatch) {
      const num = titleMatch[1] || titleMatch[4];
      const titleText = titleMatch[2] || titleMatch[5] || '';
      title = `Madde ${num}${titleText ? ': ' + titleText.substring(0, 50) : ''}`;
      content = trimmed;
    }
    
    const sectionNode = tree.appendChild(tree.root, { type: 'section', title });
    
    // Paragraflara böl
    const paragraphs = content.split(/\n\s*\n/);
    for (const para of paragraphs) {
      const paraTrimmed = para.trim();
      if (!paraTrimmed) continue;
      
      const paraNode = tree.appendChild(sectionNode, { type: 'paragraph' });
      
      // Cümlelere böl
      const sentences = paraTrimmed.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
      for (const sent of sentences) {
        if (sent.trim()) {
          const sentNode = tree.appendChild(paraNode, { type: 'sentence' });
          tree.indexContent(sentNode, sent.trim());
        }
      }
    }
  }
  
  tree.recalculateQ2();
  return tree;
}

// ============================================
// Risk Patterns
// ============================================

interface RiskPattern {
  keywords: string[];
  severity: 'high' | 'medium' | 'low';
  message: string;
}

const RISK_PATTERNS: RiskPattern[] = [
  { keywords: ['ceza', 'gecikme'], severity: 'medium', message: 'Gecikme cezası maddesi tespit edildi' },
  { keywords: ['feragat', 'hak'], severity: 'high', message: 'Hak feragati maddesi - dikkatli inceleyin' },
  { keywords: ['cayma', 'iptal'], severity: 'medium', message: 'Cayma/iptal koşulları mevcut' },
  { keywords: ['teminat', 'ipotek'], severity: 'medium', message: 'Teminat/ipotek şartları var' },
  { keywords: ['tek taraflı', 'fesih'], severity: 'high', message: 'Tek taraflı fesih hakkı - risk!' },
  { keywords: ['sorumluluk', 'sınırsız'], severity: 'high', message: 'Sınırsız sorumluluk maddesi' },
];

// ============================================
// Main Component
// ============================================

interface ContractSearchProps {
  propertyId?: string;
  propertyName?: string;
}

const ContractSearch: React.FC<ContractSearchProps> = ({ propertyId, propertyName }) => {
  const [contractText, setContractText] = useState('');
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    context?: string;
    contextTitle?: string;
    depth?: number;
    matches?: { token: string; count: number }[];
    content?: string;
  } | null>(null);
  const [risks, setRisks] = useState<{ pattern: RiskPattern; context: string }[]>([]);

  // Sözleşmeyi parse et
  const tree = useMemo(() => {
    if (!contractText.trim()) return null;
    return parseContract(contractText);
  }, [contractText]);

  const stats = useMemo(() => tree?.getStats(), [tree]);

  // Risk analizi
  const analyzeRisks = useCallback(() => {
    if (!tree) return;
    
    const foundRisks: { pattern: RiskPattern; context: string }[] = [];
    
    for (const pattern of RISK_PATTERNS) {
      const result = tree.searchAND(pattern.keywords);
      if (result) {
        foundRisks.push({
          pattern,
          context: result.context.data.title || result.context.data.type
        });
      }
    }
    
    setRisks(foundRisks);
  }, [tree]);

  // Sözleşme değiştiğinde risk analizi yap
  React.useEffect(() => {
    if (tree) {
      analyzeRisks();
    }
  }, [tree, analyzeRisks]);

  // Arama yap
  const handleSearch = useCallback(() => {
    if (!tree || !query.trim()) {
      setSearchResult(null);
      return;
    }

    const tokens = query.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^\wğüşıöçĞÜŞİÖÇ]/g, ''))
      .filter(w => w.length > 1);

    if (tokens.length === 0) {
      setSearchResult({ found: false });
      return;
    }

    const result = tree.searchAND(tokens);
    
    if (!result) {
      setSearchResult({ found: false });
      return;
    }

    const typeNames: Record<string, string> = {
      contract: 'Tüm Sözleşme',
      section: 'Madde',
      paragraph: 'Paragraf',
      sentence: 'Cümle'
    };

    setSearchResult({
      found: true,
      context: typeNames[result.context.data.type] || result.context.data.type,
      contextTitle: result.context.data.title,
      depth: result.context.getDepth(),
      matches: Array.from(result.matches.entries()).map(([token, nodes]) => ({
        token,
        count: nodes.length
      })),
      content: result.context.data.content
    });
  }, [tree, query]);

  // Enter ile arama
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Örnek sözleşme
  const loadSampleContract = () => {
    setContractText(`TAŞINMAZ SATIŞ SÖZLEŞMESİ

Madde 1: Taraflar
Bu sözleşme, satıcı ve alıcı arasında aşağıdaki koşullarla imzalanmıştır.
Taraflar sözleşme şartlarını kabul ettiklerini beyan ederler.

Madde 2: Sözleşme Konusu
İşbu sözleşmenin konusu, ${propertyName || 'taşınmaz'} satışıdır.
Taşınmazın tüm özellikleri ekli belgede belirtilmiştir.

Madde 3: Satış Bedeli ve Ödeme Koşulları
Toplam satış bedeli taksitle ödenecektir.
İlk taksit sözleşme tarihinde, kalan taksitler aylık olarak ödenecektir.
Gecikme durumunda aylık %2 gecikme cezası uygulanır.
Taksit planı ekte belirtilmiştir.

Madde 4: Devir ve Teslim
Taşınmazın devri, ödemenin tamamlanmasından sonra yapılacaktır.
Teslim tarihi, son ödeme tarihinden itibaren 30 gün içindedir.
Tapu devri masrafları alıcıya aittir.

Madde 5: Cayma Hakkı
Alıcı, sözleşme tarihinden itibaren 14 gün içinde cayma hakkını kullanabilir.
Cayma durumunda ödenen bedelin %10'u kesinti yapılır.

Madde 6: Teminat
Alıcı, satış bedelinin %20'si oranında teminat verecektir.
Teminat, tapu devri tamamlanana kadar satıcıda kalacaktır.

Madde 7: Uyuşmazlık
Taraflar arasındaki uyuşmazlıklarda İstanbul Mahkemeleri yetkilidir.
Sözleşmeden doğan her türlü sorumluluk taraflara aittir.

Madde 8: Yürürlük
Bu sözleşme, imza tarihinde yürürlüğe girer.
Sözleşme 2 nüsha olarak düzenlenmiştir.`);
  };

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sözleşme Analizi
            {propertyName && (
              <Badge variant="outline" className="ml-2">{propertyName}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadSampleContract}>
                <Upload className="h-4 w-4 mr-1" />
                Örnek Sözleşme Yükle
              </Button>
            </div>
            <Textarea
              placeholder="Sözleşme metnini buraya yapıştırın..."
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            {stats && (
              <div className="text-sm text-muted-foreground">
                📊 {stats.nodeCount} bölüm | {stats.tokenCount} benzersiz kelime | {stats.maxDepth} seviye
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk Uyarıları */}
      {risks.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-800 flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" />
              Dikkat Edilmesi Gereken Maddeler ({risks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {risks.map((risk, idx) => (
                <Alert key={idx} variant={risk.pattern.severity === 'high' ? 'destructive' : 'default'}>
                  <AlertDescription className="flex justify-between items-center">
                    <span>{risk.pattern.message}</span>
                    <Badge variant={risk.pattern.severity === 'high' ? 'destructive' : 'secondary'}>
                      {risk.context}
                    </Badge>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arama */}
      {tree && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-5 w-5" />
              Sözleşmede Ara
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Aranacak kelimeler (örn: taksit ceza)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-1" />
                  Ara
                </Button>
              </div>

              {/* Sonuç */}
              {searchResult && (
                <div className={`p-4 rounded-lg ${searchResult.found ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  {searchResult.found ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-800">Bulundu!</span>
                      </div>
                      <div className="text-sm">
                        <strong>Ortak Bağlam:</strong>{' '}
                        <Badge variant="default">{searchResult.context}</Badge>
                        {searchResult.contextTitle && (
                          <span className="ml-2 text-muted-foreground">({searchResult.contextTitle})</span>
                        )}
                      </div>
                      <div className="text-sm">
                        <strong>Kelimeler:</strong>{' '}
                        {searchResult.matches?.map((m, i) => (
                          <Badge key={i} variant="outline" className="mr-1">
                            "{m.token}" ({m.count}x)
                          </Badge>
                        ))}
                      </div>
                      {searchResult.content && (
                        <div className="mt-2 p-2 bg-white rounded text-sm italic border">
                          "{searchResult.content}"
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      <span>Bu kelimeler sözleşmede birlikte bulunamadı.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Açıklama */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Nasıl çalışır?</strong> Sözleşme metni otomatik olarak maddelere, 
            paragraflara ve cümlelere ayrılır. Arama yaptığınızda, kelimelerinizin 
            <strong> aynı maddede mi, aynı paragrafta mı, aynı cümlede mi</strong> olduğunu gösterir.
            Bu sayede ilgili bölümleri hızlıca bulabilirsiniz.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractSearch;
