/** Copies text to the clipboard and clears it again after `ms`, but only if
 *  the clipboard still holds what we wrote (so we don't clobber something
 *  else the user copied in the meantime). */
export async function copyWithAutoClear(text: string, ms = 15_000): Promise<void> {
  await navigator.clipboard.writeText(text);
  window.setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === text) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // Clipboard read can be denied by the browser (permissions/focus) —
      // nothing to do, the copied value will just remain until overwritten.
    }
  }, ms);
}
