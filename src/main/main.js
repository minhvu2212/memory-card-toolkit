const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { DiskService } = require('./diskService');

let mainWindow;
const diskService = new DiskService();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        transparent: false,
        backgroundColor: '#f5f0e8',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '../../public/icons/icon.ico'),
    });

    // Load from Vite dev server or built files
    if (process.env.NODE_ENV !== 'production') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers - Window Controls
ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.handle('window:close', () => {
    mainWindow?.close();
});

// IPC Handlers - Disk Operations
ipcMain.handle('disk:getAll', async () => {
    return await diskService.getAllDisks();
});

ipcMain.handle('disk:getAllPhysical', async () => {
    return await diskService.getAllPhysicalDisks();
});

ipcMain.handle('disk:getInfo', async (event, driveLetter) => {
    return await diskService.getDiskInfo(driveLetter);
});

ipcMain.handle('disk:getPhysicalInfo', async (event, diskNumber) => {
    return await diskService.getPhysicalDiskInfo(diskNumber);
});

ipcMain.handle('disk:format', async (event, { driveLetter, fileSystem, label, quickFormat, diskNumber }) => {
    return await diskService.formatDisk(driveLetter, fileSystem, label, quickFormat, diskNumber);
});

ipcMain.handle('disk:formatByNumber', async (event, { diskNumber, fileSystem, label }) => {
    return await diskService.formatDiskByNumber(diskNumber, fileSystem, label);
});

ipcMain.handle('disk:getPartitions', async (event, diskNumber) => {
    return await diskService.getPartitions(diskNumber);
});

ipcMain.handle('disk:createPartition', async (event, { diskNumber, size, fileSystem, label }) => {
    return await diskService.createPartition(diskNumber, size, fileSystem, label);
});

ipcMain.handle('disk:deletePartition', async (event, { diskNumber, partitionNumber }) => {
    return await diskService.deletePartition(diskNumber, partitionNumber);
});

ipcMain.handle('disk:assignLetter', async (event, { diskNumber, partitionNumber, driveLetter }) => {
    return await diskService.assignDriveLetter(diskNumber, partitionNumber, driveLetter);
});

ipcMain.handle('disk:removeLetter', async (event, { diskNumber, partitionNumber }) => {
    return await diskService.removeDriveLetter(diskNumber, partitionNumber);
});

ipcMain.handle('disk:setOnline', async (event, diskNumber) => {
    return await diskService.setDiskOnline(diskNumber);
});

ipcMain.handle('disk:setReadWrite', async (event, diskNumber) => {
    return await diskService.setDiskReadWrite(diskNumber);
});

ipcMain.handle('disk:initialize', async (event, { diskNumber, partitionStyle }) => {
    return await diskService.initializeDisk(diskNumber, partitionStyle);
});

ipcMain.handle('disk:clean', async (event, diskNumber) => {
    return await diskService.cleanDisk(diskNumber);
});

ipcMain.handle('disk:getAvailableLetters', async () => {
    return await diskService.getAvailableDriveLetters();
});
