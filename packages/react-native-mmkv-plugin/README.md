# @rn-devtools/react-native-mmkv-plugin

A React Native MMKV tab for rn-devtools, allowing developers to view and interact with MMKV storage data in their React Native applications.

## Installation

```bash
npm i @rn-devtools/react-native-mmkv-plugin
# or
yarn add @rn-devtools/react-native-mmkv-plugin
```
## Usage
1) Native (in your app)

Hook into your MMKV instance and pass your rn-devtools socket + deviceId.

```ts
// App.tsx
import React from "react";
import { Platform } from "react-native"
import { MMKV } from "react-native-mmkv";
import { useReactNativeDevtools } from "@rn-devtools/plugin-sdk";
import { seMMKVDevtools } from "@rn-devtools/react-native-mmkv-plugin/native";

export const storage = new MMKV({ id: "devtools-mmkv" });

export default function App() {
  useReactNativeDevtools({
    socketURL: "http://10.0.2.2:35515",
    deviceName: Platform.OS || "web",
    platform: Platform.OS || "web",
    deviceId: Platform.OS || "web",
    extraDeviceInfo: { appVersion: "1.0.0" },
    plugins: ({ socket, deviceId }) => {
      useMMKVDevtools({ socket, deviceId, storages: [storage] });
    },
  });

  return (
      {/* your App */}
  );
}
```

2) Web (devtools UI)

Add the plugin to your rn-devtools config so it appears as a tab.

// rn-devtools.config.js
```js
export default {
  plugins: ["@rn-devtools/react-native-mmkv-plugin"],
};
```