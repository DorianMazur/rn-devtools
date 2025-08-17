export let useReactNativeDevtools: typeof import("./useReactNativeDevtools").useReactNativeDevtools;

// @ts-ignore process.env.NODE_ENV is defined by metro transform plugins
if (process.env.NODE_ENV !== "production") {
  useReactNativeDevtools =
    require("./useReactNativeDevtools").useReactNativeDevtools;
} else {
  // @ts-ignore
  useReactNativeDevtools = () => {};
}
