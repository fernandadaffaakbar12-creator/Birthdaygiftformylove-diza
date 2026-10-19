// ==========================================
// 0. ANIMASI LOADING "I LOVE YOU" MEMBENTUK HATI
// ==========================================
(function () {
    function initMiniGame() {
        const miniGameScreen = document.getElementById('mini-game-screen');
        const gameArea = document.getElementById('game-area');
        const player = document.getElementById('player-catcher');
        const fallingContainer = document.getElementById('falling-items-container');
        const fxLayer = document.getElementById('fx-layer');
        const bouquetCountEl = document.getElementById('bouquet-count');
        const bouquetSlots = document.querySelectorAll('.b-slot');
        const progressFill = document.getElementById('game-progress-fill');
        const gameToast = document.getElementById('game-toast');
        const winOverlay = document.getElementById('game-win-overlay');
        const btnLeft = document.getElementById('btn-move-left');
        const btnRight = document.getElementById('btn-move-right');

        if (!gameArea || !player || !miniGameScreen) return;

        // =============================================
        // AUDIO SYNTHESIZER (Web Audio API - Zero Assets)
        // =============================================
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        let audioCtx = null;

        function getAudioContext() {
            if (!audioCtx && AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => { });
            }
            return audioCtx;
        }

        function playCatchSound() {
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.28);
            } catch (e) { }
        }

        function playBombSound() {
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const now = ctx.currentTime;
                // Low pitch drop
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.48);
            } catch (e) { }
        }

        function playWinSound() {
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                const now = ctx.currentTime;
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    const start = now + idx * 0.12;
                    osc.frequency.setValueAtTime(freq, start);
                    gain.gain.setValueAtTime(0.28, start);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(start);
                    osc.stop(start + 0.4);
                });
            } catch (e) { }
        }

        // =============================================
        // GAME STATE
        // =============================================
        const TARGET_BOUQUETS = 5;
        let bouquetsCaught = 0;
        let isGameOver = false;
        let animationFrameId = null;
        let spawnIntervalId = null;
        let items = [];
        let toastTimeout = null;

        let arenaWidth = gameArea.clientWidth || 340;
        let arenaHeight = gameArea.clientHeight || 350;
        let playerX = arenaWidth / 2;
        let targetPlayerX = arenaWidth / 2;
        const PLAYER_HALF_W = 34;

        function updateArenaDimensions() {
            const rect = gameArea.getBoundingClientRect();
            if (rect.width > 0) arenaWidth = rect.width;
            if (rect.height > 0) arenaHeight = rect.height;
            targetPlayerX = Math.max(PLAYER_HALF_W, Math.min(arenaWidth - PLAYER_HALF_W, targetPlayerX));
        }
        updateArenaDimensions();
        window.addEventListener('resize', updateArenaDimensions);

        // Background floating particles
        createBgParticles();
        function createBgParticles() {
            const container = miniGameScreen.querySelector('.game-bg-particles');
            if (!container || container.children.length > 0) return;
            for (let i = 0; i < 20; i++) {
                const p = document.createElement('div');
                p.classList.add('game-bg-particle');
                p.style.left = Math.random() * 100 + '%';
                p.style.top = Math.random() * 100 + '%';
                p.style.animationDelay = (Math.random() * 6) + 's';
                p.style.animationDuration = (4 + Math.random() * 4) + 's';
                p.style.width = (3 + Math.random() * 3) + 'px';
                p.style.height = p.style.width;
                container.appendChild(p);
            }
        }

        function showToast(text, className) {
            if (!gameToast) return;
            gameToast.textContent = text;
            gameToast.className = 'game-toast ' + (className || '');
            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                if (!isGameOver && gameToast) {
                    gameToast.textContent = 'Mai kaer! ' + (TARGET_BOUQUETS - bouquetsCaught) + ' Buquê tan! 💐';
                    gameToast.className = 'game-toast';
                }
            }, 2500);
        }

        // =============================================
        // SPAWN FALLING ITEMS (Bouquets & Bombs)
        // =============================================
        let spawnCounter = 0;

        function spawnFallingItem() {
            if (isGameOver || !fallingContainer) return;
            spawnCounter++;

            // Ensure first 2 items are always bouquets so user gets familiar
            let isBomb = false;
            if (spawnCounter > 2) {
                // ~25% chance of bomb
                isBomb = Math.random() < 0.28;
            }

            const itemEl = document.createElement('div');
            itemEl.className = 'falling-item ' + (isBomb ? 'falling-bomb' : 'falling-bouquet');

            if (isBomb) {
                itemEl.innerHTML = '<div class="bomb-wrap"><div class="bomb-spark">🔥</div><div class="bomb-body">💣</div></div>';
            } else {
                itemEl.innerHTML = '<img src="img/bouquet.png" alt="Bouquet" draggable="false">';
            }

            const itemWidth = 44;
            const startX = Math.random() * (arenaWidth - itemWidth - 24) + 12;
            const startY = -48;
            const speed = isBomb ? (2.4 + Math.random() * 0.8) : (2.2 + Math.random() * 0.7);
            const seed = Math.random() * 100;

            fallingContainer.appendChild(itemEl);

            items.push({
                el: itemEl,
                type: isBomb ? 'bomb' : 'bouquet',
                x: startX,
                y: startY,
                speed: speed,
                seed: seed,
                width: itemWidth,
                height: itemWidth
            });
        }

        // =============================================
        // FLOATING EFFECTS (Particles & Popups)
        // =============================================
        function createCatchFx(x, y) {
            if (!fxLayer) return;
            const fx = document.createElement('div');
            fx.className = 'fx-float-score';
            fx.textContent = '+1 💐';
            fx.style.left = x + 'px';
            fx.style.top = y + 'px';
            fxLayer.appendChild(fx);
            setTimeout(() => fx.remove(), 800);
        }

        function createExplosionFx(x, y) {
            if (!fxLayer) return;
            const exp = document.createElement('div');
            exp.className = 'fx-explosion';
            exp.textContent = '💥';
            exp.style.left = x + 'px';
            exp.style.top = y + 'px';
            fxLayer.appendChild(exp);
            setTimeout(() => exp.remove(), 600);
        }

        // =============================================
        // VICTORY CONFETTI
        // =============================================
        function triggerConfettiBurst() {
            if (!gameArea) return;
            const colors = ['#ff1493', '#ff69b4', '#ffb6c1', '#ffd700', '#ffffff', '#ff4081'];
            const icons = ['🌸', '💐', '✨', '💖', '🎉'];

            for (let i = 0; i < 30; i++) {
                const c = document.createElement('div');
                c.style.position = 'absolute';
                c.style.left = '50%';
                c.style.top = '50%';
                c.style.fontSize = (12 + Math.random() * 14) + 'px';
                c.style.color = colors[Math.floor(Math.random() * colors.length)];
                c.style.pointerEvents = 'none';
                c.style.zIndex = '60';
                c.textContent = icons[Math.floor(Math.random() * icons.length)];

                const destX = (Math.random() - 0.5) * (arenaWidth * 0.9);
                const destY = (Math.random() - 0.5) * (arenaHeight * 0.8) - 40;
                const rot = (Math.random() - 0.5) * 720;
                const duration = 0.8 + Math.random() * 0.8;

                c.style.transition = 'all ' + duration + 's cubic-bezier(0.25, 1, 0.5, 1)';
                c.style.transform = 'translate(-50%, -50%) scale(0.5)';
                c.style.opacity = '1';

                gameArea.appendChild(c);

                requestAnimationFrame(() => {
                    c.style.transform = 'translate(' + destX + 'px, ' + destY + 'px) rotate(' + rot + 'deg) scale(' + (1 + Math.random() * 0.5) + ')';
                    c.style.opacity = '0';
                });

                setTimeout(() => c.remove(), duration * 1000);
            }
        }

        // =============================================
        // WIN HANDLER -> TRANSITION TO NEXT PAGE
        // =============================================
        function handleWin() {
            isGameOver = true;
            if (spawnIntervalId) clearInterval(spawnIntervalId);

            // Clean up remaining bombs
            items.forEach(item => {
                if (item.type === 'bomb' && item.el) {
                    item.el.remove();
                }
            });
            items = items.filter(item => item.type !== 'bomb');

            playWinSound();
            triggerConfettiBurst();
            showToast('🎉 Horeee! Buquê 5 konsege halibur hotu ona! 💐🎉', 'toast-win');

            if (winOverlay) {
                winOverlay.style.display = 'flex';
            }

            // Transition to landing-page after celebration
            setTimeout(() => {
                miniGameScreen.style.transition = 'opacity 1s ease';
                miniGameScreen.style.opacity = '0';
                setTimeout(() => {
                    miniGameScreen.style.display = 'none';
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    const landingPage = document.getElementById('landing-page');
                    if (landingPage) landingPage.style.display = '';
                }, 1000);
            }, 1800);
        }

        // =============================================
        // GAME LOOP (RequestAnimationFrame)
        // =============================================
        function gameLoop() {
            if (isGameOver) return;

            // Smooth lerp player movement
            playerX += (targetPlayerX - playerX) * 0.35;
            player.style.left = playerX + 'px';

            // Catch zone boundaries (around Stitch's basket/hands)
            const catchYTop = arenaHeight - 74;
            const catchYBottom = arenaHeight - 8;
            const catchRadius = 38;

            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];

                item.y += item.speed;
                // Gentle floating sway
                item.x += Math.sin((item.y + item.seed) * 0.04) * 0.7;
                item.x = Math.max(8, Math.min(arenaWidth - item.width - 8, item.x));

                item.el.style.transform = 'translate(' + item.x + 'px, ' + item.y + 'px)';

                const itemCenterY = item.y + item.height * 0.5;
                const itemCenterX = item.x + item.width * 0.5;

                // Check collision with player
                if (itemCenterY >= catchYTop && itemCenterY <= catchYBottom) {
                    const dist = Math.abs(itemCenterX - playerX);

                    if (dist < catchRadius) {
                        // HIT!
                        if (item.type === 'bouquet') {
                            // Caught Bouquet!
                            bouquetsCaught++;
                            playCatchSound();
                            createCatchFx(itemCenterX, itemCenterY);

                            // Bounce animation for Stitch
                            player.classList.remove('catch-bounce');
                            void player.offsetWidth;
                            player.classList.add('catch-bounce');

                            // Update score & slots
                            if (bouquetCountEl) bouquetCountEl.textContent = bouquetsCaught;
                            if (progressFill) progressFill.style.width = ((bouquetsCaught / TARGET_BOUQUETS) * 100) + '%';
                            if (bouquetSlots[bouquetsCaught - 1]) {
                                bouquetSlots[bouquetsCaught - 1].classList.add('active');
                            }

                            showToast('+1 Bouquet! (' + bouquetsCaught + '/' + TARGET_BOUQUETS + ') 💐', 'toast-catch');

                            // Remove caught item
                            item.el.remove();
                            items.splice(i, 1);

                            if (bouquetsCaught >= TARGET_BOUQUETS) {
                                handleWin();
                                return;
                            }
                            continue;
                        } else if (item.type === 'bomb') {
                            // Caught Bomb!
                            playBombSound();
                            createExplosionFx(itemCenterX, itemCenterY);
                            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

                            // Arena shake
                            gameArea.classList.remove('shake-arena');
                            void gameArea.offsetWidth;
                            gameArea.classList.add('shake-arena');

                            // Stitch dizzy animation
                            player.classList.add('dizzy');
                            setTimeout(() => player.classList.remove('dizzy'), 900);

                            // RESET SCORE TO 0!
                            bouquetsCaught = 0;
                            if (bouquetCountEl) bouquetCountEl.textContent = '0';
                            if (progressFill) progressFill.style.width = '0%';
                            bouquetSlots.forEach(slot => slot.classList.remove('active'));

                            showToast('💥 Monu ba BOM! Buquê fila fali ba 0! Kuidadu diak, eee~ 😭', 'toast-bomb');

                            // Remove exploded bomb
                            item.el.remove();
                            items.splice(i, 1);
                            continue;
                        }
                    }
                }

                // Remove when fallen off screen
                if (item.y > arenaHeight + 20) {
                    item.el.remove();
                    items.splice(i, 1);
                }
            }

            animationFrameId = requestAnimationFrame(gameLoop);
        }

        // =============================================
        // CONTROLS (Touch, Pointer, Keyboard & Buttons)
        // =============================================
        function handlePointer(clientX) {
            if (isGameOver) return;
            const rect = gameArea.getBoundingClientRect();
            const x = clientX - rect.left;
            targetPlayerX = Math.max(PLAYER_HALF_W, Math.min(arenaWidth - PLAYER_HALF_W, x));
        }

        gameArea.addEventListener('pointerdown', (e) => {
            getAudioContext();
            handlePointer(e.clientX);
        });

        gameArea.addEventListener('pointermove', (e) => {
            if (e.buttons > 0 || e.pointerType === 'touch' || e.pointerType === 'pen') {
                handlePointer(e.clientX);
            }
        });

        // Keyboard Controls
        const keys = { left: false, right: false };
        let keyInterval = null;

        function startKeyLoop() {
            if (keyInterval) return;
            keyInterval = setInterval(() => {
                if (isGameOver) return;
                const STEP = 8;
                if (keys.left) targetPlayerX = Math.max(PLAYER_HALF_W, targetPlayerX - STEP);
                if (keys.right) targetPlayerX = Math.min(arenaWidth - PLAYER_HALF_W, targetPlayerX + STEP);
            }, 16);
        }

        function stopKeyLoop() {
            if (!keys.left && !keys.right && keyInterval) {
                clearInterval(keyInterval);
                keyInterval = null;
            }
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                keys.left = true;
                startKeyLoop();
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                keys.right = true;
                startKeyLoop();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                keys.left = false;
                stopKeyLoop();
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                keys.right = false;
                stopKeyLoop();
            }
        });

        // Touch Pill Buttons (Left & Right)
        function setupHoldButton(btn, direction) {
            if (!btn) return;
            let btnInterval = null;

            const startMove = (e) => {
                e.preventDefault();
                getAudioContext();
                targetPlayerX = Math.max(PLAYER_HALF_W, Math.min(arenaWidth - PLAYER_HALF_W, targetPlayerX + direction * 18));
                clearInterval(btnInterval);
                btnInterval = setInterval(() => {
                    targetPlayerX = Math.max(PLAYER_HALF_W, Math.min(arenaWidth - PLAYER_HALF_W, targetPlayerX + direction * 8));
                }, 20);
            };

            const stopMove = () => {
                clearInterval(btnInterval);
            };

            btn.addEventListener('pointerdown', startMove);
            btn.addEventListener('pointerup', stopMove);
            btn.addEventListener('pointercancel', stopMove);
            btn.addEventListener('pointerleave', stopMove);
        }

        setupHoldButton(btnLeft, -1);
        setupHoldButton(btnRight, 1);

        // =============================================
        // START GAME
        // =============================================
        // Reset everything
        bouquetsCaught = 0;
        isGameOver = false;
        items.forEach(it => it.el && it.el.remove());
        items = [];
        if (fallingContainer) fallingContainer.innerHTML = '';
        if (fxLayer) fxLayer.innerHTML = '';
        if (bouquetCountEl) bouquetCountEl.textContent = '0';
        if (progressFill) progressFill.style.width = '0%';
        bouquetSlots.forEach(s => s.classList.remove('active'));
        if (winOverlay) winOverlay.style.display = 'none';

        updateArenaDimensions();
        playerX = arenaWidth / 2;
        targetPlayerX = arenaWidth / 2;
        player.style.left = playerX + 'px';

        showToast('Mai, kaer Stitch atu kaer buquê 5! 💐', '');

        // Start animation loop & item spawner
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (spawnIntervalId) clearInterval(spawnIntervalId);

        animationFrameId = requestAnimationFrame(gameLoop);
        spawnIntervalId = setInterval(spawnFallingItem, 1000);
        // Spawn first bouquet immediately
        setTimeout(spawnFallingItem, 400);
    }

    function initPinLogic() {
        // ==========================================
        // PIN VALIDATION LOGIC (Pop-Up Notifikasi)
        // ==========================================
        const pinInput = document.getElementById('pin-input');
        const pinPopupOverlay = document.getElementById('pin-popup-overlay');
        const pinPopupBox = document.getElementById('pin-popup-box');
        const pinPopupImg = document.getElementById('pin-popup-img');
        const pinPopupEmoji = document.getElementById('pin-popup-emoji');
        const pinPopupMsg = document.getElementById('pin-popup-msg');
        const pinPopupClose = document.getElementById('pin-popup-close');

        // DEFAULT PIN (18 Oktober = 1810)
        const SECRET_PIN = "1810";

        let pinAttempt = 0;
        let popupTimeout = null;

        // Konfigurasi pesan & tampilan setiap percobaan salah
        const wrongConfigs = [
            {
                // Percobaan pertama: tampilkan foto kucing
                showCat: true,
                catSrc: 'img/cat-warning.png',
                emoji: '',
                message: 'Masa Ita nia Loron Aniversariu Doben Haluha?',
                buttonText: 'Ya ya Deskulpa 😭'
            },
            {
                // Percobaan kedua: foto kucing marah
                showCat: true,
                catSrc: 'img/cat-angry.png',
                emoji: '',
                message: 'Seriu, haluha ona?!\nDiak, koko tenta fali!',
                buttonText: 'Dala ida tan!🙏'
            },
            {
                // Percobaan ketiga+: foto kucing thumbs up
                showCat: true,
                catSrc: 'img/cat-thumbsup.png',
                emoji: '',
                message: "Se karik sala nafatin,\nida-ne'e barak liu ona!",
                buttonText: 'Perdua!😭'
            }
        ];

        function showPinPopup(config, isSuccess) {
            // Bersihkan timeout sebelumnya
            if (popupTimeout) clearTimeout(popupTimeout);

            // Reset semua state
            pinPopupBox.classList.remove('popup-success', 'shake-popup');
            pinPopupImg.classList.remove('wiggle-cat', 'hidden-img');
            pinPopupEmoji.classList.remove('show-emoji');
            pinPopupEmoji.textContent = '';

            if (isSuccess) {
                // Tampilan sukses — pakai foto kucing senang
                pinPopupImg.src = 'img/cat-succes.png';
                pinPopupImg.classList.remove('hidden-img');
                pinPopupBox.classList.add('popup-success');
                pinPopupMsg.textContent = config.message;
                pinPopupClose.textContent = config.buttonText;
                setTimeout(() => {
                    pinPopupImg.classList.add('wiggle-cat');
                }, 400);
            } else {
                // Tampilan salah
                if (config.showCat) {
                    // Tampilkan gambar kucing + animasi wiggle
                    pinPopupImg.src = config.catSrc || 'img/cat-warning.png';
                    pinPopupImg.classList.remove('hidden-img');
                    setTimeout(() => {
                        pinPopupImg.classList.add('wiggle-cat');
                    }, 400);
                } else {
                    // Sembunyikan gambar, tampilkan emoji
                    pinPopupImg.classList.add('hidden-img');
                    pinPopupEmoji.textContent = config.emoji;
                    pinPopupEmoji.classList.add('show-emoji');
                    // Tambah padding atas karena tidak ada gambar yang menonjol
                    pinPopupBox.style.paddingTop = '30px';
                }

                pinPopupMsg.textContent = config.message;
                pinPopupClose.textContent = config.buttonText;

                // Shake animation setelah muncul
                setTimeout(() => {
                    pinPopupBox.classList.add('shake-popup');
                }, 500);
            }

            // Tampilkan pop-up
            pinPopupOverlay.classList.add('show-popup');
        }

        function closePinPopup() {
            pinPopupOverlay.classList.remove('show-popup');
            if (popupTimeout) clearTimeout(popupTimeout);
            // Reset padding
            pinPopupBox.style.paddingTop = '';
        }

        // Event listener untuk tombol tutup
        if (pinPopupClose) {
            pinPopupClose.addEventListener('click', closePinPopup);
        }

        // Tutup pop-up dengan klik overlay (di luar box)
        if (pinPopupOverlay) {
            pinPopupOverlay.addEventListener('click', function (e) {
                if (e.target === pinPopupOverlay) {
                    closePinPopup();
                }
            });
        }

        if (pinInput) {
            pinInput.addEventListener('input', function () {
                if (pinInput.value.length === 4) {
                    // Delay sedikit agar digit terakhir terasa diketik
                    setTimeout(() => {
                        if (pinInput.value === SECRET_PIN || pinInput.value === "1605") {
                            // PIN BENAR
                            showPinPopup({
                                message: 'Validd!\nKontinua Letss goo',
                                buttonText: 'Lanjut 💕'
                            }, true);

                            // Auto-close dan lanjut setelah 2 detik
                            popupTimeout = setTimeout(() => {
                                closePinPopup();
                                setTimeout(() => {
                                    const pinScreen = document.getElementById('pin-screen');

                                    // 1. Fade out PIN screen
                                    pinScreen.classList.remove('active');

                                    // 2. Wait for fade out to complete (1 detik)
                                    setTimeout(() => {
                                        pinScreen.style.display = 'none';

                                        const loadingScreen = document.getElementById('mini-game-screen');
                                        if (loadingScreen) {
                                            loadingScreen.style.display = 'flex';

                                            // 3. Jeda sedikit lalu jalankan Fade in Mini Game
                                            setTimeout(() => {
                                                loadingScreen.style.opacity = '1';

                                                // 4. Inisialisasi game setelah mulai muncul
                                                initMiniGame();
                                            }, 50);
                                        }
                                    }, 1000);
                                }, 300);
                            }, 2000);

                            // Juga lanjut saat tombol diklik
                            pinPopupClose.onclick = function () {
                                closePinPopup();
                                setTimeout(() => {
                                    const pinScreen = document.getElementById('pin-screen');

                                    // 1. Fade out PIN screen
                                    pinScreen.classList.remove('active');

                                    // 2. Wait for fade out to complete (1 detik)
                                    setTimeout(() => {
                                        pinScreen.style.display = 'none';

                                        const loadingScreen = document.getElementById('mini-game-screen');
                                        if (loadingScreen) {
                                            loadingScreen.style.display = 'flex';

                                            // 3. Jeda sedikit lalu jalankan Fade in Mini Game
                                            setTimeout(() => {
                                                loadingScreen.style.opacity = '1';

                                                // 4. Inisialisasi game setelah mulai muncul
                                                initMiniGame();
                                            }, 50);
                                        }
                                    }, 1000);
                                }, 300);
                            };
                        } else {
                            // PIN SALAH
                            const configIndex = Math.min(pinAttempt, wrongConfigs.length - 1);
                            showPinPopup(wrongConfigs[configIndex], false);
                            pinAttempt++;

                            pinInput.classList.add('shake-animation');
                            setTimeout(() => pinInput.classList.remove('shake-animation'), 400);
                            pinInput.value = '';

                            // Reset tombol close ke default
                            pinPopupClose.onclick = closePinPopup;
                        }
                    }, 150);
                }
            });
        }
    }

    function buatSparkles(container, heartPoints, centerX, centerY) {
        const sparkleInterval = setInterval(() => {
            const sparkle = document.createElement('div');
            sparkle.classList.add('heart-sparkle');

            const randomPoint = heartPoints[Math.floor(Math.random() * heartPoints.length)];
            const offsetX = -15 + Math.random() * 30;
            const offsetY = -15 + Math.random() * 30;

            sparkle.style.left = (centerX + randomPoint.x + offsetX) + 'px';
            sparkle.style.top = (centerY + randomPoint.y + offsetY) + 'px';
            sparkle.style.animation = 'sparkleFloat ' + (1.5 + Math.random() * 1.5) + 's ease-out forwards';

            container.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 3000);
        }, 400);

        document.getElementById('love-loading-screen').addEventListener('click', () => {
            clearInterval(sparkleInterval);
        }, { once: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPinLogic);
    } else {
        initPinLogic();
    }
})();

