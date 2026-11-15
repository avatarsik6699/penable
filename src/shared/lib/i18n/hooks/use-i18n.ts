import { useTranslation } from "react-i18next";
import { I18n } from "../i18n";

export function useI18n() {
  useTranslation(undefined, { i18n: I18n.instance, useSuspense: false });

  return I18n;
}
