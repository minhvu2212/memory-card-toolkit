# Changelog

All notable changes to Memory Card Toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-12-30

### Added
- **Full Disk Detection** - Detect all USB disks including those without drive letters
- **Assign Drive Letter** - Assign letters to unrecognized/RAW disks
- **Initialize Disk** - Initialize disks as MBR or GPT partition style
- **Partition List View** - View partitions for disks without letters
- **Status Badges** - "NO LETTER" and "OFFLINE" badges for problematic disks
- **Fallback Format Method** - Diskpart-based formatting for RAW disks

### Changed
- Removed emoji icons from device presets for cleaner look
- Improved format reliability using diskpart as primary method
- Updated device selection to persist after letter assignment
- Enhanced error messages with actionable guidance

### Fixed
- Format failing on newly assigned drive letters
- PowerShell escaping issues in format commands
- Device info not updating after letter assignment

## [1.0.0] - 2024-12-29

### Added
- Initial release with Neo Brutalism UI
- Format SD cards and USB drives
- Device presets for cameras, gaming, IoT, and more
- Quick format and full format options
- FAT32, exFAT, NTFS file system support
- Multi-step confirmation for destructive operations
- System drive (C:) protection
- Custom title bar with window controls
- Real-time storage visualization
- Volume label customization

### Security
- Administrator privileges required for disk operations
- Protected drives cannot be modified
- Confirmation required before format
