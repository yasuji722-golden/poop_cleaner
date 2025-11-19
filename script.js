document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const titleScreen = document.getElementById('title-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const bossHpFill = document.getElementById('boss-hp-fill');
    const scoreDisplay = document.getElementById('score');
    const skillLaxative = document.getElementById('skill-laxative');
    const skillDrink = document.getElementById('skill-drink');

    // Configuration
    const GRID_SIZE = 8;
    const TILE_TYPES = 8;
    const MAX_BOSS_HP = 1000;

    // State
    let grid = [];
    let isGameActive = false;
    let selectedTile = null;
    let score = 0;
    let bossHP = MAX_BOSS_HP;
    let isProcessing = false;

    // Assets
    const ASSETS = {
        1: 'assets/tile1.png', 2: 'assets/tile2.png', 3: 'assets/tile3.png', 4: 'assets/tile4.png',
        5: 'assets/tile5.png', 6: 'assets/tile6.png', 7: 'assets/tile7.png', 8: 'assets/tile8.png'
    };

    // --- Sound & BGM ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Noise Buffer for Drums
    let noiseBuffer = null;
    function createNoiseBuffer() {
        if (noiseBuffer) return;
        const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        noiseBuffer = buffer;
    }

    const SoundManager = {
        playTone: (freq, type, duration, vol = 0.1) => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(vol, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        },
        playSwap: () => SoundManager.playTone(300, 'sine', 0.1),
        playMatch: () => {
            // Toilet Flush Sound
            if (audioCtx.state === 'suspended') audioCtx.resume();
            if (!noiseBuffer) createNoiseBuffer();

            const noise = audioCtx.createBufferSource();
            noise.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 1;
            const gain = audioCtx.createGain();

            filter.frequency.setValueAtTime(800, audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            noise.start();
        },
        playSkill: () => {
            SoundManager.playTone(200, 'square', 0.1);
            setTimeout(() => SoundManager.playTone(400, 'square', 0.1), 100);
            setTimeout(() => SoundManager.playTone(800, 'square', 0.3), 200);
        },
        playWin: () => {
            [400, 500, 600, 800].forEach((f, i) => setTimeout(() => SoundManager.playTone(f, 'triangle', 0.2), i * 150));
        }
    };

    // --- Deep House BGM Engine ---
    const BGMManager = {
        isPlaying: false,
        tempo: 120,
        lookahead: 25.0, // ms
        scheduleAheadTime: 0.1, // s
        nextNoteTime: 0.0,
        current16thNote: 0,
        timerID: null,

        // Instruments
        synthKick: (time) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
            gain.gain.setValueAtTime(0.8, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + 0.5);
        },
        synthHat: (time, open = false) => {
            if (!noiseBuffer) createNoiseBuffer();
            const source = audioCtx.createBufferSource();
            source.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 8000;
            const gain = audioCtx.createGain();
            const decay = open ? 0.3 : 0.05;
            gain.gain.setValueAtTime(0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + decay);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            source.start(time);
            source.stop(time + decay);
        },
        synthClap: (time) => {
            if (!noiseBuffer) createNoiseBuffer();
            const source = audioCtx.createBufferSource();
            source.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1500;
            filter.Q.value = 1;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            source.start(time);
            source.stop(time + 0.2);
        },
        synthBass: (time, freq) => {
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, time);
            filter.frequency.linearRampToValueAtTime(600, time + 0.1);
            filter.frequency.linearRampToValueAtTime(200, time + 0.3);
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.linearRampToValueAtTime(0.4, time + 0.2);
            gain.gain.linearRampToValueAtTime(0, time + 0.4);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + 0.4);
        },
        synthChord: (time, freqs) => {
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, time);
            filter.frequency.linearRampToValueAtTime(800, time + 1.0); // Swell

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.5); // Slow attack
            gain.gain.linearRampToValueAtTime(0, time + 2.0); // Long release

            filter.connect(gain);
            gain.connect(audioCtx.destination);

            freqs.forEach(f => {
                const osc = audioCtx.createOscillator();
                osc.type = 'triangle'; // Softer than saw
                osc.frequency.value = f;
                osc.connect(filter);
                osc.start(time);
                osc.stop(time + 2.0);
            });
        },

        // Sequencer
        scheduleNote: (beatNumber, time) => {
            // 16th notes. 0-15 per bar.
            const step = beatNumber % 64; // 4 bar loop

            // Kick: 4 on the floor
            if (step % 4 === 0) BGMManager.synthKick(time);

            // Hat: Off-beats
            if (step % 4 === 2) BGMManager.synthHat(time);
            if (step % 16 === 14) BGMManager.synthHat(time, true); // Open hat occasionally

            // Clap: Beats 2 and 4
            if (step % 16 === 4 || step % 16 === 12) BGMManager.synthClap(time);

            // Bass: Deep House Groove (G Minor)
            // G1=49Hz, Bb1=58Hz, C2=65Hz, D2=73Hz, F2=87Hz
            const bassLine = {
                0: 49, 3: 49, 7: 58,
                10: 49, 14: 65,
                16: 49, 19: 49, 23: 58,
                26: 49, 30: 73,
                32: 49, 35: 49, 39: 58,
                42: 49, 46: 87,
                48: 49, 51: 49, 55: 58,
                58: 49, 62: 65
            };
            if (bassLine[step]) BGMManager.synthBass(time, bassLine[step]);

            // Chords: Gm9 / Cm9 (Soft Pads)
            // Gm9: G Bb D F A
            // Cm9: C Eb G Bb D
            if (step === 0) BGMManager.synthChord(time, [196.00, 233.08, 293.66, 349.23]); // Gm7
            if (step === 32) BGMManager.synthChord(time, [261.63, 311.13, 392.00, 466.16]); // Cm7
        },

        scheduler: () => {
            while (BGMManager.nextNoteTime < audioCtx.currentTime + BGMManager.scheduleAheadTime) {
                BGMManager.scheduleNote(BGMManager.current16thNote, BGMManager.nextNoteTime);
                const secondsPerBeat = 60.0 / BGMManager.tempo;
                BGMManager.nextNoteTime += 0.25 * secondsPerBeat; // Add 1/4 beat (16th note)
                BGMManager.current16thNote++;
                if (BGMManager.current16thNote === 64) BGMManager.current16thNote = 0;
            }
            BGMManager.timerID = window.setTimeout(BGMManager.scheduler, BGMManager.lookahead);
        },

        start: () => {
            if (BGMManager.isPlaying) return;
            if (audioCtx.state === 'suspended') audioCtx.resume();
            BGMManager.isPlaying = true;
            BGMManager.current16thNote = 0;
            BGMManager.nextNoteTime = audioCtx.currentTime + 0.1;
            BGMManager.scheduler();
        },
        stop: () => {
            BGMManager.isPlaying = false;
            window.clearTimeout(BGMManager.timerID);
        }
    };

    // --- Initialization ---

    function initGame() {
        score = 0;
        bossHP = MAX_BOSS_HP;
        updateUI();
        isGameActive = true;
        isProcessing = false;
        selectedTile = null;

        gridContainer.innerHTML = '';
        grid = [];

        for (let r = 0; r < GRID_SIZE; r++) {
            let row = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                let type;
                do {
                    type = Math.floor(Math.random() * TILE_TYPES) + 1;
                } while (
                    (r >= 2 && grid[r - 1][c].type === type && grid[r - 2][c].type === type) ||
                    (c >= 2 && row[c - 1].type === type && row[c - 2].type === type)
                );

                const tileElement = createTileElement(r, c, type);
                gridContainer.appendChild(tileElement);
                row.push({ type, element: tileElement, r, c });
            }
            grid.push(row);
        }

        BGMManager.start();
    }

    function createTileElement(r, c, type) {
        const tile = document.createElement('div');
        tile.classList.add('tile');
        tile.dataset.row = r;
        tile.dataset.col = c;

        const img = document.createElement('img');
        img.src = ASSETS[type];
        tile.appendChild(img);

        tile.addEventListener('click', () => handleTileClick(r, c));
        return tile;
    }

    function updateTileVisuals(r, c) {
        const tile = grid[r][c];
        const img = tile.element.querySelector('img');
        img.src = ASSETS[tile.type];
        tile.element.classList.remove('selected');
        tile.element.style.opacity = '1';
        tile.element.style.transform = 'none';
        tile.element.style.transition = 'none';
    }

    // --- Input Handling ---

    function handleTileClick(r, c) {
        if (!isGameActive || isProcessing) return;

        const clickedTile = grid[r][c];

        if (selectedTile) {
            if (selectedTile.r === r && selectedTile.c === c) {
                deselectTile();
                return;
            }

            const dr = Math.abs(selectedTile.r - r);
            const dc = Math.abs(selectedTile.c - c);

            if (dr + dc === 1) {
                SoundManager.playSwap();
                swapTiles(selectedTile, clickedTile);
                deselectTile();
            } else {
                deselectTile();
                selectTile(r, c);
            }
        } else {
            selectTile(r, c);
        }
    }

    function selectTile(r, c) {
        selectedTile = { r, c };
        grid[r][c].element.classList.add('selected');
    }

    function deselectTile() {
        if (selectedTile) {
            grid[selectedTile.r][selectedTile.c].element.classList.remove('selected');
            selectedTile = null;
        }
    }

    async function swapTiles(tileA, tileB) {
        isProcessing = true;

        const typeA = grid[tileA.r][tileA.c].type;
        const typeB = grid[tileB.r][tileB.c].type;

        grid[tileA.r][tileA.c].type = typeB;
        grid[tileB.r][tileB.c].type = typeA;

        updateTileVisuals(tileA.r, tileA.c);
        updateTileVisuals(tileB.r, tileB.c);

        const matches = findMatches();

        if (matches.length > 0) {
            await processMatches(matches);
        } else {
            await new Promise(r => setTimeout(r, 200));
            grid[tileA.r][tileA.c].type = typeA;
            grid[tileB.r][tileB.c].type = typeB;
            updateTileVisuals(tileA.r, tileA.c);
            updateTileVisuals(tileB.r, tileB.c);
            isProcessing = false;
        }
    }

    // --- Match Logic ---

    function findMatches() {
        let matches = new Set();
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE - 2; c++) {
                const type = grid[r][c].type;
                if (type === grid[r][c + 1].type && type === grid[r][c + 2].type) {
                    matches.add(`${r},${c}`); matches.add(`${r},${c + 1}`); matches.add(`${r},${c + 2}`);
                }
            }
        }
        for (let c = 0; c < GRID_SIZE; c++) {
            for (let r = 0; r < GRID_SIZE - 2; r++) {
                const type = grid[r][c].type;
                if (type === grid[r + 1][c].type && type === grid[r + 2][c].type) {
                    matches.add(`${r},${c}`); matches.add(`${r + 1},${c}`); matches.add(`${r + 2},${c}`);
                }
            }
        }
        return Array.from(matches).map(str => {
            const [r, c] = str.split(',').map(Number);
            return { r, c };
        });
    }

    async function processMatches(matches, multiplier = 1) {
        SoundManager.playMatch();
        let damage = 0;
        let matchScore = 0;

        matches.forEach(m => {
            const type = grid[m.r][m.c].type;
            let s = 10;
            if (type === 1) { damage += 5; s += 50; }
            else if (type === 7) { damage += 3; }
            else if (type === 3 || type === 5) { s = -5; }
            else { damage += 1; }

            s = Math.floor(s * multiplier);
            matchScore += s;

            showFloatingText(m.r, m.c, s, multiplier);
            grid[m.r][m.c].element.classList.add('popping');
        });

        score += matchScore;
        bossHP = Math.max(0, bossHP - damage * multiplier);
        updateUI();

        await new Promise(r => setTimeout(r, 300));

        applyGravity(matches);

        const newMatches = findMatches();
        if (newMatches.length > 0) {
            await processMatches(newMatches, multiplier * 2);
        } else {
            isProcessing = false;
        }
    }

    function showFloatingText(r, c, amount, multiplier) {
        const tile = grid[r][c].element;
        const rect = tile.getBoundingClientRect();
        const containerRect = gridContainer.getBoundingClientRect();

        const el = document.createElement('div');
        el.classList.add('floating-score');

        let text = amount >= 0 ? `+${amount}` : amount;
        if (multiplier > 1) {
            text += ` x${multiplier}!`;
            el.style.fontSize = '28px';
            el.style.zIndex = '30';
        }

        el.textContent = text;
        el.style.color = amount >= 0 ? '#ffd700' : '#ff4444';

        el.style.left = `${rect.left - containerRect.left + rect.width / 2 - 20}px`;
        el.style.top = `${rect.top - containerRect.top}px`;

        gridContainer.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    function applyGravity(matches) {
        matches.forEach(m => {
            grid[m.r][m.c].type = -1;
            grid[m.r][m.c].element.classList.remove('popping');
            grid[m.r][m.c].element.style.opacity = '1';
            grid[m.r][m.c].element.style.transform = 'none';
        });

        const drops = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));

        for (let c = 0; c < GRID_SIZE; c++) {
            let emptyCount = 0;
            for (let r = GRID_SIZE - 1; r >= 0; r--) {
                if (grid[r][c].type === -1) {
                    emptyCount++;
                } else if (emptyCount > 0) {
                    grid[r + emptyCount][c].type = grid[r][c].type;
                    grid[r][c].type = -1;
                    drops[r + emptyCount][c] = emptyCount;
                }
            }
            for (let r = 0; r < emptyCount; r++) {
                grid[r][c].type = Math.floor(Math.random() * TILE_TYPES) + 1;
                drops[r][c] = emptyCount + 1;
            }
        }

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                updateTileVisuals(r, c);

                if (drops[r][c] > 0) {
                    const tile = grid[r][c].element;
                    tile.style.transition = 'none';
                    tile.style.transform = `translateY(-${drops[r][c] * 100}%)`;
                    void tile.offsetWidth;
                    tile.style.transition = 'transform 0.3s ease-in';
                    tile.style.transform = 'translateY(0)';
                }
            }
        }
    }

    // --- Skills ---
    function activateSkill(btn, action, cooldownMs) {
        if (btn.disabled) return;
        SoundManager.playSkill();
        action();
        btn.disabled = true;
        btn.style.opacity = '0.5';
        setTimeout(() => {
            btn.disabled = false;
            btn.style.opacity = '1';
        }, cooldownMs);
    }

    skillLaxative.addEventListener('click', () => {
        if (!isGameActive || isProcessing) return;
        activateSkill(skillLaxative, async () => {
            isProcessing = true;
            let types = [];
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) types.push(grid[r][c].type);
            }
            for (let i = types.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [types[i], types[j]] = [types[j], types[i]];
            }
            let idx = 0;
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    grid[r][c].type = types[idx++];
                    updateTileVisuals(r, c);
                }
            }
            const matches = findMatches();
            if (matches.length > 0) await processMatches(matches);
            else isProcessing = false;
        }, 5000);
    });

    skillDrink.addEventListener('click', () => {
        if (!isGameActive || isProcessing) return;
        activateSkill(skillDrink, async () => {
            isProcessing = true;
            let changed = false;
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const t = grid[r][c].type;
                    if (t === 3 || t === 5 || t === 6) {
                        grid[r][c].type = 2;
                        updateTileVisuals(r, c);
                        changed = true;
                    }
                }
            }
            if (changed) {
                const matches = findMatches();
                if (matches.length > 0) await processMatches(matches);
                else isProcessing = false;
            } else isProcessing = false;
        }, 8000);
    });

    function updateUI() {
        scoreDisplay.textContent = score;
        bossHpFill.style.width = `${(bossHP / MAX_BOSS_HP) * 100}%`;
        if (bossHP <= 0) {
            SoundManager.playWin();
            bossHP = MAX_BOSS_HP;
            alert("Boss Defeated! Level Up!");
        }
    }

    startBtn.addEventListener('click', () => {
        titleScreen.classList.add('hidden');
        initGame();
    });

    restartBtn.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        initGame();
    });
});
