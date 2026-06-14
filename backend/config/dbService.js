const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Path for the local JSON database
const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Ensure local db directory exists
if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
  fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
}

// Initial database template
const INITIAL_DB = {
  users: [],
  purchases: [],
  sales: [],
  products: [],
  customers: [],
  suppliers: [],
  activityLogs: []
};

// Seed file if it doesn't exist
if (!fs.existsSync(LOCAL_DB_PATH)) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
}

class LocalDB {
  constructor() {
    this.filePath = LOCAL_DB_PATH;
  }

  read() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading JSON DB, returning default:', err);
      return INITIAL_DB;
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing to JSON DB:', err);
    }
  }

  getCollection(name) {
    const dbData = this.read();
    return dbData[name] || [];
  }

  setCollection(name, data) {
    const dbData = this.read();
    dbData[name] = data;
    this.write(dbData);
  }

  async find(collectionName, query = {}) {
    let list = this.getCollection(collectionName);
    // Apply basic filter
    return list.filter(item => {
      for (const key in query) {
        // Handle MongoDB style queries if needed (like $or or nested structure, but keep it simple)
        if (query[key] && typeof query[key] === 'object' && query[key].$regex) {
          const regex = new RegExp(query[key].$regex, query[key].$options || '');
          if (!regex.test(item[key])) return false;
        } else if (query[key] !== undefined && item[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  async findOne(collectionName, query = {}) {
    const list = await this.find(collectionName, query);
    return list[0] || null;
  }

  async insertOne(collectionName, doc) {
    const list = this.getCollection(collectionName);
    const newDoc = {
      _id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...doc
    };
    list.push(newDoc);
    this.setCollection(collectionName, list);
    return newDoc;
  }

  async updateOne(collectionName, query = {}, update = {}) {
    const list = this.getCollection(collectionName);
    let updated = false;
    let updatedDoc = null;

    const newList = list.map(item => {
      // Check query match
      let match = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          match = false;
          break;
        }
      }
      if (match && !updated) {
        // Apply update (handles $set style update or direct merge)
        const changes = update.$set ? update.$set : update;
        updatedDoc = { ...item, ...changes, updatedAt: new Date().toISOString() };
        updated = true;
        return updatedDoc;
      }
      return item;
    });

    if (updated) {
      this.setCollection(collectionName, newList);
    }
    return { matchedCount: updated ? 1 : 0, modifiedCount: updated ? 1 : 0, doc: updatedDoc };
  }

  async deleteOne(collectionName, query = {}) {
    const list = this.getCollection(collectionName);
    let deleted = false;
    const newList = [];

    for (const item of list) {
      let match = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          match = false;
          break;
        }
      }
      if (match && !deleted) {
        deleted = true;
      } else {
        newList.push(item);
      }
    }

    if (deleted) {
      this.setCollection(collectionName, newList);
    }
    return { deletedCount: deleted ? 1 : 0 };
  }

  async deleteMany(collectionName, query = {}) {
    const list = this.getCollection(collectionName);
    let deletedCount = 0;
    const newList = list.filter(item => {
      let match = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          match = false;
          break;
        }
      }
      if (match) {
        deletedCount++;
        return false;
      }
      return true;
    });

    if (deletedCount > 0) {
      this.setCollection(collectionName, newList);
    }
    return { deletedCount };
  }
}

class DBManager {
  constructor() {
    this.useMongoDB = false;
    this.localDB = new LocalDB();
    this.dbName = 'jmcf-inventory';
  }

