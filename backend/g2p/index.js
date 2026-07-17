const express = require('express');
const cors = require('cors');

const g2pRouter = express.Router();

// Allow cross-origin requests from the Next.js frontend
g2pRouter.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-status-token']
}));

// Parse JSON for G2P endpoints
g2pRouter.use(express.json());

// Detailed Phase 7 Health Check
const healthRoutes = require('./routes/health');
g2pRouter.use('/health', healthRoutes);

// We will mount vendor and student routes here
const requestRoutes = require('./routes/requests');
const fileRoutes = require('./routes/files');
const vendorActionsRoutes = require('./routes/vendor-actions');
const { startCleanupWorker } = require('./workers/cleanup');

// Start the 5-min GC and reconciliation loop for G2P
startCleanupWorker();

g2pRouter.use('/requests', requestRoutes);
g2pRouter.use('/files', fileRoutes);
g2pRouter.use('/vendor', vendorActionsRoutes);

module.exports = {
  g2pRouter,
};
