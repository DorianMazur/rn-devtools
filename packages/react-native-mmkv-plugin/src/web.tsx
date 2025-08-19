import * as React from "react";
import {
  createWebPluginClient,
  DevtoolsPlugin,
  PluginProps,
} from "@rn-devtools/plugin-sdk";

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

type Row = {
  key: string;
  value: WireValue;
  dirty?: WireValue | null;
  ts: number;
};

type InstanceState = {
  id: string;
  rows: Record<string, Row>;
};

const Icon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 1.08 1.08"
    className={className}
    fill="currentColor"
    aria-hidden
  >
    <path d="M0.537 0.548c0.243 0 0.44 -0.052 0.453 -0.119V0.257c-0.013 0.067 -0.211 0.119 -0.453 0.119A1.2 1.2 0 0 1 0.188 0.329V0.269a1.2 1.2 0 0 0 0.349 0.045C0.78 0.316 0.976 0.264 0.989 0.199 0.984 0.096 0.705 0.069 0.54 0.069S0.091 0.096 0.091 0.201v0.677c0 0.105 0.283 0.133 0.449 0.133s0.449 -0.028 0.449 -0.133V0.723C0.977 0.788 0.78 0.84 0.537 0.84A1.2 1.2 0 0 1 0.188 0.796V0.736a1.2 1.2 0 0 0 0.349 0.044c0.243 0 0.44 -0.052 0.452 -0.117V0.491c-0.013 0.067 -0.211 0.119 -0.453 0.119A1.2 1.2 0 0 1 0.187 0.564V0.504a1.2 1.2 0 0 0 0.349 0.045" />
  </svg>
);

function bytesToHex(bytes: number[]) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}
function hexToBytes(hexLike: string): number[] {
  const cleaned = hexLike.replace(/[^0-9a-fA-F]/g, "");
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const b = cleaned.slice(i, i + 2);
    if (b.length === 2) out.push(parseInt(b, 16));
  }
  return out;
}
function clone(v: WireValue): WireValue {
  return v.type === "buffer"
    ? { type: "buffer", valueBytes: [...v.valueBytes] }
    : v.type === "string"
      ? { type: "string", value: v.value }
      : v.type === "number"
        ? { type: "number", value: v.value }
        : v.type === "boolean"
          ? { type: "boolean", value: v.value }
          : { type: "undefined" };
}
function toDisplay(v: WireValue) {
  switch (v.type) {
    case "string":
      return v.value;
    case "number":
      return String(v.value);
    case "boolean":
      return v.value ? "true" : "false";
    case "buffer":
      return `${v.valueBytes.length} bytes (${bytesToHex(v.valueBytes)})`;
    case "undefined":
      return "—";
  }
}

/** ---- Child component holds its own hooks (safe) ---- */
type InstanceCardProps = {
  inst: InstanceState;
  refresh: (id?: string) => void;
  clearAll: (id: string) => void;
  mutate: (id: string, ops: any[]) => void;
  startEdit: (id: string, key: string) => void;
  cancelEdit: (id: string, key: string) => void;
  setDirty: (id: string, key: string, upd: (v: WireValue) => WireValue) => void;
  commitRow: (id: string, key: string, numberText?: string | null) => void;
  deleteRow: (id: string, key: string) => void;
};

