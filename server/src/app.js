const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const ngoRoutes = require('./routes/ngo');

const app = express();
const configuredOrigin = process.env.CLIENT_ORIGIN;
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = configuredOrigin
  ? [...new Set([...defaultOrigins, configuredOrigin])]
  : defaultOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ngo', ngoRoutes);
app.use((error, req, res, next) => {
  console.error(error);
  if (error.accountCreated) {
    return res.status(error.status || 503).json({
      error: error.message,
      accountCreated: true,
    });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'An unexpected server error occurred.',
  });
});

module.exports = app;

