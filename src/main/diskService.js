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

    // ============================================
    // DISK EXTEND/SHRINK FEATURES
    // ============================================

    // Get ALL physical disks including internal drives (not just USB)
    async getAllDisksIncludingInternal() {
        try {
            // Use Get-PhysicalDisk to get ALL physical disks (Get-Disk sometimes misses disks)
            const physDiskCmd = `powershell -Command "Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, Size, MediaType, OperationalStatus, BusType | ConvertTo-Json"`;
            const { stdout: physOut } = await execAsync(physDiskCmd);

            if (!physOut.trim()) {
                return [];
            }

            let physDisks = JSON.parse(physOut);
            if (!Array.isArray(physDisks)) {
                physDisks = [physDisks];
            }

            // For each physical disk, try to get disk info and partitions
            const result = await Promise.all(physDisks.map(async (phys) => {
                const diskNumber = parseInt(phys.DeviceId) || 0;

                // Try Get-Disk for this disk number
                let diskInfo = null;
                try {
                    const diskCmd = `powershell -Command "Get-Disk -Number ${diskNumber} -ErrorAction SilentlyContinue | Select-Object Number, Size, PartitionStyle, OperationalStatus, HealthStatus, BusType | ConvertTo-Json"`;
                    const { stdout: diskOut } = await execAsync(diskCmd);
                    if (diskOut.trim()) {
                        diskInfo = JSON.parse(diskOut);
                    }
                } catch (e) {
                    console.log(`Get-Disk failed for disk ${diskNumber}, using PhysicalDisk info`);
                }

                // Get disk layout (partitions and unallocated space)
                const layout = await this.getDiskLayout(diskNumber);
                console.log(`[AllDisks] Disk ${diskNumber} layout: ${layout.items?.length || 0} items, hasUnallocated: ${layout.hasUnallocated}`);

                return {
                    diskNumber: diskNumber,
                    name: phys.FriendlyName || 'Disk',
                    size: phys.Size ? Math.round(phys.Size / (1024 * 1024 * 1024) * 100) / 100 : 0,
                    sizeBytes: phys.Size || 0,
                    partitionStyle: diskInfo?.PartitionStyle || 'Unknown',
                    status: diskInfo?.OperationalStatus || phys.OperationalStatus || 'Unknown',
                    health: diskInfo?.HealthStatus || 'Unknown',
                    busType: diskInfo?.BusType || phys.BusType || 'Unknown',
                    mediaType: phys.MediaType || 'Unknown',
                    isRemovable: (diskInfo?.BusType || phys.BusType) === 'USB',
                    isInternal: (diskInfo?.BusType || phys.BusType) !== 'USB',
                    layout: layout,
                };
            }));

            return result;
        } catch (error) {
            console.error('Error getting all disks:', error);
            return [];
        }
    }

    // Get disk layout showing partitions and unallocated space
    async getDiskLayout(diskNumber) {
        try {
            console.log(`[Layout] Getting layout for disk ${diskNumber}`);

            // Get all partitions using Get-Partition (wrap in try-catch - may fail for some disks)
            let partOut = '';
            try {
                const partCmd = `powershell -Command "Get-Partition -DiskNumber ${diskNumber} -ErrorAction SilentlyContinue | Select-Object PartitionNumber, DriveLetter, Size, Offset, Type | ConvertTo-Json"`;
                const result = await execAsync(partCmd);
                partOut = result.stdout || '';
            } catch (e) {
                console.log(`[Layout] Get-Partition failed for disk ${diskNumber}, will try WMI fallback`);
                partOut = '';
            }

            // Get disk total size (try Get-Disk first, then PhysicalDisk)
            let diskSize = 0;
            try {
                const diskCmd = `powershell -Command "(Get-Disk -Number ${diskNumber} -ErrorAction SilentlyContinue).Size"`;
                const { stdout: diskOut } = await execAsync(diskCmd);
                diskSize = parseInt(diskOut.trim()) || 0;
            } catch (e) {
                // Fallback to Get-PhysicalDisk
                try {
                    const physCmd = `powershell -Command "(Get-PhysicalDisk | Where-Object DeviceId -eq ${diskNumber}).Size"`;
                    const { stdout: physOut } = await execAsync(physCmd);
                    diskSize = parseInt(physOut.trim()) || 0;
                } catch (e2) {
                    console.log(`[Layout] Failed to get disk size for disk ${diskNumber}`);
                }
            }
            console.log(`[Layout] Disk ${diskNumber} size: ${diskSize}`);

            let partitions = [];
            if (partOut.trim()) {
                partitions = JSON.parse(partOut);
                if (!Array.isArray(partitions)) {
                    partitions = [partitions];
                }
            }
            console.log(`[Layout] Get-Partition found ${partitions.length} partitions`);

            // If no partitions found, try WMI approach for disks not managed by Storage Spaces
            if (partitions.length === 0) {
                console.log(`[Layout] Trying WMI fallback for disk ${diskNumber}`);
                try {
                    // Use WMI to find partitions on this disk (use raw property names)
                    const wmiCmd = `powershell -Command "Get-WmiObject Win32_DiskPartition | Where-Object DiskIndex -eq ${diskNumber} | Select-Object Index, Size, StartingOffset, Type, DeviceID | ConvertTo-Json"`;
                    const { stdout: wmiOut } = await execAsync(wmiCmd);
                    console.log(`[Layout] WMI output: ${wmiOut.substring(0, 200)}...`);

                    if (wmiOut.trim()) {
                        let wmiParts = JSON.parse(wmiOut);
                        if (!Array.isArray(wmiParts)) {
                            wmiParts = [wmiParts];
                        }

                        // Map raw WMI property names to expected format
                        wmiParts = wmiParts.map(p => ({
                            PartitionNumber: (p.Index || 0) + 1,
                            Size: p.Size,
                            Offset: p.StartingOffset,
                            Type: p.Type,
                            DeviceID: p.DeviceID,
                            DriveLetter: null
                        }));

                        // Get all logical disk mappings
                        try {
                            const mapCmd = `powershell -Command "Get-WmiObject Win32_LogicalDiskToPartition | Select-Object Antecedent, Dependent | ConvertTo-Json"`;
                            const { stdout: mapOut } = await execAsync(mapCmd);
                            if (mapOut.trim()) {
                                let mappings = JSON.parse(mapOut);
                                if (!Array.isArray(mappings)) mappings = [mappings];

                                // Match drive letters to partitions
                                for (const part of wmiParts) {
                                    for (const map of mappings) {
                                        if (map.Antecedent && part.DeviceID && map.Antecedent.includes(part.DeviceID)) {
                                            // Extract drive letter from Dependent
                                            const match = map.Dependent.match(/DeviceID="([A-Z]):"/i);
                                            if (match) {
                                                part.DriveLetter = match[1];
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) { }

                        partitions = wmiParts;
                    }
                } catch (wmiError) {
                    console.log('WMI fallback failed:', wmiError.message);
                }
            }

            // Build layout with partitions and gaps (unallocated space)
            const layout = [];
            let currentOffset = 0;

            // Sort by offset
            partitions.sort((a, b) => (a.Offset || 0) - (b.Offset || 0));

            for (const part of partitions) {
                const partOffset = parseInt(part.Offset) || 0;
                const partSize = parseInt(part.Size) || 0;

                // Check for unallocated space before this partition
                if (partOffset > currentOffset) {
                    const gapSize = partOffset - currentOffset;
                    if (gapSize > 1048576) { // > 1MB
                        layout.push({
                            type: 'unallocated',
                            offset: currentOffset,
                            size: gapSize,
                            sizeGB: Math.round(gapSize / (1024 * 1024 * 1024) * 100) / 100,
                        });
                    }
                }

                // Get volume info if has drive letter
                let volumeInfo = null;
                const driveLetter = part.DriveLetter;
                if (driveLetter && driveLetter !== '\u0000' && driveLetter !== '') {
                    try {
                        const volCmd = `powershell -Command "Get-Volume -DriveLetter ${driveLetter} -ErrorAction SilentlyContinue | Select-Object FileSystemLabel, FileSystem, SizeRemaining | ConvertTo-Json"`;
                        const { stdout: volOut } = await execAsync(volCmd);
                        if (volOut.trim()) {
                            volumeInfo = JSON.parse(volOut);
                        }
                    } catch (e) { }
                }

                layout.push({
                    type: 'partition',
                    partitionNumber: part.PartitionNumber,
                    driveLetter: (driveLetter && driveLetter !== '\u0000' && driveLetter !== '') ? `${driveLetter}:` : null,
                    offset: partOffset,
                    size: partSize,
                    sizeGB: Math.round(partSize / (1024 * 1024 * 1024) * 100) / 100,
                    partitionType: part.Type,
                    label: volumeInfo?.FileSystemLabel || '',
                    fileSystem: volumeInfo?.FileSystem || '',
                    freeSpace: volumeInfo?.SizeRemaining || 0,
                });

                currentOffset = partOffset + partSize;
            }

            // Check for unallocated space at the end
            if (diskSize > currentOffset) {
                const gapSize = diskSize - currentOffset;
                if (gapSize > 1048576) { // > 1MB
                    layout.push({
                        type: 'unallocated',
                        offset: currentOffset,
                        size: gapSize,
                        sizeGB: Math.round(gapSize / (1024 * 1024 * 1024) * 100) / 100,
                    });
                }
            }

            return {
                diskNumber,
                diskSize,
                diskSizeGB: Math.round(diskSize / (1024 * 1024 * 1024) * 100) / 100,
                items: layout,
                hasUnallocated: layout.some(item => item.type === 'unallocated'),
                totalUnallocated: layout.filter(item => item.type === 'unallocated').reduce((sum, item) => sum + item.size, 0),
            };
        } catch (error) {
            console.error('Error getting disk layout:', error);
            return { diskNumber, items: [], hasUnallocated: false };
        }
    }

    // Extend volume into adjacent unallocated space
    async extendVolume(driveLetter, sizeInMB = null) {
        try {
            const drive = driveLetter.replace(':', '');

            if (this.isProtected(drive)) {
                throw new Error('Cannot extend protected drive!');
            }

            let command;
            if (sizeInMB) {
                // Extend by specific size
                command = `powershell -Command "Resize-Partition -DriveLetter ${drive} -Size ((Get-PartitionSupportedSize -DriveLetter ${drive}).SizeMin + ${sizeInMB}MB)"`;
            } else {
                // Extend to max available
                command = `powershell -Command "$maxSize = (Get-PartitionSupportedSize -DriveLetter ${drive}).SizeMax; Resize-Partition -DriveLetter ${drive} -Size $maxSize"`;
            }

            await execAsync(command);
            return { success: true, message: `Volume ${drive}: extended successfully` };
        } catch (error) {
            throw new Error(`Failed to extend volume: ${error.message}`);
        }
    }

    // Shrink volume to create unallocated space
    async shrinkVolume(driveLetter, sizeInMB) {
        try {
            const drive = driveLetter.replace(':', '');

            if (this.isProtected(drive)) {
                throw new Error('Cannot shrink protected drive!');
            }

            // Get current size and shrink
            const command = `powershell -Command "$currentSize = (Get-Partition -DriveLetter ${drive}).Size; $newSize = $currentSize - (${sizeInMB}MB); Resize-Partition -DriveLetter ${drive} -Size $newSize"`;

            await execAsync(command);
            return { success: true, message: `Volume ${drive}: shrunk by ${sizeInMB}MB successfully` };
        } catch (error) {
            throw new Error(`Failed to shrink volume: ${error.message}`);
        }
    }

    // Get supported resize sizes for a volume
    async getResizeLimits(driveLetter) {
        try {
            const drive = driveLetter.replace(':', '');
            const command = `powershell -Command "Get-PartitionSupportedSize -DriveLetter ${drive} | Select-Object SizeMin, SizeMax | ConvertTo-Json"`;

            const { stdout } = await execAsync(command);

            if (!stdout.trim()) {
                throw new Error('Could not get resize limits');
            }

            const result = JSON.parse(stdout);
            return {
                minSize: result.SizeMin || 0,
                maxSize: result.SizeMax || 0,
                minSizeGB: Math.round((result.SizeMin || 0) / (1024 * 1024 * 1024) * 100) / 100,
                maxSizeGB: Math.round((result.SizeMax || 0) / (1024 * 1024 * 1024) * 100) / 100,
            };
        } catch (error) {
            console.error('Error getting resize limits:', error);
            return { minSize: 0, maxSize: 0, minSizeGB: 0, maxSizeGB: 0 };
        }
    }

    // Check if volume can be extended
    async canExtend(driveLetter) {
        try {
            const drive = driveLetter.replace(':', '');

            // Get disk number for this volume
            const diskNumCmd = `powershell -Command "(Get-Partition -DriveLetter ${drive}).DiskNumber"`;
            const { stdout: diskOut } = await execAsync(diskNumCmd);
            const diskNumber = parseInt(diskOut.trim());

            // Get layout and check for adjacent unallocated
            const layout = await this.getDiskLayout(diskNumber);

            // Find this partition
            const partIndex = layout.items.findIndex(item =>
                item.type === 'partition' && item.driveLetter === `${drive}:`
            );

            if (partIndex === -1) return { canExtend: false, reason: 'Partition not found' };

            // Check if next item is unallocated
            const nextItem = layout.items[partIndex + 1];
            if (nextItem && nextItem.type === 'unallocated') {
                return {
                    canExtend: true,
                    availableSpace: nextItem.size,
                    availableSpaceGB: nextItem.sizeGB,
                };
            }

            return { canExtend: false, reason: 'No adjacent unallocated space' };
        } catch (error) {
            return { canExtend: false, reason: error.message };
        }
    }

    // Delete a partition (DANGEROUS - use with caution)
    async deletePartition(diskNumber, partitionNumber) {
        try {
            console.log(`[Delete] Attempting to delete partition ${partitionNumber} on disk ${diskNumber}`);

            // Get partition info first
            const infoCmd = `powershell -Command "Get-Partition -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} -ErrorAction Stop | Select-Object DriveLetter, Type, Size | ConvertTo-Json"`;
            let partInfo;
            try {
                const { stdout } = await execAsync(infoCmd);
                partInfo = JSON.parse(stdout);
            } catch (e) {
                // Try WMI fallback
                const wmiCmd = `powershell -Command "Get-WmiObject Win32_DiskPartition | Where-Object { $_.DiskIndex -eq ${diskNumber} -and $_.Index -eq ${partitionNumber - 1} } | Select-Object Type, Size | ConvertTo-Json"`;
                const { stdout: wmiOut } = await execAsync(wmiCmd);
                partInfo = wmiOut.trim() ? JSON.parse(wmiOut) : null;
            }

            // Check for protected partitions
            if (partInfo) {
                const protectedTypes = ['System', 'Reserved', 'EFI'];
                const partType = partInfo.Type || '';
                if (protectedTypes.some(t => partType.includes(t))) {
                    throw new Error(`Cannot delete ${partType} partition - system protected!`);
                }

                // Check for protected drive letters
                const driveLetter = partInfo.DriveLetter;
                if (driveLetter && this.isProtected(driveLetter)) {
                    throw new Error(`Cannot delete protected drive ${driveLetter}!`);
                }
            }

            // Execute deletion using diskpart (more reliable for dynamic disks)
            const diskpartScript = `
select disk ${diskNumber}
select partition ${partitionNumber}
delete partition override
`;
            // Write script to temp file
            const tempFile = path.join(process.env.TEMP || 'C:\\Temp', `diskpart_delete_${Date.now()}.txt`);
            const fs = require('fs');
            fs.writeFileSync(tempFile, diskpartScript);

            try {
                const deleteCmd = `diskpart /s "${tempFile}"`;
                const { stdout, stderr } = await execAsync(deleteCmd);
                console.log('[Delete] Diskpart output:', stdout);

                // Cleanup temp file
                fs.unlinkSync(tempFile);

                if (stderr && stderr.includes('error')) {
                    throw new Error(stderr);
                }

                return {
                    success: true,
                    message: `Partition ${partitionNumber} deleted successfully from disk ${diskNumber}`,
                };
            } catch (diskpartError) {
                // Cleanup temp file on error
                try { fs.unlinkSync(tempFile); } catch (e) { }
                throw diskpartError;
            }
        } catch (error) {
            console.error('[Delete] Error:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // Get partition info for confirmation dialog
    async getPartitionInfo(diskNumber, partitionNumber) {
        try {
            // Try Get-Partition first
            const cmd = `powershell -Command "Get-Partition -DiskNumber ${diskNumber} -PartitionNumber ${partitionNumber} -ErrorAction SilentlyContinue | Select-Object DriveLetter, Size, Type | ConvertTo-Json"`;
            const { stdout } = await execAsync(cmd);

            if (stdout.trim()) {
                const info = JSON.parse(stdout);
                return {
                    diskNumber,
                    partitionNumber,
                    driveLetter: info.DriveLetter || null,
                    size: info.Size || 0,
                    sizeGB: Math.round((info.Size || 0) / (1024 * 1024 * 1024) * 100) / 100,
                    type: info.Type || 'Unknown',
                };
            }

            // Fallback to WMI
            const wmiCmd = `powershell -Command "Get-WmiObject Win32_DiskPartition | Where-Object { $_.DiskIndex -eq ${diskNumber} -and $_.Index -eq ${partitionNumber - 1} } | Select-Object Size, Type | ConvertTo-Json"`;
            const { stdout: wmiOut } = await execAsync(wmiCmd);

            if (wmiOut.trim()) {
                const info = JSON.parse(wmiOut);
                return {
                    diskNumber,
                    partitionNumber,
                    driveLetter: null,
                    size: info.Size || 0,
                    sizeGB: Math.round((info.Size || 0) / (1024 * 1024 * 1024) * 100) / 100,
                    type: info.Type || 'Unknown',
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting partition info:', error);
            return null;
        }
    }
}

module.exports = { DiskService };

