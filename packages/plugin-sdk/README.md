# @rn-devtools/plugin-sdk

Tools and utilities for building **rn-devtools** plugins on both the **dashboard (web)** and the **device (native)** sides.

---

## Installation

```bash
# with yarn
yarn add -D @rn-devtools/plugin-sdk

# or with npm
npm i -D @rn-devtools/plugin-sdk
```

> **Peer dependency**: `socket.io-client` v4 is expected in apps that use this SDK.

---

## Quick Start

### 1) Pick a `pluginId`

Use a stable string, e.g. `"rn-devtools.demo.counter"`.

### 2) Native (device) side

Create a client bound to your `pluginId`, the active `socket`, and the current `deviceId`.

```ts
import type { Socket } from 'socket.io-client';
import { createNativePluginClient } from '@rn-devtools/plugin-sdk';

// somewhere in your native runtime
function makeNativeBus(socket: Socket, deviceId: string) {
  const pluginId = 'rn-devtools.demo.counter';
  const bus = createNativePluginClient(pluginId, socket, deviceId);

  // send an event up to the dashboard
  bus.sendMessage('counter:value', { value: 42 });

  // listen for commands coming down from the dashboard
  const unsubscribe = bus.addMessageListener<{ step: number }>('counter:inc', ({ step }) => {
    // increment your native counter by `step`
  });

  // later, on cleanup
  return () => unsubscribe();
}
```

### 3) Dashboard (web) side

Create a client for the same `pluginId`. Provide a function that returns the **currently selected device id**.

```tsx
import * as React from 'react';
import { createWebPluginClient } from '@rn-devtools/plugin-sdk';

export function CounterPanel({ currentDeviceId }: { currentDeviceId?: string }) {
  const pluginId = 'rn-devtools.demo.counter';
  const bus = React.useMemo(
    () => createWebPluginClient(pluginId, () => currentDeviceId),
    [pluginId, currentDeviceId]
  );

  React.useEffect(() => {
    // listen for values coming from the device
    const unsub = bus.addMessageListener<{ value: number }>('counter:value', (payload, { deviceId }) => {
      console.log('value from', deviceId, payload.value);
    });
    return () => unsub();
  }, [bus]);

  return (
    <button onClick={() => bus.sendMessage('counter:inc', { step: 1 })}>
      Increment on device
    </button>
  );
}
```

---

## Message Flow

```text
Dashboard (web)                           Device (native)
------------------------------------     ------------------------------------
sendMessage(event, payload, deviceId)  →  socket.emit("plugin:down", { pluginId, deviceId, event, payload })
                                          ↑
socket.on("plugin:up", handler)       ←   sendMessage(event, payload)
                                          socket.emit("plugin:up", { pluginId, deviceId, event, payload, timestamp })
```

* On dashboard init, a singleton socket is created and says hello:

  * `socket = io('/', { transports: ['websocket', 'polling'] })`
  * `socket.emit('devtools:hello', { role: 'dashboard' })`

---

## API Reference

### `createNativePluginClient(pluginId, socket, deviceId) => NativeBus`

Builds a message bus bound to a **specific device** and plugin.

```ts
export type NativeBus = {
  sendMessage: (event: string, payload?: unknown) => void;
  addMessageListener: <T = unknown>(event: string, cb: (payload: T) => void) => () => void;
};
```

* `sendMessage(event, payload?)` → emits `plugin:up` with `{ pluginId, deviceId, event, payload, timestamp }`.
* `addMessageListener(event, cb)` → listens to `plugin:down` and **filters by** `{ pluginId, deviceId, event }`. Returns an **unsubscribe** function.

---

### `createWebPluginClient(pluginId, getDeviceId) => WebBus`

Creates or reuses a **singleton** `socket` and builds a bus scoped to your plugin.

```ts
export type WebBus = {
  socket: Socket; // shared across plugins
  sendMessage: (event: string, payload?: unknown, deviceId?: string) => void;
  addMessageListener: <T = unknown>(
    event: string,
    cb: (payload: T, meta: { deviceId: string }) => void,
  ) => () => void;
};
```

* `sendMessage(event, payload?, deviceId?)` → emits `plugin:down` to the resolved device id
  (`deviceId ?? getDeviceId()`); **no-op** if no device id is available.
* `addMessageListener(event, cb)` → listens to `plugin:up` for your `pluginId` and event.
  The callback receives `{ payload, meta: { deviceId } }`. Returns an **unsubscribe** function.

> **Note:** The dashboard socket is a singleton. All plugins share the same `io('/')` connection.

---

## Shared Types

```ts
export type Device = {
  id: string;
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  platform?: string;
};

export type PluginProps = {
  targetDevice: Device;      // the currently focused device
  allDevices: Device[];      // every known device
  isDashboardConnected: boolean;
};

export type PluginMsg = {
  pluginId: string;
  deviceId?: string;
  event: string;
  payload?: Record<string, unknown>;
  timestamp?: number; // set by native on plugin:up
};

export type DevtoolsPlugin = {
  id: string; // your pluginId
  title: string; // display name
  Icon: React.FC<{ className?: string }>;
  mount: React.ComponentType<PluginProps>; // the main React view of your plugin
};

export type NativeHookProps = {
  socket: Socket;
  deviceId: string;
};
```

---

## Example: minimal `DevtoolsPlugin`

```tsx
import type { DevtoolsPlugin, PluginProps } from '@rn-devtools/plugin-sdk';
import { createWebPluginClient } from '@rn-devtools/plugin-sdk';

function Panel(props: PluginProps) {
  const bus = React.useMemo(
    () => createWebPluginClient('rn-devtools.demo.counter', () => props.targetDevice?.deviceId),
    [props.targetDevice?.deviceId]
  );

  // ...render UI and talk to native via `bus`
  return null;
}

export const CounterPlugin: DevtoolsPlugin = {
  id: 'rn-devtools.demo.counter',
  title: 'Counter',
  Icon: (p) => <svg {...p} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>,
  mount: Panel,
};
```

---

## Events & Conventions

* **Upstream (native → web):** `plugin:up` with `{ pluginId, deviceId, event, payload, timestamp }`
* **Downstream (web → native):** `plugin:down` with `{ pluginId, deviceId, event, payload }`
* **Handshake (web only):** `devtools:hello` with `{ role: 'dashboard' }` emitted once per session
* **Unsubscribe early**: always call the function returned by `addMessageListener` in `useEffect` cleanup or component teardown

---

## Gotchas & Notes

* The dashboard client **ignores sends** if it cannot resolve a device id. Make sure `getDeviceId()` is stable and returns a value when your UI is active.
* The native client filters by **exact** `pluginId`, `deviceId`, and `event`. Make sure they match on both ends.
* `timestamp` is added on native `plugin:up` messages; the dashboard does not set it.
* If you want to support **broadcasts** from native (i.e., `deviceId` omitted), confirm your filtering logic. A common pattern is:

  ```ts
  // Accept messages for the current device *or* broadcasts
  if (msg.deviceId !== undefined && msg.deviceId !== current) return;
  ```

---

## TypeScript Tips

* Use generics on `addMessageListener<T>()` to get typed payloads per event.
* Consider building a union of event→payload mappings for your plugin and wrapping
  `sendMessage`/`addMessageListener` to constrain event names.
