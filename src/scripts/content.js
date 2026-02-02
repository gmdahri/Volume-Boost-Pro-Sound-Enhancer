// Core Audio Engine for Volume Boost Pro
let audioContext;
let gainNode;
let source;

function initAudio(element) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        source = audioContext.createMediaElementSource(element);
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
    }
}

function setVolume(level) {
    // level is 0 to 800
    const multiplier = level / 100;
    if (gainNode) {
        gainNode.gain.setTargetAtTime(multiplier, audioContext.currentTime, 0.1);
    }
}

// Listener for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SET_VOLUME') {
        const mediaElements = document.querySelectorAll('video, audio');
        if (mediaElements.length > 0) {
            mediaElements.forEach(initAudio);
            setVolume(request.level);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'No audio source found on this page' });
        }
    }

    if (request.type === 'GET_VOLUME') {
        sendResponse({ level: gainNode ? gainNode.gain.value * 100 : 100 });
    }
    return true;
});

// Auto-load volume for this domain
const domain = window.location.hostname;
chrome.storage.local.get([domain], (result) => {
    if (result[domain]) {
        // We wait for user interaction to resume AudioContext (browser requirement)
        // or wait for the first message from popup which will trigger initAudio
        console.log(`Volume Boost Pro: Saved level for ${domain} is ${result[domain]}%`);
    }
});

// Auto-init if media starts playing
const observer = new MutationObserver((mutations) => {
    const mediaElements = document.querySelectorAll('video, audio');
    if (mediaElements.length > 0) {
        // We don't init immediately to avoid breaking some sites, 
        // we wait for the user to trigger the boost via popup
    }
});
observer.observe(document.body, { childList: true, subtree: true });
