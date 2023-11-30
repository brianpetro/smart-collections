const path = require('path');
const { md5, collection_instance_name_from } = require('./helpers');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor; // for checking if function is async
const { LongTermMemory: LTM, AJSON } = require('./long_term_memory.js');
// ORCHESTRATOR CLASS
class Brain {
  constructor(ltm_class='AJSON') {
    this.config = {};
    this.main = {};
    this.item_types = {};
    this.collections = {};
    this.ltm_class = ltm_class;
  }
  async init() { await Promise.all(Object.entries(this.collections).map(async ([collection_name, collection]) => this[collection_name] = await collection.load(this))); }
  get_ref(ref) { return this[ref.collection_name].get(ref.key); }
}
// BASE COLLECTION CLASSES
class Collection {
  constructor(brain) {
    this.brain = brain;
    this.main = this.brain.main;
    this.config = this.brain.config;
    this.items = {};
    this.keys = [];
    this.LTM = LTM.wake_up(this, this.brain.ltm_class);
  }
  static async load(brain) {
    // const timestamp = Date.now();
    brain[this.collection_name] = new this(brain);
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
  save() { this.LTM.save(); }
  async load() { await this.LTM.load(); }
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
  get_many(keys = []) {
    if(Array.isArray(keys)) return keys.map((key) => this.get(key));
    console.error("get_many called with non-array keys: ", keys);
  }
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
class CollectionItem {
  static get defaults() {
    return {
      data: {
        key: null,
      },
    };
  }
  constructor(brain, data = null) {
    this.brain = brain;
    this.config = this.brain?.config;
    this.merge_defaults();
    if (data) this.data = data;
    this.data.class_name = this.constructor.name;
  }
  // Merge defaults from all classes in the inheritance chain (from top to bottom, so child classes override parent classes)
  merge_defaults() {
    let current_class = this.constructor;
    while (current_class) { // deep merge defaults
      for (let key in current_class.defaults) {
        if (typeof current_class.defaults[key] === 'object') this[key] = { ...current_class.defaults[key], ...this[key] };
        else this[key] = current_class.defaults[key];
      }
      current_class = Object.getPrototypeOf(current_class);
    }
  }
  // OVERRIDE IN CHILD CLASSES to customize key
  get_key() {
    console.log("called default get_key");
    return md5(JSON.stringify(this.data));
  }
  // update_data - for data in this.data
  update_data(data) {
    data = JSON.parse(JSON.stringify(data, this.update_data_replacer));
    // deep merge data
    this.deep_merge(this.data, data);
  }
  update_data_replacer(key, value) {
    if (value instanceof CollectionItem) return value.ref;
    if (Array.isArray(value)) return value.map((val) => (val instanceof CollectionItem) ? val.ref : val);
    return value;
  }
  // init - for data not in this.data
  init() { this.save(); } // should always call this.save() in child class init() overrides
  save() {
    if (!this.validate_save()) throw new Error("Invalid save data: " + JSON.stringify(this.data));
    this.collection.set(this); // set entity in collection
    this.collection.save(); // save collection
  }
  validate_save() {
    if (!this.key) return false;
    if (this.key === '') return false;
    if (this.key.includes('undefined')) return false;
    return true;
  }
  delete() { this.collection.delete(this.key); }
  // functional filter (returns true or false) for filtering items in collection; called by collection class
  filter(opts={}) {
    if (opts.exclude_keys?.includes(this.key)) return false;
    // OVERRIDE FILTER LOGIC here: pattern: if(opts.pattern && !this.data[opts.pattern.matcher]) return false;
    return true;
  }
  parse() { }
  // HELPER FUNCTIONS
  deep_merge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        // both exist and are objects
        if (is_obj(source[key]) && is_obj(target[key])) this.deep_merge(target[key], source[key]);
        else target[key] = source[key]; // precedence to source
      }
    }
    return target;
    function is_obj(item) { return (item && typeof item === 'object' && !Array.isArray(item)); }
  }
  // CONVENIENCE METHODS (namespace getters)
  static get collection_name() { return collection_instance_name_from(this.name); }
  get collection_name() { return this.constructor.collection_name; }
  get collection() { return this.brain[this.collection_name]; }
  get key() { return this.data.key = this.data.key || this.get_key(); }
  get ref() { return { collection_name: this.collection_name, key: this.key }; }
  get seq_key() { return this.key; } // used for building sequence keys
}

// export all classes
exports.Brain = Brain;
exports.Collection = Collection;
exports.CollectionItem = CollectionItem;
exports.LongTermMemory = LTM;
exports.AJSON = AJSON;