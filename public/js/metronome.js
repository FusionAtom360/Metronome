class Metronome {
    constructor(bpm = 100, subdivision = 1) {
        this.bpm = Number(bpm);
        this.subdivision = Math.max(1, Math.floor(Number(subdivision) || 1));
        this.audioCtx = null;
        this.isRunning = false;
        this.timerID = null;

        // Optional callbacks:
        // this.onBeat = () => { ... }       // called for main beats
        // this.onSubBeat = () => { ... }    // called for subdivision ticks (not main)
    }

    async start() {
        if (this.isRunning) return;

        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext ||
                window.webkitAudioContext)();
        }
        if (this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
        }

        this.isRunning = true;
        this.nextTime = this.audioCtx.currentTime;
        this.timerID = setInterval(() => this._schedule(), 25);
    }

    stop() {
        if (!this.isRunning) return;
        clearInterval(this.timerID);
        this.isRunning = false;
    }

    setBpm(bpm) {
        this.bpm = Number(bpm);
    }

    setSubdivision(n) {
        // Accept a positive integer; values <1 become 1 (no subdivisions)
        this.subdivision = Math.max(1, Math.floor(Number(n) || 1));
    }

    _schedule() {
        const beatDuration = 60 / this.bpm;
        // Schedule upcoming beats (and their subdivisions) slightly ahead
        while (this.nextTime < this.audioCtx.currentTime + 0.1) {
            // schedule main beat
            this._playClick(this.nextTime, { main: true });

            // schedule subdivision ticks (if any)
            if (this.subdivision > 1) {
                for (let i = 1; i < this.subdivision; i++) {
                    const offset = (i / this.subdivision) * beatDuration;
                    this._playClick(this.nextTime + offset, { main: false });
                }
            }

            this.nextTime += beatDuration;
        }
    }

    _playClick(time, { main = true } = {}) {
        const ctx = this.audioCtx;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // main beat: 800 Hz, louder, slightly longer
        // subdivision: 600 Hz, quieter, shorter envelope
        if (main) {
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(1.5, time); // peak
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(time);
            osc.stop(time + 0.12);

            // visual callback for main beat (if provided)
            try {
                const callDelay = Math.max(0, (time - ctx.currentTime) * 1000);
                if (this.onBeat && typeof this.onBeat === "function") {
                    setTimeout(() => {
                        try {
                            this.onBeat();
                        } catch (e) {
                            /* ignore visual errors */
                        }
                    }, callDelay);
                }
            } catch (e) {
                /* ignore scheduling visual errors */
            }
        } else {
            // subdivision pulse
            osc.frequency.value = 600;
            gain.gain.setValueAtTime(0.6, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(time);
            osc.stop(time + 0.08);

            // visual callback for subdivision ticks (if provided)
            try {
                const callDelay = Math.max(0, (time - ctx.currentTime) * 1000);
                if (this.onSubBeat && typeof this.onSubBeat === "function") {
                    setTimeout(() => {
                        try {
                            this.onSubBeat();
                        } catch (e) {
                            /* ignore visual errors */
                        }
                    }, callDelay);
                }
            } catch (e) {
                /* ignore scheduling visual errors */
            }
        }
    }
}

// --- wire up UI ---
const tempoCircle = document.getElementById("tempoCircle");
const bpmDisplay = document.getElementById("bpmDisplay");
// New element for tempo name that appears above the BPM number
const tempoName = document.getElementById("tempoName");
const tempoLabel = document.getElementById("tempoLabel");
const playPauseBtn = document.getElementById("playPauseBtn");
const increaseBtn = document.getElementById("increaseBtn");
const decreaseBtn = document.getElementById("decreaseBtn");
const stopwatchDisplay = document.getElementById("stopwatch");
const tapBtn = document.getElementById("practiceBtn");
const timeSigBtn = document.getElementById("timeSigBtn");
const menuOverlay = document.getElementById("menuOverlay");
const closeMenuBtn = document.getElementById("closeMenuBtn");
//const debugBtn = document.getElementById("debugBtn");
const checkBtn = document.getElementById("checkBtn");
const failBtn = document.getElementById("failBtn");
const practiceOverlay = document.getElementById("practiceOverlay");
const closePracticeBtn = document.getElementById("closePracticeBtn");
const startPracticeBtn = document.getElementById("startPracticeBtn");
const psStarting = document.getElementById("psStarting");
const psTarget = document.getElementById("psTarget");
const psRequired = document.getElementById("psRequired");
const psIncrement = document.getElementById("psIncrement");
const psPenalty = document.getElementById("psPenalty");
const practiceDotsEl = document.getElementById("practiceDots");
const closeBreakBtn = document.getElementById("closeBreakBtn");
const exitPracticeBtn = document.getElementById("exitPracticeBtn");
const messageToast = document.getElementById("messageToast");
const psStartingPulse = document.getElementById("psNoteSelectInitial");
const psTargetPulse = document.getElementById("psNoteSelectTarget");
const pulseIndicator = document.getElementById("pulseIndicator")
const equalsSign = document.getElementById("equalsSign")


