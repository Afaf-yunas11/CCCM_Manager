const dns = require('dns');
const mongoose = require('mongoose');

// Use public DNS to resolve MongoDB Atlas SRV records
// (ISP/router DNS often blocks these lookups)
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected:', mongoose.connection.name);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
