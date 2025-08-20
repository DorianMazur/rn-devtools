# React Native Devtools

Sleek, extensible devtools for React Native.
Add tabs as npm plugins!

![alt text](https://github.com/DorianMazur/rn-devtools/raw/main/preview.gif "React Native Devtools preview")

## ✨ Highlights

- Plugin system: add tabs via simple npm packages.
- Real-time monitoring (Socket.IO integration for reliable communication)
- Zero server edits: plugins talk over a shared plugin:up / plugin:down bus.
- One hook to wire it all: useReactNativeDevtools() creates one socket, fans out to plugin hooks.
- Always listening: plugins keep syncing even when their tab isn’t active.
- Zero-config production safety - automatically disabled in production builds

## 🚀 Quick start

### Installation

### 1. Install (in your RN app)

```bash
yarn add -D rn-devtools
yarn add @rn-devtools/plugin-sdk
```
### 2. (Optional) Install plugins

- [@rn-devtools/react-query-plugin](https://github.com/DorianMazur/rn-devtools/tree/main/packages/react-query-plugin)
- [@rn-devtools/react-navigation-plugin](https://github.com/DorianMazur/rn-devtools/tree/main/packages/react-navigation-plugin)
- [@rn-devtools/react-native-mmkv-plugin](https://github.com/DorianMazur/rn-devtools/tree/main/packages/react-native-mmkv-plugin)

### 3. Tell the web app which plugins to load

Create rn-devtools.config.js in your RN app:

```js
module.exports = {
  plugins: [
    "@rn-devtools/react-query-plugin",
    "@rn-devtools/react-navigation-plugin",
    "@rn-devtools/react-native-mmkv-plugin"
  ],
};
```

### 4. Start the DevTools
   
```bash
# from the package root
rn-devtools
```

### 5. Wire the RN app (one hook, many plugins)

```tsx
import { useReactNativeDevtools } from "rn-devtools";
import { useReactQueryDevtools } from "@rn-devtools/react-query-plugin/native";
import { useReactNavigationDevtools } from "@rn-devtools/react-navigation-plugin/native";
import { seMMKVDevtools } from "@rn-devtools/react-native-mmkv-plugin/native";

function App() {
  // your app setup…
  useReactNativeDevtools({
    socketURL: "http://10.0.2.2:35515",
    deviceName: Platform.OS,
    platform: Platform.OS,
    deviceId: Platform.OS, // make this persistent per device in real apps
    plugins: ({ socket, deviceId }) => {
      useReactQueryDevtools({ queryClient, socket, deviceId });
      useReactNavigationDevtools({ navigationRef, socket, deviceId });
      useMMKVDevtools({ storages: [storage], socket, deviceId, });
    },
  });

  return <AppRoot />;
}
```

DevTools opens on http://localhost:35515


## License
This project is licenced under the [MIT License](http://opensource.org/licenses/mit-license.html).