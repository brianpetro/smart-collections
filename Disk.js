class Disk {
  constructor(collection) {
    this.collection = collection;
    this.save_timeout = null;
  }
  get collection_name() { return this.collection.collection_name; }
  get item_name() { return this.collection.item_name; }
  get file_name() { return this.collection.file_name; }
  get folder_path() { return this.collection.folder_path; }
  get data_path() { return this.collection.data_path; }
  get items() { return this.collection.items; }
  set items(items) { this.collection.items = items; }
  get keys() { return this.collection.keys; }
  set keys(keys) { this.collection.keys = keys; }
  async load() { }
  save() { }
  async _save() { }
  reviver(key, value) { return this.collection.reviver(key, value); }
  replacer(key, value) { return this.collection.replacer(key, value); }
}
exports.Disk = Disk;