const mongoose = require('mongoose');

let memoryServerInstance = null;

async function connectDatabase() {
  let uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digital_library';

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (error) {
    console.log(`Could not connect to external MongoDB at ${uri} (${error.message}).`);
    console.log('Starting an embedded in-memory MongoDB database automatically...');

    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServerInstance = await MongoMemoryServer.create();
    uri = memoryServerInstance.getUri();
    process.env.MONGO_URI = uri;

    await mongoose.connect(uri);
    console.log(`Embedded MongoDB connected successfully at ${uri}`);
    return mongoose.connection;
  }
}

module.exports = connectDatabase;

