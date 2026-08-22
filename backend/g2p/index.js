const express = require('express');
const cors = require('cors');

const g2pRouter = express.Router();

// Allow cross-origin requests from the Next.js frontend
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'https://share2me-test.vercel.app', 'https://share2me.vercel.app', 'https://share2me.in', 'https://www.share2me.in'];
g2pRouter.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || DEV_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-status-token', 'x-session-token']
}));

// Mount Webhooks first so they get raw body instead of parsed JSON
const webhooksRouter = require('./routes/webhooks');
g2pRouter.use('/billing', webhooksRouter);

// Parse JSON for G2P endpoints
g2pRouter.use(express.json());

// Mount billing router (checkout, portal)
const billingRouter = require('./routes/billing');
g2pRouter.use('/billing', billingRouter);

// Detailed Phase 7 Health Check
const healthRoutes = require('./routes/health');
g2pRouter.use('/health', healthRoutes);

// We will mount vendor and student routes here
const requestRoutes = require('./routes/requests');
const fileRoutes = require('./routes/files');
const vendorActionsRoutes = require('./routes/vendor-actions');
const toolsRoutes = require('./routes/tools');
const { startCleanupWorker } = require('./workers/cleanup');

// Start the 5-min GC and reconciliation loop for G2P
startCleanupWorker();

g2pRouter.use('/requests', requestRoutes);
g2pRouter.use('/files', fileRoutes);
g2pRouter.use('/vendor', vendorActionsRoutes);
g2pRouter.use('/tools', toolsRoutes);
g2pRouter.use('/printshop', require('./routes/printshop'));

module.exports = {
  g2pRouter,
};
