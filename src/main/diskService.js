const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DiskService {
    constructor() {
        this.protectedDrives = ['C:', 'C'];
    }

    isProtected(driveLetter) {
        if (!driveLetter) return false;
        const normalized = driveLetter.toUpperCase().replace(':', '');
        return this.protectedDrives.includes(normalized) || this.protectedDrives.includes(normalized + ':');
    }

    // Get ALL physical disks (USB type) - including those without drive letters
    async getAllPhysicalDisks() {
        try {
            // Get all physical disks that are USB/Removable
            const command = `powershell -Command "Get-Disk | Where-Object { $_.BusType -eq 'USB' -or $_.IsOffline -eq $false } | Select-Object Number, FriendlyName, Size, PartitionStyle, OperationalStatus, HealthStatus, BusType | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                return [];
            }

            let disks = JSON.parse(stdout);
            if (!Array.isArray(disks)) {
                disks = [disks];
            }

            // Filter to only USB disks (removable)
            const usbDisks = disks.filter(d => d.BusType === 'USB');

            // Get partitions for each disk
            const result = await Promise.all(usbDisks.map(async (disk) => {
                const partitions = await this.getPartitionsWithLetters(disk.Number);
                const driveLetter = partitions.find(p => p.driveLetter && p.driveLetter !== '-')?.driveLetter || null;

                return {
                    diskNumber: disk.Number,
                    name: disk.FriendlyName || 'USB Disk',
                    size: disk.Size ? Math.round(disk.Size / (1024 * 1024 * 1024) * 100) / 100 : 0,
                    sizeBytes: disk.Size || 0,
                    partitionStyle: disk.PartitionStyle || 'RAW',
                    status: disk.OperationalStatus || 'Unknown',
                    health: disk.HealthStatus || 'Unknown',
                    busType: disk.BusType,
                    driveLetter: driveLetter ? `${driveLetter}:` : null,
                    hasLetter: !!driveLetter,
                    partitions: partitions,
                    isRemovable: true,
                };
            }));

            return result;
        } catch (error) {
            console.error('Error getting physical disks:', error);
            return [];
        }
    }

    // Get partitions with drive letters
    async getPartitionsWithLetters(diskNumber) {
        try {
            const command = `powershell -Command "Get-Partition -DiskNumber ${diskNumber} -ErrorAction SilentlyContinue | Select-Object PartitionNumber, DriveLetter, Size, Type, IsActive | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                return [];
            }

            let partitions = JSON.parse(stdout);
            if (!Array.isArray(partitions)) {
                partitions = [partitions];
            }

            return partitions.map(p => ({
                number: p.PartitionNumber,
                driveLetter: p.DriveLetter || null,
                size: p.Size ? Math.round(p.Size / (1024 * 1024 * 1024) * 100) / 100 : 0,
                sizeBytes: p.Size || 0,
                type: p.Type || 'Basic',
                isActive: p.IsActive || false,
            }));
        } catch (error) {
            return [];
        }
    }

    // Get removable logical drives (original method - for backwards compatibility)
    async getAllDisks() {
        try {
            // First try to get all physical USB disks
            const physicalDisks = await this.getAllPhysicalDisks();

            if (physicalDisks.length > 0) {
                return physicalDisks.map(disk => ({
                    driveLetter: disk.driveLetter,
                    label: disk.name,
                    size: disk.size,
                    freeSpace: 0, // Will be updated when selected
                    fileSystem: disk.partitionStyle === 'RAW' ? 'RAW' : 'Unknown',
                    isRemovable: true,
                    diskNumber: disk.diskNumber,
                    hasLetter: disk.hasLetter,
                    status: disk.status,
                    health: disk.health,
                    partitions: disk.partitions,
                }));
            }

            // Fallback to logical disks if no physical USB found
            const command = `powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | Select-Object DeviceID, VolumeName, Size, FreeSpace, FileSystem | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                return [];
            }

            let disks = JSON.parse(stdout);
            if (!Array.isArray(disks)) {
                disks = [disks];
            }

            return disks.map(disk => ({
                driveLetter: disk.DeviceID,
                label: disk.VolumeName || 'Removable Disk',
                size: disk.Size ? Math.round(disk.Size / (1024 * 1024 * 1024) * 100) / 100 : 0,
                freeSpace: disk.FreeSpace ? Math.round(disk.FreeSpace / (1024 * 1024 * 1024) * 100) / 100 : 0,
                fileSystem: disk.FileSystem || 'Unknown',
                isRemovable: true,
                hasLetter: true,
            }));
        } catch (error) {
            console.error('Error getting disks:', error);
            return [];
        }
    }

    async getDiskInfo(driveLetter) {
        try {
            const command = `powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq '${driveLetter}' } | Select-Object DeviceID, VolumeName, Size, FreeSpace, FileSystem, DriveType | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                return null;
            }

            const disk = JSON.parse(stdout);

            // Get physical disk number
            const diskNumberCmd = `powershell -Command "Get-Partition -DriveLetter '${driveLetter.replace(':', '')}' | Select-Object DiskNumber | ConvertTo-Json"`;
            let diskNumber = null;

            try {
                const { stdout: diskNumOut } = await execAsync(diskNumberCmd);
                if (diskNumOut.trim()) {
                    const parsed = JSON.parse(diskNumOut);
                    diskNumber = parsed.DiskNumber;
                }
            } catch (e) {
                // Ignore - disk number is optional
            }

            return {
                driveLetter: disk.DeviceID,
                label: disk.VolumeName || 'Removable Disk',
                size: disk.Size ? Math.round(disk.Size / (1024 * 1024 * 1024) * 100) / 100 : 0,
                sizeBytes: disk.Size || 0,
                freeSpace: disk.FreeSpace ? Math.round(disk.FreeSpace / (1024 * 1024 * 1024) * 100) / 100 : 0,
                freeSpaceBytes: disk.FreeSpace || 0,
                usedSpace: disk.Size && disk.FreeSpace ? Math.round((disk.Size - disk.FreeSpace) / (1024 * 1024 * 1024) * 100) / 100 : 0,
                fileSystem: disk.FileSystem || 'Unknown',
                driveType: this.getDriveTypeName(disk.DriveType),
                isRemovable: disk.DriveType === 2,
                diskNumber: diskNumber,
                isProtected: this.isProtected(driveLetter),
            };
        } catch (error) {
            console.error('Error getting disk info:', error);
            return null;
        }
    }

    // Get info for disk without drive letter
    async getPhysicalDiskInfo(diskNumber) {
        try {
            const command = `powershell -Command "Get-Disk -Number ${diskNumber} | Select-Object Number, FriendlyName, Size, PartitionStyle, OperationalStatus, HealthStatus, BusType, IsOffline, IsReadOnly | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                return null;
            }

            const disk = JSON.parse(stdout);
            const partitions = await this.getPartitionsWithLetters(diskNumber);

            return {
                diskNumber: disk.Number,
                label: disk.FriendlyName || 'USB Disk',
                size: disk.Size ? Math.round(disk.Size / (1024 * 1024 * 1024) * 100) / 100 : 0,
                sizeBytes: disk.Size || 0,
                freeSpace: 0,
                partitionStyle: disk.PartitionStyle || 'RAW',
                status: disk.OperationalStatus || 'Unknown',
                health: disk.HealthStatus || 'Unknown',
                busType: disk.BusType,
                isOffline: disk.IsOffline || false,
                isReadOnly: disk.IsReadOnly || false,
                partitions: partitions,
                isRemovable: disk.BusType === 'USB',
                isProtected: false,
                driveType: 'Removable Disk',
            };
        } catch (error) {
            console.error('Error getting physical disk info:', error);
            return null;
        }
    }

    getDriveTypeName(type) {
        const types = {
            0: 'Unknown',
            1: 'No Root Directory',
            2: 'Removable Disk',
            3: 'Local Disk',
            4: 'Network Drive',
            5: 'CD-ROM',
            6: 'RAM Disk',
        };
        return types[type] || 'Unknown';
    }

    // Assign drive letter to a partition
    async assignDriveLetter(diskNumber, partitionNumber, driveLetter) {
        try {
            const letter = driveLetter.replace(':', '').toUpperCase();

            // First check if the letter is actually available
            const checkCmd = `powershell -Command "Get-Volume -DriveLetter ${letter} -ErrorAction SilentlyContinue"`;
            try {
                const { stdout } = await execAsync(checkCmd);
                if (stdout.trim()) {
                    throw new Error(`Drive letter ${letter}: is already in use`);
                }
            } catch (e) {
                // If error, letter might be free - continue
                if (e.message.includes('already in use')) {
                    throw e;
                }
            }

            // Use Add-PartitionAccessPath to assign letter
            const command = `powershell -Command "Add-PartitionAccessPath -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} -AccessPath '${letter}:'"`;

            await execAsync(command);
            return { success: true, message: `Drive letter ${letter}: assigned successfully` };
        } catch (error) {
            throw new Error(`Failed to assign drive letter: ${error.message}`);
        }
    }

    // Remove drive letter from a partition
    async removeDriveLetter(diskNumber, partitionNumber) {
        try {
            const command = `powershell -Command "Get-Partition -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} | Remove-PartitionAccessPath -AccessPath (Get-Partition -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber}).AccessPaths[0] -ErrorAction SilentlyContinue"`;

            await execAsync(command);
            return { success: true, message: 'Drive letter removed successfully' };
        } catch (error) {
            throw new Error(`Failed to remove drive letter: ${error.message}`);
        }
    }

    // Bring disk online
    async setDiskOnline(diskNumber) {
        try {
            const command = `powershell -Command "Set-Disk -Number ${diskNumber} -IsOffline \\$false"`;
            await execAsync(command);
            return { success: true, message: 'Disk is now online' };
        } catch (error) {
            throw new Error(`Failed to bring disk online: ${error.message}`);
        }
    }

    // Set disk read-write
    async setDiskReadWrite(diskNumber) {
        try {
            const command = `powershell -Command "Set-Disk -Number ${diskNumber} -IsReadOnly \\$false"`;
            await execAsync(command);
            return { success: true, message: 'Disk is now read-write' };
        } catch (error) {
            throw new Error(`Failed to set disk read-write: ${error.message}`);
        }
    }

    async formatDisk(driveLetter, fileSystem = 'FAT32', label = 'SDCARD', quickFormat = true, diskNumber = null) {
        if (this.isProtected(driveLetter)) {
            throw new Error('Cannot format protected drive!');
        }

        const drive = driveLetter ? driveLetter.replace(':', '') : null;

        // If we have a disk number, use the more reliable disk-based method
        if (diskNumber !== null && diskNumber !== undefined) {
            return await this.formatDiskByNumberFull(diskNumber, fileSystem, label, drive);
        }

        // Try to get disk number from drive letter
        let foundDiskNumber = null;
        if (drive) {
            try {
                const cmd = `powershell -Command "(Get-Partition -DriveLetter ${drive} -ErrorAction SilentlyContinue).DiskNumber"`;
                const { stdout } = await execAsync(cmd);
                if (stdout.trim()) {
                    foundDiskNumber = parseInt(stdout.trim());
                }
            } catch (e) {
                // Continue without disk number
            }
        }

        // Method 1: Try diskpart with volume letter
        try {
            const quickOption = quickFormat ? 'quick' : '';
            const script = `
select volume ${drive}
format fs=${fileSystem} label="${label}" ${quickOption} override
exit
`.trim();

            const fs = require('fs');
            const tempFile = `${process.env.TEMP}\\diskpart_format_${Date.now()}.txt`;
            fs.writeFileSync(tempFile, script);

            const { stdout } = await execAsync(`diskpart /s "${tempFile}"`, { timeout: 300000 });
            try { fs.unlinkSync(tempFile); } catch (e) { }

            if (stdout.toLowerCase().includes('successfully') ||
                stdout.toLowerCase().includes('percent complete') ||
                stdout.toLowerCase().includes('complete')) {
                return { success: true, message: 'Format completed successfully' };
            }

            throw new Error('Volume not found');
        } catch (diskpartError) {
            // Method 2: If disk number found, clean and recreate
            if (foundDiskNumber !== null) {
                return await this.formatDiskByNumberFull(foundDiskNumber, fileSystem, label, drive);
            }

            throw new Error(`Format failed. The disk may be in RAW state. Try using "Format Disk" from the actions menu after selecting the disk.`);
        }
    }

    // Full format by disk number - cleans and recreates partition
    async formatDiskByNumberFull(diskNumber, fileSystem = 'FAT32', label = 'SDCARD', assignLetter = null) {
        try {
            const fs = require('fs');
            const letterAssign = assignLetter ? `assign letter=${assignLetter}` : 'assign';

            // Use diskpart to clean, create partition, format, and assign letter in one script
            const script = `
select disk ${diskNumber}
clean
create partition primary
${letterAssign}
format fs=${fileSystem} label="${label}" quick
exit
`.trim();

            const tempFile = `${process.env.TEMP}\\diskpart_full_${Date.now()}.txt`;
            fs.writeFileSync(tempFile, script);

            const { stdout } = await execAsync(`diskpart /s "${tempFile}"`, { timeout: 300000 });
            try { fs.unlinkSync(tempFile); } catch (e) { }

            if (stdout.toLowerCase().includes('successfully') ||
                stdout.toLowerCase().includes('percent complete')) {
                return { success: true, message: 'Disk formatted successfully' };
            }

            return { success: true, message: stdout || 'Disk formatted successfully' };
        } catch (error) {
            throw new Error(`Format failed: ${error.message}`);
        }
    }

    // Format disk by disk number (for disks without drive letter)
    async formatDiskByNumber(diskNumber, fileSystem = 'FAT32', label = 'SDCARD') {
        try {
            // First, clean the disk
            await this.cleanDisk(diskNumber);

            // Initialize as MBR (better compatibility)
            await this.initializeDisk(diskNumber, 'MBR');

            // Create partition using all space and assign letter
            const createCmd = `powershell -Command "New-Partition -DiskNumber ${diskNumber} -UseMaximumSize -AssignDriveLetter | Format-Volume -FileSystem ${fileSystem} -NewFileSystemLabel '${label}' -Confirm:\\$false"`;

            const { stdout } = await execAsync(createCmd, { timeout: 300000 });
            return { success: true, message: 'Disk formatted successfully' };
        } catch (error) {
            throw new Error(`Format failed: ${error.message}`);
        }
    }

    async getPartitions(diskNumber) {
        try {
            const command = `powershell -Command "Get-Partition -DiskNumber ${diskNumber} | Select-Object PartitionNumber, DriveLetter, Size, Type, IsActive | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                return [];
            }

            let partitions = JSON.parse(stdout);

            if (!Array.isArray(partitions)) {
                partitions = [partitions];
            }

            return partitions.map(p => ({
                number: p.PartitionNumber,
                driveLetter: p.DriveLetter || '-',
                size: p.Size ? Math.round(p.Size / (1024 * 1024 * 1024) * 100) / 100 : 0,
                sizeBytes: p.Size || 0,
                type: p.Type || 'Basic',
                isActive: p.IsActive || false,
            }));
        } catch (error) {
            console.error('Error getting partitions:', error);
            return [];
        }
    }

    async createPartition(diskNumber, sizeGB, fileSystem = 'NTFS', label = 'New Volume') {
        try {
            const sizeBytes = sizeGB * 1024 * 1024 * 1024;

            // Create partition using PowerShell
            const createCmd = `powershell -Command "New-Partition -DiskNumber ${diskNumber} -Size ${sizeBytes} -AssignDriveLetter | Format-Volume -FileSystem ${fileSystem} -NewFileSystemLabel '${label}' -Confirm:\\$false"`;

            const { stdout } = await execAsync(createCmd);
            return { success: true, message: 'Partition created successfully' };
        } catch (error) {
            throw new Error(`Failed to create partition: ${error.message}`);
        }
    }

    async deletePartition(diskNumber, partitionNumber) {
        try {
            const command = `powershell -Command "Remove-Partition -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} -Confirm:\\$false"`;

            await execAsync(command);
            return { success: true, message: 'Partition deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete partition: ${error.message}`);
        }
    }

    async initializeDisk(diskNumber, partitionStyle = 'MBR') {
        try {
            const command = `powershell -Command "Initialize-Disk -Number ${diskNumber} -PartitionStyle ${partitionStyle} -ErrorAction SilentlyContinue"`;

            await execAsync(command);
            return { success: true, message: `Disk initialized as ${partitionStyle}` };
        } catch (error) {
            throw new Error(`Failed to initialize disk: ${error.message}`);
        }
    }

    async cleanDisk(diskNumber) {
        try {
            // Use diskpart to clean the disk
            const script = `
select disk ${diskNumber}
clean
      `.trim();

            const fs = require('fs');
            const tempFile = `${process.env.TEMP}\\diskpart_clean.txt`;
            fs.writeFileSync(tempFile, script);

            const command = `diskpart /s "${tempFile}"`;
            await execAsync(command);

            fs.unlinkSync(tempFile);

            return { success: true, message: 'Disk cleaned successfully' };
        } catch (error) {
            throw new Error(`Failed to clean disk: ${error.message}`);
        }
    }

    // Get available drive letters
    async getAvailableDriveLetters() {
        try {
            const command = `powershell -Command "$used = (Get-PSDrive -PSProvider FileSystem).Name; 68..90 | ForEach-Object { $letter = [char]$_; if ($used -notcontains $letter) { $letter } } | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                return [];
            }

            let letters = JSON.parse(stdout);
            if (!Array.isArray(letters)) {
                letters = [letters];
            }

            return letters;
        } catch (error) {
            console.error('Error getting available drive letters:', error);
            return ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
        }
    }
}

module.exports = { DiskService };
