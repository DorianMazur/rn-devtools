import React from "react";

// --- 1. Extracted SVG Icon Components (SRP, KISS) ---

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

const WebIcon: React.FC<IconProps> = (props) => (
  <svg {...defaultIconProps} {...props}>
    <path d="M16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2m-5.15 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 01-4.33 3.56M14.34 14H9.66c-.1-.66-.16-1.32-.16-2 0-.68.06-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2M12 19.96c-.83-1.2-1.5-2.53-1.91-3.96h3.82c-.41 1.43-1.08 2.76-1.91 3.96M8 8H5.08A7.923 7.923 0 019.4 4.44C8.8 5.55 8.35 6.75 8 8m-2.92 8H8c.35 1.25.8 2.45 1.4 3.56A8.008 8.008 0 015.08 16m-.82-2C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2M12 4.03c.83 1.2 1.5 2.54 1.91 3.97h-3.82c.41-1.43 1.08-2.77 1.91-3.97M18.92 8h-2.95a15.65 15.65 0 00-1.38-3.56c1.84.63 3.37 1.9 4.33 3.56M12 2C6.47 2 2 6.5 2 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2z" />
  </svg>
);

// Updated Android TV Icon - Represents a modern Smart TV screen
const AndroidTvIcon: React.FC<IconProps> = (props) => (
  <svg {...defaultIconProps} {...props}>
    <path d="M21 17H3V5h18m0-2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
  </svg>
);

// Updated Apple TV Icon - Using the Apple logo
const AppleTvIcon: React.FC<IconProps> = (props) => (
  <svg {...defaultIconProps} {...props} viewBox="0 0 24 24">
    {/* Custom viewBox for Apple logo */}
    <path d="M18.71,19.5c-0.83,1.24-1.71,2.45-3.05,2.47c-1.34,0.03-1.77-0.79-3.29-0.79c-1.53,0-2,0.77-3.27,0.82 C7.79,22.55,6.79,21.28,5.95,20C4.25,17,2.94,12.45,4.7,9.39c0.87-1.52,2.43-2.48,4.12-2.51c1.28-0.02,2.5,0.87,3.29,0.87 c0.78,0,2.26-1.07,3.81-0.91c0.65,0.03,2.47,0.26,3.64,1.98c-0.09,0.06-2.17,1.28-2.15,3.81C17.44,15.67,20.06,16.68,20.09,16.69 C20.06,16.76,19.65,18.06,18.71,19.5z M13,3.5c0.73-0.83,1.94-1.46,2.94-1.5c0.13,1.17-0.34,2.35-1.04,3.19 C14.21,5.94,13.07,6.6,11.95,6.5C11.8,5.35,12.41,4.15,13,3.5z" />
  </svg>
);

// Default Icon (Generic Mobile Device)
const DefaultDeviceIcon: React.FC<IconProps> = (props) => (
  <svg {...defaultIconProps} {...props}>
    <path d="M17.25 18H6.75V4h10.5M14 21h-4v-1h4m2-19H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3z" />
  </svg>
);

// --- 2. Central Platform Configuration (DRY, Convention over Config) ---

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
  web: {
    displayName: "Web",
    bgColor: "bg-cyan-900/30 text-cyan-200",
    textColor: "text-cyan-300",
    IconComponent: WebIcon,
  },
  tv: {
    displayName: "Android TV",
    bgColor: "bg-green-900/30 text-green-200",
    textColor: "text-green-300",
    IconComponent: AndroidTvIcon,
  },
  tvos: {
    displayName: "Apple TV",
    bgColor: "bg-purple-900/30 text-purple-200",
    textColor: "text-purple-300",
    IconComponent: AppleTvIcon,
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
  platform: string | undefined | null
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

/**
 * Gets the combined background and text color CSS classes for a platform.
 */
export const getPlatformColorClasses = (platform: string): string => {
  const config = getPlatformConfig(platform);
  return `${config.bgColor}`;
};

/**
 * Gets the text color CSS class for a platform.
 */
export const getPlatformTextColor = (platform: string): string => {
  const config = getPlatformConfig(platform);
  return config.textColor;
};

/**
 * Gets the background color CSS class for a platform.
 */
export const getPlatformBgColor = (platform: string): string => {
  const config = getPlatformConfig(platform);
  return config.bgColor;
};

/**
 * Gets the display-friendly name for a platform.
 */
export const getDisplayPlatform = (platform: string): string => {
  const config = getPlatformConfig(platform);
  // Return original platform string if it wasn't found and we used default,
  // unless the original platform string was empty/null.
  if (config === platformConfiguration.default && platform) {
    return platform;
  }
  return config.displayName;
};
