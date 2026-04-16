require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const pokemonRoutes = require('./routes/pokemon');
const typesRoutes = require('./routes/types');
const generationsRoutes = require('./routes/generations');
const favoritesRoutes = require('./routes/favorites');
const teamsRoutes = require('./routes/teams');
const socialRoutes = require('./routes/social');
const battleRoutes = require('./routes/battle');
const { router: notificationsRoutes } = require('./routes/notifications');

app.use('/api/auth', authRoutes);
app.use('/api/pokemon', pokemonRoutes);
app.use('/api/types', typesRoutes);
app.use('/api/generations', generationsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (Express 5 catches async errors automatically)
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

const http = require('http');
const socketService = require('./services/socket');
const server = http.createServer(app);

// Initialize Sockets
socketService.init(server);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
