// NAMESPACES
function collection_instance_name_from(class_name) {
  return class_name
    .replace(/([a-z])([A-Z])/g, '$1_$2') // convert camelCase to snake_case
    .toLowerCase() // convert to lowercase
    .replace(/y$/, 'ie') // ex. summaries
    + 's';
}
exports.collection_instance_name_from = collection_instance_name_from;
// HASHING
const crypto = require('crypto');
function md5(string) { return crypto.createHash('md5').update(string).digest('hex'); }
exports.md5 = md5;