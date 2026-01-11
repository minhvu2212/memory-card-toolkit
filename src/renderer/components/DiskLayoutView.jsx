import React from 'react';

// Color map for different partition types
const getPartitionColor = (item) => {
    if (item.type === 'unallocated') return '#2d3436';
    if (item.partitionType === 'System') return '#6c5ce7';
    if (item.partitionType === 'Recovery') return '#fd79a8';
    if (item.driveLetter === 'C:') return '#00b894';
    if (item.driveLetter) return '#0984e3';
    return '#636e72';
};

function DiskLayoutView({ layout, onSelectPartition, selectedPartition }) {
    if (!layout || !layout.items || layout.items.length === 0) {
        return (
            <div className="disk-layout disk-layout--empty">
                <p>No partition information available</p>
            </div>
        );
    }

    const totalSize = layout.diskSize || 1;

    return (
        <div className="disk-layout">
            <div className="disk-layout__header">
                <h4 className="disk-layout__title">Disk {layout.diskNumber} Layout</h4>
                <span className="disk-layout__size">{layout.diskSizeGB} GB</span>
            </div>

            <div className="disk-layout__bar">
                {layout.items.map((item, index) => {
                    const widthPercent = Math.max((item.size / totalSize) * 100, 2);
                    const isSelected = selectedPartition &&
                        selectedPartition.partitionNumber === item.partitionNumber &&
                        selectedPartition.type === item.type;

                    return (
                        <div
                            key={index}
                            className={`disk-layout__segment ${item.type === 'unallocated' ? 'disk-layout__segment--unallocated' : ''} ${isSelected ? 'disk-layout__segment--selected' : ''}`}
                            style={{
                                width: `${widthPercent}%`,
                                backgroundColor: getPartitionColor(item),
                            }}
                            onClick={() => onSelectPartition && onSelectPartition(item)}
                            title={item.type === 'unallocated'
                                ? `Unallocated: ${item.sizeGB} GB`
                                : `${item.driveLetter || 'No letter'} (${item.label || item.partitionType}) - ${item.sizeGB} GB`
                            }
                        >
                            <span className="disk-layout__segment-label">
                                {item.type === 'unallocated'
                                    ? 'Free'
                                    : (item.driveLetter || item.partitionType?.charAt(0) || '?')
                                }
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="disk-layout__legend">
                {layout.items.map((item, index) => (
                    <div
                        key={index}
                        className={`disk-layout__legend-item ${selectedPartition === item ? 'disk-layout__legend-item--selected' : ''}`}
                        onClick={() => onSelectPartition && onSelectPartition(item)}
                    >
                        <span
                            className="disk-layout__legend-color"
                            style={{ backgroundColor: getPartitionColor(item) }}
                        />
                        <span className="disk-layout__legend-text">
                            {item.type === 'unallocated'
                                ? `Unallocated (${item.sizeGB} GB)`
                                : `${item.driveLetter || 'No letter'} ${item.label ? `"${item.label}"` : ''} (${item.sizeGB} GB)`
                            }
                        </span>
                    </div>
                ))}
            </div>

            {layout.hasUnallocated && (
                <div className="disk-layout__info">
                    <span className="disk-layout__info-icon">ℹ️</span>
                    <span>Unallocated space available - can extend adjacent partitions</span>
                </div>
            )}
        </div>
    );
}

export default DiskLayoutView;
