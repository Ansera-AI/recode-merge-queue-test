/**
 * @param {string} text The text to whisper.
 * @returns {string} The text lowercased with three trailing dots.
 */
export function whisper(text) {
  return text.toLowerCase() + '...';
}
