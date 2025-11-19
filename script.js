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
            // Toilet Flush Sound Synthesis
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const bufferSize = audioCtx.sampleRate * 1.0; // 1.0 seconds
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);

            // White Noise
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 1;

            const gain = audioCtx.createGain();

            // Filter Sweep (Whoosh)
            filter.frequency.setValueAtTime(800, audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.8);

            // Volume Envelope
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

    const BGMManager = {
        isPlaying: false,
        interval: null,
        noteIndex: 0,
        // Fun upbeat melody (approx 120 BPM)
        melody: [
            // Intro
            { f: 523.25, d: 200 }, { f: 659.25, d: 200 }, { f: 783.99, d: 200 }, { f: 1046.50, d: 400 }, // C E G C
            { f: 783.99, d: 200 }, { f: 1046.50, d: 400 }, { f: 783.99, d: 200 }, // G C G
            { f: 880.00, d: 200 }, { f: 987.77, d: 200 }, { f: 1046.50, d: 400 }, { f: 0, d: 400 }, // A B C (rest)

            // Theme A
            { f: 523.25, d: 300 }, { f: 392.00, d: 100 }, { f: 523.25, d: 200 }, { f: 659.25, d: 200 }, // C G C E
            { f: 587.33, d: 400 }, { f: 392.00, d: 400 }, // D G
            { f: 523.25, d: 300 }, { f: 392.00, d: 100 }, { f: 523.25, d: 200 }, { f: 659.25, d: 200 }, // C G C E
            { f: 587.33, d: 400 }, { f: 783.99, d: 400 }, // D G

            { f: 880.00, d: 300 }, { f: 783.99, d: 100 }, { f: 698.46, d: 200 }, { f: 659.25, d: 200 }, // A G F E
            { f: 587.33, d: 200 }, { f: 523.25, d: 200 }, { f: 587.33, d: 400 }, // D C D
            { f: 392.00, d: 200 }, { f: 440.00, d: 200 }, { f: 493.88, d: 200 }, { f: 587.33, d: 200 }, // G A B D
            { f: 523.25, d: 800 }, // C (Long)

            // Theme B (Up a bit)
            { f: 783.99, d: 300 }, { f: 659.25, d: 100 }, { f: 783.99, d: 200 }, { f: 880.00, d: 200 }, // G E G A
            { f: 783.99, d: 400 }, { f: 659.25, d: 400 }, // G E
            { f: 587.33, d: 300 }, { f: 523.25, d: 100 }, { f: 587.33, d: 200 }, { f: 659.25, d: 200 }, // D C D E
            { f: 523.25, d: 400 }, { f: 392.00, d: 400 }, // C G

            { f: 440.00, d: 200 }, { f: 440.00, d: 200 }, { f: 523.25, d: 200 }, { f: 587.33, d: 200 }, // A A C D
            { f: 659.25, d: 200 }, { f: 659.25, d: 200 }, { f: 587.33, d: 200 }, { f: 523.25, d: 200 }, // E E D C
            { f: 587.33, d: 400 }, { f: 783.99, d: 400 }, // D G
            { f: 523.25, d: 800 }, // C

            // Bridge
            { f: 349.23, d: 200 }, { f: 440.00, d: 200 }, { f: 523.25, d: 400 }, // F A C
            { f: 349.23, d: 200 }, { f: 440.00, d: 200 }, { f: 523.25, d: 400 }, // F A C
            { f: 392.00, d: 200 }, { f: 493.88, d: 200 }, { f: 587.33, d: 400 }, // G B D
            { f: 392.00, d: 200 }, { f: 493.88, d: 200 }, { f: 587.33, d: 400 }, // G B D

            { f: 1046.50, d: 200 }, { f: 987.77, d: 200 }, { f: 880.00, d: 200 }, { f: 783.99, d: 200 }, // C B A G
            { f: 698.46, d: 200 }, { f: 659.25, d: 200 }, { f: 587.33, d: 200 }, { f: 523.25, d: 200 }, // F E D C
            { f: 587.33, d: 400 }, { f: 783.99, d: 400 }, // D G
            { f: 1046.50, d: 800 }, // High C
            { f: 0, d: 400 } // Rest
        ],
        start: () => {
            if (BGMManager.isPlaying) return;
            BGMManager.isPlaying = true;
            BGMManager.playNextNote();
        },
        stop: () => {
            BGMManager.isPlaying = false;
            clearTimeout(BGMManager.interval);
        },
        playNextNote: () => {
            if (!BGMManager.isPlaying) return;
            const note = BGMManager.melody[BGMManager.noteIndex];

            if (note.f > 0) { // If not rest
                if (audioCtx.state === 'suspended') audioCtx.resume();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                // Use Triangle wave for a "flute-like" or "8-bitish" pleasant sound
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, audioCtx.currentTime);

                // Envelope
                gain.gain.setValueAtTime(0.05, audioCtx.currentTime); // Low volume
                gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + (note.d / 1000) - 0.05);
                gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + (note.d / 1000));

                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + (note.d / 1000));
            }

            BGMManager.noteIndex = (BGMManager.noteIndex + 1) % BGMManager.melody.length;
            BGMManager.interval = setTimeout(BGMManager.playNextNote, note.d);
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
