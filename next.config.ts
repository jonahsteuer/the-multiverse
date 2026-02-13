import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpack = require('webpack');

const nextConfig: NextConfig = {
  // Exclude Three.js from server components (prevents analysis during build)
  // This tells Next.js to NOT analyze these packages during server-side compilation
  serverExternalPackages: ['three', '@react-three/fiber', '@react-three/drei'],
  
  webpack: (config, { isServer }) => {
    // Only externalize on server - client needs to bundle but we'll prevent deep analysis
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('three', '@react-three/fiber', '@react-three/drei');
    } else {
      // On client, configure webpack to handle Node.js modules that shouldn't be in browser
      config.resolve = config.resolve || {};
      config.resolve.fallback = config.resolve.fallback || {};
      
      // Polyfill or ignore Node.js built-in modules that don't exist in browser
      // Setting to false tells webpack to ignore these modules (they won't be bundled)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'module': false, // Don't try to bundle Node's 'module' module - it's Node.js only
        'fs': false,
        'path': false,
        'os': false,
        'util': false,
        'stream': false,
        'buffer': false,
      };
      
      // Also configure webpack to replace 'module' imports with a stub
      // This prevents errors when dependencies try to import Node.js-only 'module' module
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^module$/,
          require.resolve('./lib/webpack-module-stub.js')
        )
      );
      
      // Prefer ES modules over CommonJS
      config.resolve.conditionNames = ['import', 'require', 'node', 'default'];
      
      // Ensure webpack can resolve both .js and .mjs files
      config.resolve.extensions = [
        '.mjs',
        '.js',
        '.mts',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
        ...(config.resolve.extensions || [])
      ];
      
      // Configure to handle CommonJS properly - webpack should convert require() to __webpack_require__()
      // This is usually automatic, but we'll ensure it's enabled
      config.output = config.output || {};
      config.output.environment = {
        ...config.output.environment,
        dynamicImport: true,
        module: true,
      };
    }
    
    return config;
  },
};

export default nextConfig;

