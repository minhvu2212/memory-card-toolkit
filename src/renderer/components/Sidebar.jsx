import React, { useState } from 'react';
import { Icons } from './Icons';

function Sidebar({
    devices,
    presets,
    selectedDevice,
    selectedPreset,
    isLoading,
    onDeviceSelect,
    onPresetSelect,
    onRefresh,
    onDeletePartition,
}) {
    const [showDonateModal, setShowDonateModal] = useState(false);
    const walletAddress = '0x051BF9b67aC43BbB461A33E13c21218f304E31BB';

    const copyAddress = () => {
        navigator.clipboard.writeText(walletAddress);
    };

    return (
        <aside className="sidebar">
            {/* Devices Section */}
            <section className="sidebar__section">
                <div className="sidebar__header">
                    <h2 className="sidebar__title">
                        <Icons.HardDrive />
                        All Disks
                    </h2>
                    <button
                        className={`sidebar__refresh ${isLoading ? 'sidebar__refresh--spinning' : ''}`}
                        onClick={onRefresh}
                        disabled={isLoading}
                        title="Refresh devices"
                    >
                        <Icons.RefreshCw />
                    </button>
                </div>

                <div className="device-list">
                    {devices.length === 0 ? (
                        <div className="device-item" style={{ opacity: 0.5, cursor: 'default' }}>
                            <div className="device-item__icon" style={{ background: 'var(--color-bg-tertiary)' }}>
                                <Icons.MemoryCard />
                            </div>
                            <div className="device-item__info">
                                <div className="device-item__name">No devices found</div>
                                <div className="device-item__details">
                                    Connect a USB drive or wait for scan
                                </div>
                            </div>
                        </div>
                    ) : (
                        devices.flatMap((device, diskIndex) => {
                            // Show disk header
                            const diskHeader = (
                                <div
                                    key={`disk-header-${device.diskNumber}`}
                                    className="disk-header"
                                >
                                    <Icons.HardDrive />
                                    <span>Disk {device.diskNumber}: {device.name} ({device.size} GB)</span>
                                </div>
                            );

                            // Show each partition and unallocated space from layout
                            const layoutItems = (device.layout?.items || []).map((item, itemIndex) => {
                                const key = `disk-${device.diskNumber}-${item.type}-${itemIndex}`;
                                const isSelected = selectedDevice?.diskNumber === device.diskNumber &&
                                    selectedDevice?.partitionNumber === item.partitionNumber &&
                                    selectedDevice?.type === item.type;

                                if (item.type === 'unallocated') {
                                    // Unallocated space entry
                                    return (
                                        <button
                                            key={key}
                                            className={`device-item device-item--unallocated ${isSelected ? 'device-item--selected' : ''}`}
                                            onClick={() => onDeviceSelect({
                                                ...device,
                                                type: 'unallocated',
                                                offset: item.offset,
                                                sizeGB: item.sizeGB
                                            })}
                                        >
                                            <div className="device-item__icon device-item__icon--unallocated">
                                                <Icons.Partition />
                                            </div>
                                            <div className="device-item__info">
                                                <div className="device-item__name">Unallocated</div>
                                                <div className="device-item__details">
                                                    <span>{item.sizeGB} GB</span>
                                                    <span>•</span>
                                                    <span className="device-item__unallocated">Free space</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                } else {
                                    // Partition entry
                                    const isSystemPartition = item.partitionType === 'System' ||
                                        item.partitionType === 'Reserved' ||
                                        item.partitionType === 'Recovery' ||
                                        (item.partitionType && item.partitionType.includes('EFI'));

                                    const isProtectedDrive = item.driveLetter === 'C:';
                                    const canDelete = !isProtectedDrive && onDeletePartition;

                                    if (isSystemPartition && !item.driveLetter) {
                                        // Show system partitions but allow delete for non-EFI
                                        const displayType = item.partitionType || 'Unknown';
                                        const isEFI = displayType.includes('EFI') || displayType.includes('System');

                                        return (
                                            <div
                                                key={key}
                                                className={`device-item device-item--system ${isSelected ? 'device-item--selected' : ''}`}
                                            >
                                                <div className="device-item__icon device-item__icon--system">
                                                    <Icons.Settings />
                                                </div>
                                                <div className="device-item__info">
                                                    <div className="device-item__name">{displayType}</div>
                                                    <div className="device-item__details">
                                                        <span>{item.sizeGB} GB</span>
                                                        <span>•</span>
                                                        <span>Partition {item.partitionNumber}</span>
                                                    </div>
                                                </div>
                                                {!isEFI && onDeletePartition && (
                                                    <button
                                                        className="device-item__delete"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeletePartition({
                                                                diskNumber: device.diskNumber,
                                                                partitionNumber: item.partitionNumber,
                                                                partitionType: item.partitionType,
                                                                sizeGB: item.sizeGB,
                                                            });
                                                        }}
                                                        title="Delete partition"
                                                    >
                                                        <Icons.Close />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    const displayName = item.driveLetter
                                        ? (item.label || `Local Disk (${item.driveLetter})`)
                                        : `Partition ${item.partitionNumber}`;

                                    return (
                                        <div
                                            key={key}
                                            className={`device-item ${isSelected ? 'device-item--selected' : ''}`}
                                        >
                                            <button
                                                className="device-item__main"
                                                onClick={() => onDeviceSelect({
                                                    ...device,
                                                    type: 'partition',
                                                    driveLetter: item.driveLetter,
                                                    partitionNumber: item.partitionNumber,
                                                    label: item.label,
                                                    sizeGB: item.sizeGB,
                                                    fileSystem: item.fileSystem,
                                                })}
                                            >
                                                <div className="device-item__icon">
                                                    <Icons.HardDrive />
                                                </div>
                                                <div className="device-item__info">
                                                    <div className="device-item__name">{displayName}</div>
                                                    <div className="device-item__details">
                                                        {item.driveLetter && <><span>{item.driveLetter}</span><span>•</span></>}
                                                        <span>{item.sizeGB} GB</span>
                                                        {item.fileSystem && <><span>•</span><span>{item.fileSystem}</span></>}
                                                    </div>
                                                </div>
                                            </button>
                                            {canDelete && (
                                                <button
                                                    className="device-item__delete"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeletePartition({
                                                            diskNumber: device.diskNumber,
                                                            partitionNumber: item.partitionNumber,
                                                            driveLetter: item.driveLetter,
                                                            partitionType: item.partitionType,
                                                            sizeGB: item.sizeGB,
                                                            label: item.label,
                                                        });
                                                    }}
                                                    title="Delete partition"
                                                >
                                                    <Icons.Close />
                                                </button>
                                            )}
                                        </div>
                                    );
                                }
                            }).filter(Boolean);

                            return [diskHeader, ...layoutItems];
                        })
                    )}
                </div>
            </section>

            {/* Presets Section */}
            <section className="sidebar__section">
                <div className="sidebar__header">
                    <h2 className="sidebar__title">
                        <Icons.Settings />
                        Device Presets
                    </h2>
                </div>

                <div className="preset-list">
                    {presets.map((preset) => {
                        const isSelected = selectedPreset?.id === preset.id;
                        return (
                            <button
                                key={preset.id}
                                className={`preset-item ${isSelected ? 'preset-item--selected' : ''}`}
                                onClick={() => onPresetSelect(preset)}
                            >
                                <div className="preset-item__info">
                                    <div className="preset-item__name">{preset.name}</div>
                                    <div className="preset-item__details">
                                        {preset.fileSystem} • {preset.label}
                                    </div>
                                </div>
                                <Icons.ChevronRight />
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Footer - Author & Donate */}
            <footer className="sidebar__footer">
                <div className="sidebar__author">
                    Made with ❤️ by{' '}
                    <a
                        href="https://github.com/tang-vu"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sidebar__link"
                    >
                        tang-vu
                    </a>
                </div>
                <button
                    className="sidebar__donate-btn"
                    onClick={() => setShowDonateModal(true)}
                >
                    ☕ Support this project
                </button>
            </footer>

            {/* Donate Modal */}
            {showDonateModal && (
                <div className="modal-overlay" onClick={() => setShowDonateModal(false)}>
                    <div className="modal donate-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">☕ Support This Project</h3>
                            <button className="modal__close" onClick={() => setShowDonateModal(false)}>
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal__body">
                            <p style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>
                                If you find this tool useful, consider buying me a coffee!
                            </p>

                            <div className="donate-section">
                                <h4 className="donate-section__title">💰 Crypto (ETH/BNB/Polygon)</h4>
                                <div className="donate-address-box">
                                    <code className="donate-address-full">{walletAddress}</code>
                                    <button
                                        className="btn btn--sm btn--primary"
                                        onClick={() => {
                                            copyAddress();
                                            alert('Wallet address copied!');
                                        }}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="donate-note">
                                    Supports: Ethereum, BNB Chain, Polygon, Arbitrum, Base, and other EVM chains
                                </p>
                            </div>

                            <div className="donate-section">
                                <h4 className="donate-section__title">⭐ Other ways to support</h4>
                                <ul className="donate-list">
                                    <li>Star this project on GitHub</li>
                                    <li>Share with friends who might need it</li>
                                    <li>Report bugs and suggest features</li>
                                </ul>
                            </div>
                        </div>
                        <div className="modal__footer">
                            <button className="btn btn--secondary" onClick={() => setShowDonateModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

export default Sidebar;