// ==========================================
// 1. FUNGSI FOTO MEMBESAR (LIGHTBOX) & PEMUTAR MUSIK
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
    const daftarFoto = document.querySelectorAll('.gallery-scroll img, .polaroid, .planet-card');
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalIframe = document.getElementById('modal-iframe'); // Panggil elemen iframe
    const modalCaption = document.getElementById('modal-caption');

    if (daftarFoto.length > 0 && modal && modalImg) {
        daftarFoto.forEach(foto => {
            foto.addEventListener('click', function () {

                // Reset layar setiap kali diklik
                if (modalCaption) modalCaption.innerText = "";
                modalImg.style.display = 'block'; // Tampilkan foto sebagai default
                modalIframe.style.display = 'none'; // Sembunyikan musik sebagai default
                modalIframe.src = ""; // Kosongkan lagu sebelumnya

                // A. JIKA YANG DIKLIK ADALAH KARTU LAGU/VIDEO (Punya data-embed)
                if (this.classList.contains('planet-card') && this.hasAttribute('data-embed')) {
                    modalImg.style.display = 'none'; // Sembunyikan foto
                    modalIframe.style.display = 'block'; // Tampilkan alat musik/video

                    const embedUrl = this.getAttribute('data-embed');
                    modalIframe.src = embedUrl; // Masukkan link

                    // Jeda musik latar agar tidak bertabrakan dengan lagu YouTube
                    const bgMusic = document.getElementById('bg-music');
                    if (bgMusic && !bgMusic.paused) {
                        bgMusic.pause();
                        bgMusic.dataset.resumeAfterModal = 'true';
                    }

                    // Hapus class lama
                    modalIframe.classList.remove('iframe-spotify', 'iframe-youtube', 'iframe-facebook');

                    // Deteksi platform untuk penyesuaian rasio (16:9 untuk YouTube, Kotak untuk Spotify, 9:16 untuk Facebook)
                    if (embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')) {
                        modalIframe.classList.add('iframe-youtube');
                    } else if (embedUrl.includes('spotify.com')) {
                        modalIframe.classList.add('iframe-spotify');
                    } else if (embedUrl.includes('facebook.com')) {
                        modalIframe.classList.add('iframe-facebook');
                    }

                    const customCaption = this.getAttribute('data-caption');
                    const teksCaption = customCaption ? customCaption : this.querySelector('.planet-caption').innerText;
                    if (modalCaption) modalCaption.innerText = teksCaption;
                }
                // B. JIKA YANG DIKLIK ADALAH KARTU 3D BIASA (Bukan Lagu)
                else if (this.classList.contains('planet-card')) {
                    modalImg.src = this.querySelector('img').src;
                    modalImg.style.aspectRatio = "3 / 4";

                    const customCaption = this.getAttribute('data-caption');
                    const teksCaption = customCaption ? customCaption : this.querySelector('.planet-caption').innerText;
                    if (modalCaption) modalCaption.innerText = teksCaption;
                }
                // C. JIKA YANG DIKLIK ADALAH POLAROID
                else if (this.classList.contains('polaroid')) {
                    const imgEl = this.querySelector('img');
                    if (imgEl) {
                        modalImg.src = imgEl.src;
                    }
                    modalImg.style.aspectRatio = "3 / 4";
                    modalImg.style.width = "auto";
                    modalImg.style.height = "70vh";
                    modalImg.style.maxWidth = "85vw";
                    modalImg.style.maxHeight = "72vh";
                    modalImg.style.objectFit = "cover";

                    const customCaption = this.getAttribute('data-caption');
                    const capElem = this.querySelector('.caption');
                    const teksCaption = customCaption ? customCaption : (capElem ? capElem.innerText : '');
                    if (modalCaption) modalCaption.innerText = teksCaption;
                }
                // D. JIKA YANG DIKLIK ADALAH GALERI CINTA
                else {
                    modalImg.src = this.src;
                    modalImg.style.aspectRatio = "9 / 16";
                    modalImg.style.width = "auto";
                    modalImg.style.height = "75vh";
                    modalImg.style.maxWidth = "85vw";
                    modalImg.style.maxHeight = "75vh";
                    modalImg.style.objectFit = "cover";
                }

                modal.classList.add('show-modal');
            });
        });
    }

    const semuaTeksKetikan = document.querySelectorAll('.typing-text');
    semuaTeksKetikan.forEach(el => {
        el.setAttribute('data-teks', el.innerHTML);
        el.innerHTML = '';
    });

    initVideoMemories();
});

