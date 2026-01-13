/**
 * DTree Test Suite
 * Contextual Search Demo dahil
 */

// Inline DTree implementation for testing
class DTreeNode {
  constructor(id, q1, q2, data, parent = null) {
    this.id = id;
    this.q1 = q1;
    this.q2 = q2;
    this.data = data;
    this.parent = parent;
    this.children = [];
    this.prevSibling = null;
    this.nextSibling = null;
  }

  contains(other) {
    // A contains B ⟺ A.q1 < B.q1 AND A.q2 > B.q2
    return this.q1 < other.q1 && this.q2 > other.q2;
  }

  isContainedBy(other) {
    return other.contains(this);
  }

  equals(other) {
    return this.id === other.id;
  }

  getAncestryPath() {
    const path = [this];
    let current = this.parent;
    while (current !== null) {
      path.push(current);
      current = current.parent;
    }
    return path;
  }

  isLeaf() {
    return this.children.length === 0;
  }

  isRoot() {
    return this.parent === null;
  }

  getDepth() {
    let depth = 0;
    let current = this.parent;
    while (current !== null) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  getSubtree() {
    const result = [this];
    for (const child of this.children) {
      result.push(...child.getSubtree());
    }
    return result;
  }
}

class TokenXref {
  constructor() {
    this.index = new Map();
  }

  add(token, node) {
    const normalizedToken = token.toLowerCase().trim();
    if (!this.index.has(normalizedToken)) {
      this.index.set(normalizedToken, new Set());
    }
    this.index.get(normalizedToken).add(node);
  }

  addMany(tokens, node) {
    for (const token of tokens) {
      this.add(token, node);
    }
  }

  get(token) {
    const normalizedToken = token.toLowerCase().trim();
    const nodes = this.index.get(normalizedToken);
    return nodes ? Array.from(nodes) : [];
  }

  has(token) {
    return this.index.has(token.toLowerCase().trim());
  }

  removeNode(node) {
    for (const [, nodes] of this.index) {
      nodes.delete(node);
    }
  }

  getAllTokens() {
    return Array.from(this.index.keys());
  }

  getStats() {
    let totalOccurrences = 0;
    for (const nodes of this.index.values()) {
      totalOccurrences += nodes.size;
    }
    return { tokenCount: this.index.size, totalOccurrences };
  }
}

class DTree {
  constructor(rootData) {
    this.INITIAL_SPACING = 1000;
    this.nextId = 1;
    this.q1Counter = 0;
    this.nodeMap = new Map();
    this.xref = new TokenXref();

    this.root = new DTreeNode(
      this.generateId(),
      0, // Q1 = 0 (pre-order start)
      Number.MAX_SAFE_INTEGER, // Q2 = max (post-order, root closes last)
      rootData || { type: 'root' }
    );
    this.nodeMap.set(this.root.id, this.root);
  }

  generateId() {
    return `node_${this.nextId++}`;
  }

  appendChild(parent, data) {
    this.q1Counter += this.INITIAL_SPACING;
    const q1 = this.q1Counter;
    
    // Q2 geçici - recalculateQ2 ile düzeltilecek
    const q2 = 0;
    
    const node = new DTreeNode(this.generateId(), q1, q2, data, parent);
    
    const lastChild = parent.children[parent.children.length - 1];
    if (lastChild) {
      node.prevSibling = lastChild;
      lastChild.nextSibling = node;
    }
    parent.children.push(node);
    this.nodeMap.set(node.id, node);
    return node;
  }

  /**
   * Q2 değerlerini post-order olarak yeniden hesapla
   */
  recalculateQ2() {
    let counter = 0;
    const traverse = (node) => {
      for (const child of node.children) {
        traverse(child);
      }
      counter += this.INITIAL_SPACING;
      node.q2 = counter;
    };
    traverse(this.root);
  }

  getNode(id) {
    return this.nodeMap.get(id);
  }

