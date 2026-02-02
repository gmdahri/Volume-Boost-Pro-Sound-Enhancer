// Volume Boost Pro - Enhanced Popup Logic
document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    const resetBtn = document.getElementById('resetBtn');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const knobContainer = document.getElementById('knobContainer');
    const knobProgress = document.getElementById('knobProgress');
    const muteBtn = document.getElementById('muteBtn');

    let isMuted = false;
    let savedVolume = 100;

    // Load initial state
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Sync with content script
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VOLUME' });
        if (response && response.level) {
            updateUI(response.level);
        }
    } catch (e) {
        console.log('Content script not ready or no audio found');
    }

    // ═══════════════════════════════════════════
    // CIRCULAR KNOB INTERACTION
    // ═══════════════════════════════════════════

    let isDragging = false;
    let knobRect = null;

    function getAngleFromEvent(e) {
        const rect = knobRect || knobContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);

        // Normalize angle: start from bottom-left (135deg), go clockwise to bottom-right (45deg)
        angle = angle + 90; // Rotate so 0 is at top
        if (angle < 0) angle += 360;

        // Map angle to value (135deg to 405deg -> 0 to 800)
        // Usable range is from 135deg to 45deg (going clockwise = 270deg)
        let normalizedAngle = angle - 135;
        if (normalizedAngle < 0) normalizedAngle += 360;

        // Clamp to usable range (270deg)
        if (normalizedAngle > 270) {
            normalizedAngle = normalizedAngle > 315 ? 0 : 270;
        }

        const value = Math.round((normalizedAngle / 270) * 800);
        return Math.max(0, Math.min(800, value));
    }

    knobContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        knobRect = knobContainer.getBoundingClientRect();
        handleKnobMove(e);
    });

    knobContainer.addEventListener('touchstart', (e) => {
        isDragging = true;
        knobRect = knobContainer.getBoundingClientRect();
        handleKnobMove(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) handleKnobMove(e);
    });

    document.addEventListener('touchmove', (e) => {
        if (isDragging) handleKnobMove(e);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        knobRect = null;
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
        knobRect = null;
    });

    function handleKnobMove(e) {
        const level = getAngleFromEvent(e);
        updateUI(level);
        applyVolume(level);
    }

    // ═══════════════════════════════════════════
    // MUTE FUNCTIONALITY
    // ═══════════════════════════════════════════

    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;

        if (isMuted) {
            savedVolume = parseInt(volumeSlider.value);
            updateUI(0);
            applyVolume(0);
            muteBtn.classList.add('muted');
            muteBtn.innerHTML = '<span class="mute-icon">🔇</span><span>Muted</span>';
        } else {
            updateUI(savedVolume);
            applyVolume(savedVolume);
            muteBtn.classList.remove('muted');
            muteBtn.innerHTML = '<span class="mute-icon">🔊</span><span>Sound On</span>';
        }
    });

    // ═══════════════════════════════════════════
    // PRESET BUTTONS
    // ═══════════════════════════════════════════

    presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Ripple effect
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);

            let level = 100;
            const mode = btn.dataset.mode;

            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            switch (mode) {
                case 'cinema': level = 150; break;
                case 'bass': level = 200; break;
                case 'vocal': level = 120; break;
                default: level = 100;
            }

            isMuted = false;
            muteBtn.classList.remove('muted');
            muteBtn.innerHTML = '<span class="mute-icon">🔊</span><span>Sound On</span>';

            updateUI(level);
            applyVolume(level);
        });
    });

    // ═══════════════════════════════════════════
    // RESET BUTTON
    // ═══════════════════════════════════════════

    resetBtn.addEventListener('click', () => {
        isMuted = false;
        muteBtn.classList.remove('muted');
        muteBtn.innerHTML = '<span class="mute-icon">🔊</span><span>Sound On</span>';

        presetBtns.forEach(b => b.classList.remove('active'));
        presetBtns[0].classList.add('active');

        updateUI(100);
        applyVolume(100);
    });

    // ═══════════════════════════════════════════
    // UI UPDATE
    // ═══════════════════════════════════════════

    function updateUI(level) {
        volumeSlider.value = level;
        volumeValue.textContent = `${level}%`;

        // Update circular progress (max 800%, so divide by 800)
        const progress = Math.min(level / 800, 1);
        knobProgress.style.setProperty('--progress', progress);

        // Get related elements
        const knobInner = document.querySelector('.knob-inner');
        const knobGlow = document.querySelector('.knob-glow');

        // Remove all state classes
        const stateClasses = ['low', 'medium', 'high', 'extreme', 'boosted'];
        stateClasses.forEach(cls => {
            knobContainer.classList.remove(cls);
            knobProgress.classList.remove(cls);
            volumeValue.classList.remove(cls);
            if (knobInner) knobInner.classList.remove(cls);
            if (knobGlow) knobGlow.classList.remove(cls);
        });

        // Apply state based on volume level
        if (level <= 100) {
            knobProgress.classList.add('low');
        } else if (level <= 200) {
            knobProgress.classList.add('medium');
            knobContainer.classList.add('boosted');
            volumeValue.classList.add('boosted');
        } else if (level <= 400) {
            knobProgress.classList.add('high');
            knobContainer.classList.add('boosted');
            volumeValue.classList.add('boosted');
        } else {
            // 400%+ is EXTREME mode
            knobProgress.classList.add('extreme');
            knobContainer.classList.add('boosted');
            volumeValue.classList.add('extreme');
            if (knobInner) knobInner.classList.add('extreme');
            if (knobGlow) knobGlow.classList.add('extreme');
        }
    }

    async function applyVolume(level) {
        try {
            // Save to storage for this domain
            if (tab.url && tab.url.startsWith('http')) {
                const domain = new URL(tab.url).hostname;
                chrome.storage.local.set({ [domain]: level });
            }

            // First ensure content script is injected
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['src/scripts/content.js']
            });

            chrome.tabs.sendMessage(tab.id, { type: 'SET_VOLUME', level: level });
        } catch (e) {
            console.error('Failed to apply volume:', e);
        }
    }

    // ═══════════════════════════════════════════
    // ENHANCED VISUALIZER
    // ═══════════════════════════════════════════

    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Smooth bar heights
    let barHeights = [];
    const barCount = 45;
    for (let i = 0; i < barCount; i++) {
        barHeights[i] = 0;
    }

    function drawVisualizer() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = 4;
        const gap = (canvas.width - barCount * barWidth) / (barCount + 1);
        const boostFactor = volumeSlider.value / 100;
        const maxHeight = canvas.height * 0.7;

        for (let i = 0; i < barCount; i++) {
            // Target height with some randomness
            const centerFactor = 1 - Math.abs(i - barCount / 2) / (barCount / 2) * 0.5;
            const targetHeight = (Math.random() * 0.5 + 0.2) * maxHeight * centerFactor * Math.min(boostFactor, 2);

            // Smooth transition
            barHeights[i] += (targetHeight - barHeights[i]) * 0.15;

            const h = Math.max(barHeights[i], 3);
            const x = gap + i * (barWidth + gap);
            const y = canvas.height - h - 20;

            // Create gradient
            const grad = ctx.createLinearGradient(x, y, x, canvas.height - 20);
            grad.addColorStop(0, '#00f0ff');
            grad.addColorStop(0.5, '#7c3aed');
            grad.addColorStop(1, '#ff00aa');

            // Draw main bar
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, h, 2);
            ctx.fill();

            // Draw reflection
            const reflectionGrad = ctx.createLinearGradient(x, canvas.height - 18, x, canvas.height);
            reflectionGrad.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
            reflectionGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = reflectionGrad;
            ctx.beginPath();
            ctx.roundRect(x, canvas.height - 18, barWidth, Math.min(h * 0.3, 15), 2);
            ctx.fill();
        }

        // Reflection line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 19);
        ctx.lineTo(canvas.width, canvas.height - 19);
        ctx.stroke();

        requestAnimationFrame(drawVisualizer);
    }
    drawVisualizer();

    // Initialize with default preset active
    presetBtns[0].classList.add('active');
});
