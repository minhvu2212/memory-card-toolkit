const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),

    // Disk operations
    disk: {
        // Get all disks (logical + physical without letters)
        getAll: () => ipcRenderer.invoke('disk:getAll'),
        getAllPhysical: () => ipcRenderer.invoke('disk:getAllPhysical'),

        // Get disk info
        getInfo: (driveLetter) => ipcRenderer.invoke('disk:getInfo', driveLetter),
        getPhysicalInfo: (diskNumber) => ipcRenderer.invoke('disk:getPhysicalInfo', diskNumber),

        // Format operations
        format: (options) => ipcRenderer.invoke('disk:format', options),
        formatByNumber: (options) => ipcRenderer.invoke('disk:formatByNumber', options),

        // Partition operations
        getPartitions: (diskNumber) => ipcRenderer.invoke('disk:getPartitions', diskNumber),
        createPartition: (options) => ipcRenderer.invoke('disk:createPartition', options),
        deletePartition: (options) => ipcRenderer.invoke('disk:deletePartition', options),

        // Drive letter management
        assignLetter: (options) => ipcRenderer.invoke('disk:assignLetter', options),
        removeLetter: (options) => ipcRenderer.invoke('disk:removeLetter', options),
        getAvailableLetters: () => ipcRenderer.invoke('disk:getAvailableLetters'),

        // Disk management
        setOnline: (diskNumber) => ipcRenderer.invoke('disk:setOnline', diskNumber),
        setReadWrite: (diskNumber) => ipcRenderer.invoke('disk:setReadWrite', diskNumber),
        initialize: (options) => ipcRenderer.invoke('disk:initialize', options),
        clean: (diskNumber) => ipcRenderer.invoke('disk:clean', diskNumber),
    },

    // Event listeners
    onDiskChange: (callback) => {
        ipcRenderer.on('disk:changed', callback);
        return () => ipcRenderer.removeListener('disk:changed', callback);
    },
});
