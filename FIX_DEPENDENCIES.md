# Fix Dependency Conflict

## The Problem
`@react-three/fiber` version 8.17.10 requires React 18, but your project uses React 19.

## The Solution

Run this command in your terminal:

```bash
cd /Users/jonahsteuer/Documents/GitHub/comeup_nextjs
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag tells npm to ignore peer dependency conflicts and install anyway. This is safe because React 19 is backward compatible with React 18 APIs that Three.js uses.

## Alternative: Use Latest Version

I've already updated `package.json` to use `@react-three/fiber@^8.18.0` which should have better React 19 support. Try:

```bash
npm install
```

If that still fails, use:

```bash
npm install --legacy-peer-deps
```

## After Installation

Once installed, you can start the dev server:

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.


