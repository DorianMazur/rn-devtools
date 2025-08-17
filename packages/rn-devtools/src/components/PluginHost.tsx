import React from "react";
import { User, DevtoolsPlugin  } from "virtual:rn-devtools-plugins";

type Props = {
  tabs: DevtoolsPlugin[];
  activeId: string;
  targetDevice: User;
  allDevices: User[];
  isDashboardConnected: boolean;
};

class PluginErrorBoundary extends React.Component<
  { pluginTitle?: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-[480px] lg:h-[560px] xl:h-[640px] rounded-xl border border-red-500/30 bg-red-950/20 grid place-items-center px-6 text-red-200">
          <div className="max-w-xl text-center space-y-2">
            <h3 className="text-sm font-semibold">
              {this.props.pluginTitle ?? "Plugin"} crashed
            </h3>
            <pre className="text-xs opacity-80 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PluginHost: React.FC<Props> = ({
  tabs,
  activeId,
  targetDevice,
  allDevices,
  isDashboardConnected,
}) => {
  return (
    <div className="relative">
      {tabs.map((p) => {
        const Mount = p.mount;
        const isActive = p.id === activeId;

        return (
          <section
            key={p.id}
            aria-hidden={!isActive}
            className={isActive ? "" : "hidden"} // keeps it mounted, just hidden
          >
            <PluginErrorBoundary pluginTitle={p.title}>
            <Mount
              targetDevice={targetDevice}
              allDevices={allDevices}
              isDashboardConnected={isDashboardConnected}
              active={isActive}
            />
            </PluginErrorBoundary>
          </section>
        );
      })}
    </div>
  );
};

