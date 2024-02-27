const fs = require('fs').promises;
const path = require('path');
const { LongTermMemory } = require('./long_term_memory');

class ScJSON extends LongTermMemory {
  async load() {
    console.log("Loading: " + this.file_path);
    try {
      const file_content = await fs.readFile(this.file_path, 'utf8');
      this.items = JSON.parse(`{${file_content}}`, this.reviver.bind(this));
      this.keys = Object.keys(this.items);
    } catch (err) {
      console.log("Error loading: " + this.file_path);
      console.log(err.stack); // stack trace

      // Create folder and file if they don't exist
      try {
        await fs.mkdir(this.data_path, { recursive: true });
        await fs.writeFile(this.file_path, "");
        this.items = {};
        this.keys = [];
      } catch (creationErr) {
        console.log("Failed to create folder or file: ", creationErr);
      }
    }
  }
  // wraps _save in timeout to prevent multiple saves at once
  save() {
    if (this.save_timeout) clearTimeout(this.save_timeout);
    this.save_timeout = setTimeout(() => this._save(), 1000);
  }
  // saves collection to file
  async _save() {
    this.save_timeout = null;
    const start = Date.now();
    console.log("Saving: " + this.file_name);
    try {
      const file_content = JSON.stringify(this.items, this.replacer.bind(this));
      await fs.writeFile(
        this.file_path,
        file_content.substring(1, file_content.length - 1)
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
  get file_name() { return super.file_name + '.ajson'; }
}

exports.ScJSON = ScJSON;