const metro = new Metronome(100);
let isDragging = false;
let dragStartY = 0;
let stopwatchInterval = null;
let stopwatchSeconds = 0;
let tapTimes = [];
let tapTimeout = null;
let timeSignature = "4/4";
let subdivision = 1;
let tapMode = false;
let tapModeTimer = null;
let practiceMode = false;
let practiceSettings = {
    startingBpm: 60,
    startingPulse: "quarter",
    targetBpm: 120,
    targetPulse: "quarter",
    requiredCorrect: 1,
    increment: 10,
    penalty: 10,
};
let practiceState = {
    currentBpm: 60,
    correctCount: 0,
    consecutiveFails: 0,
    startTime: null,
    passTime: null,
    dots: [],
    currentPulse: 4,
};

function loadPracticeSettings() {
    const saved = localStorage.getItem("practice-settings");
    if (saved) {
        try {
            const obj = JSON.parse(saved);
            Object.assign(practiceSettings, obj);
        } catch (e) {}
    }
    if (psStarting) psStarting.value = practiceSettings.startingBpm;
    if (psTarget) psTarget.value = practiceSettings.targetBpm;
    if (psRequired) psRequired.value = practiceSettings.requiredCorrect;
    if (psIncrement) psIncrement.value = practiceSettings.increment;
    if (psPenalty) psPenalty.value = practiceSettings.penalty;

    console.log(practiceSettings)
    if (psStartingPulse) {
        console.log("test")
        if (practiceSettings.startingPulse == "whole")
            psStartingPulse.textContent = "";
        if (practiceSettings.startingPulse == "half")
            psStartingPulse.textContent = "";
        if (practiceSettings.startingPulse == "quarter")
            psStartingPulse.textContent = "";
        if (practiceSettings.startingPulse == "eighth")
            psStartingPulse.textContent = "";
        if (practiceSettings.startingPulse == "sixteenth")
            psStartingPulse.textContent = "";
    }
    if (psTargetPulse) {
        if (practiceSettings.targetPulse == "whole")
            psTargetPulse.textContent = "";
        if (practiceSettings.targetPulse == "half")
            psTargetPulse.textContent = "";
        if (practiceSettings.targetPulse == "quarter")
            psTargetPulse.textContent = "";
        if (practiceSettings.targetPulse == "eighth")
            psTargetPulse.textContent = "";
        if (practiceSettings.targetPulse == "sixteenth")
            psTargetPulse.textContent = "";
    }
}

function savePracticeSettings() {
    practiceSettings.startingBpm =
        Number(psStarting.value) || practiceSettings.startingBpm;
    practiceSettings.targetBpm =
        Number(psTarget.value) || practiceSettings.targetBpm;
    practiceSettings.requiredCorrect = Math.max(
        1,
        Number(psRequired.value) || practiceSettings.requiredCorrect
    );
    practiceSettings.increment = Math.max(
        1,
        Number(psIncrement.value) || practiceSettings.increment
    );
    practiceSettings.penalty = Math.max(0, Number(psPenalty.value));

    if (psTargetPulse.textContent == "") practiceSettings.targetPulse = "whole";
    if (psTargetPulse.textContent == "") practiceSettings.targetPulse = "half";
    if (psTargetPulse.textContent == "") practiceSettings.targetPulse = "quarter";
    if (psTargetPulse.textContent == "") practiceSettings.targetPulse = "eighth";
    if (psTargetPulse.textContent == "") practiceSettings.targetPulse = "sixteenth";

    if (psStartingPulse.textContent == "") practiceSettings.startingPulse = "whole";
    if (psStartingPulse.textContent == "") practiceSettings.startingPulse = "half";
    if (psStartingPulse.textContent == "") practiceSettings.startingPulse = "quarter";
    if (psStartingPulse.textContent == "") practiceSettings.startingPulse = "eighth";
    if (psStartingPulse.textContent == "") practiceSettings.startingPulse = "sixteenth";

    localStorage.setItem("practice-settings", JSON.stringify(practiceSettings));
}

