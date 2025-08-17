# RN-Devtools

Sleek, extensible React Native devtools.

![alt text](https://github.com/DorianMazur/rn-devtools/raw/main/react-query-plugin.gif "React Query Plugin")

![alt text](https://github.com/DorianMazur/rn-devtools/raw/main/navigation-plugin.gif "Navigation Plugin")

## ✨ Highlights

- Plugin system: add tabs via simple npm packages.
- Zero server edits: plugins talk over a shared plugin:up / plugin:down bus.
- One hook to wire it all: useReactNativeDevtools() creates one socket, fans out to plugin hooks.
- Monorepo-friendly: resolves plugins from your app/workspace (Node 20+).
- Always listening: plugins keep syncing even when their tab isn’t active.

## 🚀 Quick start

### Installation

1. Install (in your RN app)

```bash
yarn add rn-devtools
yarn add @rn-devtools/react-query-plugin @rn-devtools/react-navigation-plugin
```

2. Tell the web app which plugins to load

Create rn-devtools.config.js in your RN app:

```js
const config = {
  plugins: ["@rn-devtools/react-navigation-plugin", "@rn-devtools/react-query-plugin"],
};
export default config;
```

3. Start the DevTools
   
```bash
# from the package root
rn-devtools
```

1. Wire the RN app (one hook, many plugins)

```tsx
import { useReactNativeDevtools } from "@rn-devtools/plugin-sdk/native";
import { useReactQueryDevtools } from "@rn-devtools/react-query-plugin/native";
import { useReactNavigationDevtools } from "@rn-devtools/react-navigation-plugin/native";

function App() {
  // your app setup…
  useReactNativeDevtools({
    socketURL: "http://10.0.2.2:3000",
    deviceName: Platform.OS,
    platform: Platform.OS,
    deviceId: Platform.OS, // make this persistent per device in real apps
    plugins: ({ socket, deviceId }) => {
      useReactQueryDevtools({ queryClient, socket, deviceId });
      useReactNavigationDevtools({ navigationRef, socket, deviceId });
    },
  });

  return <AppRoot />;
}
```

DevTools opens on http://localhost:3000


## License
This project is licenced under the [MIT License](http://opensource.org/licenses/mit-license.html).

Any bundled fonts are copyright to their respective authors and mostly under MIT or [SIL OFL](http://scripts.sil.org/OFL).
