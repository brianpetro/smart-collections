const { CollectionItem } = require('./CollectionItem');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor; // for checking if function is async
const helpers = require('./helpers');
const {
  deep_merge,
} = helpers;

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
    if (custom_collection_name) {
      brain[this.collection_name].collection_name = custom_collection_name;
      brain.collections[custom_collection_name] = this.constructor;
    }
    brain[this.collection_name].merge_defaults();
    // return promise if async
    if (brain[this.collection_name].load instanceof AsyncFunction) return brain[this.collection_name].load().then(() => brain[this.collection_name]);
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
  reviver(key, value) {
    if (typeof value !== 'object' || value === null) return value; // skip non-objects, quick return
    if (value.class_name) return new (this.brain.item_types[value.class_name])(this.brain, value);
    return value;
  }
  // reviver(key, value) { // JSON.parse reviver
  //   if(typeof value !== 'object' || value === null) return value; // skip non-objects, quick return
  //   if(value.class_name) this.items[key] = new (this.brain.item_types[value.class_name])(this.brain, value);
  //   return null;
  // }
  replacer(key, value) {
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
    if (existing && !changed) return existing; // if existing item and no changes, return existing item (no need to save)
    if (item.validate_save()) this.set(item); // make it available in collection (if valid)

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
    if(data.key) return this.get(data.key);
    const temp = new this.item_type(this.brain);
    const temp_data = JSON.parse(JSON.stringify(data, temp.update_data_replacer));
    deep_merge(temp.data, temp_data); // deep merge data
    // temp.update_data(data); // call deep merge directly to prevent double call of update_data in sub-classes
    // if (temp.key) temp_data.key = temp.key;
    return temp.key ? this.get(temp.key) : null;
  }
  // READ
  filter(opts) { return this.keys.filter(key => this.items[key].filter(opts)).map((key) => this.items[key]); }
  get(key) { return this.items[key]; }
  get_many(keys = []) {
    if (Array.isArray(keys)) return keys.map((key) => this.get(key));
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
  update_many(keys = [], data = {}) { this.get_many(keys).forEach((item) => item.update_data(data)); }
  // DESTROY
  clear() {
    this.items = {};
    this.keys = [];
  }
  delete(key) {
    delete this.items[key];
    this.keys = this.keys.filter((k) => k !== key);
  }
  delete_many(keys = []) {
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
exports.Collection = Collection;