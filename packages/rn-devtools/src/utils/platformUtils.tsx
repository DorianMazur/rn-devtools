import React from "react";

interface IconProps {
  className?: string;
  // Allow other SVG props like fill, viewBox etc., if needed later
  [key: string]: any; // Allow passing down arbitrary props
}

const defaultIconProps = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  className: "w-3 h-3", // Default size, can be overridden by props
};

const IosIcon: React.FC<IconProps> = (props) => (
  <svg {...defaultIconProps} {...props}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const AndroidIcon: React.FC<IconProps> = (props) => (
  <svg {...defaultIconProps} {...props}>
    <path d="M16.61 15.15c-.46 0-.84-.37-.84-.83s.37-.83.84-.83.83.37.83.83-.37.83-.83.83m-9.22 0c-.46 0-.83-.37-.83-.83s.37-.83.83-.83.84.37.84.83-.37.83-.84.83m9.42-5.89l1.67-2.89c.09-.17.03-.38-.13-.47-.17-.09-.38-.03-.47.13l-1.69 2.93A9.973 9.973 0 0012 7.75c-1.89 0-3.63.52-5.19 1.37L5.12 6.19c-.09-.17-.3-.22-.47-.13-.17.09-.22.3-.13.47l1.67 2.89C3.44 11.15 1.62 14.56 1.62 18h20.76c0-3.44-1.82-6.85-4.57-8.74z" />
  </svg>
);

// Default Icon (Generic Mobile Device)
const DefaultDeviceIcon: React.FC<IconProps> = (props) => (
  <svg {...defaultIconProps} {...props}>
    <path d="M17.25 18H6.75V4h10.5M14 21h-4v-1h4m2-19H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3z" />
  </svg>
);

interface PlatformConfig {
  displayName: string;
  bgColor: string;
  textColor: string;
  IconComponent: React.FC<IconProps>;
}

const platformConfiguration: Record<string, PlatformConfig> = {
  ios: {
    displayName: "iOS",
    bgColor: "bg-blue-900/30 text-blue-200",
    textColor: "text-blue-300",
    IconComponent: IosIcon,
  },
  android: {
    displayName: "Android",
    bgColor: "bg-green-900/30 text-green-200",
    textColor: "text-green-300",
    IconComponent: AndroidIcon,
  },
  // Default configuration for unknown platforms
  default: {
    displayName: "Device",
    bgColor: "bg-[#1D1D1F]/60 text-[#F5F5F7]",
    textColor: "text-[#F5F5F7]",
    IconComponent: DefaultDeviceIcon,
  },
};

// Helper to get platform config safely
const getPlatformConfig = (
  platform: string | undefined | null,
): PlatformConfig => {
  const normalizedPlatform = platform?.toLowerCase() || "";
  return (
    platformConfiguration[normalizedPlatform] || platformConfiguration.default
  );
};

// --- 3. Refactored PlatformIcon Component (Composition, KISS) ---

export const PlatformIcon: React.FC<{
  platform: string;
  className?: string;
}> = ({
  platform,
  className, // Allow overriding className
  ...rest // Pass any other props down
}) => {
  const config = getPlatformConfig(platform);
  const { IconComponent } = config;

  // Combine default className with passed className if provided
  const finalClassName = className ?? defaultIconProps.className;

  return <IconComponent className={finalClassName} {...rest} />;
};
