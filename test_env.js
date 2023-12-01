const { 
  Brain,
  LongTermMemory,
  Parent,
  Child,
  Grand,
  TestItem,
  TestItems,
  Parents,
  Childs,
  Grands,
} = require('./test_classes');
async function init(opts = {}) {
  const {
    key = 'test',
  } = opts;
  const brain = new Brain(LongTermMemory);
  brain.item_types = {
    TestItem,
    Parent,
    Child,
    Grand,
  };
  if(opts.item_types) Object.assign(brain.item_types, opts.item_types);
  brain.collections = {
    test_items: TestItems,
    parents: Parents,
    childs: Childs,
    grands: Grands,
  };
  if(opts.collections) Object.assign(brain.collections, opts.collections);
  brain.config = {
    collections: {
      test_items: {
        test_item_config: 'test_item_config_value',
      },
      parents: {
        parent_config: 'parent_config_value',
      },
      childs: {
        child_config: 'child_config_value',
      },
      grands: {
        grand_config: 'grand_config_value',
      },
    },
    data_path: './tmp',
  };
  await brain.init();
  const test_collection = brain.test_items;
  const test_item = test_collection.create_or_update({ key });
  return { brain, test_collection, test_item };
}
exports.init = init;