// Fungsi Menutup Layar & Mematikan Lagu
function tutupModal() {
    const modal = document.getElementById('image-modal');
    const modalIframe = document.getElementById('modal-iframe');
    const modalImg = document.getElementById('modal-img');

    if (modal) {
        modal.classList.remove('show-modal');
        // KUNCI PENTING: Mengosongkan src agar lagu berhenti berputar saat ditutup
        if (modalIframe) {
            modalIframe.src = "";
        }
        // Lanjutkan musik latar jika tadi dijeda oleh lagu YouTube
        const bgMusic = document.getElementById('bg-music');
        if (bgMusic && bgMusic.dataset.resumeAfterModal === 'true') {
            delete bgMusic.dataset.resumeAfterModal;
            bgMusic.play().catch(() => { });
        }
        if (modalImg) {
            modalImg.style.width = "";
            modalImg.style.height = "";
            modalImg.style.maxWidth = "";
            modalImg.style.maxHeight = "";
        }
    }
}

// ==========================================
// 1.B PENGATURAN VIDEO CORE MEMORIES & SINKRONISASI SUARA
// ==========================================
function initVideoMemories() {
    const videos = document.querySelectorAll('.memory-video');
    const bgMusic = document.getElementById('bg-music');

    // Sinkronisasi otomatis audio:
    // Jika ada video yang sedang bersuara, matikan lagu website.
    // Jika sudah tidak ada suara musik dari video (di-mute, pause, selesai), nyalakan kembali lagu website.
    function syncBgMusicWithVideoAudio() {
        if (!bgMusic) return;

        let isAnyVideoProducingSound = false;
        videos.forEach(v => {
            if (!v.paused && !v.muted && v.volume > 0) {
                isAnyVideoProducingSound = true;
            }
        });

        if (isAnyVideoProducingSound) {
            // Video sedang bersuara: matikan lagu website
            if (!bgMusic.paused) {
                bgMusic.pause();
                bgMusic.dataset.pausedByVideo = 'true';
            }
        } else {
            // Sudah tidak ada suara dari video: otomatis nyalakan kembali lagu website
            if (bgMusic.dataset.pausedByVideo === 'true') {
                delete bgMusic.dataset.pausedByVideo;
                bgMusic.play().catch(() => { });
            }
        }
    }

    // Pastikan icon play/pause di pop-up musik selalu sinkron dengan status bg-music
    if (bgMusic && !bgMusic.dataset.listenersAttached) {
        bgMusic.dataset.listenersAttached = 'true';
        bgMusic.addEventListener('play', () => {
            const iconPlay = document.getElementById('icon-play');
            const iconPause = document.getElementById('icon-pause');
            if (iconPlay) iconPlay.style.display = 'none';
            if (iconPause) iconPause.style.display = 'block';
        });
        bgMusic.addEventListener('pause', () => {
            const iconPlay = document.getElementById('icon-play');
            const iconPause = document.getElementById('icon-pause');
            if (iconPlay) iconPlay.style.display = 'block';
            if (iconPause) iconPause.style.display = 'none';
        });
    }

    function updateVideoRatio(video) {
        if (video.videoWidth && video.videoHeight) {
            const container = video.closest('.video-frame-container');
            if (container) {
                container.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
            }
        }
    }

    videos.forEach(video => {
        // Otomatis mute suara pada video saat awal dimuat
        video.muted = true;

        // Sesuaikan rasio kontainer secara dinamis dengan rasio asli file video
        video.addEventListener('loadedmetadata', function () {
            updateVideoRatio(this);
            checkOrientation();
        });

        video.addEventListener('canplay', function () {
            updateVideoRatio(this);
        });

        if (video.readyState >= 1) {
            updateVideoRatio(video);
        }

        // Saat video mulai diputar
        video.addEventListener('play', function () {
            // Hentikan video lain jika sedang menyala agar tidak bertumpuk
            videos.forEach(otherVideo => {
                if (otherVideo !== video && !otherVideo.paused) {
                    otherVideo.pause();
                }
            });

            syncBgMusicWithVideoAudio();
        });

        // Saat user mengklik ikon volume pada pemutar video (unmute / mute / ubah volume)
        video.addEventListener('volumechange', function () {
            syncBgMusicWithVideoAudio();
        });

        // Saat video dijeda (pause)
        video.addEventListener('pause', function () {
            syncBgMusicWithVideoAudio();
        });

        // Saat video selesai diputar
        video.addEventListener('ended', function () {
            // Siapkan kembali kondisi muted agar saat diputar ulang otomatis mute
            video.muted = true;
            syncBgMusicWithVideoAudio();
        });
    });

    // Pengecekan orientasi layar
    function checkOrientation() {
        const isLandscape = window.matchMedia("(orientation: landscape)").matches || (window.innerWidth > window.innerHeight);
        const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 900);

        const overlays = document.querySelectorAll('.rotate-lock-overlay');
        overlays.forEach(overlay => {
            const card = overlay.closest('.video-card-item');
            const video = card ? card.querySelector('.memory-video') : null;
            const isVideoPortrait = video && video.videoWidth && video.videoHeight && (video.videoWidth <= video.videoHeight);

            // Jangan tampilkan overlay jika user sudah memilih tonton langsung atau jika video portrait
            if (overlay.dataset.dismissed === 'true' || isVideoPortrait) {
                overlay.style.display = 'none';
                return;
            }

            if (isMobile && !isLandscape) {
                // Di HP mode vertikal: tampilkan saran putar HP
                overlay.style.display = 'flex';
            } else {
                // Di mode horizontal atau di desktop: sembunyikan overlay
                overlay.style.display = 'none';
            }
        });
    }

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', function () {
        setTimeout(checkOrientation, 250);
    });
    checkOrientation();
}