function loadPracticeLog() {
    const raw = localStorage.getItem("practice-log");
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function savePracticeLog(log) {
    localStorage.setItem("practice-log", JSON.stringify(log));
}

function logPracticeEntry(type, bpm, details) {
    const log = loadPracticeLog();
    log.push({ ts: Date.now(), type, bpm, details: details || null });
    savePracticeLog(log);
}

// In-app message / toast helper
let _toastTimer = null;
function showMessage(msg, ms = 3000) {
    if (!messageToast) {
        alert(msg); // fallback if toast element missing
        return;
    }
    messageToast.textContent = msg;
    messageToast.style.display = "block";
    // trigger CSS transition
    void messageToast.offsetWidth;
    messageToast.classList.add("show");
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        messageToast.classList.remove("show");
        setTimeout(() => {
            messageToast.style.display = "none";
        }, 180);
        _toastTimer = null;
    }, ms);
}

// Tempo name mapping
const tempoNames = [
    { min: 0, max: 39, name: "Grave" },
    { min: 40, max: 59, name: "Largo" },
    { min: 60, max: 65, name: "Larghetto" },
    { min: 66, max: 75, name: "Adagio" },
    { min: 76, max: 89, name: "Andante" },
    { min: 90, max: 104, name: "Moderato" },
    { min: 105, max: 114, name: "Allegretto" },
    { min: 115, max: 129, name: "Allegro" },
    { min: 130, max: 167, name: "Vivace" },
    { min: 168, max: 199, name: "Presto" },
    { min: 200, max: 500, name: "Prestissimo" },
];

// Get tempo name based on BPM
function getTempoName(bpm) {
    for (let tempo of tempoNames) {
        if (bpm >= tempo.min && bpm <= tempo.max) {
            return tempo.name;
        }
    }
    return "Larghissimo";
}

// Local storage functions
function saveState() {
    localStorage.setItem("metronome-bpm", metro.bpm);
    localStorage.setItem("metronome-stopwatch", stopwatchSeconds);
    localStorage.setItem("metronome-timesig", timeSignature);
    localStorage.setItem("metronome-subdivision", subdivision);
}

function loadState() {
    const savedBpm = localStorage.getItem("metronome-bpm");
    const savedStopwatch = localStorage.getItem("metronome-stopwatch");
    const savedTimeSig = localStorage.getItem("metronome-timesig");
    const savedSubdivision = localStorage.getItem("metronome-subdivision");

    if (savedBpm !== null) {
        metro.setBpm(Number(savedBpm));
        updateBpmDisplay();
    }

    if (savedStopwatch !== null) {
        stopwatchSeconds = Number(savedStopwatch);
        updateStopwatch();
    }

    if (savedTimeSig !== null) {
        timeSignature = savedTimeSig;
        // Mark the button as selected
        document.querySelectorAll(".menu-option[data-sig]").forEach((btn) => {
            btn.classList.remove("selected");
            btn.removeAttribute("data-selected");
            if (btn.getAttribute("data-sig") === timeSignature) {
                btn.classList.add("selected");
                btn.setAttribute("data-selected", "true");
            }
        });
    }

    if (savedSubdivision !== null) {
        subdivision = Number(savedSubdivision);
        metro.subdivision = subdivision;
        // Mark the button as selected
        document.querySelectorAll(".menu-option.sub-option").forEach((btn) => {
            btn.classList.remove("selected");
            if (parseInt(btn.getAttribute("data-sub"), 10) === subdivision) {
                btn.classList.add("selected");
            }
        });
        updateNoteIcon();
    }
}

// Stopwatch functions
function updateStopwatch() {
    const minutes = Math.floor(stopwatchSeconds / 60);
    const seconds = stopwatchSeconds % 60;
    stopwatchDisplay.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");
}

function startStopwatch() {
    if (stopwatchInterval) return;
    stopwatchInterval = setInterval(() => {
        stopwatchSeconds++;
        updateStopwatch();
        saveState();
    }, 1000);
}

function stopStopwatch() {
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    }
}

