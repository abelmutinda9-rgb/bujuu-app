const { app, BrowserWindow, shell } = require("electron");

const SITE = "https://lynnn.lovable.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    title: "BUJUU",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // External links open in the normal browser; BUJUU pages stay in the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SITE)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL(SITE);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
