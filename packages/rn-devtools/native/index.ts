export let useReactNativeDevtools: typeof import("./useReactNativeDevtools").useReactNativeDevtools;

if (process.env.NODE_ENV !== "production") {
  useReactNativeDevtools =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./useReactNativeDevtools").useReactNativeDevtools;
} else {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  useReactNativeDevtools = () => {};
}