function resetStopwatch() {
    stopwatchSeconds = 0;
    updateStopwatch();
    saveState();
}

// Tap tempo functions
function handleTap() {
    const now = Date.now();
    tapTimes.push(now);

    // Keep only the last 5 taps
    if (tapTimes.length > 5) {
        tapTimes.shift();
    }

    // Clear any pending timeout
    if (tapTimeout) clearTimeout(tapTimeout);

    // Set a new timeout to clear taps if none occur in 5 seconds
    tapTimeout = setTimeout(() => {
        tapTimes = [];
    }, 5000);

    // If we have at least 2 taps, calculate average BPM
    if (tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
            intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }

        const avgInterval =
            intervals.reduce((a, b) => a + b) / intervals.length;
        const avgBpm = Math.round(60000 / avgInterval); // Convert ms interval to BPM

        const newBpm = Math.max(20, Math.min(300, avgBpm));
        metro.setBpm(newBpm);
        updateBpmDisplay();
        saveState();
    }
}

function enterTapMode() {
    tapMode = true;
    if (tapModeTimer) clearTimeout(tapModeTimer);
    // change tempo label to TAP (replace the tempo name)
    if (tempoName) {
        // store previous tempo name and show TAP in its place
        tempoName._prev = tempoName.textContent;
        tempoName.textContent = "TAP";
    }
    tempoCircle.classList.add("tap-mode");
    // after 3 seconds of inactivity, exit tap mode
    tapModeTimer = setTimeout(() => {
        exitTapMode();
    }, 2000);
}

function exitTapMode() {
    tapMode = false;
    if (tapModeTimer) {
        clearTimeout(tapModeTimer);
        tapModeTimer = null;
    }
    // clear tap averages when tap mode times out
    tapTimes = [];
    if (tapTimeout) {
        clearTimeout(tapTimeout);
        tapTimeout = null;
    }
    // restore tempo label
    if (tempoName && tempoName._prev !== undefined) {
        tempoName.textContent = tempoName._prev;
        delete tempoName._prev;
    }
    tempoCircle.classList.remove("tap-mode");
}

// Update BPM display
function updateBpmDisplay() {
    const bpm = Math.round(metro.bpm);
    bpmDisplay.textContent = bpm;
    const tempoRef = getTempoName(bpm);
    // set the tempo name element (don't overwrite the TAP label while in tap mode)
    if (!tapMode && tempoName) {
        tempoName.textContent = tempoRef;
    }
}

// Visual flash on beat (short burst)
function visualFlash() {
    if (!tempoCircle) return;
    tempoCircle.classList.add("beat");
    setTimeout(() => tempoCircle.classList.remove("beat"), 140);
}

// Wire metronome visual callback
metro.onBeat = () => {
    // If in tap mode, use a different outline color via class
    visualFlash();
};

// Tempo circle drag control
tempoCircle.addEventListener("mousedown", (e) => {
    if (practiceMode) return;
    isDragging = true;
    dragStartY = e.clientY;
});

// When circle is clicked (not dragged) use it as a tap surface
tempoCircle.addEventListener("click", (e) => {
    if (isDragging) return; // ignore clicks that were actually drags
    // ignore tap-tempo while in practice mode
    if (practiceMode) return;
    // call existing tap handler and enter tap mode
    handleTap();
    enterTapMode();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaY = dragStartY - e.clientY; // negative = down, positive = up
    const sensitivity = 3; // pixels per BPM change
    const bpmChange = Math.round(deltaY / sensitivity);

    const newBpm = Math.max(20, Math.min(300, metro.bpm + bpmChange));
    metro.setBpm(newBpm);
    updateBpmDisplay();
    saveState();

    dragStartY = e.clientY;
});

document.addEventListener("mouseup", () => {
    isDragging = false;
});

// Touch support for mobile
tempoCircle.addEventListener("touchstart", (e) => {
    isDragging = true;
    dragStartY = e.touches[0].clientY;
});

document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;

    const deltaY = dragStartY - e.touches[0].clientY;
    const sensitivity = 3;
    const bpmChange = Math.round(deltaY / sensitivity);

    const newBpm = Math.max(20, Math.min(300, metro.bpm + bpmChange));
    metro.setBpm(newBpm);
    updateBpmDisplay();
    saveState();
    dragStartY = e.touches[0].clientY;
});

