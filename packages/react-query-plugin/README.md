# @rn-devtools/react-query-plugin

A React Query tab for rn-devtools. Mirrors your app’s TanStack Query state in the devtools UI and lets you refetch/invalidate/reset/remove queries, edit data, toggle online/offline, and simulate loading/error.

## Installation

```bash
npm i -D @rn-devtools/react-query-plugin
# or
yarn add -D @rn-devtools/react-query-plugin
```
## Usage
1) Native (in your app)

Hook the plugin into your QueryClient and rn-devtools connection.

```ts
// App.tsx
import React from "react";
import { Platform } from "react-native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReactQueryDevtools } from "@rn-devtools/react-query-plugin/native";
import { useReactNativeDevtools } from "@rn-devtools/plugin-sdk";

const client = new QueryClient();

export default function App() {
  useReactNativeDevtools({
    socketURL: "http://10.0.2.2:35515",
    deviceName: Platform.OS || "web",
    platform: Platform.OS || "web",
    deviceId: Platform.OS || "web",
    extraDeviceInfo: { appVersion: "1.0.0" },
    plugins: ({ socket, deviceId }) => {
      useReactQueryDevtools({ queryClient: client, socket, deviceId });
    },
  });

  return (
    <QueryClientProvider client={qc}>
      {/* your app */}
    </QueryClientProvider>
  );
}
```

2) Web (devtools UI)

Add the plugin to your rn-devtools config so it appears as a tab.

// rn-devtools.config.js
```js
export default {
  plugins: ["@rn-devtools/react-query-plugin"],
};
```