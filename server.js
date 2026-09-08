require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDatabase = require('./config/db');

const User = require('./models/User');
const { seedDatabase } = require('./scripts/seed');

const port = Number(process.env.PORT) || 4000;
let server;

async function startServer() {
  await connectDatabase();

  const userCount = await User.countDocuments();
  if (userCount === 0) {
    console.log('Database is empty. Populating seed data...');
    await seedDatabase({ exit: false });
  }

  server = http.createServer(app);
  server.listen(port, () => {
    console.log(`Digital Library API running at http://localhost:${port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing server gracefully...`);
  if (!server) process.exit(0);
  server.close(async () => {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  shutdown('UNHANDLED_REJECTION');
});

startServer().catch((error) => {
  console.error('Unable to start server:', error.message);
  process.exit(1);
});