document.addEventListener("touchend", () => {
    isDragging = false;
});

// Hold-to-repeat for +/- buttons (slow increments)
const _hold = {
    inc: { timeout: null, interval: null },
    dec: { timeout: null, interval: null },
};

function _doIncrement(delta) {
    const newBpm = Math.max(20, Math.min(300, Math.round(metro.bpm + delta)));
    metro.setBpm(newBpm);
    updateBpmDisplay();
    saveState();
}

function startHoldInc() {
    if (practiceMode) {
        if (practiceState.currentPulse < 16){
            const newBpm = Math.min(300, Math.floor(metro.bpm * 2));
            metro.setBpm(newBpm);
            updateBpmDisplay();
            practiceState.currentBpm = newBpm;

            practiceState.currentPulse *= 2;
            updatePulseIndicator();
        }
        return;
    };
    // single step immediately
    _doIncrement(1);
    // start repeating after a short delay
    clearTimeout(_hold.inc.timeout);
    clearInterval(_hold.inc.interval);
    _hold.inc.timeout = setTimeout(() => {
        _hold.inc.interval = setInterval(() => _doIncrement(1), 150);
    }, 400);
}

function stopHoldInc() {
    if (practiceMode) return;
    clearTimeout(_hold.inc.timeout);
    clearInterval(_hold.inc.interval);
    _hold.inc.timeout = null;
    _hold.inc.interval = null;
}

function startHoldDec() {
    if (practiceMode) {
         if (practiceState.currentPulse > 1){
            const newBpm = Math.max(20, Math.floor(metro.bpm / 2));
            metro.setBpm(newBpm);
            practiceState.currentBpm = newBpm;
            updateBpmDisplay();
            practiceState.currentPulse /= 2;
            updatePulseIndicator();
        }
        return;
    };
    _doIncrement(-1);
    clearTimeout(_hold.dec.timeout);
    clearInterval(_hold.dec.interval);
    _hold.dec.timeout = setTimeout(() => {
        _hold.dec.interval = setInterval(() => _doIncrement(-1), 150);
    }, 400);
}

function stopHoldDec() {
    if (practiceMode) return;
    clearTimeout(_hold.dec.timeout);
    clearInterval(_hold.dec.interval);
    _hold.dec.timeout = null;
    _hold.dec.interval = null;
}

// mouse + touch handlers for increase button
if (increaseBtn) {
    increaseBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startHoldInc();
    });
    increaseBtn.addEventListener("mouseup", stopHoldInc);
    increaseBtn.addEventListener("mouseleave", stopHoldInc);
    increaseBtn.addEventListener(
        "touchstart",
        (e) => {
            e.preventDefault();
            startHoldInc();
        },
        { passive: false }
    );
    increaseBtn.addEventListener("touchend", stopHoldInc);
    increaseBtn.addEventListener("touchcancel", stopHoldInc);
}

// mouse + touch handlers for decrease button
if (decreaseBtn) {
    decreaseBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startHoldDec();
    });
    decreaseBtn.addEventListener("mouseup", stopHoldDec);
    decreaseBtn.addEventListener("mouseleave", stopHoldDec);
    decreaseBtn.addEventListener(
        "touchstart",
        (e) => {
            e.preventDefault();
            startHoldDec();
        },
        { passive: false }
    );
    decreaseBtn.addEventListener("touchend", stopHoldDec);
    decreaseBtn.addEventListener("touchcancel", stopHoldDec);
}

playPauseBtn.addEventListener("click", async () => {
    requestWakeLock();
    try {
        if (metro.isRunning) {
            stopMetronome();
        } else {
            await startMetronome();
        }
        saveState();
    } catch (err) {
        console.error("Unable to control audio", err);
    }
});

// wrapper to start metro and update UI consistently
async function startMetronome() {
    try {
        await metro.start();
    } catch (e) {
        console.error("startMetronome error", e);
    }
    playPauseBtn.innerHTML =
        '<span class="material-symbols-outlined" style="font-size: 60px">pause</span>';
    // style play button like grey buttons when in practice
    if (practiceMode) playPauseBtn.classList.add("play-practice");
    startStopwatch();
}

function stopMetronome() {
    try {
        metro.stop();
    } catch (e) {
        console.error("stopMetronome error", e);
    }
    playPauseBtn.textContent = "▶";
    // remove practice styling when stopped
    playPauseBtn.classList.remove("play-practice");
    stopStopwatch();
}