  findNCD(nodeA, nodeB) {
    if (nodeA.equals(nodeB)) return nodeA;
    if (nodeA.contains(nodeB)) return nodeA;
    if (nodeB.contains(nodeA)) return nodeB;

    const ancestryA = nodeA.getAncestryPath();
    const ancestryB = new Set(nodeB.getAncestryPath().map(n => n.id));

    for (const ancestor of ancestryA) {
      if (ancestryB.has(ancestor.id)) {
        return ancestor;
      }
    }
    return this.root;
  }

  findNCDMultiple(nodes) {
    if (nodes.length === 0) return this.root;
    if (nodes.length === 1) return nodes[0];

    let ncd = nodes[0];
    for (let i = 1; i < nodes.length; i++) {
      ncd = this.findNCD(ncd, nodes[i]);
    }
    return ncd;
  }

  searchAND(tokens) {
    const occurrences = new Map();
    const allNodes = [];

    for (const token of tokens) {
      const nodes = this.xref.get(token);
      if (nodes.length === 0) return null;
      occurrences.set(token, nodes);
      allNodes.push(...nodes);
    }

    const context = this.findNCDMultiple(allNodes);
    return { context, occurrences };
  }

  indexContent(node, content) {
    const tokens = content
      .toLowerCase()
      .split(/\s+/)
      .map(t => t.replace(/[^\w]/g, ''))
      .filter(t => t.length > 0);

    this.xref.addMany(tokens, node);
    node.data.content = content;
  }

  print(node = this.root, indent = '') {
    const info = `${node.data.type}[${node.id}] Q1=${node.q1.toFixed(1)} Q2=${node.q2.toFixed(1)}`;
    const content = node.data.content ? ` "${node.data.content.substring(0, 40)}..."` : '';
    console.log(`${indent}${info}${content}`);
    for (const child of node.children) {
      this.print(child, indent + '  ');
    }
  }

