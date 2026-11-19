/**
 * @param {string} text The text to hush.
 * @returns {string} The text with every exclamation mark removed.
 */
export function hush(text) {
  return text.replace(/!/g, '');
}