// TAP button now opens Practice Settings modal
tapBtn.addEventListener("click", () => {
    // open practice settings
    loadPracticeSettings();
    practiceOverlay.style.display = "flex";
});

closePracticeBtn.addEventListener("click", () => {
    practiceOverlay.style.display = "none";
});

startPracticeBtn.addEventListener("click", () => {
    savePracticeSettings();
    practiceOverlay.style.display = "none";
    startPracticeMode();
    showMessage("Practice settings saved", 900);
});

// Auto-save practice settings when inputs change
[psStarting, psTarget, psRequired, psIncrement, psPenalty].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => {
        savePracticeSettings();
        // brief feedback
    });
});

// Time Signature Menu
timeSigBtn.addEventListener("click", () => {
    menuOverlay.style.display = "flex";
});

closeMenuBtn.addEventListener("click", () => {
    menuOverlay.style.display = "none";
});

menuOverlay.addEventListener("click", (e) => {
    if (e.target === menuOverlay) {
        menuOverlay.style.display = "none";
    }
});

// Time signature options
document.querySelectorAll(".menu-option[data-sig]").forEach((btn) => {
    btn.addEventListener("click", () => {
        // Remove selected from all
        document.querySelectorAll(".menu-option[data-sig]").forEach((b) => {
            b.classList.remove("selected");
            b.removeAttribute("data-selected");
        });

        // Add selected to clicked
        btn.classList.add("selected");
        btn.setAttribute("data-selected", "true");
        timeSignature = btn.getAttribute("data-sig");
        saveState();
    });
});

// Subdivision options
document.querySelectorAll(".menu-option.sub-option").forEach((btn) => {
    btn.addEventListener("click", () => {
        // Remove selected from all
        document.querySelectorAll(".menu-option.sub-option").forEach((b) => {
            b.classList.remove("selected");
        });

        // Add selected to clicked
        btn.classList.add("selected");
        subdivision = parseInt(btn.getAttribute("data-sub"), 10);
        metro.subdivision = subdivision;
        updateNoteIcon();
        saveState();
    });
});

// Update the small note icon based on subdivision
function updateNoteIcon() {
    if (!timeSigBtn) return;
    const iconEl = timeSigBtn.querySelector(".note-icon");
    if (!iconEl) return;
    // Map subdivision to a simple note symbol
    // 1: Quarter, 2: Eighth, 3: Triplets, 4: Sixteenth
    switch (subdivision) {
        case 1:
            iconEl.textContent = ""; //quarter note
            break;
        case 2:
            iconEl.textContent = ""; //eighth note
            break;
        case 3:
            iconEl.textContent = ""; //sixteenth note
            break;
        case 4:
            iconEl.textContent = "";
            break;
        default:
            iconEl.textContent = ""; //quarter note
    }
}

// Practice action handlers
function showPracticeUI(show) {
    if (show) {
        // hide timeSig and tap labels, show check/fail
        timeSigBtn.style.display = "none";
        tapBtn.style.display = "none";
        checkBtn.style.display = "inline-flex";
        failBtn.style.display = "inline-flex";
        if (checkBtn) checkBtn.disabled = false;
        if (failBtn) failBtn.disabled = false;
        practiceDotsEl.style.display =
            practiceSettings.requiredCorrect > 1 ? "flex" : "none";
        if (exitPracticeBtn) exitPracticeBtn.style.display = "inline-flex";
        if (playPauseBtn) playPauseBtn.classList.add("play-practice");
    } else {
        timeSigBtn.style.display = "";
        tapBtn.style.display = "";
        // restore +/- visibility and functionality
        checkBtn.style.display = "none";
        failBtn.style.display = "none";
        if (checkBtn) checkBtn.disabled = true;
        if (failBtn) failBtn.disabled = true;
        practiceDotsEl.style.display = "none";
        if (exitPracticeBtn) exitPracticeBtn.style.display = "none";
        if (playPauseBtn) playPauseBtn.classList.remove("play-practice");
    }
}

function renderDots() {
    practiceDotsEl.innerHTML = "";
    practiceState.dots = [];
    for (let i = 0; i < practiceSettings.requiredCorrect; i++) {
        const d = document.createElement("div");
        d.className = "dot";
        practiceDotsEl.appendChild(d);
        practiceState.dots.push(d);
    }
}

