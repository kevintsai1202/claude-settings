import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { detectPlatform } from "./utils/platform";
import "./index.css";

// 在其他模組載入前先快取平台偵測結果
// （settingsStore.ts 的 initialState 會在匯入時呼叫 getDefaultManagedPath，依賴此快取）
detectPlatform();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
