/**
 * CTGEngine Tests - Pure JavaScript version for validation
 * Run with: node src/lib/ctgEngine.test.js
 */

// Inline implementation for testing (since we can't compile TS without network)
class CTGEngine {
  validatePositiveInteger(n) {
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`Invalid node ID: ${n}. Must be a positive integer (N+).`);
    }
  }

  getOddPart(n) {
    this.validatePositiveInteger(n);
    while ((n & 1) === 0) {
      n = n >> 1;
    }
    return n;
  }

  getPowerOfTwo(n) {
    this.validatePositiveInteger(n);
    let k = 0;
    while ((n & 1) === 0) {
      k++;
      n = n >> 1;
    }
    return k;
  }

  isOddNode(n) {
    this.validatePositiveInteger(n);
    return (n & 1) === 1;
  }

  getParent(n) {
    this.validatePositiveInteger(n);
    if (n === 1) return null;
    if ((n & 1) === 0) return n >> 1;
    const threeNPlusOne = 3 * n + 1;
    return this.getOddPart(threeNPlusOne);
  }

  getAncestryChain(n) {
    this.validatePositiveInteger(n);
    const chain = [n];
    let current = n;
    while (current !== 1) {
      const parent = this.getParent(current);
      if (parent === null) break;
      chain.push(parent);
      current = parent;
    }
    return chain;
  }

  getPillar(n, maxVersions = 10) {
    this.validatePositiveInteger(n);
    const oddBase = this.getOddPart(n);
    const pillar = [];
    for (let k = 0; k < maxVersions; k++) {
      pillar.push(oddBase * Math.pow(2, k));
    }
    return pillar;
  }

  findAdmissibleAssociates(parentID, maxSearch = 20) {
    this.validatePositiveInteger(parentID);
    const children = [];
    for (let k = 1; k <= maxSearch; k++) {
      const numerator = Math.pow(2, k) * parentID - 1;
      if (numerator % 3 === 0) {
        const candidate = numerator / 3;
        if (candidate > 0 && Number.isInteger(candidate) && (candidate & 1) === 1) {
          if (this.getParent(candidate) === parentID) {
            children.push(candidate);
          }
        }
      }
    }
    return children.sort((a, b) => a - b);
  }

  mintNextChild(parentID, currentChildren = []) {
    this.validatePositiveInteger(parentID);
    const currentSet = new Set(currentChildren);
    const admissible = this.findAdmissibleAssociates(parentID, 30);
    for (const candidate of admissible) {
      if (!currentSet.has(candidate)) {
        return candidate;
      }
    }
    throw new Error(`Unable to find available child for parent ${parentID}.`);
  }

  mintNextVersion(n) {
    this.validatePositiveInteger(n);
    return n * 2;
  }

  getNodeInfo(n) {
    this.validatePositiveInteger(n);
    const oddBase = this.getOddPart(n);
    const pillarLevel = this.getPowerOfTwo(n);
    const parent = this.getParent(n);
    const ancestryDepth = this.getAncestryChain(n).length - 1;
    let type;
    if (n === 1) type = 'root';
    else if (this.isOddNode(n)) type = 'odd';
    else type = 'even';
    return { id: n, type, oddBase, pillarLevel, parent, ancestryDepth };
  }

  verifyParenthood(parentID, childID) {
    this.validatePositiveInteger(parentID);
    this.validatePositiveInteger(childID);
    return this.getParent(childID) === parentID;
  }

  verifyAncestry(ancestorID, descendantID) {
    this.validatePositiveInteger(ancestorID);
    this.validatePositiveInteger(descendantID);
    const chain = this.getAncestryChain(descendantID);
    return chain.includes(ancestorID);
  }
}

// Test runner
function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function assertArrayEquals(a, b, message) {
  assert(JSON.stringify(a) === JSON.stringify(b), message);
}

// Run tests
const engine = new CTGEngine();

console.log('\n========================================');
console.log('    CTG ENGINE TEST SUITE');
console.log('========================================\n');

// Test 1: getOddPart
console.log('--- Test: getOddPart ---');
assert(engine.getOddPart(12) === 3, 'getOddPart(12) = 3 (12 = 2² × 3)');
assert(engine.getOddPart(8) === 1, 'getOddPart(8) = 1 (8 = 2³ × 1)');
assert(engine.getOddPart(15) === 15, 'getOddPart(15) = 15 (already odd)');
assert(engine.getOddPart(118) === 59, 'getOddPart(118) = 59 (118 = 2 × 59)');
assert(engine.getOddPart(236) === 59, 'getOddPart(236) = 59 (236 = 4 × 59)');
assert(engine.getOddPart(1) === 1, 'getOddPart(1) = 1');