// Handler tombol putar layar penuh (fullscreen)
function handleRotateAndPlay(videoId) {
    const video = document.getElementById('video-memories-' + videoId);
    if (!video) return;

    const overlay = document.getElementById('rotate-overlay-' + videoId);
    if (overlay) {
        overlay.style.display = 'none';
        overlay.dataset.dismissed = 'true';
    }

    // Otomatis mute saat memutar video
    video.muted = true;

    // Masuk fullscreen dan coba kunci orientasi horizontal
    if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => { });
    } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
    } else if (video.webkitEnterFullscreen) {
        // Safari iOS
        video.webkitEnterFullscreen();
    }

    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => { });
    }

    video.play().catch(() => { });
}

// Handler tombol tonton langsung tanpa putar layar
function handlePlayDirect(videoId) {
    const video = document.getElementById('video-memories-' + videoId);
    if (!video) return;

    const overlay = document.getElementById('rotate-overlay-' + videoId);
    if (overlay) {
        overlay.style.display = 'none';
        overlay.dataset.dismissed = 'true';
    }

    // Otomatis mute saat memutar video
    video.muted = true;

    video.play().catch(() => { });
}

// ==========================================
// 2. FUNGSI KADO & PEMUTAR MUSIK LATAR
// ==========================================
function bukaKado() {
    buatHujanBunga();

    const flash = document.getElementById('flash-light');
    if (flash) flash.classList.add('flash-active');

    // --- MULAI MUSIK & MUNCULKAN POP-UP ---
    const bgMusic = document.getElementById('bg-music');
    const musicPopup = document.getElementById('music-popup');

    // Putar musiknya
    if (bgMusic) {
        bgMusic.play().catch(error => {
            console.log("Browser memblokir autoplay, tidak masalah.");
        });
    }

    // Munculkan notifikasi pop-up dari bawah layar
    if (musicPopup) {
        setTimeout(() => {
            musicPopup.classList.add('show-music');
        }, 1000);
    }
    // --------------------------------------

    setTimeout(() => {
        const landingPage = document.getElementById('landing-page');
        const mainContent = document.getElementById('main-content');

        if (landingPage) landingPage.style.display = 'none';
        if (mainContent) mainContent.classList.remove('hidden');

        jalankanAnimasiScroll();
    }, 450);
}