const InstanceCard: React.FC<InstanceCardProps> = ({
  inst,
  refresh,
  clearAll,
  mutate,
  startEdit,
  cancelEdit,
  setDirty,
  commitRow,
  deleteRow,
}) => {
  const numRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const rows = React.useMemo(
    () => Object.values(inst.rows).sort((a, b) => a.key.localeCompare(b.key)),
    [inst.rows]
  );

  return (
    <div className="bg-[#111214] border border-[#2D2D2F]/60 rounded-lg p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 justify-between">
        <div className="text-sm font-mono">{inst.id}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh(inst.id)}
            className="text-xs px-2 py-1 rounded-md border border-[#2D2D2F] hover:bg-[#191a1d]"
          >
            Refresh
          </button>
          <button
            onClick={() => clearAll(inst.id)}
            className="text-xs px-2 py-1 rounded-md border border-red-900 text-red-300 hover:bg-red-950/40"
            title="Delete all keys in this instance"
          >
            Clear instance
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-gray-400">No keys yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const editing = !!r.dirty;
            const type = editing ? r.dirty!.type : r.value.type;
            return (
              <div
                key={`${inst.id}:${r.key}`}
                className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-[#191a1d]"
              >
                <div className="w-56 shrink-0 font-mono text-sm break-all">
                  {r.key}
                </div>

                <div className="w-24 shrink-0">
                  <select
                    className="text-xs bg-transparent border border-[#2D2D2F]/60 rounded px-1 py-0.5 pointer-events-auto"
                    value={type}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const t = e.currentTarget.value as WireValue["type"];
                      if (!editing) {
                        startEdit(inst.id, r.key);
                      }
                      setDirty(inst.id, r.key, () => {
                        switch (t) {
                          case "string":
                            return { type: "string", value: "" };
                          case "number":
                            return { type: "number", value: Number.NaN };
                          case "boolean":
                            return { type: "boolean", value: false };
                          case "buffer":
                            return { type: "buffer", valueBytes: [] };
                          default:
                            return { type: "undefined" };
                        }
                      });
                    }}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="buffer">buffer</option>
                    <option value="undefined">undefined</option>
                  </select>
                </div>

                <div className="flex-1 min-w-0">
                  {!editing ? (
                    <div className="font-mono text-sm break-all text-gray-200">
                      {toDisplay(r.value)}
                    </div>
                  ) : type === "string" ? (
                    <input
                      className="w-full bg-[#0d0e10] border border-[#2D2D2F]/60 rounded px-2 py-1 text-sm font-mono text-gray-100 placeholder-gray-500"
                      value={(r.dirty as any).value ?? ""}
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDirty(inst.id, r.key, () => ({
                          type: "string",
                          value: next,
                        }));
                      }}
                    />
                  ) : type === "number" ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-48 bg-[#0d0e10] border border-[#2D2D2F]/60 rounded px-2 py-1 text-sm font-mono text-gray-100 placeholder-gray-500"
                      defaultValue={
                        r.dirty?.type === "number"
                          ? String((r.dirty as any).value ?? "")
                          : r.value.type === "number"
                            ? String((r.value as any).value ?? "")
                            : ""
                      }
                      ref={(el) => {
                        numRefs.current[r.key] = el;
                      }}
                    />
                  ) : type === "boolean" ? (
                    <label className="text-sm">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={(r.dirty as any).value ?? false}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setDirty(inst.id, r.key, () => ({
                            type: "boolean",
                            value: checked,
                          }));
                        }}
                      />
                      {(r.dirty as any).value ? "true" : "false"}
                    </label>
                  ) : type === "buffer" ? (
                    <input
                      className="w-full bg-[#0d0e10] border border-[#2D2D2F]/60 rounded px-2 py-1 text-sm font-mono text-gray-100 placeholder-gray-500"
                      placeholder="hex bytes, e.g. 01 0a ff"
                      value={bytesToHex((r.dirty as any).valueBytes ?? [])}
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDirty(inst.id, r.key, () => ({
                          type: "buffer",
                          valueBytes: hexToBytes(next),
                        }));
                      }}
                    />
                  ) : (
                    <div className="text-sm text-gray-500">undefined</div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  {!editing ? (
                    <>
                      {r.value.type === "boolean" && (
                        <button
                          onClick={() =>
                            mutate(inst.id, [
                              {
                                op: "set",
                                key: r.key,
                                value: {
                                  type: "boolean",
                                  value: !(
                                    r.value.type === "boolean" && r.value.value
                                  ),
                                },
                              },
                            ])
                          }
                          className="text-xs px-2 py-1 rounded-md border border-[#2D2D2F] hover:bg-[#191a1d]"
                        >
                          Toggle
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(inst.id, r.key)}
                        className="text-xs px-2 py-1 rounded-md border border-[#2D2D2F] hover:bg-[#191a1d]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRow(inst.id, r.key)}
                        className="text-xs px-2 py-1 rounded-md border border-[#2D2D2F] hover:bg-[#191a1d]"
                        title="Delete this key"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          commitRow(
                            inst.id,
                            r.key,
                            numRefs.current[r.key]?.value
                          )
                        }
                        className="text-xs px-2 py-1 rounded-md border border-green-900 text-green-300 hover:bg-green-950/40"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => cancelEdit(inst.id, r.key)}
                        className="text-xs px-2 py-1 rounded-md border border-[#2D2D2F] hover:bg-[#191a1d]"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** ---- Parent Tab keeps a constant hook order ---- */
const Tab: React.FC<PluginProps> = ({ targetDevice }) => {
  const deviceId = targetDevice?.deviceId;
  const client = React.useMemo(
    () => createWebPluginClient(PLUGIN, () => deviceId),
    [deviceId]
  );
  const lastCfgRef = React.useRef<string>("");
  const [instances, setInstances] = React.useState<
    Record<string, InstanceState>
  >({});

  const ensureInstance = React.useCallback((id: string) => {
    setInstances((prev) =>
      prev[id]
        ? prev
        : { ...prev, [id]: { id, watchAll: true, keysFilter: [], rows: {} } }
    );
  }, []);

  React.useEffect(() => {
    const unsubSnap = client.addMessageListener(
      EVT_SNAPSHOT,
      (payload?: { instanceId: string; values: Record<string, WireValue> }) => {
        if (!payload) return;
        const { instanceId, values } = payload;
        ensureInstance(instanceId);
        setInstances((prev) => {
          const inst = prev[instanceId] ?? {
            id: instanceId,
            watchAll: true,
            keysFilter: [],
            rows: {},
          };
          const now = Date.now();
          const nextRows: Record<string, Row> = {};
          for (const [k, v] of Object.entries(values)) {
            if (!v || v.type === "undefined") continue;
            const existing = inst.rows[k];
            nextRows[k] = {
              key: k,
              value: v,
              ts: now,
              dirty: existing?.dirty ?? null,
            };
          }
          return { ...prev, [instanceId]: { ...inst, rows: nextRows } };
        });
      }
    );

    const unsubChange = client.addMessageListener(
      EVT_CHANGE,
      (payload?: { instanceId: string; key: string; value: WireValue }) => {
        if (!payload) return;
        ensureInstance(payload.instanceId);
        setInstances((prev) => {
          const inst = prev[payload.instanceId];
          if (!inst) return prev;
          const nextRows = { ...inst.rows };
          if (!payload.value || payload.value.type === "undefined") {
            delete nextRows[payload.key];
          } else {
            const existing = nextRows[payload.key];
            nextRows[payload.key] = {
              key: payload.key,
              value: payload.value,
              ts: Date.now(),
              dirty: existing?.dirty ?? null,
            };
          }
          return { ...prev, [payload.instanceId]: { ...inst, rows: nextRows } };
        });
      }
    );

    client.sendMessage(EVT_REQUEST_SNAPSHOT, {});
    return () => {
      unsubSnap();
      unsubChange();
    };
  }, [client, ensureInstance]);

  React.useEffect(() => {
    const cfg = Object.values(instances).map((i) => ({
      id: i.id,
    }));
    const sig = JSON.stringify(cfg.sort((a, b) => a.id.localeCompare(b.id)));
    if (sig !== lastCfgRef.current) {
      lastCfgRef.current = sig;
      client.sendMessage(EVT_CONFIG, { instances: cfg });
    }
  }, [client, instances]);

  const refresh = React.useCallback(
    (id?: string) =>
      client.sendMessage(EVT_REQUEST_SNAPSHOT, id ? { instanceId: id } : {}),
    [client]
  );
  const mutate = React.useCallback(
    (instanceId: string, ops: any[]) =>
      client.sendMessage(EVT_MUTATE, { instanceId, ops }),
    [client]
  );

  const startEdit = (id: string, key: string) =>
    setInstances((prev) => {
      const inst = prev[id];
      if (!inst) return prev;
      const r = inst.rows[key];
      if (!r) return prev;
      return {
        ...prev,
        [id]: {
          ...inst,
          rows: { ...inst.rows, [key]: { ...r, dirty: clone(r.value) } },
        },
      };
    });
  const cancelEdit = (id: string, key: string) =>
    setInstances((prev) => {
      const inst = prev[id];
      if (!inst) return prev;
      const r = inst.rows[key];
      if (!r) return prev;
      return {
        ...prev,
        [id]: { ...inst, rows: { ...inst.rows, [key]: { ...r, dirty: null } } },
      };
    });
  const setDirty = (
    id: string,
    key: string,
    updater: (v: WireValue) => WireValue
  ) =>
    setInstances((prev) => {
      const inst = prev[id];
      if (!inst) return prev;
      const r = inst.rows[key];
      if (!r) return prev;
      const base = r.dirty ?? clone(r.value);
      return {
        ...prev,
        [id]: {
          ...inst,
          rows: { ...inst.rows, [key]: { ...r, dirty: updater(base) } },
        },
      };
    });
  const commitRow = (id: string, key: string, numberText?: string | null) =>
    setInstances((prev) => {
      const inst = prev[id];
      if (!inst) return prev;
      const r = inst.rows[key];
      if (!r || !r.dirty) return prev;
      let payload = r.dirty as WireValue;
      if (payload.type === "number") {
        const raw = (numberText ?? "").trim();
        if (raw === "") return prev;
        const parsed = Number(raw.replace(",", "."));
        if (!Number.isFinite(parsed)) return prev;
        payload = { type: "number", value: parsed };
      }
      mutate(id, [{ op: "set", key, value: payload }]);
      return {
        ...prev,
        [id]: { ...inst, rows: { ...inst.rows, [key]: { ...r, dirty: null } } },
      };
    });

  const deleteRow = (id: string, key: string) =>
    mutate(id, [{ op: "delete", key }]);
  const clearAll = (id: string) => mutate(id, [{ op: "clearAll" }]);

  const instList = React.useMemo(
    () => Object.values(instances).sort((a, b) => a.id.localeCompare(b.id)),
    [instances]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-cyan-300" />
        <div className="text-lg font-semibold">MMKV</div>
        <button
          onClick={() => refresh()}
          className="ml-auto text-xs px-2 py-1 rounded-md border border-[#2D2D2F] hover:bg-[#191a1d]"
          title="Refresh all instances"
        >
          Refresh all
        </button>
      </div>

      {instList.length === 0 ? (
        <div className="text-sm text-gray-400">
          Waiting for instances… open the app in development with the hook
          mounted.
        </div>
      ) : (
        instList.map((inst) => (
          <InstanceCard
            key={inst.id}
            inst={inst}
            refresh={refresh}
            clearAll={clearAll}
            mutate={mutate}
            startEdit={startEdit}
            cancelEdit={cancelEdit}
            setDirty={setDirty}
            commitRow={commitRow}
            deleteRow={deleteRow}
          />
        ))
      )}
    </div>
  );
};

export const MMKVPlugin: DevtoolsPlugin = {
  id: PLUGIN,
  title: "MMKV",
  Icon,
  mount: Tab,
};

export default MMKVPlugin;
