import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18n } from "~/shared/lib/i18n";
import { App } from "./app/app";
import { LocalePreferences } from "./app/adapters/locale-platform";
import "./app/styles.css";

const locale = new LocalePreferences();

void I18n.initialize(locale.getSnapshot().language).then(() => {
  const root = document.getElementById("root");

  if (!root) throw new Error("Application root element is missing");

  createRoot(root).render(
    <StrictMode>
      <App locale={locale} />
    </StrictMode>,
  );
});