function buatHujanBunga() {
    const container = document.getElementById('flower-rain');
    if (!container) return;

    const bungaPilihan = ['🌸', '🌺', '🌷', '✨', '💖'];

    for (let i = 0; i < 40; i++) {
        const petal = document.createElement('div');
        petal.classList.add('petal');

        petal.innerText = bungaPilihan[Math.floor(Math.random() * bungaPilihan.length)];
        petal.style.left = Math.random() * 100 + 'vw';
        petal.style.animationDuration = (Math.random() * 3 + 2) + 's';
        petal.style.animationDelay = (Math.random() * 1) + 's';

        container.appendChild(petal);

        setTimeout(() => {
            petal.remove();
        }, 6000);
    }
}

// ==========================================
// 3. FUNGSI SENSOR SCROLL & MESIN TIK BERURUTAN
// ==========================================
function jalankanAnimasiScroll() {
    const elemenScroll = document.querySelectorAll('.show-on-scroll');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                if (!entry.target.classList.contains('is-visible')) {
                    entry.target.classList.add('is-visible');
                    mulaiKetikanBerurutan(entry.target);
                }
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: "0px 0px -35% 0px"
    });

    elemenScroll.forEach((el) => observer.observe(el));
}

async function mulaiKetikanBerurutan(slideTarget) {
    const teksKetikan = slideTarget.querySelectorAll('.typing-text');

    await new Promise(resolve => setTimeout(resolve, 3500));

    for (let i = 0; i < teksKetikan.length; i++) {
        const el = teksKetikan[i];
        const teksAsli = el.getAttribute('data-teks');

        if (teksAsli) {
            await ketikTeks(el, teksAsli);
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    }
}

function ketikTeks(elemen, teks) {
    return new Promise(resolve => {
        let index = 0;
        elemen.innerHTML = '';

        elemen.classList.add('is-typing');

        function ketik() {
            if (index < teks.length) {
                elemen.innerHTML += teks.charAt(index);
                index++;
                setTimeout(ketik, 35);
            } else {
                elemen.classList.remove('is-typing');
                elemen.classList.add('typing-done');
                resolve();
            }
        }

        ketik();
    });
}

// ==========================================
// 4. FUNGSI TOGGLE PLAY/PAUSE MUSIK (SPOTIFY STYLE)
// ==========================================
function toggleMusic() {
    const bgMusic = document.getElementById('bg-music');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');

    if (!bgMusic) return;

    if (bgMusic.paused) {
        bgMusic.play().catch(console.error);
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
    } else {
        bgMusic.pause();
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
    }
}

// ==========================================
// 5. FUNGSI MENYEMBUNYIKAN POP-UP MUSIK SAAT SCROLL
// ==========================================
function hideMusicPopup() {
    const musicPopup = document.getElementById('music-popup');
    const showMusicBtn = document.getElementById('show-music-btn');
    if (musicPopup) {
        musicPopup.classList.remove('show-music');
    }
    if (showMusicBtn) {
        showMusicBtn.classList.add('show-btn');
    }
}

function showMusicPopup() {
    const musicPopup = document.getElementById('music-popup');
    const showMusicBtn = document.getElementById('show-music-btn');
    if (musicPopup) {
        musicPopup.classList.add('show-music');
    }
    if (showMusicBtn) {
        showMusicBtn.classList.remove('show-btn');
    }
}

// Auto-hide pop-up musik saat user mulai scroll
(function () {
    let sudahDisembunyikan = false;

    window.addEventListener('scroll', function () {
        const musicPopup = document.getElementById('music-popup');

        // Hanya sembunyikan jika pop-up sedang tampil dan belum pernah disembunyikan oleh scroll
        if (!sudahDisembunyikan && musicPopup && musicPopup.classList.contains('show-music')) {
            hideMusicPopup();
            sudahDisembunyikan = true;
        }
    });

    // Reset flag saat pop-up ditampilkan kembali lewat tombol 🎵
    const originalShowMusicPopup = showMusicPopup;
    showMusicPopup = function () {
        sudahDisembunyikan = false;
        originalShowMusicPopup();
    };
    // Pasang ulang ke window agar onclick di HTML tetap berfungsi
    window.showMusicPopup = showMusicPopup;
})();

// ==========================================
// SCRATCH CARD (ERASER EFFECT) + GALLERY UNLOCK LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const canvases = document.querySelectorAll('.scratch-canvas');
    const galleryScroll = document.querySelector('.gallery-scroll');
    const galleryHint = document.getElementById('gallery-hint');
    const gallerySlider = document.getElementById('gallery-slider');
    const gallerySliderThumb = document.getElementById('gallery-slider-thumb');

    const totalCanvases = canvases.length;
    const clearedSet = new Set();
    let galleryUnlocked = false;

    function updateSlider() {
        if (!gallerySliderThumb || !galleryScroll) return;
        const maxScroll = galleryScroll.scrollWidth - galleryScroll.clientWidth;
        if (maxScroll > 0) {
            const scrollPercent = galleryScroll.scrollLeft / maxScroll;
            const trackWidth = gallerySliderThumb.parentElement.clientWidth;
            const thumbWidth = gallerySliderThumb.clientWidth;
            const maxLeft = trackWidth - thumbWidth;
            gallerySliderThumb.style.left = (scrollPercent * maxLeft) + 'px';
        }
    }

    function scrollToCard(cardIndex) {
        if (!galleryScroll) return;
        const cards = galleryScroll.querySelectorAll('.scratch-card');
        if (cardIndex < cards.length) {
            const card = cards[cardIndex];
            // Hitung posisi scroll secara manual agar card berada di tengah container
            // Ini menghindari scrollIntoView yang bisa menggeser seluruh halaman di HP
            const containerWidth = galleryScroll.clientWidth;
            const cardLeft = card.offsetLeft;
            const cardWidth = card.offsetWidth;
            const targetScroll = cardLeft - (containerWidth / 2) + (cardWidth / 2);

            // Sementara aktifkan scroll agar bisa geser
            galleryScroll.style.overflowX = 'auto';
            galleryScroll.scrollTo({ left: targetScroll, behavior: 'smooth' });
            // Kunci lagi setelah scroll selesai
            setTimeout(() => {
                if (!galleryUnlocked) {
                    galleryScroll.style.overflowX = 'hidden';
                }
                updateSlider();
            }, 600);
        }
    }

    // Tampilkan slider dari awal
    if (gallerySlider) {
        gallerySlider.classList.add('slider-visible');
    }

    function checkCanvasCleared(canvas, index) {
        if (clearedSet.has(index)) return;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let transparentCount = 0;
        let sampledCount = 0;

        for (let i = 3; i < pixels.length; i += 8) {
            sampledCount++;
            if (pixels[i] === 0) transparentCount++;
        }

        const ratio = transparentCount / sampledCount;
        if (ratio > 0.45) {
            clearedSet.add(index);
            // Fade out sisa canvas
            canvas.style.transition = 'opacity 0.5s ease';
            canvas.style.opacity = '0';
            setTimeout(() => {
                canvas.style.pointerEvents = 'none';
            }, 500);

            // Update hint
            if (galleryHint) {
                galleryHint.textContent = '✨ Foto ' + clearedSet.size + ' Husi ' + totalCanvases + ' Loke ona ✨';
            }

            // Cek apakah semua sudah dibersihkan
            if (clearedSet.size >= totalCanvases) {
                // Semua selesai — unlock untuk geser bebas
                galleryUnlocked = true;
                if (galleryScroll) {
                    galleryScroll.classList.add('gallery-unlocked');
                    galleryScroll.style.overflowX = 'auto';
                    galleryScroll.style.touchAction = 'pan-x pan-y';
                    // Sync slider saat scroll bebas
                    galleryScroll.addEventListener('scroll', updateSlider);
                }
                if (galleryHint) {
                    galleryHint.textContent = 'Foto Sira Nee Loke Hotu ona! Dada ba sorin atu hare…';
                    galleryHint.classList.add('hint-unlocked');
                }
            } else {
                // Auto-scroll ke foto berikutnya
                setTimeout(() => {
                    scrollToCard(index + 1);
                }, 700);
            }
        }
    }

    canvases.forEach((canvas, index) => {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let brushRadius = 25;
        let drawMoveCount = 0;

        setTimeout(() => {
            canvas.width = 220;
            canvas.height = Math.round(220 * 16 / 9);

            ctx.fillStyle = '#FFF0F5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Glitter emas kecil-kecil
            for (let i = 0; i < 300; i++) {
                ctx.beginPath();
                ctx.arc(
                    Math.random() * canvas.width,
                    Math.random() * canvas.height,
                    Math.random() * 1.8 + 0.3,
                    0, Math.PI * 2
                );
                const pinkColors = [
                    'rgba(255, 105, 180, 0.9)',
                    'rgba(255, 20, 147, 0.85)',
                    'rgba(255, 182, 193, 0.8)',
                    'rgba(255, 192, 203, 0.75)',
                    'rgba(219, 112, 147, 0.7)',
                    'rgba(199, 21, 133, 0.6)'
                ];
                ctx.fillStyle = pinkColors[Math.floor(Math.random() * pinkColors.length)];
                ctx.fill();
            }

            ctx.globalCompositeOperation = 'destination-out';

            const startPosition = (e) => {
                isDrawing = true;
                drawMoveCount = 0;
                draw(e);
            };

            const endPosition = () => {
                isDrawing = false;
                ctx.beginPath();
                // Cek setiap kali selesai menggosok
                checkCanvasCleared(canvas, index);
            };

            const draw = (e) => {
                if (!isDrawing) return;

                let clientX, clientY;
                if (e.type.includes('touch')) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else {
                    clientX = e.clientX;
                    clientY = e.clientY;
                }

                const canvasRect = canvas.getBoundingClientRect();
                const x = clientX - canvasRect.left;
                const y = clientY - canvasRect.top;

                ctx.lineWidth = brushRadius * 2;
                ctx.lineCap = 'round';
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y);

                // Juga cek selama menggosok setiap 15 gerakan
                drawMoveCount++;
                if (drawMoveCount % 15 === 0) {
                    checkCanvasCleared(canvas, index);
                }
            };

            canvas.addEventListener('mousedown', startPosition);
            canvas.addEventListener('mouseup', endPosition);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseleave', endPosition);

            canvas.addEventListener('touchstart', startPosition, { passive: true });
            canvas.addEventListener('touchend', endPosition);
            canvas.addEventListener('touchmove', (e) => {
                if (isDrawing) e.preventDefault();
                draw(e);
            }, { passive: false });

        }, 500);
    });
});

