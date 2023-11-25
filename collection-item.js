const { AJSON } = require('./AJSON');
const { Disk } = require('./Disk');
const { CollectionItem } = require('./CollectionItem');
const { Collection } = require('./Collection');
class Brain {
  constructor() {
    this.config = {};
    this.main = {};
    this.item_types = {};
    this.collections = {};
  }
  async init() {
    for (let collection_name in this.collections) {
      await this.collections[collection_name].load(this, Disk);
    }
  }
}
// export all classes
exports.Brain = Brain;
exports.Collection = Collection;
exports.CollectionItem = CollectionItem;
exports.Disk = Disk;
exports.AJSON = AJSON;