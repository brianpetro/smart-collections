const test = require('ava');
const { 
  Brain, 
  Collection, 
  CollectionItem 
} = require('./collection-item');
// mock sub classes
class TestItems extends Collection {}
class TestItem extends CollectionItem {}
class Parents extends Collection {}
class Parent extends CollectionItem {
  static get defaults() {
    return {
      data: {
        parent_prop: 'parent_value',
        child_prop: null,
        grand_prop: null,
      },
    };
  }
  get_key() { return 'parent_key'; }
}
class Childs extends Parents {}
class Child extends CollectionItem {
  static get defaults() {
    return {
      data: {
        parent_prop: 'child_value',
        child_prop: 'child_value',
        grand_prop: null,
      },
    };
  }
  get_key() { return 'child_key'; }
}
class Grands extends Childs {}
class Grand extends CollectionItem {
  static get defaults() {
    return {
      data: {
        parent_prop: 'grand_value',
        child_prop: 'grand_value',
        grand_prop: 'grand_value',
      },
    };
  }
  get_key() { return 'grand_key'; }
}
async function init_test_env(item_data = {}) {
  const { key = 'test' } = item_data;
  const brain = new Brain();
  brain.item_types = {
    TestItem,
    Parent,
    Child,
    Grand,
  };
  brain.collections = {
    test_items: TestItems,
    parents: Parents,
    childs: Childs,
    grands: Grands,
  };
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
  };
  await brain.init();
  const collection = brain.test_items;
  const item = collection.create_or_update({ key });
  return { brain, collection, item };
}

// Collection tests
test('Collection constructor sets the brain property', async (t) => {
  const { brain, collection } = await init_test_env();
  t.is(collection.brain, brain);
});

test('Collection constructor sets the config property', async (t) => {
  const { collection } = await init_test_env();
  t.is(collection.config, collection.brain.config);
});

test('Collection constructor sets the items property', async (t) => {
  const { collection, item } = await init_test_env();
  t.deepEqual(collection.items, { [item.key]: item });
});

test('Collection constructor sets the keys property', async (t) => {
  const { collection, item } = await init_test_env();
  t.deepEqual(collection.keys, [item.key]);
});

test('Collection constructor sets the disk property', async (t) => {
  const { collection } = await init_test_env();
  t.is(collection.disk.collection, collection);
});

test('Collection merge_defaults merges settings from config', async (t) => {
  const { collection } = await init_test_env();
  t.is(collection.test_item_config, 'test_item_config_value');
});

test('Collection load calls disk.load', async (t) => {
  const { collection } = await init_test_env();
  collection.disk.load = () => t.pass();
  collection.load();
});

// CollectionItem tests
test('CollectionItem constructor sets the brain property', async (t) => {
  const { brain, item } = await init_test_env();
  t.is(item.brain, brain);
});

test('CollectionItem constructor sets the data class_name property', async (t) => {
  const { item } = await init_test_env();
  t.is(item.data.class_name, 'TestItem');
});

test('CollectionItem merge_defaults merges defaults from all classes in the inheritance chain', async (t) => {
  const { brain } = await init_test_env();
  const parent = brain.parents.create_or_update();
  const child = brain.childs.create_or_update();
  const grand = brain.grands.create_or_update();
  t.is(parent.data.parent_prop, 'parent_value');
  t.is(parent.data.child_prop, null);
  t.is(parent.data.grand_prop, null);
  t.is(child.data.parent_prop, 'child_value');
  t.is(child.data.child_prop, 'child_value');
  t.is(child.data.grand_prop, null);
  t.is(grand.data.parent_prop, 'grand_value');
  t.is(grand.data.child_prop, 'grand_value');
  t.is(grand.data.grand_prop, 'grand_value');
});

test('CollectionItem update_data deep merges the provided data with the existing data', async (t) => {
  const { item } = await init_test_env();
  item.data = {
    key: 'item_key',
    value: 'item_value',
    nested: {
      prop1: 'prop1_value',
      prop2: 'prop2_value',
    },
  };
  
  item.update_data({
    value: 'updated_value',
    nested: {
      prop2: 'updated_prop2_value',
      prop3: 'prop3_value',
    },
  });
  
  t.is(item.data.key, 'item_key');
  t.is(item.data.value, 'updated_value');
  t.is(item.data.nested.prop1, 'prop1_value');
  t.is(item.data.nested.prop2, 'updated_prop2_value');
  t.is(item.data.nested.prop3, 'prop3_value');
});

test('CollectionItem init calls save', async (t) => {
  const { item } = await init_test_env();
  item.save = () => t.pass();
  item.init();
});

test('CollectionItem save calls validate_save, collection.set, and collection.save', async (t) => {
  const { item } = await init_test_env();
  item.validate_save = () => t.pass();
  item.collection.set = () => t.pass();
  item.collection.save = () => t.pass();
  item.save();
});

test('CollectionItem validate_save returns false if key is null', async (t) => {
  const { item } = await init_test_env();
  item.get_key = () => null;
  item.data.key = null;
  t.false(item.validate_save());
});
test('CollectionItem validate_save returns false if key is empty', async (t) => {
  const { item } = await init_test_env();
  item.get_key = () => '';
  item.data.key = '';
  t.false(item.validate_save());
});
test('CollectionItem validate_save returns false if key includes undefined', async (t) => {
  const { item } = await init_test_env();
  item.get_key = () => undefined;
  item.data.key = undefined;
  t.false(item.validate_save());
});
test('CollectionItem validate_save returns true if key is valid', async (t) => {
  const { item } = await init_test_env();
  item.get_key = () => 'test';
  item.data.key = 'test';
  t.true(item.validate_save());
});

test('CollectionItem delete calls collection.delete', async (t) => {
  const { item } = await init_test_env();
  item.collection.delete = () => t.pass();
  item.delete();
});

test('CollectionItem filter returns true by default', async (t) => {
  const { item } = await init_test_env();
  t.true(item.filter());
});

test('CollectionItem filter returns false if item key is in exclude_keys', async (t) => {
  const { item } = await init_test_env();
  t.false(item.filter({ exclude_keys: [item.key] }));
});

// test('CollectionItem filter returns false if item data does not match pattern', async (t) => {
//   const { item } = await init_test_env();
//   t.false(item.filter({ pattern: { matcher: 'test', value: 'test' } }));
// });

// test('CollectionItem filter returns true if item data matches pattern', async (t) => {
//   const { item } = await init_test_env();
//   item.data.test = 'test';
//   t.true(item.filter({ pattern: { matcher: 'test', value: 'test' } }));
// });

test('CollectionItem get_key returns md5 hash of JSON.stringify(this.data)', async (t) => {
  const { item } = await init_test_env({ key: 'test' });
  t.is(item.get_key(), 'bdbe9d1ea525cbf3210538e33d8e09c1');
});

test('CollectionItem collection getter returns the collection for the item', async (t) => {
  const { item, collection } = await init_test_env();
  t.is(item.collection, collection);
});

test('CollectionItem ref getter returns a reference to the item', async (t) => {
  const { item } = await init_test_env({ key: 'test' });
  t.deepEqual(item.ref, { collection_name: 'test_items', key: 'test' });
});

test('CollectionItem collection_name getter returns the name of the collection', async (t) => {
  const { item } = await init_test_env();
  t.is(item.collection_name, 'test_items');
});

// uses get_key() in sub class to generate key
test('CollectionItem key getter returns the sub class get_key() value', async (t) => {
  const { brain } = await init_test_env();
  const child = brain.childs.create_or_update();
  t.is(child.key, 'child_key');
});