// ==========================================
// FITUR TIUP LILIN 🎂 (Press & Hold)
// ==========================================
let holdTime = 0;
let holdInterval = null;
let holdCurrentStage = 0;
let holdListenersAttached = false;
let holdStartFn = null;
let holdStopFn = null;

const STAGE_1_DURATION = 6000;  // 6 detik untuk tahap 1
const STAGE_2_DURATION = 13000; // 13 detik total (7 detik tambahan) untuk tahap 2

function bukaHalamanLilin() {
    const candlePage = document.getElementById('candle-page');
    if (!candlePage) return;

    // Reset state
    holdTime = 0;
    holdCurrentStage = 0;
    holdListenersAttached = false;

    // Tampilkan halaman
    candlePage.classList.add('active');

    // Buat sparkle background
    buatSparkleBackground(candlePage);

    // Fade in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            candlePage.classList.add('visible');
        });
    });
}

function tutupHalamanLilin() {
    const candlePage = document.getElementById('candle-page');
    const msg = document.getElementById('candle-message');
    const btn = document.getElementById('btn-mulai-tiup');
    const tapHint = document.getElementById('tap-hint');
    const flames = document.querySelectorAll('.candle-flame');
    const progressBar = document.getElementById('hold-progress-bar');
    const progressFill = document.getElementById('hold-progress-fill');
    const cakeContainer = document.querySelector('.cake-container');

    if (!candlePage) return;

    // Stop hold interval
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }

    // Hapus event listeners
    hapusHoldListeners(candlePage);

    // Fade out
    candlePage.classList.remove('visible');

    setTimeout(() => {
        candlePage.classList.remove('active');

        // Reset semua state
        holdTime = 0;
        holdCurrentStage = 0;

        if (msg) {
            msg.textContent = '';
            msg.className = 'candle-message';
        }

        if (btn) btn.classList.remove('hidden-btn');

        if (tapHint) {
            tapHint.textContent = '';
            tapHint.className = 'tap-hint';
        }

        if (progressBar) progressBar.classList.remove('show-bar');
        if (progressFill) progressFill.style.width = '0%';
        if (cakeContainer) cakeContainer.classList.remove('holding');

        // Reset api lilin
        flames.forEach(flame => {
            flame.classList.remove('dimming', 'extinguished');
            flame.style.animationDuration = '';
        });

        // Hapus sparkle elements
        const sparkles = candlePage.querySelectorAll('.candle-sparkle');
        sparkles.forEach(s => s.remove());
    }, 800);
}

