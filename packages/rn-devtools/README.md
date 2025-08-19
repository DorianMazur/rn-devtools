# rn-devtools
CLI + web UI for React Native DevTools.
This is the package that serves the dashboard and wires the plugin system.

## Quick start (from your RN app)

```bash
# dev-only install
npm i -D rn-devtools @rn-devtools/plugin-sdk
# run
npx rn-devtools   # opens http://localhost:35515
```

Add a config to load tabs:

// rn-devtools.config.js
```js
export default { plugins: ["@rn-devtools/react-query-plugin"] };
```

## Requirements
Node >= 20