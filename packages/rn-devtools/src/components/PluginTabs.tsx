import React from "react";
import { DevtoolsPlugin } from "virtual:rn-devtools-plugins";

type Props = {
  tabs: DevtoolsPlugin[];
  activeId: string;
  setActiveId: (id: string) => void;
};

export const PluginTabs: React.FC<Props> = ({
  tabs,
  activeId,
  setActiveId,
}) => {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-[#0D0D0F] border border-[#2D2D2F]/60 rounded-xl">
      {tabs.map((p) => {
        const isActive = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs
              ${
                isActive
                  ? "bg-blue-500/15 text-blue-300 border border-blue-500/20"
                  : "text-[#A1A1A6] hover:text-white hover:bg-[#1A1A1C] border border-transparent"
              }`}
          >
            <p.Icon
              className={`w-3.5 h-3.5 ${isActive ? "text-blue-300" : "text-[#A1A1A6] group-hover:text-white"}`}
            />
            <span className="font-medium">{p.title}</span>
          </button>
        );
      })}
    </div>
  );
};