function updatePulseIndicator() {
    console.log(practiceSettings)
    if (practiceState.currentPulse == 1)
        pulseIndicator.textContent = "";
    if (practiceState.currentPulse == 2)
        pulseIndicator.textContent = "";
    if (practiceState.currentPulse == 4)
        pulseIndicator.textContent = "";
    if (practiceState.currentPulse == 8)
        pulseIndicator.textContent = "";
    if (practiceState.currentPulse == 16)
        pulseIndicator.textContent = "";
}

function startPracticeMode() {
    practiceMode = true;
    practiceState.currentBpm = practiceSettings.startingBpm;
    metro.setBpm(practiceState.currentBpm);
    updateBpmDisplay();
    tapBtn.disabled = true;
    showPracticeUI(true);
    renderDots();
    increaseBtn.textContent = "×";
    decreaseBtn.textContent = "÷";
    if (practiceState.dots && practiceState.dots[0])
        practiceState.dots[0].classList.add("active");
    practiceState.correctCount = 0;
    practiceState.consecutiveFails = 0;
    equalsSign.style.display = "inline-block";
    if (practiceSettings.startingPulse == "whole") {
        practiceState.currentPulse = 1;
    } 
    if (practiceSettings.startingPulse == "half") {
            practiceState.currentPulse = 2;
    }
    if (practiceSettings.startingPulse == "quarter") {
        practiceState.currentPulse = 4;
    }
    if (practiceSettings.startingPulse == "eighth") {
        practiceState.currentPulse = 8;
    }
    if (practiceSettings.startingPulse == "sixteenth") {
        practiceState.currentPulse = 16;
    }   

    updatePulseIndicator();


    if (practiceSettings.startingPulse == "half") practiceState.currentPulse = 2;
    if (practiceSettings.startingPulse == "quarter") practiceState.currentPulse = 4;
    if (practiceSettings.startingPulse == "eighth") practiceState.currentPulse = 8;
    if (practiceSettings.startingPulse == "sixteenth") practiceState.currentPulse = 16;

    practiceState.startTime = Date.now();
    logPracticeEntry("start", practiceState.currentBpm, "practice started");
    // start metronome if not running
    startMetronome().catch(() => {});
    // start monitor for break advice
    // record active stopwatch seconds at start of practice
    practiceState._stopwatchStart = stopwatchSeconds;
    practiceState._monitor = setInterval(() => {
        // check active (stopwatch) time, not wall-clock elapsed
        const activeElapsed =
            (stopwatchSeconds || 0) - (practiceState._stopwatchStart || 0); // seconds
        if (activeElapsed >= 30 * 60) {
            // if still not reached target
            if (practiceState.currentBpm < practiceSettings.targetBpm) {
                showMessage(
                    "Consider taking a break to rest and refocus.",
                    10000
                );
            }
            clearInterval(practiceState._monitor);
            practiceState._monitor = null;
        }
    }, 1000);
}

function exitPracticeMode() {
    practiceMode = false;
    showPracticeUI(false);
    increaseBtn.textContent = "+";
    decreaseBtn.textContent = "-";
    tapBtn.disabled = false;
    equalsSign.style.display = "none";
    pulseIndicator.textContent = "";
    if (practiceState._monitor) clearInterval(practiceState._monitor);
    logPracticeEntry("exit", metro.bpm, "practice exited");
}

function handlePass() {
    if (!practiceMode) return;
    practiceState.correctCount++;
    practiceState.consecutiveFails = 0;
    tempoCircle.classList.add('green');
    setTimeout(() => tempoCircle.classList.remove('green'), 200);
    // light up dot
    let targetPulseInt = 0;
    if (practiceSettings.targetPulse == "whole") targetPulseInt = 1;
    if (practiceSettings.targetPulse == "half") targetPulseInt = 2;
    if (practiceSettings.targetPulse == "quarter") targetPulseInt = 4;
    if (practiceSettings.targetPulse == "eighth") targetPulseInt = 8;
    if (practiceSettings.targetPulse == "sixteenth") targetPulseInt = 16;

    const idx = practiceState.correctCount;
    if (practiceState.dots && practiceState.dots[idx])
        practiceState.dots[idx].classList.add("active");
    if (practiceState.correctCount >= practiceSettings.requiredCorrect) {
        // level complete: if at target BPM, pass; otherwise increment bpm
        if (practiceState.currentBpm / practiceState.currentPulse >= practiceSettings.targetBpm / targetPulseInt) {
            // passed
            logPracticeEntry(
                "pass",
                practiceState.currentBpm,
                "target reached and required correct"
            );
            showMessage("Congratulations — you finished the practice!", 5000);
            exitPracticeMode();
        } else {
            
            practiceState.currentBpm = Math.min(
                practiceSettings.targetBpm / targetPulseInt * practiceState.currentPulse,
                practiceState.currentBpm + practiceSettings.increment
            );
            metro.setBpm(practiceState.currentBpm);
            updateBpmDisplay();
            logPracticeEntry(
                "level-up",
                practiceState.currentBpm,
                "level incremented"
            );
            // reset for next level
            practiceState.correctCount = 0;
            if (practiceState.dots) {
                practiceState.dots.forEach((d) => d.classList.remove("active"));
                practiceState.dots[0].classList.add("active");
            }
        }
    }
}

