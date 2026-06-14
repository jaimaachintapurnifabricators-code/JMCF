require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/dbService');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Import Routes
const authRoutes = require('./routes/auth');
const purchaseRoutes = require('./routes/purchases');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const contactRoutes = require('./routes/contacts');
const reportRoutes = require('./routes/reports');
const systemRoutes = require('./routes/system');
const { seedSampleData } = require('./utils/seeder');

// Bind Routes
app.use('/api/auth', authRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: db.useMongoDB ? 'MongoDB' : 'Local JSON DB',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static files in production or on Render
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  app.get('*all', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Connect to Database and Start Server
async function startServer() {
  await db.connect();
  
  // Seed database if empty
  await seedSampleData();

  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`JMCF Management Backend is running on port ${PORT}`);
    console.log(`Mode: ${db.useMongoDB ? 'MongoDB' : 'Local JSON DB'}`);
    console.log(`Health URL: http://localhost:${PORT}/health`);
    console.log(`==================================================`);
  });
}

startServer();
