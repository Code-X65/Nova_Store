/**
 * Generates a URL-friendly slug from a string.
 * @param {string} text - The text to slugify (e.g., Product Name)
 * @returns {string} - The slug (e.g., "product-name")
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

module.exports = slugify;
