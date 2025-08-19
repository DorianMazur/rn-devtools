import * as React from "react";
import {
  createNativePluginClient,
  NativeHookProps,
} from "@rn-devtools/plugin-sdk";
import type { MMKV } from "react-native-mmkv";

type Props = NativeHookProps & {
  /** MMKV instances to monitor (pass the storages you care about). */
  storages: readonly MMKV[];
  /** Optional: customize how instanceIds are named on the wire (for the web UI). */
  getInstanceId?: (mmkv: MMKV, index: number) => string;
};

const PLUGIN = "mmkv";
const EVT_CONFIG = "config";
const EVT_SNAPSHOT = "snapshot";
const EVT_CHANGE = "change";
const EVT_MUTATE = "mutate";
const EVT_REQUEST_SNAPSHOT = "snapshot.request";

type WireValue =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "buffer"; valueBytes: number[] }
  | { type: "undefined" };

type MutationOp =
  | { op: "set"; key: string; value: WireValue }
  | { op: "delete"; key: string }
  | { op: "clearAll" };

function toBytes(buf: unknown): number[] {
  if (buf instanceof Uint8Array) return Array.from(buf);
  if (buf instanceof ArrayBuffer) return Array.from(new Uint8Array(buf));
  return [];
}

function readKey(mmkv: MMKV, key: string): WireValue {
  if (!mmkv.contains(key)) return { type: "undefined" };

  const s = mmkv.getString(key);
  if (s !== undefined && s.length > 0) return { type: "string", value: s };

  const n = mmkv.getNumber(key);
  if (n !== undefined) return { type: "number", value: n };

  const b = mmkv.getBoolean(key);
  if (b !== undefined) return { type: "boolean", value: b };

  const buf = mmkv.getBuffer?.(key) as Uint8Array | ArrayBuffer | undefined;
  if (buf) return { type: "buffer", valueBytes: toBytes(buf) };

  return { type: "undefined" };
}

function writeKey(mmkv: MMKV, key: string, v: WireValue) {
  switch (v.type) {
    case "string":
      mmkv.set(key, v.value);
      break;
    case "number":
      mmkv.set(key, v.value);
      break;
    case "boolean":
      mmkv.set(key, v.value);
      break;
    case "buffer": {
      const u8 = new Uint8Array(v.valueBytes);
      mmkv.set(key, u8);
      break;
    }
    case "undefined":
      mmkv.delete(key);
      break;
  }
}

function defaultGetId(mmkv: MMKV, index: number) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return String(mmkv?.id ?? `mmkv[${index}]`);
}

export function useMMKVDevtools({
  storages,
  socket,
  deviceId,
  getInstanceId = defaultGetId,
}: Props) {
  const clientRef = React.useRef(
    createNativePluginClient(PLUGIN, socket, deviceId),
  );
  const client = clientRef.current;

  const pairs = React.useMemo(
    () => storages.map((mmkv, i) => ({ id: getInstanceId(mmkv, i), mmkv })),
    [storages, getInstanceId],
  );

  const snapshot = React.useCallback(
    (pair: { id: string; mmkv: MMKV }, customKeys?: string[]) => {
      const { id, mmkv } = pair;
      const keys = customKeys ?? mmkv.getAllKeys();
      const values: Record<string, WireValue> = {};
      for (const k of keys) values[k] = readKey(mmkv, k);
      client.sendMessage(EVT_SNAPSHOT, { instanceId: id, values });
    },
    [client],
  );

  React.useEffect(() => {
    const unsubCfg = client.addMessageListener(EVT_CONFIG, () => {
      for (const p of pairs) snapshot(p);
    });

    const unsubReq = client.addMessageListener(
      EVT_REQUEST_SNAPSHOT,
      (payload?: { instanceId?: string }) => {
        if (payload?.instanceId) {
          const p = pairs.find((x) => x.id === payload.instanceId);
          if (p) snapshot(p);
        } else {
          for (const p of pairs) snapshot(p);
        }
      },
    );

    const unsubMut = client.addMessageListener(
      EVT_MUTATE,
      (payload?: { instanceId: string; ops: MutationOp[] }) => {
        if (!payload) return;
        const p = pairs.find((x) => x.id === payload.instanceId);
        if (!p) return;
        for (const op of payload.ops ?? []) {
          if (op.op === "set") writeKey(p.mmkv, op.key, op.value);
          else if (op.op === "delete") p.mmkv.delete(op.key);
          else if (op.op === "clearAll") p.mmkv.clearAll();
        }
        snapshot(p);
      },
    );

    const subs = pairs.map(({ id, mmkv }) =>
      mmkv.addOnValueChangedListener((changedKey) => {
        client.sendMessage(EVT_CHANGE, {
          instanceId: id,
          key: changedKey,
          value: readKey(mmkv, changedKey),
        });
      }),
    );

    // Initial snapshot
    for (const p of pairs) snapshot(p);

    return () => {
      unsubCfg();
      unsubReq();
      unsubMut();
      subs.forEach((s) => s.remove());
    };
  }, [client, pairs, snapshot]);
}

export default useMMKVDevtools;
