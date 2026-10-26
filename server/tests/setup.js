const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/printpass_test';

const setupDB = () => {
  beforeAll(async () => {
    await connectDB(TEST_DB_URI);
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });
};

module.exports = { setupDB, TEST_DB_URI };
