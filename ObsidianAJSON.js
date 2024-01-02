const { LongTermMemory } = require('./long_term_memory');
class ObsidianAJSON extends LongTermMemory {
  constructor(collection) {
    super(collection);
    this.adapter = this.brain.main.app.vault.adapter;
  }
  async load() {
    console.log("Loading: " + this.file_path);
    try {
      const file_content = await this.adapter.read(this.file_path);
      this.items = JSON.parse(`{${file_content.slice(0, -2)}}`, this.reviver.bind(this));
      this.keys = Object.keys(this.items);
    } catch (err) {
      console.log("Error loading: " + this.data_path);
      console.log(err.stack); // stack trace
      // Create folder and file if they don't exist
      try {
        await this.adapter.mkdir(this.data_path);
        await this.adapter.write(this.file_path, "");
        this.items = {};
        this.keys = [];
      } catch (creationErr) {
        console.log("Failed to create folder or file: ", creationErr);
      }
    }
  }
  // wraps _save in timeout to prevent multiple saves at once
  save() {
    if(this.save_timeout) clearTimeout(this.save_timeout);
    this.save_timeout = setTimeout(() => { this._save(); }, 10000);
  }
  // saves collection to file
  async _save(force=false) {
    if (this.save_timeout) clearTimeout(this.save_timeout);
    this.save_timeout = null;
    if(this._saving) return console.log("Already saving: " + this.file_name);
    this._saving = true; // prevent multiple saves at once
    setTimeout(() => { this._saving = false; }, 10000); // set _saving to false after 10 seconds
    const start = Date.now();
    console.log("Saving: " + this.file_name);
    try {
      const file_content = JSON.stringify(this.items, this.replacer.bind(this), 2);
      const new_size = file_content.length;
      if(!force && (new_size < 100)) return console.log("File content empty, not saving"); // if file content empty, do not save
      const old_size = (await this.adapter.stat(this.file_path)).size;
      if(!force && (new_size < (0.8 * old_size))) return console.log("File content smaller than 80% of original, not saving"); // if file content smaller than 80% of original, do not save
      await this.adapter.write( this.file_path, file_content.slice(0, -1).slice(1) + ",\n" );
    } catch (err) {
      console.error("Error saving: " + this.file_name);
      console.error(err.stack);
      return;
    }
    const end = Date.now(); // log time
    const time = end - start;
    console.log("Saved " + this.file_name + " in " + time + "ms");
    this._saving = false;
  }
  get file_name() { return super.file_name + '.ajson'; }
}

exports.ObsidianAJSON = ObsidianAJSON;