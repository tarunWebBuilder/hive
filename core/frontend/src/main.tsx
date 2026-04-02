import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const THEME_KEY = "hive.theme";
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const storedTheme = localStorage.getItem(THEME_KEY);
const initialTheme = storedTheme === "light" || storedTheme === "dark"
  ? storedTheme
  : systemPrefersDark ? "dark" : "light";

document.documentElement.classList.toggle("dark", initialTheme === "dark");
document.documentElement.style.colorScheme = initialTheme;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
