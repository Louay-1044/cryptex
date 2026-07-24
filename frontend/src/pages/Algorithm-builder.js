import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Blockly from 'blockly';
import Navbar from '../Components/Navbar';
import { toolbox } from '../blockly/toolbox';
import { getCode } from '../blockly/codegen';
import '../blockly/blocks';
import { loadCurrencies, refreshCurrencyDropdowns } from '../blockly/blocks';
import '../styles/Algorithm-builder.css';

const API = 'http://localhost:8000';

const STATUS = {
    RUN: { label: 'Running',  colour: '#3DBE7A' },
    PSE: { label: 'Paused',   colour: '#E8A838' },
    STP: { label: 'Stopped',  colour: '#8888aa' },
    ERR: { label: 'Error',    colour: '#E85454' },
    IDL: { label: 'Ready',    colour: '#5B8CFF' },
};

const getAuthToken = () => localStorage.getItem('token') ?? '';

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Token ${getAuthToken()}`,
});

const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
};

const AlgorithmBuilder = () => {
    const blocklyDiv = useRef(null);
    const workspaceRef = useRef(null);
    const pollRef = useRef(null);

    const [statusKey, setStatusKey] = useState('IDL');
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [output, setOutput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [toast, setToast] = useState('');
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currenciesLoaded, setCurrenciesLoaded] = useState(false);

    const isRunning = statusKey === 'RUN';
    const isPaused = statusKey === 'PSE';

    // ── Load currencies ──
    useEffect(() => {
        const init = async () => {
            await loadCurrencies();
            setCurrenciesLoaded(true);
        };
        init();
    }, []);

    // ── Blockly init ──
    useEffect(() => {
        if (!currenciesLoaded) return;

        workspaceRef.current = Blockly.inject(blocklyDiv.current, {
            toolbox,
            scrollbars: true,
            trashcan: true,
            zoom: { controls: true, wheel: true },
            grid: { spacing: 24, length: 4, colour: '#1e1e38', snap: true },
            theme: Blockly.Theme.defineTheme('darkAlgo', {
                base: Blockly.Themes.Classic,
                componentStyles: {
                    workspaceBackgroundColour: '#080810',
                    toolboxBackgroundColour:   '#0f0f1e',
                    toolboxForegroundColour:   '#c8c8e8',
                    flyoutBackgroundColour:    '#13132a',
                    flyoutForegroundColour:    '#c8c8e8',
                    flyoutOpacity:             0.97,
                    scrollbarColour:           '#2a2a4a',
                },
            }),
        });

        refreshCurrencyDropdowns();

        const restoreWorkspace = async () => {
            try {
                const res = await fetch(`${API}/api/algorithm/fetch/`, { headers: authHeaders() });
                if (!res.ok) return;
                const data = await res.json();
                if (data.blocks_json && Object.keys(data.blocks_json).length > 0) {
                    Blockly.serialization.workspaces.load(data.blocks_json, workspaceRef.current);
                    // Refresh dropdowns again after loading workspace
                    refreshCurrencyDropdowns();
                }
                // Restore status if algorithm is still active
                if (data.algorithm_status) {
                    setStatusKey(data.algorithm_status);
                }
            } catch {
                // no saved state
            }
        };

        restoreWorkspace();

        return () => {
            clearInterval(pollRef.current);
            workspaceRef.current?.dispose();
        };
    }, [currenciesLoaded]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const startPolling = useCallback(() => {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/algorithm/status/`, { headers: authHeaders() });
                const data = await res.json();

                setStatusKey(data.status);
                setEndTime(data.end_time);

                if (data.status === 'ERR') {
                    setErrorMsg(data.error_message ?? 'Unknown error');
                    clearInterval(pollRef.current);
                }

                if (data.status === 'STP') {
                    clearInterval(pollRef.current);
                }
            } catch {
                clearInterval(pollRef.current);
            }
        }, 2000);
    }, []);

    const handleRun = async () => {
        setErrorMsg('');

        const code = getCode(workspaceRef.current);
        const blocksJson = Blockly.serialization.workspaces.save(workspaceRef.current);
        setOutput(code);

        try {
            const res = await fetch(`${API}/api/algorithm/start/`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ source: code, blocks_json: blocksJson}),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            setStatusKey(data.status ?? 'RUN');
            setStartTime(data.start_time);
            setEndTime(null);
            startPolling();
        } catch (err) {
            setStatusKey('ERR');
            setErrorMsg(err.message);
        }
    };

    const handlePause = async () => {
        try {
            // 🔥 STEP 1: get real backend status
            const statusRes = await fetch(`${API}/api/algorithm/status/`, {
                headers: authHeaders(),
            });

            const statusData = await statusRes.json();

            if (!statusRes.ok) {
                throw new Error(statusData.error || "Failed to fetch status");
            }

            const backendStatus = statusData.status;

            // 🔥 STEP 2: block invalid calls
            if (backendStatus !== 'RUN' && backendStatus !== 'PSE') {
                showToast("Algorithm has been Paused");
                setStatusKey(backendStatus); // sync UI
                return;
            }

            // 🔥 STEP 3: now it's safe to pause/resume
            const res = await fetch(`${API}/api/algorithm/pause/`, {
                method: 'POST',
                headers: authHeaders(),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            // 🔥 STEP 4: update UI correctly
            if (data.success?.toLowerCase().includes('paused')) {
                setStatusKey('PSE');
                clearInterval(pollRef.current);
            } else {
                setStatusKey('RUN');
                startPolling();
            }

        } catch (err) {
            showToast(`Pause failed: ${err.message}`);
        }
    };

    const handleStop = async () => {
        try {
            // 🔥 STEP 1: sync with backend
            const statusRes = await fetch(`${API}/api/algorithm/status/`, {
                headers: authHeaders(),
            });

            const statusData = await statusRes.json();

            if (!statusRes.ok) {
                throw new Error(statusData.error || "Failed to fetch status");
            }

            const backendStatus = statusData.status;

            // 🔥 STEP 2: block invalid stop
            if (backendStatus !== 'RUN' && backendStatus !== 'PSE') {
                showToast("Algorithm has been stopped");
                setStatusKey(backendStatus); // sync UI
                return;
            }

            // 🔥 STEP 3: safe to stop
            const res = await fetch(`${API}/api/algorithm/stop/`, {
                method: 'POST',
                headers: authHeaders(),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            // 🔥 STEP 4: update UI
            setStatusKey('STP');
            clearInterval(pollRef.current);
            showToast('Stopped');

        } catch (err) {
            showToast(`Stop failed: ${err.message}`);
        }
    };

    const handleSave = async () => {
        if (!workspaceRef.current) return;

        setSaving(true);

        try {
            const blocksJson = Blockly.serialization.workspaces.save(workspaceRef.current);

            const res = await fetch(`${API}/api/algorithm/save/`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ blocks_json: blocksJson }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Save failed");
            }

            showToast(`Algorithm ${data.status}`);
        } catch (err) {
            showToast(`Save failed: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleClear = () => {
        workspaceRef.current?.clear();
        setOutput('');
        setErrorMsg('');
        setStatusKey('IDL');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(errorMsg || output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusCfg = STATUS[statusKey] ?? STATUS.IDL;

    return (
        <>

            <div className="algo-root">
                <Navbar />

                <header className="algo-header">
                    <div className="algo-title">
                        <h1>Algorithm Builder</h1>
                        <p>Drag blocks · Generate code · Deploy strategy</p>
                    </div>

                    <div className="algo-status-badge">
                        <span className="algo-status-dot" style={{ background: statusCfg.colour }} />
                        <span style={{ color: statusCfg.colour }}>{statusCfg.label}</span>
                    </div>

                    <div className="algo-actions">
                        <button className="algo-btn" onClick={handleRun}>▶ Run</button>
                        <button
                            className="algo-btn"
                            onClick={handlePause}
                            disabled={!isRunning && !isPaused}
                            >
                            ⏸ Pause
                        </button>
                        <button
                            className="algo-btn"
                            onClick={handleStop}
                            disabled={!isRunning && !isPaused}
                            >
                            ■ Stop
                        </button>
                        <button
                            className="algo-btn"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            💾 {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="algo-btn" onClick={handleClear}>✕ Clear</button>
                    </div>
                </header>

                <div className="algo-body">
                    <div className="algo-canvas">
                        <div className="algo-canvas-inner" ref={blocklyDiv} />
                    </div>

                    <aside className="algo-sidebar">
                        <div className="algo-sidebar-header">
                            <span>{errorMsg ? 'Error' : 'Generated Code'}</span>
                            {(output || errorMsg) && (
                                <button className="algo-copy-btn" onClick={handleCopy}>
                                    {copied ? '✓ Copied' : 'Copy'}
                                </button>
                            )}
                        </div>

                        <div className="algo-sidebar-body">
                            {errorMsg ? (
                                <pre className="algo-output-error">{errorMsg}</pre>
                            ) : output ? (
                                <pre className="algo-output-code">{output}</pre>
                            ) : (
                                <p className="algo-output-placeholder">
                                    Build your algorithm<br />then press Run.
                                </p>
                            )}
                        </div>
                    </aside>
                </div>

                {toast && <div className="algo-toast">{toast}</div>}
            </div>
        </>
    );
};

export default AlgorithmBuilder;
