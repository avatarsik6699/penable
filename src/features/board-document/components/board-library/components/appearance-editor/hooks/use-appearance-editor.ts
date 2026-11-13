import { useState, useRef, useEffect } from "react";
import type { AppearanceEditorTypes } from "../appearance-editor.types";

export function useAppearanceEditor(props: AppearanceEditorTypes.Props) {
  const [draft, setDraft] = useState(props.appearance);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(function editorLifetimeFx() {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const save = async () => {
    if (props.disabled || pending.current) return;

    pending.current = true;
    setSaving(true);
    setError("");

    try {
      await props.onSave(props.id, draft);

      if (mounted.current) props.onReturn();
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Не удалось сохранить оформление.",
        );
    } finally {
      pending.current = false;

      if (mounted.current) setSaving(false);
    }
  };

  return { draft, setDraft, saving, error, save };
}
