// Vercel serverless function entry point
// This file exports the Express app as a serverless function for Vercel

const app = require('../server');

// Export as Vercel serverless function
module.exports = app;

