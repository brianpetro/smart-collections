/*
 * Copyright (c) Brian Joseph Petro (WFH Brian)
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
const helpers = require('./helpers');
const { md5, deep_merge, collection_instance_name_from } = helpers;
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor; // for checking if function is async
const { LongTermMemory: LTM } = require('./long_term_memory.js');
const { AJSON } = require('./AJSON.js');
const { ObsidianAJSON } = require('./ObsidianAJSON.js');
// ORCHESTRATOR CLASS
class Brain {
  constructor(ltm_adapter=LTM) {
    this.config = {};
    this.item_types = {};
    this.collections = {};
    this.ltm_adapter = ltm_adapter;
    this.data_path = './test/data';
  }
  init() {
    this.load_collections();
  }
  load_collections() {
    Object.entries(this.collections).map(([collection_name, collection]) => this[collection_name] = collection.load(this));
  }
  get_ref(ref) { return this[ref.collection_name].get(ref.key); }
}
// BASE COLLECTION CLASSES
/**
 * Represents a collection of items.
 */
class Collection {
  constructor(brain) {
    this.brain = brain;
    this.config = this.brain.config;
    this.items = {};
    this.keys = [];
    this.LTM = this.brain.ltm_adapter.wake_up(this, this.brain.ltm_adapter);
  }
  static load(brain, config = {}) {
    const { custom_collection_name } = config;
    brain[this.collection_name] = new this(brain);
    if(custom_collection_name){
      brain[this.collection_name].collection_name = custom_collection_name;
      brain.collections[custom_collection_name] = this.constructor;
    }
    brain[this.collection_name].merge_defaults();
    // return promise if async
    if(brain[this.collection_name].load instanceof AsyncFunction) return brain[this.collection_name].load().then(() => brain[this.collection_name]);
    else brain[this.collection_name].load();
    return brain[this.collection_name];
  }
  // Merge defaults from all classes in the inheritance chain (from top to bottom, so child classes override parent classes)
  merge_defaults() {
    let current_class = this.constructor;
    while (current_class) { // merge collection config into item config
      const col_conf = this.config?.collections?.[current_class.collection_name];
      Object.entries((typeof col_conf === 'object') ? col_conf : {})
        .forEach(([key, value]) => this[key] = value);
      current_class = Object.getPrototypeOf(current_class);
    }
    // console.log(Object.keys(this));
  }
  // SAVE/LOAD
  save() { this.LTM.save(); }
  load() { this.LTM.load(); }
  reviver(key, value) { // JSON.parse reviver
    if(typeof value !== 'object' || value === null) return value; // skip non-objects, quick return
    if(value.class_name) return new (this.brain.item_types[value.class_name])(this.brain, value);
    return value;
  }
  // reviver(key, value) { // JSON.parse reviver
  //   if(typeof value !== 'object' || value === null) return value; // skip non-objects, quick return
  //   if(value.class_name) this.items[key] = new (this.brain.item_types[value.class_name])(this.brain, value);
  //   return null;
  // }
  replacer(key, value) { // JSON.stringify replacer
    if (value instanceof this.item_type) return value.data;
    if (value instanceof CollectionItem) return value.ref;
    return value;
  }
  // CREATE
  /**
   * Creates a new item or updates an existing one within the collection based on the provided data.
   * @param {Object} data - The data to create a new item or update an existing one.
   * @return {CollectionItem} The newly created or updated CollectionItem.
   */
  create_or_update(data = {}) {
    const existing = this.find_by(data);
    const item = existing ? existing : new this.item_type(this.brain);
    item.is_new = !!!existing;
    const changed = item.update_data(data); // handles this.data
    if(existing && !changed) return existing; // if existing item and no changes, return existing item (no need to save)
    if(item.validate_save()) this.set(item); // make it available in collection (if valid)
    // dynamically handle async init functions
    if (item.init instanceof AsyncFunction) return new Promise((resolve, reject) => { item.init(data).then(() => resolve(item)); });
    item.init(data); // handles functions that involve other items
    return item;
  }
  /**
   * Finds an item in the collection that matches the given data.
   * @param {Object} data - The criteria used to find the item.
   * @return {CollectionItem|null} The found CollectionItem or null if not found.
   */
  find_by(data) {
    if (!data.key) {
      const temp = new this.item_type(this.brain);
      temp.update_data(data);
      if(temp.key) data.key = temp.key;
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
      // console.log("filter_opts: ", filter_opts);
      const filtered = this.filter(filter_opts);
      // console.log("filtered: " + filtered.length);
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
  update_many(keys=[], data={}) { this.get_many(keys).forEach((item) => item.update_data(data)); }
  // DESTROY
  clear() {
    this.items = {};
    this.keys = [];
  }
  delete(key) {
    delete this.items[key];
    this.keys = this.keys.filter((k) => k !== key);
  }
  delete_many(keys=[]) {
    keys.forEach((key) => delete this.items[key]);
    this.keys = Object.keys(this.items);
  }
  // CONVENIENCE METHODS (namespace getters)
  static get collection_name() { return this.name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(); }
  get collection_name() { return (this._collection_name) ? this._collection_name : this.constructor.collection_name; }
  set collection_name(name) { this._collection_name = name; }
  get item_class_name() { return this.constructor.name.slice(0, -1).replace(/(ie)$/g, 'y'); } // remove 's' from end of name & if name ends in 'ie', replace with 'y'
  get item_name() { return this.item_class_name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(); }
  get item_type() { return this.brain.item_types[this.item_class_name]; }
}
/**
 * Represents an item within a collection.
 */
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
    if(data) this.data = data;
    this.data.class_name = this.constructor.name;
  }
  // Merge defaults from all classes in the inheritance chain (from top to bottom, so child classes override parent classes)
  merge_defaults() {
    let current_class = this.constructor;
    while(current_class) { // deep merge defaults
      for(let key in current_class.defaults) {
        if(typeof current_class.defaults[key] === 'object') this[key] = { ...current_class.defaults[key], ...this[key] };
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
  /**
   * Updates the data of this item.
   * @param {Object} input_data - The new data for the item.
   */
  update_data(data) {
    data = JSON.parse(JSON.stringify(data, this.update_data_replacer));
    deep_merge(this.data, data); // deep merge data
    return true; // return true if data changed (default true)
  }
  update_data_replacer(key, value) {
    if (value instanceof CollectionItem) return value.ref;
    if (Array.isArray(value)) return value.map((val) => (val instanceof CollectionItem) ? val.ref : val);
    return value;
  }
  // init - for data not in this.data
  /**
   * Initializes the item with input_data, potentially asynchronously.
   * Handles interactions with other collection items.
   * @param {Object} input_data - The initial data for the item.
   */
  init() { this.save(); } // should always call this.save() in child class init() overrides
  save() {
    if(!this.validate_save()){
      if(this.key) this.collection.delete(this.key);
      return console.error("Invalid save: ", {data: this.data, stack: new Error().stack});
    }
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
    const {
      exclude_key,
      exclude_keys = exclude_key ? [exclude_key] : [],
      exclude_key_starts_with,
      key_ends_with,
    } = opts;
    if(exclude_keys?.includes(this.key)) return false;
    if(exclude_key_starts_with && this.key.startsWith(exclude_key_starts_with)) return false;
    if(key_ends_with && !this.key.endsWith(key_ends_with)) return false;
    // OVERRIDE FILTER LOGIC here: pattern: if(opts.pattern && !this.data[opts.pattern.matcher]) return false;
    return true;
  }
  parse() { }
  // HELPER FUNCTIONS
  // CONVENIENCE METHODS (namespace getters)
  static get collection_name() { return collection_instance_name_from(this.name); }
  // static get collection_name() { return this.name
  //   .replace(/([a-z])([A-Z])/g, '$1_$2') // convert camelCase to snake_case
  //   .toLowerCase() // convert to lowercase
  //   .replace(/y$/, 'ie') // ex. summaries
  //   + 's';
  // }
  get collection_name() { return this.data.collection_name ? this.data.collection_name : this.constructor.collection_name; }
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
exports.ObsidianAJSON = ObsidianAJSON;
exports.helpers = helpers;