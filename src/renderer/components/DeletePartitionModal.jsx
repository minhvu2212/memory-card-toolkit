import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

function DeletePartitionModal({ isOpen, onClose, partition, onDelete }) {
    const [partitionInfo, setPartitionInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && partition && window.electronAPI) {
            loadPartitionInfo();
        }
    }, [isOpen, partition]);

    const loadPartitionInfo = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const info = await window.electronAPI.disk.getPartitionInfo({
                diskNumber: partition.diskNumber,
                partitionNumber: partition.partitionNumber,
            });
            setPartitionInfo(info);
        } catch (error) {
            console.error('Error loading partition info:', error);
            setError('Failed to load partition information');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!partition) return;

        setIsDeleting(true);
        setError(null);
        try {
            const result = await window.electronAPI.disk.deletePartition({
                diskNumber: partition.diskNumber,
                partitionNumber: partition.partitionNumber,
            });

            if (result.success) {
                alert(result.message || 'Partition deleted successfully!');
                onDelete && onDelete();
                onClose();
            } else {
                setError(result.error || 'Failed to delete partition');
            }
        } catch (error) {
            setError(error.message || 'Failed to delete partition');
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    const partName = partition?.driveLetter
        ? partition.driveLetter
        : `Partition ${partition?.partitionNumber}`;
    const confirmRequired = partition?.driveLetter
        ? partition.driveLetter.replace(':', '').toUpperCase()
        : 'DELETE';
    const isConfirmed = confirmText.toUpperCase() === confirmRequired;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h3 className="modal__title">Delete {partName}</h3>
                    <button className="modal__close" onClick={onClose}>
                        <Icons.Close />
                    </button>
                </div>

                <div className="modal__body">
                    {isLoading ? (
                        <div className="delete-modal__loading">
                            <p>Loading partition information...</p>
                        </div>
                    ) : error ? (
                        <div className="delete-modal__error">
                            <div className="warning-box warning-box--danger">
                                <span className="warning-box__icon">❌</span>
                                <div>
                                    <strong>Error</strong>
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="warning-box warning-box--danger">
                                <span className="warning-box__icon">⚠️</span>
                                <div>
                                    <strong>Warning: This action is IRREVERSIBLE!</strong>
                                    <p>
                                        Deleting this partition will permanently destroy all data on it.
                                        The space will become unallocated and can be used to extend adjacent partitions.
                                    </p>
                                </div>
                            </div>

                            <div className="delete-modal__info">
                                <div className="delete-modal__stat">
                                    <span className="delete-modal__stat-label">Disk</span>
                                    <span className="delete-modal__stat-value">Disk {partition?.diskNumber}</span>
                                </div>
                                <div className="delete-modal__stat">
                                    <span className="delete-modal__stat-label">Partition</span>
                                    <span className="delete-modal__stat-value">{partName}</span>
                                </div>
                                <div className="delete-modal__stat">
                                    <span className="delete-modal__stat-label">Size</span>
                                    <span className="delete-modal__stat-value">
                                        {partitionInfo?.sizeGB || partition?.sizeGB || 0} GB
                                    </span>
                                </div>
                                <div className="delete-modal__stat">
                                    <span className="delete-modal__stat-label">Type</span>
                                    <span className="delete-modal__stat-value">
                                        {partitionInfo?.type || partition?.partitionType || 'Unknown'}
                                    </span>
                                </div>
                            </div>

                            {partition?.partitionType?.includes('Recovery') && (
                                <div className="warning-box warning-box--caution">
                                    <span className="warning-box__icon">💡</span>
                                    <div>
                                        <strong>Recovery Partition</strong>
                                        <p>
                                            This is a Windows Recovery partition. After deletion, you won't be able
                                            to use Windows Recovery Environment from this disk. Make sure you have
                                            a Windows installation USB as backup.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="delete-modal__confirm">
                                <label>
                                    Type <strong>{confirmRequired}</strong> to confirm deletion:
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={confirmRequired}
                                    maxLength={10}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="modal__footer">
                    <button className="btn btn--secondary" onClick={onClose}>
                        Cancel
                    </button>
                    {!isLoading && !error && (
                        <button
                            className="btn btn--danger"
                            onClick={handleDelete}
                            disabled={isDeleting || !isConfirmed}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Partition'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DeletePartitionModal;
