/** @returns {number} a modulo b, always non-negative. */
export function mod(a, b) {
  return ((a % b) + b) % b;
}
