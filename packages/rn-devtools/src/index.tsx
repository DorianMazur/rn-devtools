import React from "react";
import { Container, createRoot } from "react-dom/client";
import { App } from "./app";
import "./index.css";

createRoot(document.getElementById("root") as Container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
