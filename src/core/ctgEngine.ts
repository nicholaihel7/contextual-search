/**
 * CTGEngine - Canonical Triple-Graph Engine
 * 
 * Implements the theoretical framework for a graph-based addressing system
 * where every node is a positive integer (N+).
 * 
 * Key Concepts:
 * - Odd Nodes: Carry branching structure, each odd n ≠ 1 has a unique parent
 * - Even Nodes (Pillars): Form vertical chains (2^k × m) representing versions/updates
 * - Parenthood: For odd n, parent is the odd part of (3n + 1)
 * - Root: Node 1 is the Genesis/Root with no parent
 * 
 * Use Cases:
 * - Property (e.g., Maslak Tower): Odd Node (e.g., 59)
 * - Updates (e.g., Price Change): Even Nodes above it (118, 236, ...)
 * - Fractional Shares: Children of the Property Node
 */

export class CTGEngine {
  
  /**
   * Validates that n is a positive integer
   * @throws Error if n is not a positive integer
   */
  private validatePositiveInteger(n: number): void {
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`Invalid node ID: ${n}. Must be a positive integer (N+).`);
    }
  }

  /**
   * Extracts the odd part (odd base m) from any positive integer.
   * Removes all factors of 2 from n.
   * 
   * For n = 2^k × m where m is odd:
   * - Returns m (the odd part)
   * 
   * Examples:
   * - getOddPart(12) = 3  (12 = 2² × 3)
   * - getOddPart(8) = 1   (8 = 2³ × 1)
   * - getOddPart(15) = 15 (15 = 2⁰ × 15)
   * - getOddPart(118) = 59 (118 = 2¹ × 59)
   * 
   * @param n - A positive integer
   * @returns The odd part of n
   */
  getOddPart(n: number): number {
    this.validatePositiveInteger(n);
    
    // Use bitwise operations for efficiency
    // n & -n gives the lowest set bit (highest power of 2 that divides n)
    // Dividing by this removes all factors of 2
    while ((n & 1) === 0) {
      n = n >> 1; // Equivalent to n / 2, but faster
    }
    return n;
  }

  /**
   * Gets the power of 2 in the factorization of n.
   * For n = 2^k × m (m odd), returns k.
   * 
   * @param n - A positive integer
   * @returns The exponent k where 2^k divides n but 2^(k+1) does not
   */
  getPowerOfTwo(n: number): number {
    this.validatePositiveInteger(n);
    
    let k = 0;
    while ((n & 1) === 0) {
      k++;
      n = n >> 1;
    }
    return k;
  }

  /**
   * Determines if a node is odd (branching structure) or even (pillar/version).
   * 
   * @param n - A positive integer
   * @returns true if n is odd, false if even
   */
  isOddNode(n: number): boolean {
    this.validatePositiveInteger(n);
    return (n & 1) === 1;
  }

  /**
   * Gets the parent of a node in the CTG structure.
   * 
   * Rules:
   * 1. If n = 1 (Root/Genesis): Returns null (no parent)
   * 2. If n is even (n = 2^k × m, k ≥ 1): 
   *    Parent is 2^(k-1) × m (vertical predecessor in pillar)
   * 3. If n is odd (n ≠ 1):
   *    Parent is oddPart(3n + 1) (branching structure)
   * 
   * Examples:
   * - getParent(1) = null (Root)
   * - getParent(118) = 59 (118 = 2 × 59, so parent is 59)
   * - getParent(236) = 118 (236 = 4 × 59, so parent is 2 × 59 = 118)
   * - getParent(59) = oddPart(178) = oddPart(2 × 89) = 89
   * - getParent(5) = oddPart(16) = oddPart(2⁴ × 1) = 1
   * 
   * @param n - A positive integer node ID
   * @returns The parent node ID, or null if n is the Root (1)
   */
  getParent(n: number): number | null {
    this.validatePositiveInteger(n);
    
    // Rule 1: Root has no parent
    if (n === 1) {
      return null;
    }
    
    // Rule 2: Even nodes - vertical chain predecessor
    if ((n & 1) === 0) {
      // n = 2^k × m, parent = 2^(k-1) × m = n / 2
      return n >> 1;
    }
    
    // Rule 3: Odd nodes - branching structure using 3n+1 rule
    // Parent is the odd part of (3n + 1)
    const threeNPlusOne = 3 * n + 1;
    return this.getOddPart(threeNPlusOne);
  }

  /**
   * Gets the complete ancestry chain from node n back to Root (1).
   * 
   * The chain represents the full path in the CTG from the given node
   * to Genesis, useful for verifying lineage and establishing provenance.
   * 
   * @param n - A positive integer node ID
   * @returns Array of node IDs from n to 1 (inclusive), e.g., [n, ..., 1]
   */
  getAncestryChain(n: number): number[] {
    this.validatePositiveInteger(n);
    
    const chain: number[] = [n];
    let current = n;
    
    // Walk up the tree until we reach Root
    while (current !== 1) {
      const parent = this.getParent(current);
      if (parent === null) {
        break; // Should only happen at Root
      }
      chain.push(parent);
      current = parent;
    }
    
    return chain;
  }

  /**
   * Gets all nodes in the vertical pillar for a given node.
   * A pillar consists of nodes 2^0×m, 2^1×m, 2^2×m, ... for odd base m.
   * 
   * @param n - A positive integer node ID
   * @param maxVersions - Maximum number of versions to return (default: 10)
   * @returns Array of pillar nodes starting from the odd base
   */
  getPillar(n: number, maxVersions: number = 10): number[] {
    this.validatePositiveInteger(n);
    
    const oddBase = this.getOddPart(n);
    const pillar: number[] = [];
    
    for (let k = 0; k < maxVersions; k++) {
      pillar.push(oddBase * Math.pow(2, k));
    }
    
    return pillar;
  }

  /**
   * Finds admissible associates (potential children) for a parent node.
   * 
   * For a parent p, a child c must satisfy:
   * - c is odd
   * - oddPart(3c + 1) = p (for odd p) OR
   * - c = 2p (for even children / pillar extension)
   * 
   * The inverse of the 3n+1 rule:
   * If oddPart(3c + 1) = p, then 3c + 1 = 2^k × p for some k
   * So c = (2^k × p - 1) / 3
   * 
   * For c to be valid:
   * 1. c must be a positive integer: (2^k × p - 1) must be divisible by 3
   * 2. c must be odd
   * 
   * @param parentID - The parent node ID
   * @param maxSearch - Maximum power of 2 to search (default: 20)
   * @returns Array of valid child node IDs (odd admissible associates)
   */
  findAdmissibleAssociates(parentID: number, maxSearch: number = 20): number[] {
    this.validatePositiveInteger(parentID);
    
    const children: number[] = [];
    
    // For odd parents, find odd children where oddPart(3c + 1) = parentID
    // c = (2^k × parentID - 1) / 3 for various k
    for (let k = 1; k <= maxSearch; k++) {
      const numerator = Math.pow(2, k) * parentID - 1;
      
      // Check if divisible by 3
      if (numerator % 3 === 0) {
        const candidate = numerator / 3;
        
        // Must be a positive integer and odd
        if (candidate > 0 && Number.isInteger(candidate) && (candidate & 1) === 1) {
          // Verify: the parent of this candidate should be parentID
          if (this.getParent(candidate) === parentID) {
            children.push(candidate);
          }
        }
      }
    }
    
    return children.sort((a, b) => a - b);
  }

  /**
   * Mints the next available child node ID for a given parent.
   * 
   * This finds the smallest admissible associate not already in use.
   * Used for creating new entities (e.g., fractional shares of a property).
   * 
   * @param parentID - The parent node ID
   * @param currentChildren - Array of already-minted child IDs
   * @returns The next available child node ID
   * @throws Error if no available child can be found within search limits
   */
  mintNextChild(parentID: number, currentChildren: number[] = []): number {
    this.validatePositiveInteger(parentID);
    
    const currentSet = new Set(currentChildren);
    const admissible = this.findAdmissibleAssociates(parentID, 30);
    
    for (const candidate of admissible) {
      if (!currentSet.has(candidate)) {
        return candidate;
      }
    }
    
    throw new Error(
      `Unable to find available child for parent ${parentID}. ` +
      `Consider increasing search depth or checking current children.`
    );
  }

  /**
   * Mints the next version (pillar extension) for a given node.
   * Creates the next even node in the vertical chain.
   * 
   * @param n - Current node ID
   * @returns The next version node ID (2n)
   */
  mintNextVersion(n: number): number {
    this.validatePositiveInteger(n);
    return n * 2;
  }

  /**
   * Gets comprehensive node information including type, parent, 
   * ancestry depth, and pillar position.
   * 
   * @param n - A positive integer node ID
   * @returns Object with node metadata
   */
  getNodeInfo(n: number): {
    id: number;
    type: 'root' | 'odd' | 'even';
    oddBase: number;
    pillarLevel: number;
    parent: number | null;
    ancestryDepth: number;
  } {
    this.validatePositiveInteger(n);
    
    const oddBase = this.getOddPart(n);
    const pillarLevel = this.getPowerOfTwo(n);
    const parent = this.getParent(n);
    const ancestryDepth = this.getAncestryChain(n).length - 1;
    
    let type: 'root' | 'odd' | 'even';
    if (n === 1) {
      type = 'root';
    } else if (this.isOddNode(n)) {
      type = 'odd';
    } else {
      type = 'even';
    }
    
    return {
      id: n,
      type,
      oddBase,
      pillarLevel,
      parent,
      ancestryDepth,
    };
  }

  /**
   * Verifies that a claimed parent-child relationship is valid.
   * 
   * @param parentID - Claimed parent node ID
   * @param childID - Claimed child node ID
   * @returns true if the relationship is valid in the CTG structure
   */
  verifyParenthood(parentID: number, childID: number): boolean {
    this.validatePositiveInteger(parentID);
    this.validatePositiveInteger(childID);
    
    return this.getParent(childID) === parentID;
  }

  /**
   * Verifies that a node is a descendant of an ancestor.
   * 
   * @param ancestorID - Claimed ancestor node ID
   * @param descendantID - Claimed descendant node ID
   * @returns true if ancestorID appears in the ancestry chain of descendantID
   */
  verifyAncestry(ancestorID: number, descendantID: number): boolean {
    this.validatePositiveInteger(ancestorID);
    this.validatePositiveInteger(descendantID);
    
    const chain = this.getAncestryChain(descendantID);
    return chain.includes(ancestorID);
  }
}

