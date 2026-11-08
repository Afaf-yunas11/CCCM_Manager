const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('./app');
const connectDB = require('./config/db');

const port = Number(process.env.PORT) || 5000;

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`CCCM Manager API listening on port ${port}`);
  });
});

