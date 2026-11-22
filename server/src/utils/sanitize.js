const validator = require('validator');

/**
 * sanitize(str)
 * Trims whitespace, removes ASCII control characters (NULL, tabs, etc.),
 * and normalises the string for safe storage.
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return validator.stripLow(validator.trim(str));
}

/**
 * escapeHtml(str)
 * Replaces HTML-significant characters (&, <, >, ", ') with their
 * entity equivalents so user input cannot inject markup or scripts.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return validator.escape(str);
}

module.exports = { sanitize, escapeHtml };