  async connect() {
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri) {
      try {
        console.log('Attempting connection to MongoDB at:', mongoUri);
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 3000
        });
        this.useMongoDB = true;
        console.log('Successfully connected to MongoDB.');
      } catch (err) {
        console.error('Failed to connect to MongoDB, falling back to Local JSON DB.', err.message);
        this.useMongoDB = false;
      }
    } else {
      console.log('No MONGO_URI provided in environment. Using Local JSON DB.');
      this.useMongoDB = false;
    }
  }

  // Unified CRUD Operations
  async find(collectionName, query = {}) {
    if (this.useMongoDB) {
      try {
        // Check if query._id is a string, and we need to match it
        // MongoDB stores it as String if we insert it as string, or ObjectId. Let's make queries flexible.
        return await mongoose.connection.db.collection(collectionName).find(query).toArray();
      } catch (err) {
        console.error(`MongoDB find failed for ${collectionName}, falling back to Local DB:`, err);
        return await this.localDB.find(collectionName, query);
      }
    }
    return await this.localDB.find(collectionName, query);
  }

  async findOne(collectionName, query = {}) {
    if (this.useMongoDB) {
      try {
        return await mongoose.connection.db.collection(collectionName).findOne(query);
      } catch (err) {
        console.error(`MongoDB findOne failed for ${collectionName}, falling back to Local DB:`, err);
        return await this.localDB.findOne(collectionName, query);
      }
    }
    return await this.localDB.findOne(collectionName, query);
  }

  async insertOne(collectionName, doc) {
    if (this.useMongoDB) {
      try {
        const newDoc = {
          _id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36), // Use simple custom string keys for both databases to keep code identical
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...doc
        };
        await mongoose.connection.db.collection(collectionName).insertOne(newDoc);
        return newDoc;
      } catch (err) {
        console.error(`MongoDB insertOne failed for ${collectionName}, falling back to Local DB:`, err);
        return await this.localDB.insertOne(collectionName, doc);
      }
    }
    return await this.localDB.insertOne(collectionName, doc);
  }

  async updateOne(collectionName, query = {}, update = {}) {
    if (this.useMongoDB) {
      try {
        const changes = update.$set ? update : { $set: update };
        // Add updatedAt timestamp
        if (changes.$set) {
          changes.$set.updatedAt = new Date().toISOString();
        }
        const res = await mongoose.connection.db.collection(collectionName).updateOne(query, changes);
        const doc = await this.findOne(collectionName, query);
        return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, doc };
      } catch (err) {
        console.error(`MongoDB updateOne failed for ${collectionName}, falling back to Local DB:`, err);
        return await this.localDB.updateOne(collectionName, query, update);
      }
    }
    return await this.localDB.updateOne(collectionName, query, update);
  }

  async deleteOne(collectionName, query = {}) {
    if (this.useMongoDB) {
      try {
        const res = await mongoose.connection.db.collection(collectionName).deleteOne(query);
        return { deletedCount: res.deletedCount };
      } catch (err) {
        console.error(`MongoDB deleteOne failed for ${collectionName}, falling back to Local DB:`, err);
        return await this.localDB.deleteOne(collectionName, query);
      }
    }
    return await this.localDB.deleteOne(collectionName, query);
  }

  async deleteMany(collectionName, query = {}) {
    if (this.useMongoDB) {
      try {
        const res = await mongoose.connection.db.collection(collectionName).deleteMany(query);
        return { deletedCount: res.deletedCount };
      } catch (err) {
        console.error(`MongoDB deleteMany failed for ${collectionName}, falling back to Local DB:`, err);
        return await this.localDB.deleteMany(collectionName, query);
      }
    }
    return await this.localDB.deleteMany(collectionName, query);
  }

  // Backup data
  async backup() {
    const collections = ['users', 'purchases', 'sales', 'products', 'customers', 'suppliers', 'activityLogs'];
    const data = {};
    for (const col of collections) {
      data[col] = await this.find(col, {});
    }
    return data;
  }

  // Restore data
  async restore(data) {
    const collections = ['users', 'purchases', 'sales', 'products', 'customers', 'suppliers', 'activityLogs'];
    for (const col of collections) {
      if (data[col]) {
        await this.deleteMany(col, {});
        for (const item of data[col]) {
          // Direct insert
          if (this.useMongoDB) {
            await mongoose.connection.db.collection(col).insertOne(item);
          } else {
            const list = this.localDB.getCollection(col);
            list.push(item);
            this.localDB.setCollection(col, list);
          }
        }
      }
    }
    return true;
  }
}

module.exports = new DBManager();
