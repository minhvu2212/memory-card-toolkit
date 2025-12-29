import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { fileSystemOptions } from '../data/presets';

function FormatModal({ device, preset, onClose, onComplete }) {
    const [fileSystem, setFileSystem] = useState(preset?.fileSystem || 'FAT32');
    const [label, setLabel] = useState(preset?.label || device?.label || 'SDCARD');
    const [quickFormat, setQuickFormat] = useState(true);
    const [confirmText, setConfirmText] = useState('');
    const [isFormatting, setIsFormatting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('idle'); // idle, formatting, success, error
    const [error, setError] = useState(null);

    const expectedConfirmText = device?.driveLetter?.replace(':', '') || '';
    const isConfirmed = confirmText.toUpperCase() === expectedConfirmText.toUpperCase();

    useEffect(() => {
        if (preset) {
            setFileSystem(preset.fileSystem);
            setLabel(preset.label);
        }
    }, [preset]);

    const handleFormat = async () => {
        if (!isConfirmed) return;

        setIsFormatting(true);
        setStatus('formatting');
        setProgress(10);

        try {
            // Simulate progress for UX (actual format doesn't report progress)
            const progressInterval = setInterval(() => {
                setProgress((prev) => Math.min(prev + 10, 90));
            }, 500);

            if (window.electronAPI) {
                await window.electronAPI.disk.format({
                    driveLetter: device.driveLetter,
                    fileSystem,
                    label,
                    quickFormat,
                    diskNumber: device.diskNumber,
                });
            } else {
                // Simulate format for development
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }

            clearInterval(progressInterval);
            setProgress(100);
            setStatus('success');

            // Auto-close after success
            setTimeout(() => {
                onComplete();
            }, 1500);
        } catch (err) {
            setStatus('error');
            setError(err.message || 'Format failed');
            setIsFormatting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h3 className="modal__title">
                        {status === 'success' ? '✓ Format Complete' : 'Format Drive'}
                    </h3>
                    {status === 'idle' && (
                        <button className="modal__close" onClick={onClose}>
                            <Icons.Close />
                        </button>
                    )}
                </div>

                <div className="modal__body">
                    {status === 'idle' && (
                        <>
                            {/* Warning */}
                            <div className="warning-box warning-box--danger">
                                <div className="warning-box__icon">
                                    <Icons.AlertTriangle />
                                </div>
                                <div className="warning-box__content">
                                    <div className="warning-box__title">Warning: All data will be erased!</div>
                                    <div className="warning-box__text">
                                        Formatting {device?.driveLetter} ({device?.label}) will permanently delete all data on this drive.
                                    </div>
                                </div>
                            </div>

                            {/* File System Selection */}
                            <div className="form-group">
                                <label className="form-label">File System</label>
                                <select
                                    className="form-select"
                                    value={fileSystem}
                                    onChange={(e) => setFileSystem(e.target.value)}
                                >
                                    {fileSystemOptions.map((fs) => (
                                        <option key={fs.id} value={fs.name}>
                                            {fs.name} - {fs.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Volume Label */}
                            <div className="form-group">
                                <label className="form-label">Volume Label</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value.toUpperCase().slice(0, 11))}
                                    placeholder="SDCARD"
                                    maxLength={11}
                                />
                            </div>

                            {/* Quick Format */}
                            <div className="form-group">
                                <label className="form-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={quickFormat}
                                        onChange={(e) => setQuickFormat(e.target.checked)}
                                    />
                                    <span>Quick Format (faster, recommended)</span>
                                </label>
                            </div>

                            {/* Confirmation */}
                            <div className="form-group">
                                <label className="form-label">
                                    Type <strong>{expectedConfirmText}</strong> to confirm
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={`Type ${expectedConfirmText} to confirm`}
                                    style={{
                                        borderColor: confirmText && !isConfirmed ? 'var(--color-danger)' : undefined,
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {status === 'formatting' && (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}>
                            <div className="loading-spinner" style={{ margin: '0 auto var(--spacing-lg)' }} />
                            <p style={{ marginBottom: 'var(--spacing-md)' }}>
                                Formatting {device?.driveLetter} as {fileSystem}...
                            </p>
                            <div className="progress-bar">
                                <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-muted" style={{ marginTop: 'var(--spacing-sm)' }}>
                                {progress}% complete
                            </p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}>
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                background: 'rgba(0, 230, 118, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto var(--spacing-lg)',
                                color: 'var(--color-success)',
                            }}>
                                <Icons.CheckCircle />
                            </div>
                            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                                Format Successful!
                            </p>
                            <p className="text-muted">
                                {device?.driveLetter} has been formatted as {fileSystem}
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl) 0' }}>
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                background: 'rgba(255, 82, 82, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto var(--spacing-lg)',
                                color: 'var(--color-danger)',
                            }}>
                                <Icons.AlertCircle />
                            </div>
                            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-danger)' }}>
                                Format Failed
                            </p>
                            <p className="text-muted">{error}</p>
                        </div>
                    )}
                </div>

                <div className="modal__footer">
                    {status === 'idle' && (
                        <>
                            <button className="btn btn--secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="btn btn--danger"
                                onClick={handleFormat}
                                disabled={!isConfirmed}
                            >
                                <Icons.Zap />
                                Format Drive
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <button className="btn btn--secondary" onClick={onClose}>
                                Close
                            </button>
                            <button className="btn btn--primary" onClick={() => setStatus('idle')}>
                                Try Again
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default FormatModal;
