import React from 'react';
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
}) {
    return (
        <aside className="sidebar">
            {/* Devices Section */}
            <section className="sidebar__section">
                <div className="sidebar__header">
                    <h2 className="sidebar__title">
                        <Icons.UsbDrive />
                        Devices
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
                                    Connect a USB drive or SD card
                                </div>
                            </div>
                        </div>
                    ) : (
                        devices.map((device, index) => {
                            const key = device.driveLetter || `disk-${device.diskNumber}` || index;
                            const isSelected = selectedDevice?.driveLetter === device.driveLetter &&
                                selectedDevice?.diskNumber === device.diskNumber;

                            return (
                                <button
                                    key={key}
                                    className={`device-item ${isSelected ? 'device-item--selected' : ''}`}
                                    onClick={() => onDeviceSelect(device)}
                                >
                                    <div className="device-item__icon">
                                        <Icons.MemoryCard />
                                    </div>
                                    <div className="device-item__info">
                                        <div className="device-item__name">
                                            {device.label || 'USB Disk'}
                                        </div>
                                        <div className="device-item__details">
                                            {device.driveLetter ? (
                                                <>
                                                    <span>{device.driveLetter}</span>
                                                    <span>•</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Disk {device.diskNumber}</span>
                                                    <span>•</span>
                                                </>
                                            )}
                                            <span>{device.size} GB</span>
                                            {device.hasLetter === false && (
                                                <span className="device-item__badge device-item__badge--warning">
                                                    NO LETTER
                                                </span>
                                            )}
                                            {device.hasLetter !== false && device.fileSystem && (
                                                <span className="device-item__badge">{device.fileSystem}</span>
                                            )}
                                            {device.status === 'Offline' && (
                                                <span className="device-item__badge device-item__badge--danger">
                                                    OFFLINE
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
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
                    {presets.map((preset) => (
                        <button
                            key={preset.id}
                            className={`preset-item ${selectedPreset?.id === preset.id ? 'preset-item--selected' : ''
                                }`}
                            onClick={() => onPresetSelect(preset)}
                            disabled={!selectedDevice}
                            title={!selectedDevice ? 'Select a device first' : preset.notes}
                        >
                            <div className="preset-item__info">
                                <div className="preset-item__name">{preset.name}</div>
                                <div className="preset-item__desc">{preset.description}</div>
                            </div>
                            <Icons.ChevronRight />
                        </button>
                    ))}
                </div>
            </section>
        </aside>
    );
}

export default Sidebar;
