import { BrowserWindow, app, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import fs from "node:fs";
//#region electron/main.ts
var { autoUpdater } = createRequire(import.meta.url)("electron-updater");
var __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var win;
function createWindow() {
	win = new BrowserWindow({
		icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
		webPreferences: { preload: path.join(__dirname, "preload.mjs") },
		width: 1200,
		height: 800,
		titleBarStyle: "hidden",
		titleBarOverlay: {
			color: "#1a1a1a",
			symbolColor: "#ffffff",
			height: 35
		},
		backgroundColor: "#1a1a1a"
	});
	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	});
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadFile(path.join(RENDERER_DIST, "index.html"));
}
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
		win = null;
	}
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
var projectsPath = path.join(app.getPath("userData"), "projects.json");
ipcMain.handle("save-projects", (_, projects) => {
	fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
});
ipcMain.handle("load-projects", () => {
	if (fs.existsSync(projectsPath)) return JSON.parse(fs.readFileSync(projectsPath, "utf-8"));
	return [];
});
app.whenReady().then(() => {
	createWindow();
	autoUpdater.checkForUpdatesAndNotify();
});
autoUpdater.on("update-available", () => {
	win?.webContents.send("update-available");
});
autoUpdater.on("update-downloaded", () => {
	win?.webContents.send("update-downloaded");
});
ipcMain.on("restart-app", () => {
	autoUpdater.quitAndInstall();
});
//#endregion
export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
