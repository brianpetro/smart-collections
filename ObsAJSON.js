const { LongTermMemory } = require('./long_term_memory');
class ObsAJSON extends LongTermMemory {
  constructor(collection) {
    super(collection);
    this.adapter = this.brain.main.app.vault.adapter;
  }
  async load() {
    console.log("Loading: " + this.file_path);
    try {
      // replaced reviver b/c it was using too much memory
      Object.entries(JSON.parse(`{${await this.adapter.read(this.file_path)}}`)).forEach(([key, value]) => {
        this.collection.items[key] = new (this.brain.item_types[value.class_name])(this.brain, value);
        this.collection.keys.push(key);
      });
      console.log("Loaded: " + this.file_name);
    } catch (err) {
      console.log("Error loading: " + this.file_path);
      console.log(err.stack); // stack trace
      // Create folder and file if they don't exist
      if (err.code === 'ENOENT') {
        this.items = {};
        this.keys = [];
        try {
          await this.adapter.mkdir(this.data_path);
          await this.adapter.write(this.file_path, "");
        } catch (creationErr) {
          console.log("Failed to create folder or file: ", creationErr);
        }
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
    if(this.save_timeout) clearTimeout(this.save_timeout);
    this.save_timeout = null;
    if(this._saving) return console.log("Already saving: " + this.file_name);
    this._saving = true; // prevent multiple saves at once
    setTimeout(() => { this._saving = false; }, 10000); // set _saving to false after 10 seconds
    const start = Date.now();
    console.log("Saving: " + this.file_name);
    // rename old file
    const old_file_path = this.file_path.replace('.ajson', '.old.ajson');
    try {
      if(await this.adapter.exists(old_file_path)) await this.adapter.remove(old_file_path);
      if(await this.adapter.exists(this.file_path)) await this.adapter.rename(this.file_path, old_file_path);
      let file_content = [];
      const items = Object.values(this.items).filter(i => i.vec);
      const batches = Math.ceil(items.length / 1000);

      for(let i = 0; i < batches; i++) {
        file_content = items.slice(i * 1000, (i + 1) * 1000).map(i => i.ajson);
        const batch_content = file_content.join(",");
        if(i > 0) await this.adapter.append(this.file_path, ",");
        await this.adapter.append(this.file_path, batch_content);
      }
      // append last batch
      if(items.length > batches * 1000) {
        await this.adapter.append(this.file_path, ",");
        await this.adapter.append(this.file_path, items.slice(batches * 1000).map(i => i.ajson).join(","));
      }

      const end = Date.now(); // log time
      const time = end - start;
      console.log("Saved " + this.file_name + " in " + time + "ms");
      // remove old file after new file is saved
      if(await this.adapter.exists(old_file_path)) await this.adapter.remove(old_file_path);
    } catch (err) {
      console.error("Error saving: " + this.file_name);
      console.error(err.stack);
      // set new file to "failed" and rename to inlclude datetime
      const failed_file_path = this.file_path.replace('.ajson', '-' + Date.now() + '.failed.ajson');
      // move old file back if new file fails to save
      await this.adapter.rename(this.file_path, failed_file_path);
      await this.adapter.rename(old_file_path, this.file_path);
    }
    this._saving = false;
  }
  get file_name() { return super.file_name + '.ajson'; }
}

exports.ObsAJSON = ObsAJSON;