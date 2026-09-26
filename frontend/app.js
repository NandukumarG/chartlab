/**
 * ChartLab Demo - Frontend Application Logic
 * Clean, reactive, plain JavaScript implementation with no build step.
 */

(function () {
    'use strict';

    // Application State
    const state = {
        stream: null,
        videoTrack: null,
        isMonitoring: false,
        isAnalyzing: false,
        isCapturing: false,
        abortController: null,
        progressTimerId: null,
        progressPercent: 0,
        currentImageBase64: null,
        sessionId: null,
        activeRequestToken: 0,
        captureIntervalId: null,
        isPageHidden: false,
        wasMonitoringBeforeHidden: false,
        
        // Video and crop geometry
        sourceWidth: 0,
        sourceHeight: 0,
        // Crop in video pixel coordinates: { x, y, width, height }
        cropRect: null,
        isDraggingCrop: false,
        dragStartX: 0,
        dragStartY: 0,
        tempCrop: null,

        // Configuration from backend
        config: {
            mock_mode: true,
            model: "gpt-4o-mini",
            strategy_version: "v1.0.0",
            capture_interval_seconds: 60,
            max_screenshot_age_seconds: 30,
            is_key_configured: false
        },

        // Active selection
        latestAssessment: null,
        includeMockMetrics: false,
        // Real per-pattern win/loss history from this app's own logged trades
        // (backend.metrics breakdowns.by_pattern) - never a fabricated number.
        patternPerformance: {}
    };

    // DOM Elements
    const elements = {
        badgeMode: document.getElementById('badge-mode'),
        badgeStatus: document.getElementById('badge-status'),
        istClock: document.getElementById('ist-clock'),
        visibilityBanner: document.getElementById('visibility-pause-banner'),
        btnResumeMonitoring: document.getElementById('btn-resume-monitoring'),
        dimChangeBanner: document.getElementById('dimension-change-banner'),
        btnDismissDimAlert: document.getElementById('btn-dismiss-dim-alert'),

        // Inputs
        inputAsset: document.getElementById('input-asset'),
        inputTimeframe: document.getElementById('input-timeframe'),
        inputTradeHorizon: document.getElementById('input-trade-horizon'),
        inputInterval: document.getElementById('input-interval'),
        inputObsDuration: document.getElementById('input-observation-duration'),

        // Controls
        btnShare: document.getElementById('btn-share-chart'),
        btnStart: document.getElementById('btn-start-monitoring'),
        btnAnalyze: document.getElementById('btn-analyze-chart'),
        btnStopAnalyze: document.getElementById('btn-stop-analyze'),
        btnEndSharing: document.getElementById('btn-end-sharing'),
        btnResetCrop: document.getElementById('btn-reset-crop'),

        // Video & Canvas
        videoPlaceholder: document.getElementById('video-placeholder'),
        liveVideo: document.getElementById('live-video'),
        cropCanvas: document.getElementById('crop-canvas'),
        cropInfo: document.getElementById('crop-info'),
        previewThumbnail: document.getElementById('preview-thumbnail'),

        // Live operation progress (capture / analyze)
        operationProgress: document.getElementById('operation-progress'),
        operationProgressLabel: document.getElementById('operation-progress-label'),
        operationProgressPercent: document.getElementById('operation-progress-percent'),
        operationProgressFill: document.getElementById('operation-progress-fill'),
        operationProgressText: document.getElementById('operation-progress-text'),

        // Assessment
        assetMismatchBanner: document.getElementById('asset-mismatch-banner'),
        mismatchTypedAsset: document.getElementById('mismatch-typed-asset'),
        mismatchDetectedAsset: document.getElementById('mismatch-detected-asset'),
        btnUseDetectedAsset: document.getElementById('btn-use-detected-asset'),
        assessmentStaleTag: document.getElementById('assessment-stale-tag'),
        assessmentEmpty: document.getElementById('assessment-card'),
        assessmentDetails: document.getElementById('assessment-details'),
        signalDirection: document.getElementById('signal-direction'),
        metaAsset: document.getElementById('meta-asset'),
        metaTimeframe: document.getElementById('meta-timeframe'),
        metaQuality: document.getElementById('meta-quality'),
        metaTrend: document.getElementById('meta-trend'),
        metaChartTime: document.getElementById('meta-chart-time'),
        metaTimeIst: document.getElementById('meta-time-ist'),
        metaAge: document.getElementById('meta-age'),
        metaTradeHorizon: document.getElementById('meta-trade-horizon'),
        metaForecast: document.getElementById('meta-forecast'),
        metaConfidence: document.getElementById('meta-confidence'),
        metaPattern: document.getElementById('meta-pattern'),
        forecastSummary: document.getElementById('forecast-summary'),
        patternsList: document.getElementById('patterns-list'),
        srDetails: document.getElementById('sr-details'),
        reasoning: document.getElementById('assessment-reasoning'),
        entryCond: document.getElementById('assessment-entry'),
        invalidationCond: document.getElementById('assessment-invalidation'),
        limitations: document.getElementById('assessment-limitations'),
        btnOpenLogTrade: document.getElementById('btn-open-log-trade'),

        // Trade Logger Form
        tradeLoggerCard: document.getElementById('trade-log-form-container'),
        btnCloseLogger: document.getElementById('btn-close-logger'),
        tradeForm: document.getElementById('trade-form'),
        tradeDirection: document.getElementById('trade-direction'),
        tradeWasEntered: document.getElementById('trade-was-entered'),
        tradeEntryPrice: document.getElementById('trade-entry-price'),
        tradeStake: document.getElementById('trade-stake'),
        tradeSettlement: document.getElementById('trade-settlement'),
        tradeOutcome: document.getElementById('trade-outcome'),
        tradeNotes: document.getElementById('trade-notes'),

        // Metrics
        toggleIncludeMock: document.getElementById('toggle-include-mock'),
        statWinRate: document.getElementById('stat-win-rate'),
        statWinRateDesc: document.getElementById('stat-win-rate-desc'),
        statWilsonCi: document.getElementById('stat-wilson-ci'),
        statNetPnl: document.getElementById('stat-net-pnl'),
        statMaxDd: document.getElementById('stat-max-dd'),
        statLossStreak: document.getElementById('stat-loss-streak'),
        statCounts: document.getElementById('stat-counts'),
        statExclusions: document.getElementById('stat-exclusions'),
        evidenceAlert: document.getElementById('insufficient-evidence-alert'),
        evidenceMessage: document.getElementById('evidence-message'),

        // History Tables
        tbodyTrades: document.getElementById('tbody-trades'),
        tbodyAssessments: document.getElementById('tbody-assessments'),
        btnExportTrades: document.getElementById('btn-export-trades-csv'),
        btnExportAssessments: document.getElementById('btn-export-assessments-csv'),

        // Modal
        modalUpdateTrade: document.getElementById('modal-update-trade'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        modalTradeId: document.getElementById('modal-trade-id'),
        modalOutcome: document.getElementById('modal-outcome'),
        modalSettlement: document.getElementById('modal-settlement'),
        modalNotes: document.getElementById('modal-notes'),
        btnSaveModalTrade: document.getElementById('btn-save-modal-trade')
    };

    // -------------------------------------------------------------------------
    // Time & IST Display Utilities
    // -------------------------------------------------------------------------

    function formatToIST(dateOrIsoStr) {
        if (!dateOrIsoStr) return "--";
        try {
            const date = new Date(dateOrIsoStr);
            return date.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }) + ' IST';
        } catch (e) {
            return dateOrIsoStr;
        }
    }

    function updateLiveClock() {
        const now = new Date();
        elements.istClock.textContent = now.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }) + ' IST';
    }
    setInterval(updateLiveClock, 1000);
    updateLiveClock();

    // -------------------------------------------------------------------------
    // Status & Badge Management
    // -------------------------------------------------------------------------

    function setStatus(statusName) {
        const badge = elements.badgeStatus;
        if (!badge) return;

        badge.className = 'badge badge-status';
        switch (statusName) {
            case 'Idle':
                badge.classList.add('badge-idle');
                badge.textContent = 'Status: Idle';
                break;
            case 'Sharing':
                badge.classList.add('badge-sharing');
                badge.textContent = 'Status: Sharing';
                break;
            case 'Analyzing':
                badge.classList.add('badge-analyzing');
                badge.textContent = 'Status: Analyzing';
                break;
            case 'Ready':
                badge.classList.add('badge-stopped');
                badge.textContent = 'Status: Ready';
                break;
            case 'Stopped':
                badge.classList.add('badge-stopped');
                badge.textContent = 'Status: Stopped';
                break;
            case 'Error':
                badge.classList.add('badge-error');
                badge.textContent = 'Status: Error';
                break;
        }
    }

    function setButtonDisabled(button, disabled) {
        if (button) {
            button.disabled = disabled;
        }
    }

    function updateSystemModeBadge() {
        if (state.config.mock_mode) {
            elements.badgeMode.className = 'badge badge-mock';
            elements.badgeMode.textContent = 'Mock Mode (Simulation)';
        } else {
            elements.badgeMode.className = 'badge badge-live';
            elements.badgeMode.textContent = `Live OpenAI (${state.config.model})`;
        }
    }

    // -------------------------------------------------------------------------
    // Backend Config & Data Fetching
    // -------------------------------------------------------------------------

    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                state.config = await res.json();
                updateSystemModeBadge();
                if (state.config.capture_interval_seconds) {
                    elements.inputInterval.value = state.config.capture_interval_seconds;
                }
            }
        } catch (err) {
            console.error('Failed to load system config:', err);
        }
    }

    async function refreshMetricsAndHistory() {
        if (!elements.toggleIncludeMock) {
            return;
        }

        const includeMock = elements.toggleIncludeMock.checked;
        state.includeMockMetrics = includeMock;

        // Fetch metrics
        try {
            const res = await fetch(`/api/metrics?include_mock=${includeMock}`);
            if (res.ok) {
                const data = await res.json();
                state.patternPerformance = (data.breakdowns && data.breakdowns.by_pattern) || {};
                renderMetrics(data);
            }
        } catch (err) {
            console.error('Failed to load metrics:', err);
        }

        // Fetch trade history
        try {
            const res = await fetch(`/api/trades?limit=50&include_mock=${includeMock}`);
            if (res.ok) {
                const trades = await res.json();
                renderTradesTable(trades);
            }
        } catch (err) {
            console.error('Failed to load trades:', err);
        }

        // Fetch assessment history
        try {
            const res = await fetch(`/api/assessments?limit=50&include_mock=${includeMock}`);
            if (res.ok) {
                const assessments = await res.json();
                renderAssessmentsTable(assessments);
            }
        } catch (err) {
            console.error('Failed to load assessments:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Screen Capture & Lifecycle
    // -------------------------------------------------------------------------

    async function startScreenSharing() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: 5, max: 15 },
                    cursor: 'never'
                },
                audio: false
            });

            state.stream = stream;
            state.videoTrack = stream.getVideoTracks()[0];

            elements.liveVideo.srcObject = stream;
            elements.liveVideo.classList.remove('hidden');
            elements.cropCanvas.classList.remove('hidden');
            elements.videoPlaceholder.classList.add('hidden');

            // Handle user clicking "Stop sharing" in browser native chrome bar
            state.videoTrack.onended = () => {
                endScreenSharing();
            };

            elements.liveVideo.onloadedmetadata = () => {
                state.sourceWidth = elements.liveVideo.videoWidth;
                state.sourceHeight = elements.liveVideo.videoHeight;
                initCropCanvas();
                resetCropToFull();
                updateCropThumbnail();

                setButtonDisabled(elements.btnStart, false);
                setButtonDisabled(elements.btnEndSharing, false);
                setButtonDisabled(elements.btnShare, true);
                setButtonDisabled(elements.btnResetCrop, false);
                setStatus('Sharing');
            };

            // Detect resolution/dimension changes
            state.videoTrack.onmute = checkDimensionChanges;
            state.videoTrack.onunmute = checkDimensionChanges;
            window.addEventListener('resize', syncCropCanvasSize);

        } catch (err) {
            console.error('Screen sharing cancelled or denied:', err);
            setStatus('Idle');
        }
    }

    function checkDimensionChanges() {
        if (!elements.liveVideo || elements.liveVideo.videoWidth === 0) return;
        if (elements.liveVideo.videoWidth !== state.sourceWidth || elements.liveVideo.videoHeight !== state.sourceHeight) {
            state.sourceWidth = elements.liveVideo.videoWidth;
            state.sourceHeight = elements.liveVideo.videoHeight;
            if (elements.dimChangeBanner) {
                elements.dimChangeBanner.classList.remove('hidden');
            }
            syncCropCanvasSize();
            resetCropToFull();
        }
    }

    function endScreenSharing() {
        stopMonitoring();
        hideOperationProgress();
        state.isCapturing = false;

        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
            state.videoTrack = null;
        }

        elements.liveVideo.srcObject = null;
        elements.liveVideo.classList.add('hidden');
        elements.cropCanvas.classList.add('hidden');
        elements.videoPlaceholder.classList.remove('hidden');

        setButtonDisabled(elements.btnShare, false);
        setButtonDisabled(elements.btnStart, true);
        setButtonDisabled(elements.btnAnalyze, true);
        setButtonDisabled(elements.btnStopAnalyze, true);
        setButtonDisabled(elements.btnEndSharing, true);
        setButtonDisabled(elements.btnResetCrop, true);
        state.cropRect = null;
        state.currentImageBase64 = null;
        if (elements.cropInfo) {
            elements.cropInfo.textContent = 'None';
        }

        // Clear thumbnail preview
        const ctx = elements.previewThumbnail.getContext('2d');
        ctx.clearRect(0, 0, elements.previewThumbnail.width, elements.previewThumbnail.height);

        setStatus('Idle');
    }

    // -------------------------------------------------------------------------
    // Live Operation Progress (real % feedback for capture / analyze)
    // -------------------------------------------------------------------------

    function clearOperationProgressTimer() {
        if (state.progressTimerId) {
            clearInterval(state.progressTimerId);
            state.progressTimerId = null;
        }
    }

    function showOperationProgress(label) {
        clearOperationProgressTimer();
        if (!elements.operationProgress) return;
        elements.operationProgress.classList.remove('hidden');
        updateOperationProgress(0, label);
    }

    function updateOperationProgress(percent, text) {
        const safePercent = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        state.progressPercent = safePercent;
        if (elements.operationProgressPercent) elements.operationProgressPercent.textContent = `${safePercent}%`;
        if (elements.operationProgressFill) elements.operationProgressFill.style.width = `${safePercent}%`;
        if (text && elements.operationProgressText) elements.operationProgressText.textContent = text;
    }

    function hideOperationProgress(delayMs = 0) {
        clearOperationProgressTimer();
        setTimeout(() => {
            if (elements.operationProgress) elements.operationProgress.classList.add('hidden');
        }, delayMs);
    }

    // Non-blocking crop encode: toBlob() lets the browser paint the 0% state
    // before doing the pixel work, instead of freezing the UI on a synchronous
    // toDataURL() call and only "faking" a loader afterwards.
    function getCroppedBase64Async() {
        return new Promise((resolve, reject) => {
            if (!elements.liveVideo || state.sourceWidth === 0 || !state.cropRect) {
                resolve(null);
                return;
            }
            const offscreen = document.createElement('canvas');
            offscreen.width = state.cropRect.width;
            offscreen.height = state.cropRect.height;
            const offCtx = offscreen.getContext('2d');
            offCtx.drawImage(
                elements.liveVideo,
                state.cropRect.x, state.cropRect.y, state.cropRect.width, state.cropRect.height,
                0, 0, state.cropRect.width, state.cropRect.height
            );
            offscreen.toBlob((blob) => {
                if (!blob) {
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.85);
        });
    }

    function captureScreenshot() {
        if (!state.stream || !state.videoTrack) {
            alert('Please share your chart screen first.');
            return;
        }
        if (state.isCapturing) return;

        state.isCapturing = true;
        setButtonDisabled(elements.btnStart, true);
        setStatus('Analyzing');
        showOperationProgress('Capturing screenshot');
        updateOperationProgress(15, 'Grabbing current video frame...');

        // Yield to the browser so the 0%/15% state actually paints before
        // the (potentially heavier) frame-grab and encode work runs.
        requestAnimationFrame(() => {
            updateOperationProgress(40, 'Encoding cropped frame to JPEG...');
            getCroppedBase64Async()
                .then((imageBase64) => {
                    if (!imageBase64) {
                        hideOperationProgress();
                        alert('No chart image was captured. Please select a crop first.');
                        return;
                    }

                    state.currentImageBase64 = imageBase64;
                    state.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                    state.activeRequestToken++;
                    updateCropThumbnail();

                    if (elements.assessmentEmpty) {
                        elements.assessmentEmpty.classList.add('hidden');
                    }
                    if (elements.assessmentDetails) {
                        elements.assessmentDetails.classList.remove('hidden');
                    }

                    updateOperationProgress(100, 'Screenshot captured.');
                    hideOperationProgress(300);
                    renderCaptureReadyState();

                    setButtonDisabled(elements.btnAnalyze, false);
                    setButtonDisabled(elements.btnStopAnalyze, true);
                    setStatus('Ready');
                })
                .catch((err) => {
                    console.error('Screenshot capture failed:', err);
                    hideOperationProgress();
                    setStatus('Error');
                    alert('Failed to capture the screenshot. Please try again.');
                })
                .finally(() => {
                    state.isCapturing = false;
                    setButtonDisabled(elements.btnStart, false);
                });
        });
    }

    function renderCaptureReadyState() {
        if (elements.assetMismatchBanner) elements.assetMismatchBanner.classList.add('hidden');
        const el = elements.forecastSummary || document.getElementById('forecast-summary');
        if (el) {
            el.innerHTML = 'Screenshot captured. Use <strong>Analyze Chart</strong> to process the selected crop and forecast the next 5 minutes.';
        }

        if (elements.signalDirection) {
            elements.signalDirection.textContent = 'READY';
            elements.signalDirection.className = 'direction-badge direction-wait';
        }
        if (elements.metaForecast) {
            elements.metaForecast.textContent = 'Pending analysis';
        }
        if (elements.metaConfidence) {
            elements.metaConfidence.textContent = 'Waiting';
        }
    }

    function stopMonitoring() {
        if (state.captureIntervalId) {
            clearInterval(state.captureIntervalId);
            state.captureIntervalId = null;
        }
        state.isMonitoring = false;
        state.activeRequestToken++;
        setButtonDisabled(elements.btnStart, !state.stream);
        setButtonDisabled(elements.btnAnalyze, !state.currentImageBase64);
        setButtonDisabled(elements.btnStopAnalyze, true);
        setStatus(state.stream ? 'Stopped' : 'Idle');
    }

    // -------------------------------------------------------------------------
    // Visibility Page Inactivity Safeguard
    // -------------------------------------------------------------------------

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            state.isPageHidden = true;
            if (state.isMonitoring) {
                state.wasMonitoringBeforeHidden = true;
                stopMonitoring();
                if (elements.visibilityBanner) {
                    elements.visibilityBanner.classList.remove('hidden');
                }
            }
        } else {
            state.isPageHidden = false;
        }
    });

    if (elements.btnResumeMonitoring) {
        elements.btnResumeMonitoring.addEventListener('click', () => {
            if (elements.visibilityBanner) {
                elements.visibilityBanner.classList.add('hidden');
            }
            if (state.stream && state.videoTrack && state.videoTrack.readyState === 'live') {
                setStatus('Sharing');
            } else {
                alert('Screen share stream has ended. Please click "Share Screen" again.');
                if (elements.visibilityBanner) {
                    elements.visibilityBanner.classList.add('hidden');
                }
            }
        });
    }

    if (elements.btnDismissDimAlert) {
        elements.btnDismissDimAlert.addEventListener('click', () => {
            if (elements.dimChangeBanner) {
                elements.dimChangeBanner.classList.add('hidden');
            }
        });
    }

    // -------------------------------------------------------------------------
    // Interactive Crop Canvas & Geometry Mapping
    // -------------------------------------------------------------------------

    function syncCropCanvasSize() {
        const video = elements.liveVideo;
        const canvas = elements.cropCanvas;
        if (!video || !canvas) return;

        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawCropOverlay();
    }

    function initCropCanvas() {
        syncCropCanvasSize();
        const canvas = elements.cropCanvas;

        canvas.onmousedown = (e) => {
            const rect = canvas.getBoundingClientRect();
            state.isDraggingCrop = true;
            state.dragStartX = e.clientX - rect.left;
            state.dragStartY = e.clientY - rect.top;
            state.tempCrop = { x: state.dragStartX, y: state.dragStartY, w: 0, h: 0 };
        };

        canvas.onmousemove = (e) => {
            if (!state.isDraggingCrop) return;
            const rect = canvas.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;

            state.tempCrop = {
                x: Math.min(state.dragStartX, curX),
                y: Math.min(state.dragStartY, curY),
                w: Math.abs(curX - state.dragStartX),
                h: Math.abs(curY - state.dragStartY)
            };
            drawCropOverlay();
        };

        window.onmouseup = () => {
            if (!state.isDraggingCrop) return;
            state.isDraggingCrop = false;
            if (state.tempCrop && state.tempCrop.w > 20 && state.tempCrop.h > 20) {
                mapCanvasCropToVideoPixels(state.tempCrop);
            }
            state.tempCrop = null;
            drawCropOverlay();
            updateCropThumbnail();
        };
    }

    function resetCropToFull() {
        state.cropRect = {
            x: 0,
            y: 0,
            width: state.sourceWidth,
            height: state.sourceHeight
        };
        elements.cropInfo.textContent = `Full (${state.sourceWidth} × ${state.sourceHeight} px)`;
        drawCropOverlay();
        updateCropThumbnail();
    }

    function mapCanvasCropToVideoPixels(canvasBox) {
        const canvas = elements.cropCanvas;
        const scaleX = state.sourceWidth / canvas.width;
        const scaleY = state.sourceHeight / canvas.height;

        state.cropRect = {
            x: Math.round(canvasBox.x * scaleX),
            y: Math.round(canvasBox.y * scaleY),
            width: Math.round(canvasBox.w * scaleX),
            height: Math.round(canvasBox.h * scaleY)
        };

        // Clamp inside bounds
        state.cropRect.x = Math.max(0, Math.min(state.cropRect.x, state.sourceWidth - 10));
        state.cropRect.y = Math.max(0, Math.min(state.cropRect.y, state.sourceHeight - 10));
        state.cropRect.width = Math.min(state.cropRect.width, state.sourceWidth - state.cropRect.x);
        state.cropRect.height = Math.min(state.cropRect.height, state.sourceHeight - state.cropRect.y);

        elements.cropInfo.textContent = `${state.cropRect.width} × ${state.cropRect.height} px (at ${state.cropRect.x}, ${state.cropRect.y})`;
    }

    function drawCropOverlay() {
        const canvas = elements.cropCanvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let activeBox = null;
        if (state.tempCrop) {
            activeBox = state.tempCrop;
        } else if (state.cropRect && state.sourceWidth > 0) {
            const scaleX = canvas.width / state.sourceWidth;
            const scaleY = canvas.height / state.sourceHeight;
            activeBox = {
                x: state.cropRect.x * scaleX,
                y: state.cropRect.y * scaleY,
                w: state.cropRect.width * scaleX,
                h: state.cropRect.height * scaleY
            };
        }

        if (!activeBox) return;

        // Dark mask over unselected region
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Clear cropped hole
        ctx.clearRect(activeBox.x, activeBox.y, activeBox.w, activeBox.h);

        // Border & corner guidelines
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(activeBox.x, activeBox.y, activeBox.w, activeBox.h);

        // Crop label
        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillText('Analysis Crop Boundary', activeBox.x + 6, activeBox.y + 16);
    }

    function getCroppedBase64() {
        if (!elements.liveVideo || state.sourceWidth === 0 || !state.cropRect) return null;

        const offscreen = document.createElement('canvas');
        offscreen.width = state.cropRect.width;
        offscreen.height = state.cropRect.height;
        const offCtx = offscreen.getContext('2d');

        offCtx.drawImage(
            elements.liveVideo,
            state.cropRect.x, state.cropRect.y, state.cropRect.width, state.cropRect.height,
            0, 0, state.cropRect.width, state.cropRect.height
        );

        // Return high quality JPEG
        return offscreen.toDataURL('image/jpeg', 0.85);
    }

    function updateCropThumbnail() {
        const base64 = getCroppedBase64();
        if (!base64) return;

        const img = new Image();
        img.onload = () => {
            const thumbCanvas = elements.previewThumbnail;
            const ctx = thumbCanvas.getContext('2d');
            ctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);

            // Maintain aspect ratio inside 320x180 thumbnail box
            const hRatio = thumbCanvas.width / img.width;
            const vRatio = thumbCanvas.height / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const centerShiftX = (thumbCanvas.width - img.width * ratio) / 2;
            const centerShiftY = (thumbCanvas.height - img.height * ratio) / 2;

            ctx.drawImage(img, 0, 0, img.width, img.height,
                centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
        };
        img.src = base64;
    }

    // -------------------------------------------------------------------------
    // Capture & Analysis Execution
    // -------------------------------------------------------------------------

    async function analyzeCurrentScreenshot() {
        if (state.isAnalyzing) {
            console.log('A chart analysis is already running.');
            return;
        }

        const imageBase64 = state.currentImageBase64 || getCroppedBase64();
        if (!imageBase64) {
            alert('Capture a screenshot first before analyzing.');
            return;
        }

        state.isAnalyzing = true;
        setStatus('Analyzing');
        setButtonDisabled(elements.btnAnalyze, true);
        setButtonDisabled(elements.btnStopAnalyze, false);
        showOperationProgress('Analyzing chart');
        updateOperationProgress(12, 'Sending crop to the analysis engine...');
        state.progressTimerId = setInterval(() => {
            const next = Math.min(90, (state.progressPercent || 12) + 6);
            updateOperationProgress(next, 'Reading candles, trend, and patterns...');
            if (next >= 90) {
                clearOperationProgressTimer();
            }
        }, 260);
        const currentToken = state.activeRequestToken;
        const currentSession = state.sessionId || ('sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
        const captureUtc = new Date().toISOString();

        const payload = {
            image_base64: imageBase64,
            asset: elements.inputAsset && elements.inputAsset.value ? elements.inputAsset.value.trim() : 'EUR/USD OTC',
            timeframe: elements.inputTimeframe ? elements.inputTimeframe.value : '1m',
            observation_duration: elements.inputObsDuration ? elements.inputObsDuration.value : '1m',
            trade_horizon: elements.inputTradeHorizon ? elements.inputTradeHorizon.value : '1m',
            capture_timestamp: captureUtc,
            session_id: currentSession
        };

        let abortController = null;

        try {
            abortController = new AbortController();
            state.abortController = abortController;
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });

            if (currentToken !== state.activeRequestToken) {
                console.log('Discarded stale analysis response.');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}`);
            }

            const data = await response.json();
            renderLatestAssessment(data);
            renderAnalysisOverlay(data.analysis);
            refreshMetricsAndHistory();
            updateOperationProgress(100, 'Analysis complete.');
            hideOperationProgress(300);
            setStatus('Ready');

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Chart analysis was stopped by the user.');
                hideOperationProgress();
                setStatus('Ready');
                return;
            }
            console.error('Analysis request failed:', err);
            hideOperationProgress();
            setStatus('Error');
        } finally {
            state.isAnalyzing = false;
            state.abortController = null;
            setButtonDisabled(elements.btnAnalyze, false);
            setButtonDisabled(elements.btnStopAnalyze, true);
        }
    }

    function stopAnalyzeCurrentScreenshot() {
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }
        hideOperationProgress();
        state.activeRequestToken++;
        state.isAnalyzing = false;
        setButtonDisabled(elements.btnAnalyze, false);
        setButtonDisabled(elements.btnStopAnalyze, true);
        setStatus('Ready');
    }

    // -------------------------------------------------------------------------
    // Render Assessment Card
    // -------------------------------------------------------------------------

    // Loosely normalize an asset label for comparison only (not for display):
    // strips punctuation/whitespace and case so "EUR/USD OTC" and "eur usd otc"
    // compare equal, while genuinely different tickers still differ.
    function normalizeAssetLabel(label) {
        return (label || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function updateAssetMismatchBanner(typedAsset, detectedAsset) {
        if (!elements.assetMismatchBanner) return;
        const hasMismatch = detectedAsset
            && normalizeAssetLabel(detectedAsset)
            && normalizeAssetLabel(detectedAsset) !== normalizeAssetLabel(typedAsset);

        if (!hasMismatch) {
            elements.assetMismatchBanner.classList.add('hidden');
            return;
        }
        if (elements.mismatchTypedAsset) elements.mismatchTypedAsset.textContent = typedAsset || '(blank)';
        if (elements.mismatchDetectedAsset) elements.mismatchDetectedAsset.textContent = detectedAsset;
        elements.assetMismatchBanner.dataset.detectedAsset = detectedAsset;
        elements.assetMismatchBanner.classList.remove('hidden');
    }

    if (elements.btnUseDetectedAsset) {
        elements.btnUseDetectedAsset.addEventListener('click', () => {
            const detected = elements.assetMismatchBanner && elements.assetMismatchBanner.dataset.detectedAsset;
            if (detected && elements.inputAsset) {
                elements.inputAsset.value = detected;
            }
            elements.assetMismatchBanner.classList.add('hidden');
        });
    }

    // Real historical performance for the pattern(s) identified in an
    // assessment, aggregated from this app's own logged trade outcomes.
    // Returns null when no pattern names were identified at all.
    function getPatternHistoryFor(patternNames) {
        if (!patternNames || patternNames.length === 0) return null;
        const perf = state.patternPerformance || {};
        let wins = 0, losses = 0, pnl = 0, matched = [];

        patternNames.forEach((name) => {
            const stat = perf[name];
            if (stat) {
                wins += stat.wins;
                losses += stat.losses;
                pnl += stat.pnl;
                matched.push(name);
            }
        });

        const total = wins + losses;
        return {
            total,
            wins,
            losses,
            pnl: Math.round(pnl * 100) / 100,
            winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
            insufficientEvidence: total < 30,
            matchedPatterns: matched
        };
    }

    function renderBacktestLine(history) {
        if (!history || history.total === 0) {
            return 'No historical demo trades logged yet for this exact pattern. Log outcomes via "Record Demo Trade" to build a real track record.';
        }
        const evidenceNote = history.insufficientEvidence
            ? ' (sample below 30 trades - not statistically reliable yet)'
            : '';
        const pnlStr = (history.pnl >= 0 ? '+' : '') + `$${history.pnl.toFixed(2)}`;
        return `${history.wins}W / ${history.losses}L across ${history.total} of your logged trades = ${history.winRate}% win rate${evidenceNote}. Net PnL: ${pnlStr}.`;
    }

    function renderAnalysisOverlay(analysis) {
        const thumb = elements.previewThumbnail;
        if (!thumb) return;
        const ctx = thumb.getContext('2d');
        const width = thumb.width;
        const height = thumb.height;
        ctx.clearRect(0, 0, width, height);

        const patternText = (analysis && analysis.candle_pattern) ? analysis.candle_pattern : 'Pattern scan';
        const direction = (analysis && analysis.direction) ? analysis.direction : 'WAIT';
        const biasColor = direction === 'UP' ? '#22c55e' : (direction === 'DOWN' ? '#ef4444' : '#f59e0b');

        ctx.strokeStyle = biasColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, height - 30);
        ctx.lineTo(width - 30, height - 30);
        ctx.moveTo(30, 30);
        ctx.lineTo(30, height - 40);
        ctx.stroke();

        ctx.fillStyle = biasColor;
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText(direction, width - 90, 28);

        ctx.fillStyle = '#dbeafe';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(patternText.substring(0, 28), 40, height - 20);
    }

    function renderLatestAssessment(res) {
        state.latestAssessment = res;
        elements.assessmentEmpty.classList.add('hidden');
        elements.assessmentDetails.classList.remove('hidden');

        // Stale warning indicator
        if (res.is_stale) {
            elements.assessmentStaleTag.classList.remove('hidden');
            elements.metaAge.textContent = `${res.screenshot_age_seconds}s (LATE - STALE)`;
            elements.metaAge.classList.add('text-danger');
        } else {
            elements.assessmentStaleTag.classList.add('hidden');
            elements.metaAge.textContent = `${res.screenshot_age_seconds}s (Fresh)`;
            elements.metaAge.classList.remove('text-danger');
        }

        const a = res.analysis;
        const predictedDirection = a.direction || 'WAIT';
        const dirBadge = elements.signalDirection;
        dirBadge.className = 'direction-badge';
        dirBadge.textContent = predictedDirection;

        if (predictedDirection === 'UP') dirBadge.classList.add('direction-up');
        else if (predictedDirection === 'DOWN') dirBadge.classList.add('direction-down');
        else dirBadge.classList.add('direction-wait');

        const patternNames = (a.patterns || []).map((p) => p.name).filter(Boolean);
        const history = getPatternHistoryFor(patternNames);
        updateAssetMismatchBanner(res.asset, a.currency_pair);

        elements.metaAsset.textContent = a.currency_pair || res.asset;
        elements.metaTimeframe.textContent = res.timeframe;
        elements.metaQuality.textContent = a.data_quality;
        elements.metaTrend.textContent = a.trend.toUpperCase();
        elements.metaChartTime.textContent = a.chart_time ? formatToIST(a.chart_time) : formatToIST(res.capture_timestamp);
        elements.metaTimeIst.textContent = formatToIST(res.capture_timestamp);
        elements.metaTradeHorizon.textContent = a.trade_horizon || elements.inputTradeHorizon.value;
        elements.metaForecast.textContent = predictedDirection;
        elements.metaConfidence.textContent = (!history || history.total === 0)
            ? 'No logged trades yet'
            : `${history.winRate}% (${history.wins}W/${history.losses}L, n=${history.total})${history.insufficientEvidence ? ' - thin sample' : ''}`;
        elements.metaPattern.textContent = a.candle_pattern || 'Not classified';

        const outlookText = a.next_5_min_outlook
            || (res.is_mock ? 'Not generated in Mock Mode - enable live analysis for real AI reasoning.' : 'No outlook provided by the model.');

        elements.forecastSummary.innerHTML = `
            <strong>AI Read:</strong> ${predictedDirection}<br>
            <strong>Next 5-minute outlook:</strong> ${outlookText}<br>
            <strong>Real backtest (your logged trades):</strong> ${renderBacktestLine(history)}
        `;

        // Patterns
        if (a.patterns && a.patterns.length > 0) {
            elements.patternsList.innerHTML = a.patterns.map(p => `
                <div class="pattern-item">
                    <div class="pattern-item-header">
                        <span>${p.name}</span>
                        <span class="pattern-chip ${p.status === 'confirmed' ? 'chip-confirmed' : 'chip-forming'}">${p.status}</span>
                    </div>
                    <div class="text-secondary">${p.evidence}</div>
                </div>
            `).join('');
        } else {
            elements.patternsList.innerHTML = '<span class="text-muted">No textbook patterns identified.</span>';
        }

        // Support & Resistance
        if (a.support_resistance && (a.support_resistance.support_level || a.support_resistance.resistance_level)) {
            const sr = a.support_resistance;
            elements.srDetails.innerHTML = `
                <div><strong>Resistance:</strong> ${sr.resistance_level || 'None'} | <strong>Support:</strong> ${sr.support_level || 'None'}</div>
                <div class="text-secondary" style="margin-top:2px;">${sr.summary || ''}</div>
            `;
        } else {
            elements.srDetails.innerHTML = '<span class="text-muted">No explicit horizontal bounds detected.</span>';
        }

        elements.reasoning.textContent = a.reasoning || '--';
        elements.entryCond.textContent = a.entry_condition || 'None / Indecision';
        elements.invalidationCond.textContent = a.invalidation_condition || 'None';
        elements.limitations.textContent = a.limitations || 'None documented.';

        // Prepare trade logging button
        elements.tradeDirection.value = (a.direction === 'UP' || a.direction === 'DOWN') ? a.direction : 'UP';
    }

    // -------------------------------------------------------------------------
    // Manual Demo Trade Logging
    // -------------------------------------------------------------------------

    elements.btnOpenLogTrade.addEventListener('click', () => {
        elements.tradeLoggerCard.classList.remove('hidden');
        if (state.latestAssessment) {
            const dir = state.latestAssessment.analysis.direction;
            if (dir === 'UP' || dir === 'DOWN') {
                elements.tradeDirection.value = dir;
            }
        }
    });

    elements.btnCloseLogger.addEventListener('click', () => {
        elements.tradeLoggerCard.classList.add('hidden');
    });

    elements.tradeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tradeData = {
            assessment_id: state.latestAssessment ? state.latestAssessment.id : null,
            session_id: state.latestAssessment ? state.latestAssessment.session_id : null,
            asset: elements.inputAsset.value.trim() || 'EUR/USD OTC',
            timeframe: elements.inputTimeframe.value,
            observation_duration: elements.inputObsDuration.value,
            was_entered: elements.tradeWasEntered.value === 'true',
            direction: elements.tradeDirection.value,
            entry_price: elements.tradeEntryPrice.value ? parseFloat(elements.tradeEntryPrice.value) : null,
            entry_time: new Date().toISOString(),
            stake: parseFloat(elements.tradeStake.value) || 10.0,
            settlement_amount: parseFloat(elements.tradeSettlement.value) || 0.0,
            outcome: elements.tradeOutcome.value,
            notes: elements.tradeNotes.value.trim() || null,
            is_mock: state.latestAssessment ? state.latestAssessment.is_mock : state.config.mock_mode
        };

        try {
            const res = await fetch('/api/trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tradeData)
            });

            if (res.ok) {
                elements.tradeLoggerCard.classList.add('hidden');
                elements.tradeNotes.value = '';
                refreshMetricsAndHistory();
            } else {
                alert('Failed to save trade record.');
            }
        } catch (err) {
            console.error('Error recording demo trade:', err);
        }
    });

    // -------------------------------------------------------------------------
    // Render Performance Metrics
    // -------------------------------------------------------------------------

    function renderMetrics(m) {
        if (!elements.statWinRate || !elements.statWinRateDesc || !elements.statWilsonCi || !elements.statNetPnl || !elements.statMaxDd || !elements.statLossStreak || !elements.statCounts || !elements.statExclusions) {
            return;
        }

        elements.statWinRate.textContent = `${m.win_rate_percent}%`;
        elements.statWinRateDesc.textContent = m.win_rate_denominator_description;

        elements.statWilsonCi.textContent = `[${m.wilson_95_ci.lower_percent}% - ${m.wilson_95_ci.upper_percent}%]`;
        
        const pnlEl = elements.statNetPnl;
        pnlEl.textContent = (m.net_demo_pnl >= 0 ? '+' : '') + `$${m.net_demo_pnl.toFixed(2)}`;
        pnlEl.className = 'metric-value ' + (m.net_demo_pnl >= 0 ? 'text-success' : 'text-danger');

        elements.statMaxDd.textContent = `$${m.max_drawdown.toFixed(2)}`;
        elements.statLossStreak.textContent = m.longest_losing_streak;
        elements.statCounts.textContent = `W: ${m.wins} | L: ${m.losses} | D: ${m.draws}`;
        elements.statExclusions.textContent = `Skipped: ${m.skipped} | Unres: ${m.unresolved} | Wait: ${m.wait_assessments_excluded}`;

        // Insufficient evidence alert badge
        if (elements.evidenceAlert && elements.evidenceMessage) {
            if (m.insufficient_evidence) {
                elements.evidenceAlert.className = 'alert-box alert-warning';
                elements.evidenceMessage.textContent = m.evidence_message;
            } else {
                elements.evidenceAlert.className = 'alert-box alert-info';
                elements.evidenceMessage.textContent = m.evidence_message;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Render History Tables
    // -------------------------------------------------------------------------

    function renderTradesTable(trades) {
        if (!elements.tbodyTrades) return;

        if (!trades || trades.length === 0) {
            elements.tbodyTrades.innerHTML = '<tr><td colspan="8" class="text-center">No trades recorded yet.</td></tr>';
            return;
        }

        elements.tbodyTrades.innerHTML = trades.map(t => {
            const pnlClass = t.pnl > 0 ? 'text-success' : (t.pnl < 0 ? 'text-danger' : '');
            const outcomeClass = t.outcome === 'WIN' ? 'text-success' : (t.outcome === 'LOSS' ? 'text-danger' : '');
            const pnlStr = (t.pnl >= 0 ? '+' : '') + `$${t.pnl.toFixed(2)}`;

            return `
                <tr>
                    <td>${formatToIST(t.entry_time || t.created_at)}</td>
                    <td><strong>${t.asset}</strong> <small>(${t.observation_duration})</small></td>
                    <td><span class="${t.direction === 'UP' ? 'text-success' : 'text-danger'} font-mono">${t.direction}</span></td>
                    <td>$${t.stake.toFixed(2)}</td>
                    <td>$${t.settlement_amount.toFixed(2)}</td>
                    <td class="${pnlClass} font-mono">${pnlStr}</td>
                    <td><strong class="${outcomeClass}">${t.outcome}</strong></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="window.ChartLab.openUpdateModal('${t.id}', '${t.outcome}', ${t.settlement_amount}, '${escapeQuotes(t.notes || '')}')">
                            Edit
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderAssessmentsTable(assessments) {
        if (!elements.tbodyAssessments) return;

        if (!assessments || assessments.length === 0) {
            elements.tbodyAssessments.innerHTML = '<tr><td colspan="9" class="text-center">No assessments generated yet.</td></tr>';
            return;
        }

        elements.tbodyAssessments.innerHTML = assessments.map(a => {
            const dirClass = a.direction === 'UP' ? 'text-success' : (a.direction === 'DOWN' ? 'text-danger' : 'text-muted');
            return `
                <tr>
                    <td>${formatToIST(a.capture_timestamp)}</td>
                    <td>${a.asset}</td>
                    <td>${a.timeframe}</td>
                    <td><strong class="${dirClass}">${a.direction}</strong></td>
                    <td>${a.data_quality}</td>
                    <td>${a.trend}</td>
                    <td>${a.screenshot_age_seconds}s ${a.is_stale ? '⚠️' : ''}</td>
                    <td><small>${a.model}</small></td>
                    <td><small>${truncate(a.reasoning, 85)}</small></td>
                </tr>
            `;
        }).join('');
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '...' : str;
    }

    function escapeQuotes(str) {
        return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    // -------------------------------------------------------------------------
    // Modal Edit Trade Outcome
    // -------------------------------------------------------------------------

    window.ChartLab = {
        openUpdateModal: function (tradeId, outcome, settlement, notes) {
            elements.modalTradeId.value = tradeId;
            elements.modalOutcome.value = outcome || 'UNRESOLVED';
            elements.modalSettlement.value = settlement || 0.0;
            elements.modalNotes.value = notes || '';
            elements.modalUpdateTrade.classList.remove('hidden');
        }
    };

    elements.btnCloseModal.addEventListener('click', () => {
        elements.modalUpdateTrade.classList.add('hidden');
    });

    elements.btnSaveModalTrade.addEventListener('click', async () => {
        const tradeId = elements.modalTradeId.value;
        const outcome = elements.modalOutcome.value;
        const settlement = parseFloat(elements.modalSettlement.value) || 0.0;
        const notes = elements.modalNotes.value.trim();

        try {
            const res = await fetch(`/api/trades/${tradeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    outcome: outcome,
                    settlement_amount: settlement,
                    notes: notes
                })
            });

            if (res.ok) {
                elements.modalUpdateTrade.classList.add('hidden');
                refreshMetricsAndHistory();
            } else {
                alert('Failed to update trade outcome.');
            }
        } catch (err) {
            console.error('Error updating trade:', err);
        }
    });

    // -------------------------------------------------------------------------
    // Event Listeners & Tab Switching
    // -------------------------------------------------------------------------

    if (elements.btnShare) elements.btnShare.addEventListener('click', startScreenSharing);
    if (elements.btnStart) elements.btnStart.addEventListener('click', captureScreenshot);
    if (elements.btnAnalyze) elements.btnAnalyze.addEventListener('click', analyzeCurrentScreenshot);
    if (elements.btnStopAnalyze) elements.btnStopAnalyze.addEventListener('click', stopAnalyzeCurrentScreenshot);
    if (elements.btnEndSharing) elements.btnEndSharing.addEventListener('click', endScreenSharing);
    if (elements.btnResetCrop) elements.btnResetCrop.addEventListener('click', resetCropToFull);

    if (elements.toggleIncludeMock) {
        elements.toggleIncludeMock.addEventListener('change', refreshMetricsAndHistory);
    }

    if (elements.btnExportTrades) {
        elements.btnExportTrades.addEventListener('click', () => {
            const includeMock = elements.toggleIncludeMock ? elements.toggleIncludeMock.checked : false;
            window.location.href = `/api/export/csv?table=trades&include_mock=${includeMock}`;
        });
    }

    if (elements.btnExportAssessments) {
        elements.btnExportAssessments.addEventListener('click', () => {
            const includeMock = elements.toggleIncludeMock ? elements.toggleIncludeMock.checked : false;
            window.location.href = `/api/export/csv?table=assessments&include_mock=${includeMock}`;
        });
    }

    // Tabs switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const target = document.getElementById(btn.getAttribute('data-tab'));
            if (target) target.classList.add('active');
        });
    });

    // Initialize
    loadConfig();
    refreshMetricsAndHistory();

})();