  getStats() {
    let maxDepth = 0;
    const calculateDepth = (node, depth) => {
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

  serialize() {
    const serializeNode = (node) => ({
      id: node.id,
      q1: node.q1,
      q2: node.q2,
      data: node.data,
      children: node.children.map(serializeNode),
    });

    const xrefData = {};
    for (const token of this.xref.getAllTokens()) {
      xrefData[token] = this.xref.get(token).map(n => n.id);
    }

    return JSON.stringify({ tree: serializeNode(this.root), xref: xrefData }, null, 2);
  }
}

// ========================================
// TEST SUITE
// ========================================

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`✓ ${message}`);
}

console.log('\n========================================');
console.log('    DTREE TEST SUITE');
console.log('========================================\n');

// Test 1: Temel ağaç oluşturma
console.log('--- Test: Temel Ağaç Oluşturma ---');
const tree = new DTree({ type: 'document' });
assert(tree.root !== null, 'Root oluşturuldu');
assert(tree.root.q1 === 0, 'Root Q1=0');
assert(tree.root.q2 === Number.MAX_SAFE_INTEGER, 'Root Q2=MAX (post-order)');
assert(tree.root.isRoot(), 'Root kendini root olarak tanıyor');

// Test 2: Düğüm ekleme ve Q1/Q2
console.log('\n--- Test: Düğüm Ekleme ---');
const section1 = tree.appendChild(tree.root, { type: 'section' });
const section2 = tree.appendChild(tree.root, { type: 'section' });
tree.recalculateQ2(); // Q2'leri post-order olarak hesapla
assert(section1.q1 > tree.root.q1, 'Section1 Q1 > Root Q1');
assert(section2.q1 > section1.q1, 'Section2 Q1 > Section1 Q1');
assert(section1.parent === tree.root, 'Section1 parent = root');

// Test 3: Containment
console.log('\n--- Test: Containment ---');
const para1 = tree.appendChild(section1, { type: 'paragraph' });
const sent1 = tree.appendChild(para1, { type: 'sentence' });
tree.recalculateQ2(); // Q2'leri güncelle
assert(tree.root.contains(section1), 'Root contains Section1');
assert(section1.contains(para1), 'Section1 contains Para1');
assert(para1.contains(sent1), 'Para1 contains Sent1');
assert(tree.root.contains(sent1), 'Root contains Sent1 (transitive)');
assert(!sent1.contains(para1), 'Sent1 does NOT contain Para1');

// Test 4: Ancestry
console.log('\n--- Test: Ancestry ---');
const ancestry = sent1.getAncestryPath();
assert(ancestry.length === 4, 'Sent1 ancestry length = 4');
assert(ancestry[0] === sent1, 'Ancestry[0] = sent1');
assert(ancestry[3] === tree.root, 'Ancestry[3] = root');

// Test 5: Token Indexing
console.log('\n--- Test: Token Indexing ---');
tree.indexContent(sent1, 'Data privacy is important for users');
const sent2 = tree.appendChild(para1, { type: 'sentence' });
tree.indexContent(sent2, 'Users should protect their data');
tree.recalculateQ2(); // Yeni düğüm eklendi, Q2'leri güncelle

assert(tree.xref.has('data'), 'Token "data" indexed');
assert(tree.xref.get('data').length === 2, '"data" appears in 2 nodes');
assert(tree.xref.has('privacy'), 'Token "privacy" indexed');
assert(tree.xref.get('privacy').length === 1, '"privacy" appears in 1 node');

// Test 6: NCD (Nearest Common Dominator)
console.log('\n--- Test: NCD ---');
const ncd1 = tree.findNCD(sent1, sent2);
assert(ncd1 === para1, 'NCD of sent1 & sent2 = para1 (same paragraph)');

const para2 = tree.appendChild(section1, { type: 'paragraph' });
const sent3 = tree.appendChild(para2, { type: 'sentence' });
tree.indexContent(sent3, 'Security measures protect privacy');
tree.recalculateQ2(); // Yeni düğümler eklendi

const ncd2 = tree.findNCD(sent1, sent3);
assert(ncd2 === section1, 'NCD of sent1 & sent3 = section1 (different paragraphs)');

// Test 7: Contextual Search - AND
console.log('\n--- Test: Contextual Search (AND) ---');

const result1 = tree.searchAND(['data', 'users']);
assert(result1 !== null, 'AND search "data users" found results');
assert(result1.context === para1, 'Context = para1 (both terms in same paragraph)');
console.log(`  "data AND users" → Context: ${result1.context.data.type}[${result1.context.id}]`);

const result2 = tree.searchAND(['data', 'privacy']);
assert(result2 !== null, 'AND search "data privacy" found results');
console.log(`  "data AND privacy" → Context: ${result2.context.data.type}[${result2.context.id}]`);

const result3 = tree.searchAND(['privacy', 'security']);
assert(result3 !== null, 'AND search "privacy security" found results');
assert(result3.context === section1, 'Context = section1 (terms in different paragraphs)');
console.log(`  "privacy AND security" → Context: ${result3.context.data.type}[${result3.context.id}]`);

const result4 = tree.searchAND(['nonexistent', 'word']);
assert(result4 === null, 'AND search with missing token returns null');

// Test 8: Sibling Navigation
console.log('\n--- Test: Sibling Navigation ---');
assert(sent1.nextSibling === sent2, 'sent1.nextSibling = sent2');
assert(sent2.prevSibling === sent1, 'sent2.prevSibling = sent1');
assert(sent1.prevSibling === null, 'sent1.prevSibling = null (first child)');

// Test 9: Serialize/Deserialize
console.log('\n--- Test: Serialize ---');
const json = tree.serialize();
assert(json.length > 0, 'Serialization produces JSON');
assert(json.includes('"type"'), 'JSON contains type field');
assert(json.includes('"q1"'), 'JSON contains Q1 field');

// Test 10: Stats
console.log('\n--- Test: Stats ---');
const stats = tree.getStats();
console.log(`  Nodes: ${stats.nodeCount}, Max Depth: ${stats.maxDepth}, Tokens: ${stats.tokenCount}`);
assert(stats.nodeCount > 5, 'Node count > 5');
assert(stats.maxDepth >= 3, 'Max depth >= 3');

// ========================================
// CONTEXTUAL SEARCH DEMO
// ========================================

console.log('\n========================================');
console.log('    CONTEXTUAL SEARCH DEMO');
console.log('========================================\n');

// Örnek doküman oluştur
const doc = new DTree({ type: 'document', metadata: { title: 'Privacy Policy' } });

// Bölüm 1: Introduction
const intro = doc.appendChild(doc.root, { type: 'section' });
const introP1 = doc.appendChild(intro, { type: 'paragraph' });
doc.indexContent(doc.appendChild(introP1, { type: 'sentence' }), 
  'This document describes our data collection practices');
doc.indexContent(doc.appendChild(introP1, { type: 'sentence' }), 
  'We value user privacy and security');

// Bölüm 2: Data Collection
const dataSection = doc.appendChild(doc.root, { type: 'section' });
const dataP1 = doc.appendChild(dataSection, { type: 'paragraph' });
doc.indexContent(doc.appendChild(dataP1, { type: 'sentence' }), 
  'We collect personal data including name and email');
doc.indexContent(doc.appendChild(dataP1, { type: 'sentence' }), 
  'Data is stored securely on our servers');

const dataP2 = doc.appendChild(dataSection, { type: 'paragraph' });
doc.indexContent(doc.appendChild(dataP2, { type: 'sentence' }), 
  'Users can request deletion of their data');
doc.indexContent(doc.appendChild(dataP2, { type: 'sentence' }), 
  'Privacy controls are available in settings');

// Bölüm 3: Security
const securitySection = doc.appendChild(doc.root, { type: 'section' });
const secP1 = doc.appendChild(securitySection, { type: 'paragraph' });
doc.indexContent(doc.appendChild(secP1, { type: 'sentence' }), 
  'We use encryption to protect data');
doc.indexContent(doc.appendChild(secP1, { type: 'sentence' }), 
  'Security audits are performed regularly');

// Tüm düğümler eklendi, Q2'leri hesapla
doc.recalculateQ2();

console.log('Doküman Yapısı:');
doc.print();

console.log('\n--- Arama Örnekleri ---\n');

// Arama 1: "data" ve "privacy" aynı bağlamda mı?
const search1 = doc.searchAND(['data', 'privacy']);
if (search1) {
  console.log(`"data AND privacy":`);
  console.log(`  → Bağlam: ${search1.context.data.type}[${search1.context.id}]`);
  console.log(`  → "data" bulundu: ${search1.occurrences.get('data').length} yerde`);
  console.log(`  → "privacy" bulundu: ${search1.occurrences.get('privacy').length} yerde`);
}

// Arama 2: "encryption" ve "security"
const search2 = doc.searchAND(['encryption', 'security']);
if (search2) {
  console.log(`\n"encryption AND security":`);
  console.log(`  → Bağlam: ${search2.context.data.type}[${search2.context.id}]`);
}

// Arama 3: "user" ve "email"
const search3 = doc.searchAND(['users', 'email']);
if (search3) {
  console.log(`\n"users AND email":`);
  console.log(`  → Bağlam: ${search3.context.data.type}[${search3.context.id}]`);
}

// Arama 4: "deletion" ve "privacy"
const search4 = doc.searchAND(['deletion', 'privacy']);
if (search4) {
  console.log(`\n"deletion AND privacy":`);
  console.log(`  → Bağlam: ${search4.context.data.type}[${search4.context.id}] (aynı paragraf!)`);
}

console.log('\n========================================');
console.log('    TÜM TESTLER BAŞARILI! ✓');
console.log('========================================\n');
