function bind(session: {
  hasUnsaved: () => boolean;
  flush: () => unknown;
}): () => void {
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (session.hasUnsaved()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };

  const visibility = () => {
    if (document.visibilityState === "hidden") void session.flush();
  };

  window.addEventListener("beforeunload", beforeUnload);
  document.addEventListener("visibilitychange", visibility);

  return () => {
    window.removeEventListener("beforeunload", beforeUnload);
    document.removeEventListener("visibilitychange", visibility);
  };
}

export const DocumentBindings = { bind };
