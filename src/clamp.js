/** @returns {number} n kept between lo and hi. */
export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(n, lo));
}
