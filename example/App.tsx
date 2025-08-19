import React, { useLayoutEffect, useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from "react-native";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReactNativeDevtools } from "rn-devtools";
import { useReactNavigationDevtools } from "@rn-devtools/react-navigation-plugin/native";
import { useReactQueryDevtools } from "@rn-devtools/react-query-plugin/native";
import { MMKV } from "react-native-mmkv";

import {
  NavigationContainer,
  useNavigation,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// ---------------------------
// Types
// ---------------------------
type JsonApiList<T> = {
  data: Array<{ id: string; type: string; attributes: T }>;
  links?: { self?: string; next?: string | null; current?: string };
};

type JsonApiSingle<T> = {
  data: { id: string; type: string; attributes: T };
};

type Breed = {
  name: string;
  description?: string | null;
  life?: { min?: number | null; max?: number | null } | null;
  male_weight?: { min?: number | null; max?: number | null } | null;
  female_weight?: { min?: number | null; max?: number | null } | null;
  hypoallergenic?: boolean | null;
  temperament?: string | null;
};

type Fact = {
  body: string;
};

// ---------------------------
// API helpers
// ---------------------------
const API_BASE = "https://dogapi.dog/api/v2";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Request failed (${res.status}): ${text || res.statusText}`
    );
  }
  return res.json() as Promise<T>;
}

const PAGE_SIZE = 20;

function fetchBreedsPage({
  pageParam = 1,
  signal,
}: {
  pageParam?: number;
  signal?: AbortSignal;
}) {
  const url = `${API_BASE}/breeds?page[number]=${pageParam}&page[size]=${PAGE_SIZE}`;
  return fetchJson<JsonApiList<Breed>>(url, signal);
}

function fetchBreedById({ id, signal }: { id: string; signal?: AbortSignal }) {
  const url = `${API_BASE}/breeds/${id}`;
  return fetchJson<JsonApiSingle<Breed>>(url, signal);
}

function fetchRandomFact({ signal }: { signal?: AbortSignal }) {
  const url = `${API_BASE}/facts`;
  return fetchJson<JsonApiList<Fact>>(url, signal);
}

// ---------------------------
// MMKV setup
// ---------------------------
export const storage = new MMKV({ id: "devtools-mmkv" });

declare global {
  // Expose storage for your devtools or quick inspection
  // (e.g. evaluate globalThis.__MMKV__.getAllKeys())
  var __MMKV__: MMKV | undefined;
}

globalThis.__MMKV__ = storage;

// Small helper to convert unknown value to a printable form
function readAny(key: string): string | number | boolean | null {
  // Try all types; MMKV stores typed values separately
  const str = storage.getString(key);
  if (typeof str === "string") return str;
  const num = storage.getNumber(key);
  if (typeof num === "number") return num;
  const bool = storage.getBoolean?.(key as any);
  if (typeof bool === "boolean") return bool;
  return null;
}

// Wire MMKV to rn-devtools via your socket
function useMMKVDevtools({
  socket,
  deviceId,
  namespace = "plugin:mmkv",
}: {
  socket: any;
  deviceId: string;
  namespace?: string;
}) {
  useEffect(() => {
    if (!socket) return;

    const snapshot = () => {
      const keys = storage.getAllKeys();
      const data: Record<string, string | number | boolean | null> = {};
      for (const k of keys) data[k] = readAny(k);
      socket.emit(`${namespace}/snapshot`, { deviceId, keys, data });
    };

    // initial state
    snapshot();

    // listen to changes from app-side
    const sub = storage.addOnValueChangedListener((key) => {
      socket.emit(`${namespace}/change`, {
        deviceId,
        key,
        value: readAny(key),
      });
    });

    // allow devtools to control storage
    const onGet = ({ key }: { key: string }) =>
      socket.emit(`${namespace}/value`, {
        deviceId,
        key,
        value: readAny(key),
      });

    const onSet = ({ key, value }: { key: string; value: any }) => {
      // Try to preserve primitive type
      if (typeof value === "string") storage.set(key, value);
      else if (typeof value === "number") storage.set(key, value);
      else if (typeof value === "boolean") storage.set(key, value);
      else storage.set(key, JSON.stringify(value));
      snapshot();
    };

    const onRemove = ({ key }: { key: string }) => {
      storage.delete(key);
      snapshot();
    };

    const onClear = () => {
      for (const k of storage.getAllKeys()) storage.delete(k);
      snapshot();
    };

    socket.on(`${namespace}/get`, onGet);
    socket.on(`${namespace}/set`, onSet);
    socket.on(`${namespace}/remove`, onRemove);
    socket.on(`${namespace}/clear`, onClear);

    return () => {
      sub.remove();
      socket.off(`${namespace}/get`, onGet);
      socket.off(`${namespace}/set`, onSet);
      socket.off(`${namespace}/remove`, onRemove);
      socket.off(`${namespace}/clear`, onClear);
    };
  }, [socket, deviceId, namespace]);
}

// ---------------------------
// UI Components
// ---------------------------
function FactCard() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["fact"],
    queryFn: ({ signal }) => fetchRandomFact({ signal }),
  });

  const body =
    data?.data?.[0]?.attributes?.body ??
    (isError ? "Could not load a dog fact." : "");

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Random dog fact</Text>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Text style={styles.factText}>{body}</Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            disabled={isRefetching}
          >
            <Text style={styles.buttonLabel}>
              {isRefetching ? "Fetching…" : "Another one"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

type RootStackParamList = {
  Home: undefined;
  BreedDetails: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function BreedsList({
  header,
  footer,
}: {
  header?: React.ReactElement | null;
  footer?: React.ReactElement | null;
}) {
  const [search, setSearch] = useState("");
  const navigation = useNavigation<any>();

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["breeds"],
    queryFn: ({ pageParam, signal }) => fetchBreedsPage({ pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextUrl = lastPage.links?.next;
      if (!nextUrl) return undefined;
      const m = /(?:\?|&)page\[number\]=(\d+)/.exec(nextUrl);
      return m ? Number(m[1]) : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const breeds = React.useMemo(() => {
    const list =
      data?.pages.flatMap((p) =>
        p.data.map((x) => ({ id: x.id, ...x.attributes }))
      ) ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((b) => b.name?.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        placeholder="Search breeds…"
        placeholderTextColor="#E5E7EB"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : isError ? (
        <Text style={styles.errorText}>Could not load breeds.</Text>
      ) : (
        <FlatList
          data={breeds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate("BreedDetails", { id: item.id })
              }
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtle}>Tap for details</Text>
            </Pressable>
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          ListFooterComponent={
            <View>
              {isFetchingNextPage ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator />
                </View>
              ) : null}
              {footer ?? null}
            </View>
          }
        />
      )}
    </View>
  );
}

function BreedDetailsScreen({
  route,
  navigation,
}: {
  route: { params: { id: string } };
  navigation: any;
}) {
  const { id } = route.params;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["breed", id],
    queryFn: ({ signal }) => fetchBreedById({ id, signal }),
    staleTime: 5 * 60 * 1000,
  });

  const a = data?.data?.attributes;

  useLayoutEffect(() => {
    if (a?.name) navigation.setOptions({ title: a.name });
  }, [a?.name, navigation]);

  return (
    <SafeAreaView style={styles.modalRoot}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : isError || !a ? (
        <Text style={styles.errorText}>Failed to load breed details.</Text>
      ) : (
        <View style={{ gap: 12, padding: 16 }}>
          {!!a.description && (
            <Text style={styles.description}>{a.description}</Text>
          )}

          <KeyValue label="Temperament" value={a.temperament || undefined} />
          <KeyValue
            label="Life span"
            value={
              a.life?.min && a.life?.max
                ? `${a.life.min}–${a.life.max} yrs`
                : undefined
            }
          />
          <KeyValue
            label="Male weight"
            value={
              a.male_weight?.min && a.male_weight?.max
                ? `${a.male_weight.min}–${a.male_weight.max} kg`
                : undefined
            }
          />
          <KeyValue
            label="Female weight"
            value={
              a.female_weight?.min && a.female_weight?.max
                ? `${a.female_weight.min}–${a.female_weight.max} kg`
                : undefined
            }
          />
          <KeyValue
            label="Hypoallergenic"
            value={
              typeof a.hypoallergenic === "boolean"
                ? a.hypoallergenic
                  ? "Yes"
                  : "No"
                : undefined
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------
// MMKV Playground Card (for manual testing)
// ---------------------------
function MMKVPlayground() {
  const [keyName, setKeyName] = useState<string>("greeting");
  const [stringValue, setStringValue] = useState<string>("Hello 🐶");
  const [numberValue, setNumberValue] = useState<string>("42");
  const [boolValue, setBoolValue] = useState<boolean>(true);
  const [keys, setKeys] = useState<string[]>(storage.getAllKeys());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const sub = storage.addOnValueChangedListener(() =>
      setKeys(storage.getAllKeys())
    );
    return () => sub.remove();
  }, []);

  const writeString = () => {
    storage.set(keyName, stringValue);
    setSelectedKey(keyName);
  };

  const writeNumber = () => {
    const n = Number(numberValue);
    if (!Number.isNaN(n)) {
      storage.set(keyName, n);
      setSelectedKey(keyName);
    }
  };

  const writeBool = () => {
    storage.set(keyName, boolValue);
    setSelectedKey(keyName);
  };

  const removeSelected = () => {
    if (selectedKey) storage.delete(selectedKey);
    setSelectedKey(null);
  };

  const clearAll = () => {
    for (const k of storage.getAllKeys()) storage.delete(k);
    setSelectedKey(null);
  };

  const previewValue = selectedKey ? readAny(selectedKey) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>MMKV Playground</Text>

      <TextInput
        placeholder="Key"
        placeholderTextColor="#E5E7EB"
        value={keyName}
        onChangeText={setKeyName}
        style={styles.input}
      />

      <View style={{ gap: 8 }}>
        <View style={styles.rowInline}>
          <Text style={styles.kvLabel}>String</Text>
          <TextInput
            placeholder="value"
            placeholderTextColor="#E5E7EB"
            value={stringValue}
            onChangeText={setStringValue}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable onPress={writeString} style={styles.smallButton}>
            {({ pressed }) => (
              <Text style={[styles.buttonLabel, pressed && { opacity: 0.85 }]}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.rowInline}>
          <Text style={styles.kvLabel}>Number</Text>
          <TextInput
            placeholder="value"
            placeholderTextColor="#E5E7EB"
            value={numberValue}
            onChangeText={setNumberValue}
            keyboardType="numeric"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable onPress={writeNumber} style={styles.smallButton}>
            {({ pressed }) => (
              <Text style={[styles.buttonLabel, pressed && { opacity: 0.85 }]}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.rowInline}>
          <Text style={styles.kvLabel}>Boolean</Text>
          <View
            style={{
              flex: 1,
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            <Switch value={boolValue} onValueChange={setBoolValue} />
          </View>
          <Pressable onPress={writeBool} style={styles.smallButton}>
            {({ pressed }) => (
              <Text style={[styles.buttonLabel, pressed && { opacity: 0.85 }]}>
                Save
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={{ height: 12 }} />

      <View style={styles.rowInline}>
        <Pressable
          onPress={removeSelected}
          style={[styles.button, { flex: 1 }]}
        >
          {({ pressed }) => (
            <Text style={[styles.buttonLabel, pressed && { opacity: 0.85 }]}>
              Delete selected
            </Text>
          )}
        </Pressable>
        <View style={{ width: 8 }} />
        <Pressable
          onPress={clearAll}
          style={[styles.button, { flex: 1, backgroundColor: "#ef4444" }]}
        >
          {({ pressed }) => (
            <Text style={[styles.buttonLabel, pressed && { opacity: 0.85 }]}>
              Clear all
            </Text>
          )}
        </Pressable>
      </View>

      <View style={{ height: 12 }} />

      <Text style={styles.cardTitle}>Keys</Text>
      {keys.length === 0 ? (
        <Text style={styles.rowSubtle}>No keys yet. Add some above.</Text>
      ) : (
        <FlatList
          data={keys}
          keyExtractor={(k) => k}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedKey(item)}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowTitle}>{item}</Text>
              <Text style={styles.rowSubtle}>Tap to select</Text>
            </Pressable>
          )}
          style={{ maxHeight: 180 }}
        />
      )}

      {selectedKey && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.cardTitle}>Selected</Text>
          <Text style={styles.kvValue}>
            {selectedKey}: {String(previewValue)}
          </Text>
        </View>
      )}
    </View>
  );
}

function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <BreedsList
        header={
          <View>
            <Text style={styles.header}>🐶 Dog Browser</Text>
            <FactCard />
            <MMKVPlayground />
          </View>
        }
        footer={
          <Text style={styles.footer}>
            {Platform.select({ ios: "iOS", android: "Android", default: "RN" })}{" "}
            • React Query • MMKV
          </Text>
        }
      />
    </SafeAreaView>
  );
}

export default function App() {
  const navigationRef = createNavigationContainerRef();

  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 30 * 60 * 1000,
            retry: 1,
          },
        },
      }),
    []
  );

  useReactNativeDevtools({
    socketURL: "http://10.0.2.2:35515",
    deviceName: Platform.OS || "web",
    platform: Platform.OS || "web",
    deviceId: Platform.OS || "web",
    extraDeviceInfo: { appVersion: "1.0.0" },
    plugins: ({ socket, deviceId }) => {
      useReactQueryDevtools({ queryClient: client, socket, deviceId });
      useReactNavigationDevtools({
        navigationRef: navigationRef as any,
        socket,
        deviceId,
      });

      // 👇 Add your MMKV tab wiring
      useMMKVDevtools({ socket, deviceId, namespace: "plugin:mmkv" });
    },
  });

  return (
    <QueryClientProvider client={client}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BreedDetails"
            component={BreedDetailsScreen}
            options={{
              title: "Breed",
              headerStyle: {
                backgroundColor: "#0B0F14",
              },
              headerTintColor: "#E5E7EB",
              presentation: "modal", // keeps the slide-up vibe
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}

// ---------------------------
// Styles
// ---------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: { flex: 1, backgroundColor: "#0B0F14" },
  header: { fontSize: 24, fontWeight: "700", padding: 16, color: "#E5E7EB" },
  footer: { textAlign: "center", color: "#9CA3AF", padding: 12 },

  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
    backgroundColor: "#111827",
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 16,
    color: "#E5E7EB",
  },
  factText: { fontSize: 14, lineHeight: 20, color: "#E5E7EB" },

  button: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignSelf: "flex-start",
  },
  smallButton: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignSelf: "center",
    height: 40,
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { color: "#FFFFFF", fontWeight: "600" },

  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
    backgroundColor: "#0F172A",
    color: "#E5E7EB",
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1F2937",
    backgroundColor: "#0F172A",
    color: "#E5E7EB",
  },

  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1F2937",
    backgroundColor: "transparent",
  },
  rowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowPressed: { backgroundColor: "#0B1220" },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#E5E7EB" },
  rowSubtle: { color: "#9CA3AF", marginTop: 4 },

  modalRoot: { flex: 1, backgroundColor: "#0B0F14" },

  description: { fontSize: 14, color: "#E5E7EB" },
  errorText: { color: "#FCA5A5", padding: 16 },

  kvRow: { flexDirection: "row", gap: 8 },
  kvLabel: { width: 140, color: "#9CA3AF", fontWeight: "600" },
  kvValue: { flex: 1, color: "#E5E7EB" },
});
