import React from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App.jsx";
import "./tailwind.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(<App />);