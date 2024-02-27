const { LongTermMemory } = require('./long_term_memory');
const { openDB } = require('idb');
class IDBLTM extends LongTermMemory {
  constructor(collection) {
    super(collection);
    openDB(this.file_name, 1, {
      upgrade: this.upgradeDB.bind(this)
    }).then(db => this.db = db);
  }
  async upgradeDB(db, oldVersion, newVersion, transaction) {
    console.log("Upgrading DB", this.file_name);
    if (!db.objectStoreNames.contains(this.file_name)) {
      db.createObjectStore(this.file_name);
    }
  }
  // clear database
  async clear() {
    await this.db.clear(this.file_name);
  }
  // // load collection from indexedDB
  // async load() {
  //   const time = Date.now();
  //   // wait for this.db to be defined
  //   while(!this.db) await new Promise(r => setTimeout(r, 100));
  //   // wait for createObjectStore to finish
  //   // while(!this.db.objectStoreNames.contains(this.file_name)) await new Promise(r => setTimeout(r, 100));
  //   console.log(this.db);
  //   // verify db has been created
  //   if(!this.db.objectStoreNames.contains(this.file_name)) {
  //     console.log("Collection not found: " + this.file_name);
  //     return;
  //   }
  //   console.log("Getting keys for: " + this.file_name);
  //   const keys = await this.db.getAllKeys(this.file_name);
  //   console.log(keys);
  //   for(let key of keys) {
  //     const item = await this.db.get(this.file_name, key);
  //     // console.log(item);
  //     this.collection.items[key] = JSON.parse(item, this.reviver.bind(this));
  //     this.collection.keys.push(key);
  //   }
  //   console.log("Loaded " + this.collection.keys.length + ' items from ' + this.file_name + " in " + (Date.now() - time) + "ms");
  // }
  async load() {
    const time = Date.now();
    while(!this.db) await new Promise(r => setTimeout(r, 100));
    if(!this.db.objectStoreNames.contains(this.file_name)) {
      console.log("Collection not found: " + this.file_name);
      return;
    }
    console.log("Getting keys for: " + this.file_name);
    const keys = await this.db.getAllKeys(this.file_name);
    console.log(keys);
    const items = await Promise.all(keys.map(key => this.db.get(this.file_name, key)));
    for(let i = 0; i < keys.length; i++) {
      this.collection.items[keys[i]] = JSON.parse(items[i], this.reviver.bind(this));
      this.collection.keys.push(keys[i]);
    }
    console.log("Loaded " + this.collection.keys.length + ' items from ' + this.file_name + " in " + (Date.now() - time) + "ms");
  }


  // wraps _save in timeout to prevent multiple saves at once
  save() {
    if(this.save_timeout) clearTimeout(this.save_timeout);
    this.save_timeout = setTimeout(() => { this._save(); }, 10000);
  }
  async _save(force=false) {
    if(this.save_timeout) clearTimeout(this.save_timeout);
    this.save_timeout = null;
    if(this._saving) return console.log("Already saving: " + this.file_name);
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 10000);
    const start = Date.now();
    console.log("Saving: " + this.file_name);
    const transaction = this.db.transaction(this.file_name, 'readwrite');
    const store = transaction.objectStore(this.file_name);
    for(let key in this.items) {
      if(!this.items[key]?.vec) continue;
      const item = JSON.stringify(this.items[key], this.replacer.bind(this));
      store.put(item, key);
    }
    await transaction.done;
    console.log("Saved " + this.file_name + " in " + (Date.now() - start) + "ms");
  }
  // // saves collection to indexedDB
  // async _save(force=false) {
  //   if(this.save_timeout) clearTimeout(this.save_timeout);
  //   this.save_timeout = null;
  //   if(this._saving) return console.log("Already saving: " + this.file_name);
  //   this._saving = true; // prevent multiple saves at once
  //   setTimeout(() => { this._saving = false; }, 10000); // set _saving to false after 10 seconds
  //   const start = Date.now();
  //   console.log("Saving: " + this.file_name);
  //   for(let key in this.items) {
  //     if(!this.items[key]?.vec) continue; // skip items without vec
  //     const item = JSON.stringify(this.items[key], this.replacer.bind(this));
  //     this.db.put(this.file_name, item, key);
  //   }
  //   const end = Date.now(); // log time
  //   const time = end - start;
  //   console.log("Saved " + this.file_name + " in " + time + "ms");
  // }
}
exports.IDBLTM = IDBLTM;