// Test 2: getPowerOfTwo
console.log('\n--- Test: getPowerOfTwo ---');
assert(engine.getPowerOfTwo(1) === 0, 'getPowerOfTwo(1) = 0');
assert(engine.getPowerOfTwo(2) === 1, 'getPowerOfTwo(2) = 1');
assert(engine.getPowerOfTwo(8) === 3, 'getPowerOfTwo(8) = 3');
assert(engine.getPowerOfTwo(12) === 2, 'getPowerOfTwo(12) = 2 (12 = 4 × 3)');
assert(engine.getPowerOfTwo(59) === 0, 'getPowerOfTwo(59) = 0 (odd)');
assert(engine.getPowerOfTwo(118) === 1, 'getPowerOfTwo(118) = 1');
assert(engine.getPowerOfTwo(236) === 2, 'getPowerOfTwo(236) = 2');

// Test 3: getParent - Root
console.log('\n--- Test: getParent (Root) ---');
assert(engine.getParent(1) === null, 'getParent(1) = null (Root has no parent)');

// Test 4: getParent - Even nodes (pillar)
console.log('\n--- Test: getParent (Even nodes - Pillar) ---');
assert(engine.getParent(2) === 1, 'getParent(2) = 1');
assert(engine.getParent(4) === 2, 'getParent(4) = 2');
assert(engine.getParent(8) === 4, 'getParent(8) = 4');
assert(engine.getParent(118) === 59, 'getParent(118) = 59 (118 = 2 × 59)');
assert(engine.getParent(236) === 118, 'getParent(236) = 118 (236 = 4 × 59)');

// Test 5: getParent - Odd nodes (3n+1 rule)
console.log('\n--- Test: getParent (Odd nodes - 3n+1 Rule) ---');
assert(engine.getParent(5) === 1, 'getParent(5) = 1 (3×5+1 = 16 = 2⁴×1)');
assert(engine.getParent(3) === 5, 'getParent(3) = 5 (3×3+1 = 10 = 2×5)');
assert(engine.getParent(7) === 11, 'getParent(7) = 11 (3×7+1 = 22 = 2×11)');
// 3×59+1 = 178 = 2×89
assert(engine.getParent(59) === 89, 'getParent(59) = 89 (3×59+1 = 178 = 2×89)');

// Test 6: getAncestryChain
console.log('\n--- Test: getAncestryChain ---');
assertArrayEquals(engine.getAncestryChain(1), [1], 'getAncestryChain(1) = [1]');
assertArrayEquals(engine.getAncestryChain(2), [2, 1], 'getAncestryChain(2) = [2, 1]');
assertArrayEquals(engine.getAncestryChain(5), [5, 1], 'getAncestryChain(5) = [5, 1]');
assertArrayEquals(engine.getAncestryChain(3), [3, 5, 1], 'getAncestryChain(3) = [3, 5, 1]');

const chain59 = engine.getAncestryChain(59);
assert(chain59[0] === 59, 'Ancestry of 59 starts with 59');
assert(chain59[chain59.length - 1] === 1, 'Ancestry of 59 ends with 1 (Root)');
console.log(`  getAncestryChain(59) = [${chain59.join(', ')}] (length: ${chain59.length})`);

// Test 7: getPillar
console.log('\n--- Test: getPillar ---');
const pillar59 = engine.getPillar(59, 5);
assertArrayEquals(pillar59, [59, 118, 236, 472, 944], 'getPillar(59, 5) = [59, 118, 236, 472, 944]');

const pillar118 = engine.getPillar(118, 4);
assertArrayEquals(pillar118, [59, 118, 236, 472], 'getPillar(118, 4) starts from odd base 59');

// Test 8: findAdmissibleAssociates
console.log('\n--- Test: findAdmissibleAssociates ---');
const childrenOf1 = engine.findAdmissibleAssociates(1, 10);
console.log(`  Children of 1: [${childrenOf1.join(', ')}]`);
assert(childrenOf1.includes(5), 'Node 5 is a child of Root (1)');
assert(childrenOf1.includes(21), 'Node 21 is a child of Root (1)');

const childrenOf5 = engine.findAdmissibleAssociates(5, 15);
console.log(`  Children of 5: [${childrenOf5.join(', ')}]`);
assert(childrenOf5.includes(3), 'Node 3 is a child of 5');

// Verify all found children
childrenOf1.forEach(child => {
  assert(engine.getParent(child) === 1, `Verify: parent of ${child} is 1`);
});

// Test 9: mintNextChild
console.log('\n--- Test: mintNextChild ---');
const firstChild = engine.mintNextChild(59);
assert(typeof firstChild === 'number' && firstChild > 0, `First child of 59: ${firstChild}`);
assert(engine.getParent(firstChild) === 59, `Verify: parent of ${firstChild} is 59`);

const secondChild = engine.mintNextChild(59, [firstChild]);
assert(secondChild !== firstChild, `Second child ${secondChild} differs from first ${firstChild}`);
assert(engine.getParent(secondChild) === 59, `Verify: parent of ${secondChild} is 59`);

// Test 10: mintNextVersion
console.log('\n--- Test: mintNextVersion ---');
assert(engine.mintNextVersion(59) === 118, 'mintNextVersion(59) = 118');
assert(engine.mintNextVersion(118) === 236, 'mintNextVersion(118) = 236');
assert(engine.mintNextVersion(1) === 2, 'mintNextVersion(1) = 2');

