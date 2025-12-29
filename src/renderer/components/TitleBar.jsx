import React from 'react';
import { Icons } from './Icons';

function TitleBar() {
    const handleMinimize = () => {
        window.electronAPI?.minimize();
    };

    const handleMaximize = () => {
        window.electronAPI?.maximize();
    };

    const handleClose = () => {
        window.electronAPI?.close();
    };

    return (
        <div className="titlebar">
            <div className="titlebar__title">
                <Icons.MemoryCard />
                <span>Memory Card Toolkit</span>
            </div>

            <div className="titlebar__controls">
                <button
                    className="titlebar__btn"
                    onClick={handleMinimize}
                    title="Minimize"
                >
                    <Icons.Minimize />
                </button>
                <button
                    className="titlebar__btn"
                    onClick={handleMaximize}
                    title="Maximize"
                >
                    <Icons.Maximize />
                </button>
                <button
                    className="titlebar__btn titlebar__btn--close"
                    onClick={handleClose}
                    title="Close"
                >
                    <Icons.Close />
                </button>
            </div>
        </div>
    );
}

export default TitleBar;
