const portInput = document.getElementById("port") as HTMLInputElement;
const tokenInput = document.getElementById("token") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

void chrome.storage.local.get(["tracefyPort", "tracefyToken"]).then((stored) => {
  portInput.value = stored.tracefyPort ? String(stored.tracefyPort) : "";
  tokenInput.value = typeof stored.tracefyToken === "string" ? stored.tracefyToken : "";
});

saveButton.addEventListener("click", () => {
  const port = Number(portInput.value);
  const token = tokenInput.value.trim();

  if (!Number.isInteger(port) || port <= 0 || !token) {
    statusEl.textContent = "Enter the port and token shown in VS Code.";
    return;
  }

  void chrome.storage.local
    .set({
      tracefyPort: port,
      tracefyToken: token
    })
    .then(() => {
      statusEl.textContent = "Pairing saved. Reproduce the bug now.";
    });
});
