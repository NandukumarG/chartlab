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
        includeMockMetrics: false
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
        inputInterval: document.getElementById('input-interval'),
        inputObsDuration: document.getElementById('input-observation-duration'),

        // Controls
        btnShare: document.getElementById('btn-share-chart'),
        btnStart: document.getElementById('btn-start-monitoring'),
        btnStop: document.getElementById('btn-stop-monitoring'),
        btnEndSharing: document.getElementById('btn-end-sharing'),
        btnResetCrop: document.getElementById('btn-reset-crop'),

        // Video & Canvas
        videoPlaceholder: document.getElementById('video-placeholder'),
        liveVideo: document.getElementById('live-video'),
        cropCanvas: document.getElementById('crop-canvas'),
        cropInfo: document.getElementById('crop-info'),
        previewThumbnail: document.getElementById('preview-thumbnail'),

        // Assessment
        assessmentStaleTag: document.getElementById('assessment-stale-tag'),
        assessmentEmpty: document.getElementById('assessment-card'),
        assessmentDetails: document.getElementById('assessment-details'),
        signalDirection: document.getElementById('signal-direction'),
        metaAsset: document.getElementById('meta-asset'),
        metaTimeframe: document.getElementById('meta-timeframe'),
        metaQuality: document.getElementById('meta-quality'),
        metaTrend: document.getElementById('meta-trend'),
        metaTimeIst: document.getElementById('meta-time-ist'),
        metaAge: document.getElementById('meta-age'),
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
        const includeMock = elements.toggleIncludeMock.checked;
        state.includeMockMetrics = includeMock;

        // Fetch metrics
        try {
            const res = await fetch(`/api/metrics?include_mock=${includeMock}`);
            if (res.ok) {
                const data = await res.json();
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

                elements.btnStart.disabled = false;
                elements.btnEndSharing.disabled = false;
                elements.btnShare.disabled = true;
                elements.btnResetCrop.disabled = false;
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
            elements.dimChangeBanner.classList.remove('hidden');
            syncCropCanvasSize();
            resetCropToFull();
        }
    }

    function endScreenSharing() {
        stopMonitoring();

        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
            state.videoTrack = null;
        }

        elements.liveVideo.srcObject = null;
        elements.liveVideo.classList.add('hidden');
        elements.cropCanvas.classList.add('hidden');
        elements.videoPlaceholder.classList.remove('hidden');

        elements.btnShare.disabled = false;
        elements.btnStart.disabled = true;
        elements.btnStop.disabled = true;
        elements.btnEndSharing.disabled = true;
        elements.btnResetCrop.disabled = true;
        state.cropRect = null;
        elements.cropInfo.textContent = 'None';

        // Clear thumbnail preview
        const ctx = elements.previewThumbnail.getContext('2d');
        ctx.clearRect(0, 0, elements.previewThumbnail.width, elements.previewThumbnail.height);

        setStatus('Idle');
    }

    function startMonitoring() {
        if (!state.stream || !state.videoTrack) {
            alert('Please share your Quotex chart screen first.');
            return;
        }

        const intervalSec = parseInt(elements.inputInterval.value, 10) || 60;
        if (intervalSec < 10) {
            alert('Minimum interval is 10 seconds.');
            return;
        }

        state.isMonitoring = true;
        state.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        state.activeRequestToken++;

        elements.btnStart.disabled = true;
        elements.btnStop.disabled = false;
        elements.btnShare.disabled = true;
        elements.inputInterval.disabled = true;

        setStatus('Analyzing');

        // Immediate first capture
        captureAndAnalyze();

        // Schedule periodic captures
        state.captureIntervalId = setInterval(() => {
            if (state.isMonitoring && !state.isPageHidden) {
                captureAndAnalyze();
            }
        }, intervalSec * 1000);
    }

    function stopMonitoring() {
        if (!state.isMonitoring) return;

        state.isMonitoring = false;
        state.activeRequestToken++; // Invalidate pending responses

        if (state.captureIntervalId) {
            clearInterval(state.captureIntervalId);
            state.captureIntervalId = null;
        }

        elements.btnStart.disabled = !state.stream;
        elements.btnStop.disabled = true;
        elements.inputInterval.disabled = false;

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
                elements.visibilityBanner.classList.remove('hidden');
            }
        } else {
            state.isPageHidden = false;
            // Never resume automatically! Require explicit user click
        }
    });

    elements.btnResumeMonitoring.addEventListener('click', () => {
        elements.visibilityBanner.classList.add('hidden');
        if (state.stream && state.videoTrack && state.videoTrack.readyState === 'live') {
            startMonitoring();
        } else {
            alert('Screen share stream has ended. Please click "Share Chart" again.');
            elements.visibilityBanner.classList.add('hidden');
        }
    });

    elements.btnDismissDimAlert.addEventListener('click', () => {
        elements.dimChangeBanner.classList.add('hidden');
    });

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

    async function captureAndAnalyze() {
        // Enforce single in-flight request guard
        if (state.isAnalyzing) {
            console.log('Skipping capture interval: previous request is still in flight.');
            return;
        }

        if (!state.isMonitoring || state.isPageHidden) return;

        const imageBase64 = getCroppedBase64();
        if (!imageBase64) return;

        updateCropThumbnail();

        state.isAnalyzing = true;
        const currentToken = state.activeRequestToken;
        const currentSession = state.sessionId;
        const captureUtc = new Date().toISOString();

        const payload = {
            image_base64: imageBase64,
            asset: elements.inputAsset.value.trim() || 'EUR/USD OTC',
            timeframe: elements.inputTimeframe.value,
            observation_duration: elements.inputObsDuration.value,
            capture_timestamp: captureUtc,
            session_id: currentSession
        };

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Discard late response if session was stopped or superseded
            if (currentToken !== state.activeRequestToken || !state.isMonitoring) {
                console.log('Discarded late response from stopped/superseded session.');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}`);
            }

            const data = await response.json();
            renderLatestAssessment(data);
            refreshMetricsAndHistory();

        } catch (err) {
            console.error('Analysis request failed:', err);
        } finally {
            state.isAnalyzing = false;
        }
    }

    // -------------------------------------------------------------------------
    // Render Assessment Card
    // -------------------------------------------------------------------------

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
        const dirBadge = elements.signalDirection;
        dirBadge.className = 'direction-badge';
        dirBadge.textContent = a.direction;

        if (a.direction === 'UP') dirBadge.classList.add('direction-up');
        else if (a.direction === 'DOWN') dirBadge.classList.add('direction-down');
        else dirBadge.classList.add('direction-wait');

        elements.metaAsset.textContent = res.asset;
        elements.metaTimeframe.textContent = res.timeframe;
        elements.metaQuality.textContent = a.data_quality;
        elements.metaTrend.textContent = a.trend.toUpperCase();
        elements.metaTimeIst.textContent = formatToIST(res.capture_timestamp);

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
        if (m.insufficient_evidence) {
            elements.evidenceAlert.className = 'alert-box alert-warning';
            elements.evidenceMessage.textContent = m.evidence_message;
        } else {
            elements.evidenceAlert.className = 'alert-box alert-info';
            elements.evidenceMessage.textContent = m.evidence_message;
        }
    }

    // -------------------------------------------------------------------------
    // Render History Tables
    // -------------------------------------------------------------------------

    function renderTradesTable(trades) {
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

    elements.btnShare.addEventListener('click', startScreenSharing);
    elements.btnStart.addEventListener('click', startMonitoring);
    elements.btnStop.addEventListener('click', stopMonitoring);
    elements.btnEndSharing.addEventListener('click', endScreenSharing);
    elements.btnResetCrop.addEventListener('click', resetCropToFull);

    elements.toggleIncludeMock.addEventListener('change', refreshMetricsAndHistory);

    elements.btnExportTrades.addEventListener('click', () => {
        const includeMock = elements.toggleIncludeMock.checked;
        window.location.href = `/api/export/csv?table=trades&include_mock=${includeMock}`;
    });

    elements.btnExportAssessments.addEventListener('click', () => {
        const includeMock = elements.toggleIncludeMock.checked;
        window.location.href = `/api/export/csv?table=assessments&include_mock=${includeMock}`;
    });

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