function handleFail() {
    if (!practiceMode) return;
    practiceState.consecutiveFails++;
    tempoCircle.classList.add('red');
    setTimeout(() => tempoCircle.classList.remove('red'), 200);
    if (practiceState.consecutiveFails >= 3) {
        showMessage("Consider taking a break to rest and refocus.", 10000);
        practiceState.consecutiveFails = 0;
    }
    practiceState.correctCount = 0;
    if (practiceState.dots) {
        practiceState.dots.forEach((d) => d.classList.remove("active"));
        practiceState.dots[0].classList.add("active");
    }
    // decrement bpm by penalty
    practiceState.currentBpm = Math.max(
        20,
        practiceState.currentBpm - practiceSettings.penalty
    );
    metro.setBpm(practiceState.currentBpm);
    updateBpmDisplay();
    logPracticeEntry("fail", practiceState.currentBpm, "user pressed X");
}

checkBtn.addEventListener("click", handlePass);
failBtn.addEventListener("click", handleFail);
if (exitPracticeBtn)
    exitPracticeBtn.addEventListener("click", () => {
        exitPracticeMode();
        showMessage("Exited practice mode");
    });

// allow spacebar to toggle start/stop
window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault();
        playPauseBtn.click();
    }
});

// Initialize display
loadState();
// ensure tempo name/bpm show correctly even when no saved BPM exists
updateBpmDisplay();
updateStopwatch();
updateNoteIcon();

let wakeLock = null;

const requestWakeLock = async () => {
    try {
        wakeLock = await navigator.wakeLock.request("screen");
        console.log("Screen Wake Lock acquired");
    } catch (err) {
        console.log(`${err.name}, ${err.message}`);
    }
};

psStartingPulse.addEventListener("click", (e) => {
    if (practiceSettings.startingPulse == "whole") {
      practiceSettings.startingPulse = "half";
      psStartingPulse.textContent = "";
    }
    else if (practiceSettings.startingPulse == "half") {
      practiceSettings.startingPulse = "quarter";
      psStartingPulse.textContent = "";
    }
    else if (practiceSettings.startingPulse == "quarter") {
      practiceSettings.startingPulse = "eighth";
      psStartingPulse.textContent = "";
    }
    else if (practiceSettings.startingPulse == "eighth") {
      practiceSettings.startingPulse = "sixteenth";
      psStartingPulse.textContent = "";
    }
    else if (practiceSettings.startingPulse == "sixteenth") {
      practiceSettings.startingPulse = "whole";
      psStartingPulse.textContent = "";
    }
    savePracticeSettings();
});

psTargetPulse.addEventListener("click", (e) => {
    if (practiceSettings.targetPulse == "whole") {
      practiceSettings.targetPulse = "half";
      psTargetPulse.textContent = "";
    }
    else if (practiceSettings.targetPulse == "half") {
      practiceSettings.targetPulse = "quarter";
      psTargetPulse.textContent = "";
    }
    else if (practiceSettings.targetPulse == "quarter") {
      practiceSettings.targetPulse = "eighth";
      psTargetPulse.textContent = "";
    }
    else if (practiceSettings.targetPulse == "eighth") {
      practiceSettings.targetPulse = "sixteenth";
      psTargetPulse.textContent = "";
    }
    else if (practiceSettings.targetPulse == "sixteenth") {
      practiceSettings.targetPulse = "whole";
      psTargetPulse.textContent = "";
    }
    savePracticeSettings();
});