// const { AJSON } = require('./AJSON.js');
class LongTermMemory {
  constructor(collection) {
    this.collection = collection;
    this.save_timeout = null;
  }
  static wake_up(collection, ltm_class='AJSON') {
    const ltm_classes = { LongTermMemory, AJSON };
    const ltm = new ltm_classes[ltm_class](collection);
    return ltm;
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
  save() { if (this.constructor.name !== 'LongTermMemory') console.log("called default, override me"); }
  async _save() { if (this.constructor.name !== 'LongTermMemory') console.log("called default, override me"); }
  reviver(key, value) { return this.collection.reviver(key, value); }
  replacer(key, value) { return this.collection.replacer(key, value); }
}
exports.LongTermMemory = LongTermMemory;

const fs = require('fs');
const path = require('path');
// const { LongTermMemory } = require('./long_term_memory');

class AJSON extends LongTermMemory {
  async load() {
    console.log("Loading: " + this.data_path);
    try {
      const file_content = fs.readFileSync(path.join(this.folder_path, this.file_name), 'utf8');
      this.items = JSON.parse(`{${file_content.slice(0, -2)}}`, this.reviver.bind(this));
      this.keys = Object.keys(this.items);
    } catch (err) {
      console.log("Error loading: " + this.data_path);
      console.log(err.stack); // stack trace
      // Create folder and file if they don't exist
      try {
        fs.mkdirSync(this.folder_path, { recursive: true });
        fs.writeFileSync(this.data_path, "");
        this.items = {};
        this.keys = [];
      } catch (creationErr) {
        console.log("Failed to create folder or file: ", creationErr);
      }
    }
  }
  // wraps _save in timeout to prevent multiple saves at once
  save() {
    // console.log("Saving: " + this.file_name);
    if (this.save_timeout) clearTimeout(this.save_timeout);
    this.save_timeout = setTimeout(this._save.bind(this), 1000);
  }
  // saves collection to file
  async _save() {
    this.save_timeout = null;
    const start = Date.now();
    console.log("Saving: " + this.file_name);
    try{
      fs.writeFileSync(
        this.data_path,
        JSON.stringify(this.items, this.replacer.bind(this), 2).slice(0, -1).slice(1) + ",\n",
      );
    } catch (err) {
      console.error("Error saving: " + this.file_name);
      console.error(err.stack);
      return;
    }
    const end = Date.now(); // log time
    const time = end - start;
    console.log("Saved " + this.file_name + " in " + time + "ms");
  }
}

exports.AJSON = AJSON;