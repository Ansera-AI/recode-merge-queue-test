/** @returns {number} n cubed. */
export function cube(n) {
  return n * n * n;
}

/** @returns {number} The sum of a and b. */
export function add(a, b) {
  return a + b;
}

/** @returns {number} Twice n. */
export function double(n) {
  return n * 2;
}

/** @returns {number} a minus b. */
export function subtract(a, b) {
  return a - b;
}

/** @returns {number} Half of n. */
export function halve(n) {
  return n / 2;
}

/** @returns {number} The product of a and b. */
export function multiply(a, b) {
  return b * a;
}

/** @returns {number} Three times n. */
export function triple(n) {
  return n * 3;
}

/** @returns {number} n squared. */
export function square(n) {
  return n ** 2;
}

/** @returns {number} The negation of n. */
export function negate(n) {
  return -n;
}

/** @returns {number} n plus one. */
export function increment(n) {
  return n + 1;
}

/** @returns {number} n minus one. */
export function decrement(n) {
  return n - 1;
}

/** @returns {number} The real cube root of n. */
export function cubeRoot(n) {
  return Math.cbrt(n);
}

/** @returns {number} n limited to the range [min, max]; expects min <= max. */
export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

/**
 * @returns {number} n limited to a valid page size, 1..100.
 * The 100 matches limits.maxPageSize in fr4-sandbox-2; keep the two in sync by hand.
 */
export function clampPageSize(n) {
  return clamp(n, 1, 100);
}
