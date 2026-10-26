// Hand a generated file to the user: the share sheet on touch devices (mobile),
// otherwise a download. Desktop browsers on Windows/macOS also support file
// sharing, but a download is what you expect there.
export async function deliverFile(content, filename, type) {
  const file = new File([content], filename, { type });
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (touchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
      // Sharing failed for another reason — fall back to a download
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
