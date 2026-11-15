export type DownloadContents = string | Blob;

function download(json: DownloadContents, name: string) {
  const url = URL.createObjectURL(
    typeof json === "string"
      ? new Blob([json], { type: "application/json" })
      : json,
  );

  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  document.body.append(link);

  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

export const DocumentDownloads = { download };
