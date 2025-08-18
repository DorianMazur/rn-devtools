import { useEffect, useMemo, useState } from "react";
import { Device } from "virtual:rn-devtools-plugins";
import { PLUGINS } from "../utils/plugins";

const TAB_QS_KEY = "tab";
const lsKey = (deviceId?: string) => `devtools.activeTab.${deviceId ?? "all"}`;

export function useActiveTab(targetDevice: Device) {
  const deviceKey = targetDevice?.deviceId ?? "All";
  const tabs = Array.isArray(PLUGINS) ? PLUGINS : [];

  const pickFallback = () => tabs[0]?.id ?? "";

  const [activeId, setActiveId] = useState<string>(() => {
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get(TAB_QS_KEY) || undefined;
      const fromLs = localStorage.getItem(lsKey(deviceKey)) || undefined;
      const candidate = (fromUrl || fromLs) as string | undefined;
      if (candidate && tabs.some((p) => p.id === candidate)) return candidate;
    } catch {
      // ignore
    }
    return pickFallback();
  });

  // Keep active tab valid & visible when device changes (or if the plugin goes away)
  useEffect(() => {
    const tab = tabs.find((p) => p.id === activeId);
    const exists = !!tab;
    const isVisible = tab || false;

    if (!exists || !isVisible) {
      const next = pickFallback();
      if (next !== activeId) setActiveId(next);
    }
  }, [deviceKey]);

  useEffect(() => {
    if (!activeId) return;
    const url = new URL(window.location.href);
    url.searchParams.set(TAB_QS_KEY, activeId);
    window.history.replaceState({}, "", url.toString());
    try {
      localStorage.setItem(lsKey(deviceKey), activeId);
    } catch {
      // ignore storage errors (Safari private mode, etc.)
    }
  }, [activeId, deviceKey]);

  const tab = useMemo(
    () => tabs.find((p) => p.id === activeId) ?? null,
    [tabs, activeId]
  );

  return { activeId, setActiveId, tab, tabs };
}
