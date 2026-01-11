import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

function ShrinkModal({ isOpen, onClose, device, onShrink }) {
    const [resizeLimits, setResizeLimits] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isShrinking, setIsShrinking] = useState(false);
    const [shrinkSizeMB, setShrinkSizeMB] = useState(0);
    const [confirmText, setConfirmText] = useState('');

    useEffect(() => {
        if (isOpen && device?.driveLetter && window.electronAPI) {
            loadResizeLimits();
        }
    }, [isOpen, device]);

    const loadResizeLimits = async () => {
        setIsLoading(true);
        try {
            const limits = await window.electronAPI.disk.getResizeLimits(device.driveLetter);
            setResizeLimits(limits);
            // Default to 10GB or half of shrinkable space
            const shrinkable = (limits.maxSize - limits.minSize) / (1024 * 1024);
            setShrinkSizeMB(Math.min(10240, Math.floor(shrinkable / 2)));
        } catch (error) {
            console.error('Error loading resize limits:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleShrink = async () => {
        if (!device?.driveLetter || shrinkSizeMB <= 0) return;

        setIsShrinking(true);
        try {
            await window.electronAPI.disk.shrinkVolume({
                driveLetter: device.driveLetter,
                sizeInMB: shrinkSizeMB,
            });
            alert(`Volume ${device.driveLetter} shrunk by ${shrinkSizeMB} MB successfully!`);
            onShrink && onShrink();
            onClose();
        } catch (error) {
            alert(`Failed to shrink: ${error.message}`);
        } finally {
            setIsShrinking(false);
        }
    };

    if (!isOpen) return null;

    const maxShrinkMB = resizeLimits
        ? Math.floor((resizeLimits.maxSize - resizeLimits.minSize) / (1024 * 1024))
        : 0;
    const driveLetter = device?.driveLetter?.replace(':', '') || '';
    const isConfirmed = confirmText.toUpperCase() === driveLetter.toUpperCase();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal shrink-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h3 className="modal__title">Shrink Volume {device?.driveLetter}</h3>
                    <button className="modal__close" onClick={onClose}>
                        <Icons.Close />
                    </button>
                </div>

                <div className="modal__body">
                    {isLoading ? (
                        <div className="shrink-modal__loading">
                            <p>Analyzing volume...</p>
                        </div>
                    ) : maxShrinkMB <= 0 ? (
                        <div className="shrink-modal__error">
                            <div className="warning-box">
                                <span className="warning-box__icon">⚠️</span>
                                <div>
                                    <strong>Cannot Shrink</strong>
                                    <p>This volume cannot be shrunk. It may be full or have unmovable files.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="warning-box warning-box--caution">
                                <span className="warning-box__icon">⚠️</span>
                                <div>
                                    <strong>Warning</strong>
                                    <p>Shrinking a volume will create unallocated space. Make sure you have a backup.</p>
                                </div>
                            </div>

                            <div className="shrink-modal__info">
                                <div className="shrink-modal__stat">
                                    <span className="shrink-modal__stat-label">Current Size</span>
                                    <span className="shrink-modal__stat-value">{resizeLimits?.maxSizeGB || 0} GB</span>
                                </div>
                                <div className="shrink-modal__stat">
                                    <span className="shrink-modal__stat-label">Minimum Size</span>
                                    <span className="shrink-modal__stat-value">{resizeLimits?.minSizeGB || 0} GB</span>
                                </div>
                                <div className="shrink-modal__stat">
                                    <span className="shrink-modal__stat-label">Available to Shrink</span>
                                    <span className="shrink-modal__stat-value shrink-modal__stat-value--highlight">
                                        {Math.round(maxShrinkMB / 1024 * 100) / 100} GB
                                    </span>
                                </div>
                            </div>

                            <div className="shrink-modal__size">
                                <label className="shrink-modal__size-label">Amount to shrink:</label>
                                <div className="shrink-modal__size-input">
                                    <input
                                        type="number"
                                        value={shrinkSizeMB}
                                        onChange={(e) => setShrinkSizeMB(Math.min(maxShrinkMB, Math.max(0, parseInt(e.target.value) || 0)))}
                                        min={0}
                                        max={maxShrinkMB}
                                    />
                                    <span>MB</span>
                                </div>
                                <input
                                    type="range"
                                    value={shrinkSizeMB}
                                    onChange={(e) => setShrinkSizeMB(parseInt(e.target.value))}
                                    min={0}
                                    max={maxShrinkMB}
                                    className="shrink-modal__slider"
                                />
                            </div>

                            <div className="shrink-modal__confirm">
                                <label>Type <strong>{driveLetter}</strong> to confirm:</label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={driveLetter}
                                    maxLength={1}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="modal__footer">
                    <button className="btn btn--secondary" onClick={onClose}>
                        Cancel
                    </button>
                    {maxShrinkMB > 0 && (
                        <button
                            className="btn btn--danger"
                            onClick={handleShrink}
                            disabled={isShrinking || !isConfirmed || shrinkSizeMB <= 0}
                        >
                            {isShrinking ? 'Shrinking...' : `Shrink by ${shrinkSizeMB} MB`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ShrinkModal;
