/**
 * Deterministic browser-safe UUID-v4-like generator for static asset rows.
 * Replaces Node.js native 'crypto' to prevent any bundler or server-side rendering mismatch.
 */
export function stableStaticAssetId(symbol: string, assetClass: string): string {
  const seed = `${symbol.toUpperCase()}:${assetClass}`;
  
  // FNV-1a hash implementation
  const hashString = (str: string, offset: number) => {
    let hash = 2166136261 ^ offset;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };

  const h1 = hashString(`benchmark.static.asset:${seed}`, 11);
  const h2 = hashString(`benchmark.static.asset:${seed}`, 22);
  const h3 = hashString(`benchmark.static.asset:${seed}`, 33);
  const h4 = hashString(`benchmark.static.asset:${seed}`, 44);

  // Format as a standard UUID (8-4-4-4-12)
  const part1 = h1;
  const part2 = h2.slice(0, 4);
  const part3 = "4" + h2.slice(4, 7); // force UUID version 4
  const part4 = ((parseInt(h3.slice(0, 2), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + h3.slice(2, 4); // force variant RFC 4122
  const part5 = h4 + h3.slice(4, 8);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}