// Test 11: getNodeInfo
console.log('\n--- Test: getNodeInfo ---');
const info1 = engine.getNodeInfo(1);
assert(info1.type === 'root', 'Node 1 type is "root"');
assert(info1.oddBase === 1, 'Node 1 oddBase is 1');
assert(info1.pillarLevel === 0, 'Node 1 pillarLevel is 0');
assert(info1.parent === null, 'Node 1 parent is null');

const info59 = engine.getNodeInfo(59);
assert(info59.type === 'odd', 'Node 59 type is "odd"');
assert(info59.oddBase === 59, 'Node 59 oddBase is 59');
assert(info59.pillarLevel === 0, 'Node 59 pillarLevel is 0');
assert(info59.parent === 89, 'Node 59 parent is 89');

const info118 = engine.getNodeInfo(118);
assert(info118.type === 'even', 'Node 118 type is "even"');
assert(info118.oddBase === 59, 'Node 118 oddBase is 59');
assert(info118.pillarLevel === 1, 'Node 118 pillarLevel is 1');
assert(info118.parent === 59, 'Node 118 parent is 59');

// Test 12: verifyParenthood
console.log('\n--- Test: verifyParenthood ---');
assert(engine.verifyParenthood(59, 118) === true, 'verifyParenthood(59, 118) = true');
assert(engine.verifyParenthood(118, 236) === true, 'verifyParenthood(118, 236) = true');
assert(engine.verifyParenthood(89, 59) === true, 'verifyParenthood(89, 59) = true');
assert(engine.verifyParenthood(1, 5) === true, 'verifyParenthood(1, 5) = true');
assert(engine.verifyParenthood(1, 59) === false, 'verifyParenthood(1, 59) = false');
assert(engine.verifyParenthood(59, 5) === false, 'verifyParenthood(59, 5) = false');

// Test 13: verifyAncestry
console.log('\n--- Test: verifyAncestry ---');
assert(engine.verifyAncestry(1, 59) === true, 'verifyAncestry(1, 59) = true (1 is ancestor of all)');
assert(engine.verifyAncestry(1, 118) === true, 'verifyAncestry(1, 118) = true');
assert(engine.verifyAncestry(59, 118) === true, 'verifyAncestry(59, 118) = true (pillar)');
assert(engine.verifyAncestry(59, 236) === true, 'verifyAncestry(59, 236) = true (pillar)');
assert(engine.verifyAncestry(89, 59) === true, 'verifyAncestry(89, 59) = true');
assert(engine.verifyAncestry(5, 59) === true, 'verifyAncestry(5, 59) = true (5 is ancestor of 59)');
assert(engine.verifyAncestry(59, 5) === false, 'verifyAncestry(59, 5) = false (59 is NOT ancestor of 5)');

// Test 14: Edge cases and validation
console.log('\n--- Test: Edge Cases and Validation ---');
try {
  engine.getOddPart(0);
  assert(false, 'Should throw for n=0');
} catch (e) {
  assert(true, 'Throws error for n=0');
}

try {
  engine.getParent(-5);
  assert(false, 'Should throw for negative n');
} catch (e) {
  assert(true, 'Throws error for negative n');
}

try {
  engine.getOddPart(3.5);
  assert(false, 'Should throw for non-integer');
} catch (e) {
  assert(true, 'Throws error for non-integer');
}

// Real Estate Demo
console.log('\n========================================');
console.log('    REAL ESTATE DEMO: MASLAK TOWER');
console.log('========================================\n');

const MASLAK_TOWER = 59;
console.log(`Property Node (Maslak Tower): ${MASLAK_TOWER}`);
console.log(`Node Info:`, engine.getNodeInfo(MASLAK_TOWER));
console.log(`\nAncestry Chain to Genesis:`);
const ancestry = engine.getAncestryChain(MASLAK_TOWER);
console.log(`  ${ancestry.join(' → ')}`);

console.log(`\n--- Version History (Price Updates) ---`);
const versions = engine.getPillar(MASLAK_TOWER, 5);
console.log(`Pillar: ${versions.join(' → ')}`);
versions.forEach((v, i) => {
  const info = engine.getNodeInfo(v);
  console.log(`  Version ${i}: Node ${v} (parent: ${info.parent})`);
});

console.log(`\n--- Fractional Shares (Children) ---`);
const shares = engine.findAdmissibleAssociates(MASLAK_TOWER, 20);
console.log(`Available share IDs: [${shares.slice(0, 8).join(', ')}${shares.length > 8 ? ', ...' : ''}]`);

console.log(`\nMinting first 5 shares:`);
let minted = [];
for (let i = 0; i < 5; i++) {
  const shareID = engine.mintNextChild(MASLAK_TOWER, minted);
  minted.push(shareID);
  const info = engine.getNodeInfo(shareID);
  console.log(`  Share ${i + 1}: Node ${shareID}`);
  console.log(`    - Type: ${info.type}`);
  console.log(`    - Ancestry depth: ${info.ancestryDepth}`);
  console.log(`    - Verified parent: ${engine.verifyParenthood(MASLAK_TOWER, shareID)}`);
}

console.log('\n========================================');
console.log('    ALL TESTS PASSED! ✓');
console.log('========================================\n');
