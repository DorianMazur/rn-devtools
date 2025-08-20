# @rn-devtools/react-navigation-plugin

A React Navigation tab for rn-devtools. It shows the focused navigator/stack, lets you trim/reset/remove routes, and invoke navigation actions from the devtools UI.

## Installation

```bash
npm i @rn-devtools/react-navigation-plugin
# or
yarn add @rn-devtools/react-navigation-plugin
```
## Usage
1) Native (in your app)

Hook into your NavigationContainer and pass your rn-devtools socket + deviceId.

```ts
// App.tsx
import React from "react";
import { Platform } from "react-native"
import { useReactNativeDevtools } from "@rn-devtools/plugin-sdk";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { useReactNavigationDevtools } from "@rn-devtools/react-navigation-plugin/native";

const navigationRef = createNavigationContainerRef();

export default function App() {
  useReactNativeDevtools({
    socketURL: "http://10.0.2.2:35515",
    deviceName: Platform.OS || "web",
    platform: Platform.OS || "web",
    deviceId: Platform.OS || "web",
    extraDeviceInfo: { appVersion: "1.0.0" },
    plugins: ({ socket, deviceId }) => {
      useReactNavigationDevtools({
        navigationRef: navigationRef as any,
        socket,
        deviceId,
      });
    },
  });

  return (
    <NavigationContainer ref={navigationRef}>
      {/* your navigators */}
    </NavigationContainer>
  );
}
```

2) Web (devtools UI)

Add the plugin to your rn-devtools config so it appears as a tab.

// rn-devtools.config.js
```js
export default {
  plugins: ["@rn-devtools/react-navigation-plugin"],
};
```