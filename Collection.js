const path = require('path');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor; // for checking if function is async

// BASE COLLECTION CLASSES
class Collection {
  constructor(brain, disk_class) {
    this.brain = brain;
    this.main = this.brain.main;
    this.config = this.brain.config;
    this.items = {};
    this.keys = [];
    if(!disk_class) disk_class = require('./Disk.js').Disk;
    this.disk = new disk_class(this);
  }
  static async load(brain, disk_class) {
    // const timestamp = Date.now();
    brain[this.collection_name] = new this(brain, disk_class);
    brain[this.collection_name].merge_defaults();
    await brain[this.collection_name].load();
    // console.log("Loaded " + this.collection_name + " in " + (Date.now() - timestamp) + "ms");
    return brain[this.collection_name];
  }
  // Merge defaults from all classes in the inheritance chain (from top to bottom, so child classes override parent classes)
  merge_defaults() {
    let current_class = this.constructor;
    while (current_class) { // merge collection config into item config
      const col_conf = this.config.collections[current_class.collection_name];
      Object.entries((typeof col_conf === 'object') ? col_conf : {})
        .forEach(([key, value]) => this[key] = value);
      current_class = Object.getPrototypeOf(current_class);
    }
    // console.log(Object.keys(this));
  }
  // SAVE/LOAD
  save() { this.disk.save(); }
  async load() { await this.disk.load(); }
  reviver(key, value) {
    if (typeof value !== 'object' || value === null) return value; // skip non-objects, quick return
    if (value.class_name) return new (this.brain.item_types[value.class_name])(this.brain, value);
    return value;
  }
  replacer(key, value) { return (value instanceof CollectionItem) ? value.data : value; } // JSON.stringify Replacer

  // CREATE
  create_or_update(data = {}) {
    const existing = this.find_by(data);
    const item = existing ? existing : new this.item_type(this.brain);
    item.update_data(data); // handles this.data
    item.save(); // call save to make it available in collection
    // dynamically handle async init functions
    if (item.init instanceof AsyncFunction) return new Promise((resolve, reject) => { item.init(data).then(() => resolve(item)); });
    item.init(data); // handles functions that involve other items
    return item;
  }
  find_by(data) {
    if (!data.key) {
      const temp = new this.item_type(this.brain);
      temp.update_data(data);
      data.key = temp.key;
    }
    return data.key ? this.get(data.key) : null;
  }
  // READ
  filter(opts) { return this.keys.filter(key => this.items[key].filter(opts)).map((key) => this.items[key]); }
  get(key) { return this.items[key]; }
  get_many(keys = []) { return keys.map((key) => this.get(key)); }
  get_rand(filter_opts = null) {
    if (filter_opts) {
      console.log("filter_opts: ", filter_opts);
      const filtered = this.filter(filter_opts);
      console.log("filtered: " + filtered.length);
      return filtered[Math.floor(Math.random() * filtered.length)];
    }
    return this.items[this.keys[Math.floor(Math.random() * this.keys.length)]];
  }
  // UPDATE
  set(item) {
    if (!item.key) throw new Error("Item must have key property");
    this.items[item.key] = item;
    if (!this.keys.includes(item.key)) this.keys.push(item.key);
  }
  // DESTROY
  clear() {
    this.items = {};
    this.keys = [];
    this.save();
  }
  delete(key) {
    delete this.items[key];
    this.keys = this.keys.filter((k) => k !== key);
    this.save();
  }
  parse(source) {
    const parse_fx_name = `parse_${source.collection.item_name}`; // e.g. parse_turn, parse_manychat_thread
    if (typeof this[parse_fx_name] === 'function') {
      this[parse_fx_name](source);
    } else if (typeof this.item_type[parse_fx_name] === 'function') {
      this.item_type[parse_fx_name](this.brain, source);
    } else if (this.item_type.parse) {
      this.item_type.parse(this.brain, source);
    } else {
      console.log(`No parse function found for ${source.collection.item_name} in ${this.item_name}`);
    }
  }
  reparse(reset = true) { Object.values(this.items).forEach((item) => item.parse(reset)); }
  // CONVENIENCE METHODS (namespace getters)
  static get collection_name() { return this.name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(); }
  get collection_name() { return this.constructor.collection_name; }
  get data_path() { return path.join(this.folder_path, this.file_name); }
  get file_name() { return this.collection_name + '.ajson'; }
  get folder_path() { return path.join(this.config.data_path, this.config.account); }
  get item_class_name() { return this.constructor.name.slice(0, -1).replace(/(ie)$/g, 'y'); } // remove 's' from end of name & if name ends in 'ie', replace with 'y'
  get item_name() { return this.item_class_name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(); }
  get item_type() { return this.brain.item_types[this.item_class_name]; }
}
exports.Collection = Collection;