// Export a singleton instance for convenience
export const ctgEngine = new CTGEngine();

// Example usage and test cases
if (typeof require !== 'undefined' && require.main === module) {
  const engine = new CTGEngine();
  
  console.log('=== CTG Engine Demo ===\n');
  
  // Property example: Maslak Tower as node 59
  const propertyNode = 59;
  console.log(`Property Node (Maslak Tower): ${propertyNode}`);
  console.log(`Node Info:`, engine.getNodeInfo(propertyNode));
  console.log(`Ancestry Chain:`, engine.getAncestryChain(propertyNode));
  console.log(`Parent:`, engine.getParent(propertyNode));
  
  // Version updates (price changes)
  console.log('\n--- Version Updates (Pillar) ---');
  const pillar = engine.getPillar(propertyNode, 5);
  console.log(`Pillar for ${propertyNode}:`, pillar);
  pillar.forEach((v, i) => {
    console.log(`  v${i}: Node ${v}, Parent: ${engine.getParent(v)}`);
  });
  
  // Fractional shares (children)
  console.log('\n--- Fractional Shares (Children) ---');
  const children = engine.findAdmissibleAssociates(propertyNode, 15);
  console.log(`Admissible children of ${propertyNode}:`, children.slice(0, 5));
  
  // Minting new children
  console.log('\n--- Minting New Shares ---');
  let mintedChildren: number[] = [];
  for (let i = 0; i < 3; i++) {
    const newChild = engine.mintNextChild(propertyNode, mintedChildren);
    mintedChildren.push(newChild);
    console.log(`Minted share ${i + 1}: Node ${newChild}`);
    console.log(`  Verify parenthood:`, engine.verifyParenthood(propertyNode, newChild));
  }
}