function hapusHoldListeners(candlePage) {
    if (holdListenersAttached && holdStartFn && holdStopFn) {
        candlePage.removeEventListener('mousedown', holdStartFn);
        candlePage.removeEventListener('mouseup', holdStopFn);
        candlePage.removeEventListener('mouseleave', holdStopFn);
        candlePage.removeEventListener('touchstart', holdStartFn);
        candlePage.removeEventListener('touchend', holdStopFn);
        candlePage.removeEventListener('touchcancel', holdStopFn);
        holdListenersAttached = false;
    }
}

function buatSparkleBackground(container) {
    for (let i = 0; i < 30; i++) {
        const sparkle = document.createElement('div');
        sparkle.classList.add('candle-sparkle');
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.animationDelay = (Math.random() * 3) + 's';
        sparkle.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        container.appendChild(sparkle);
    }
}

function mulaiTiupLilin() {
    const btn = document.getElementById('btn-mulai-tiup');
    const tapHint = document.getElementById('tap-hint');
    const candlePage = document.getElementById('candle-page');
    const progressBar = document.getElementById('hold-progress-bar');

    if (!btn || !candlePage) return;

    // Sembunyikan tombol
    btn.classList.add('hidden-btn');

    // Tampilkan progress bar & hint
    if (progressBar) progressBar.classList.add('show-bar');
    if (tapHint) {
        tapHint.textContent = 'Hanehan no tahan layar atu Huu lilin';
        tapHint.className = 'tap-hint show-hint';
    }

    // Reset hold state
    holdTime = 0;
    holdCurrentStage = 0;

    // Setup hold event listeners
    holdStartFn = function (e) {
        // Jangan proses jika klik tombol kembali
        if (e.target.closest('.btn-back-candle')) return;
        // Jangan proses jika sudah selesai
        if (holdCurrentStage >= 3) return;

        e.preventDefault();
        startHolding();
    };

    holdStopFn = function () {
        if (holdCurrentStage >= 3) return;
        stopHolding();
    };

    candlePage.addEventListener('mousedown', holdStartFn);
    candlePage.addEventListener('mouseup', holdStopFn);
    candlePage.addEventListener('mouseleave', holdStopFn);
    candlePage.addEventListener('touchstart', holdStartFn, { passive: false });
    candlePage.addEventListener('touchend', holdStopFn);
    candlePage.addEventListener('touchcancel', holdStopFn);
    holdListenersAttached = true;
}

