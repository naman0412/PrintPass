const mongoose = require('mongoose');

let gridfsBucket = null;

const connectDB = async (customUri = null) => {
  const uri = customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/printpass';
  if (mongoose.connection.readyState >= 1) {
    if (!gridfsBucket && mongoose.connection.db) {
      gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
      });
    }
    return mongoose.connection;
  }

  const conn = await mongoose.connect(uri);

  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.connection.db, {
    bucketName: 'uploads'
  });

  return conn;
};

const getGridFSBucket = () => {
  if (!gridfsBucket && mongoose.connection.db) {
    gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });
  }
  if (!gridfsBucket) {
    throw new Error('GridFSBucket not initialized. Connect to MongoDB first.');
  }
  return gridfsBucket;
};

module.exports = {
  connectDB,
  getGridFSBucket,
  mongoose
};
