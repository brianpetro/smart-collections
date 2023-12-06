// HASHING
const crypto = require('crypto');
function md5(string) { return crypto.createHash('md5').update(String(string)).digest('hex'); }
exports.md5 = md5;
// DEEP MERGE
function deep_merge(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      // both exist and are objects
      if (is_obj(source[key]) && is_obj(target[key])) deep_merge(target[key], source[key]);
      else target[key] = source[key]; // precedence to source
    }
  }
  return target;
  function is_obj(item) { return (item && typeof item === 'object' && !Array.isArray(item)); }
}
exports.deep_merge = deep_merge;
// NAMESPACES
function collection_instance_name_from(class_name) {
  return class_name
    .replace(/([a-z])([A-Z])/g, '$1_$2') // convert camelCase to snake_case
    .toLowerCase() // convert to lowercase
    .replace(/y$/, 'ie') // ex. summaries
    + 's';
}
exports.collection_instance_name_from = collection_instance_name_from;
// TIME
function get_readable_time(time_in_ms) {
  const seconds = Math.floor(time_in_ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} days passed`;
  else if (hours > 0) return `${hours} hours passed`;
  else if (minutes > 0) return `${minutes} minutes passed`;
  else return '';
}
exports.get_readable_time = get_readable_time;
// COSINE SIMILARITY
function cos_sim(vector1, vector2) {
  const dotProduct = vector1.reduce((acc, val, i) => acc + val * vector2[i], 0);
  const normA = Math.sqrt(vector1.reduce((acc, val) => acc + val * val, 0));
  const normB = Math.sqrt(vector2.reduce((acc, val) => acc + val * val, 0));
  return normA === 0 || normB === 0 ? 0 : dotProduct / (normA * normB);
}
exports.cos_sim = cos_sim;