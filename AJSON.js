const fs = require('fs');
const path = require('path');
const { Disk } = require('./Disk.js');

class AJSON extends Disk {
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
    console.log("Saving: " + this.file_name);
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