function startHolding() {
    const cakeContainer = document.querySelector('.cake-container');
    const tapHint = document.getElementById('tap-hint');

    if (cakeContainer) cakeContainer.classList.add('holding');
    if (tapHint) tapHint.className = 'tap-hint'; // Sembunyikan hint saat menekan

    // Jika belum masuk tahap 1, langsung masuk
    if (holdCurrentStage === 0) {
        holdCurrentStage = 1;
        tampilkanTahap1();
    }

    // Mulai interval untuk menambah holdTime
    if (holdInterval) clearInterval(holdInterval);
    holdInterval = setInterval(() => {
        holdTime += 50;
        updateProgress();
        cekTransisiTahap();
    }, 50);
}

function stopHolding() {
    const cakeContainer = document.querySelector('.cake-container');
    const tapHint = document.getElementById('tap-hint');

    if (cakeContainer) cakeContainer.classList.remove('holding');

    // Stop interval
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }

    // Tampilkan hint untuk menekan lagi (jika belum selesai)
    if (holdCurrentStage > 0 && holdCurrentStage < 3 && tapHint) {
        tapHint.textContent = '🌬️ Taka no kaer nafatin atu kontinua';
        tapHint.className = 'tap-hint show-hint';
    }
}

function updateProgress() {
    const progressFill = document.getElementById('hold-progress-fill');
    if (!progressFill) return;

    const percent = Math.min((holdTime / STAGE_2_DURATION) * 100, 100);
    progressFill.style.width = percent + '%';
}

function cekTransisiTahap() {
    // Transisi dari tahap 1 ke tahap 2
    if (holdCurrentStage === 1 && holdTime >= STAGE_1_DURATION) {
        holdCurrentStage = 2;
        tampilkanTahap2();
    }

    // Transisi dari tahap 2 ke tahap 3 (selesai)
    if (holdCurrentStage === 2 && holdTime >= STAGE_2_DURATION) {
        holdCurrentStage = 3;
        stopHolding();
        tampilkanTahap3();
    }
}

function tampilkanTahap1() {
    const msg = document.getElementById('candle-message');
    const flames = document.querySelectorAll('.candle-flame');

    if (msg) {
        msg.textContent = 'lilin hahu Huu ona...';
        msg.className = 'candle-message show-msg';
    }

    // Api bergoyang lebih kencang tapi belum mati
    flames.forEach(flame => {
        flame.style.animationDuration = '0.15s';
    });
}

function tampilkanTahap2() {
    const msg = document.getElementById('candle-message');
    const flames = document.querySelectorAll('.candle-flame');

    if (msg) {
        msg.className = 'candle-message'; // fade out dulu
        setTimeout(() => {
            msg.textContent = 'Make a wish, hasae orasaun.. ';
            msg.className = 'candle-message show-msg';
        }, 400);
    }

    // Api mulai redup
    flames.forEach(flame => {
        flame.classList.add('dimming');
    });
}

function tampilkanTahap3() {
    const msg = document.getElementById('candle-message');
    const tapHint = document.getElementById('tap-hint');
    const flames = document.querySelectorAll('.candle-flame');
    const candlePage = document.getElementById('candle-page');
    const progressBar = document.getElementById('hold-progress-bar');

    // Sembunyikan hint & progress
    if (tapHint) {
        tapHint.textContent = '';
        tapHint.className = 'tap-hint';
    }
    if (progressBar) {
        setTimeout(() => { progressBar.classList.remove('show-bar'); }, 500);
    }

    // Fade out pesan sebelumnya
    if (msg) msg.className = 'candle-message';

    // Matikan api satu per satu
    flames.forEach((flame, index) => {
        setTimeout(() => {
            flame.classList.remove('dimming');
            flame.classList.add('extinguished');
        }, index * 400);
    });

    // Setelah semua api mati
    setTimeout(() => {
        buatConfetti();

        setTimeout(() => {
            if (msg) {
                msg.textContent = "Semoga buat hotu ne'ebé ita reza no hakarak bele realiza lalais, hein! Amén 🤍";
                msg.className = 'candle-message show-msg final-msg';
            }
        }, 600);
    }, flames.length * 400 + 500);

    // Hapus event listeners karena sudah selesai
    if (candlePage) hapusHoldListeners(candlePage);
}

function buatConfetti() {
    const colors = [
        '#ff6b81', '#ffb6c1', '#a55eea', '#6c5ce7', '#ffd700',
        '#ff9ff3', '#f368e0', '#ffffff', '#00d2d3', '#ff6348',
        '#7bed9f', '#ffa502', '#ff4757', '#2ed573', '#eccc68',
        '#ff7eb3', '#c56cf0', '#17c0eb', '#ffc312'
    ];
    const shapes = ['circle', 'rect', 'star', 'heart', 'ribbon'];
    const animStyles = ['', 'confetti-swirl', 'confetti-zigzag'];

    function burstWave(count, delayBase) {
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti-piece');

            const color = colors[Math.floor(Math.random() * colors.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const animStyle = animStyles[Math.floor(Math.random() * animStyles.length)];
            const size = 5 + Math.random() * 10;

            if (animStyle) confetti.classList.add(animStyle);

            if (shape === 'star') {
                confetti.classList.add('confetti-star');
                confetti.textContent = '⭐';
                confetti.style.fontSize = (10 + Math.random() * 8) + 'px';
            } else if (shape === 'heart') {
                confetti.classList.add('confetti-heart');
                confetti.textContent = '💖';
                confetti.style.fontSize = (8 + Math.random() * 8) + 'px';
            } else if (shape === 'ribbon') {
                confetti.classList.add('confetti-ribbon');
                confetti.style.width = (3 + Math.random() * 4) + 'px';
                confetti.style.height = (14 + Math.random() * 12) + 'px';
                confetti.style.background = color;
                confetti.style.borderRadius = '1px';
            } else if (shape === 'rect') {
                confetti.style.width = size + 'px';
                confetti.style.height = (size * 0.5) + 'px';
                confetti.style.background = color;
                confetti.style.borderRadius = '2px';
            } else {
                confetti.style.width = size + 'px';
                confetti.style.height = size + 'px';
                confetti.style.background = color;
                confetti.style.borderRadius = '50%';
            }

            // Wider spread across the entire screen
            confetti.style.left = (5 + Math.random() * 90) + 'vw';
            confetti.style.top = '-15px';
            confetti.style.animationDuration = (2.5 + Math.random() * 3) + 's';
            confetti.style.animationDelay = (delayBase + Math.random() * 1.2) + 's';

            document.body.appendChild(confetti);

            setTimeout(() => {
                confetti.remove();
            }, 8000 + delayBase * 1000);
        }
    }

    // Gelombang 1: Ledakan utama
    burstWave(60, 0);

    // Gelombang 2: Ledakan kedua setelah 0.8 detik
    setTimeout(() => burstWave(50, 0), 800);

    // Gelombang 3: Hujan confetti lanjutan
    setTimeout(() => burstWave(40, 0), 2000);
}