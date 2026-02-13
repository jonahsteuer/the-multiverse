// Stub for Node.js 'module' module - used by webpack when bundling client-side code
// This prevents errors when dependencies try to import Node.js-only modules
module.exports = {
  createRequire: () => {
    // Return a no-op require function for browser
    return () => {};
  }
};

