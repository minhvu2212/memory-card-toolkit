import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

function ExtendModal({ isOpen, onClose, device, onExtend }) {
    const [resizeLimits, setResizeLimits] = useState(null);
    const [canExtendInfo, setCanExtendInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExtending, setIsExtending] = useState(false);
    const [extendToMax, setExtendToMax] = useState(true);
    const [customSizeMB, setCustomSizeMB] = useState(0);

    useEffect(() => {
        if (isOpen && device?.driveLetter && window.electronAPI) {
            loadExtendInfo();
        }
    }, [isOpen, device]);

    const loadExtendInfo = async () => {
        setIsLoading(true);
        try {
            const [limits, canExtend] = await Promise.all([
                window.electronAPI.disk.getResizeLimits(device.driveLetter),
                window.electronAPI.disk.canExtend(device.driveLetter),
            ]);
            setResizeLimits(limits);
            setCanExtendInfo(canExtend);
            if (canExtend.availableSpaceGB) {
                setCustomSizeMB(Math.floor(canExtend.availableSpaceGB * 1024));
            }
        } catch (error) {
            console.error('Error loading extend info:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExtend = async () => {
        if (!device?.driveLetter) return;

        setIsExtending(true);
        try {
            const sizeInMB = extendToMax ? null : customSizeMB;
            await window.electronAPI.disk.extendVolume({
                driveLetter: device.driveLetter,
                sizeInMB,
            });
            alert(`Volume ${device.driveLetter} extended successfully!`);
            onExtend && onExtend();
            onClose();
        } catch (error) {
            alert(`Failed to extend: ${error.message}`);
        } finally {
            setIsExtending(false);
        }
    };

    if (!isOpen) return null;

    const canExtend = canExtendInfo?.canExtend;
    const availableGB = canExtendInfo?.availableSpaceGB || 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal extend-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h3 className="modal__title">Extend Volume {device?.driveLetter}</h3>
                    <button className="modal__close" onClick={onClose}>
                        <Icons.Close />
                    </button>
                </div>

                <div className="modal__body">
                    {isLoading ? (
                        <div className="extend-modal__loading">
                            <p>Checking available space...</p>
                        </div>
                    ) : !canExtend ? (
                        <div className="extend-modal__error">
                            <div className="warning-box">
                                <span className="warning-box__icon">⚠️</span>
                                <div>
                                    <strong>Cannot Extend</strong>
                                    <p>{canExtendInfo?.reason || 'No adjacent unallocated space available'}</p>
                                </div>
                            </div>
                            <p className="extend-modal__tip">
                                To extend this volume, you need unallocated space immediately after this partition.
                                Try shrinking or deleting the adjacent partition first.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="extend-modal__info">
                                <div className="extend-modal__stat">
                                    <span className="extend-modal__stat-label">Current Size</span>
                                    <span className="extend-modal__stat-value">{resizeLimits?.minSizeGB || 0} GB</span>
                                </div>
                                <div className="extend-modal__stat">
                                    <span className="extend-modal__stat-label">Available to Add</span>
                                    <span className="extend-modal__stat-value extend-modal__stat-value--highlight">{availableGB} GB</span>
                                </div>
                                <div className="extend-modal__stat">
                                    <span className="extend-modal__stat-label">Max Size</span>
                                    <span className="extend-modal__stat-value">{resizeLimits?.maxSizeGB || 0} GB</span>
                                </div>
                            </div>

                            <div className="extend-modal__options">
                                <label className="extend-modal__option">
                                    <input
                                        type="radio"
                                        checked={extendToMax}
                                        onChange={() => setExtendToMax(true)}
                                    />
                                    <span>Extend to maximum ({resizeLimits?.maxSizeGB} GB)</span>
                                </label>
                                <label className="extend-modal__option">
                                    <input
                                        type="radio"
                                        checked={!extendToMax}
                                        onChange={() => setExtendToMax(false)}
                                    />
                                    <span>Extend by specific size:</span>
                                </label>
                                {!extendToMax && (
                                    <div className="extend-modal__size-input">
                                        <input
                                            type="number"
                                            value={customSizeMB}
                                            onChange={(e) => setCustomSizeMB(Math.max(0, parseInt(e.target.value) || 0))}
                                            min={0}
                                            max={availableGB * 1024}
                                        />
                                        <span>MB</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="modal__footer">
                    <button className="btn btn--secondary" onClick={onClose}>
                        Cancel
                    </button>
                    {canExtend && (
                        <button
                            className="btn btn--primary"
                            onClick={handleExtend}
                            disabled={isExtending}
                        >
                            {isExtending ? 'Extending...' : 'Extend Volume'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ExtendModal;
