// Game constants
const GRAVITY = 0.6;
const JUMP_POWER = -9;
const PLAYER_SPEED = 4;
const BARREL_SPEED = 2.5;
const BARREL_SPAWN_INTERVAL = 180;
const INVINCIBILITY_TIME = 120; // 2 seconds at 60fps

// Canvas setup with responsive sizing
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const maxWidth = 800;
    const maxHeight = 600;
    const aspectRatio = maxWidth / maxHeight;
    
    let width = Math.min(window.innerWidth - 40, maxWidth);
    let height = width / aspectRatio;
    
    if (height > window.innerHeight - 40) {
        height = window.innerHeight - 40;
        width = height * aspectRatio;
    }
    
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Storage Manager for high score persistence
const StorageManager = {
    STORAGE_KEY: 'kiroKongHighScore',
    
    // Get high score from local storage
    getHighScore() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? parseInt(stored, 10) : 0;
        } catch (e) {
            // localStorage unavailable (private browsing, etc.)
            console.warn('localStorage unavailable:', e);
            return 0;
        }
    },
    
    // Save high score to local storage
    saveHighScore(score) {
        try {
            localStorage.setItem(this.STORAGE_KEY, score.toString());
        } catch (e) {
            console.warn('Failed to save high score:', e);
        }
    },
    
    // Check if current score is a new high score
    isNewHighScore(currentScore) {
        return currentScore > this.getHighScore();
    }
};

// Game state
let gameState = 'start'; // 'start', 'playing', 'levelComplete', 'gameOver'
let score = 0;
let highScore = StorageManager.getHighScore(); // Initialize high score on game start
let lives = 3;
let frameCount = 0;
let barrelSpawnTimer = 0;

// Input handling
const keys = {};
const mobileInput = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false
};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        handleSpacePress();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Mobile controls
function setupMobileControls() {
    const buttons = {
        leftBtn: 'left',
        rightBtn: 'right',
        upBtn: 'up',
        downBtn: 'down',
        jumpBtn: 'jump'
    };
    
    Object.entries(buttons).forEach(([id, action]) => {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            mobileInput[action] = true;
            if (action === 'jump') handleSpacePress();
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            mobileInput[action] = false;
        });
    });
}

setupMobileControls();

function handleSpacePress() {
    initAudio(); // Initialize audio on first interaction
    
    if (gameState === 'start') {
        startGame();
    } else if (gameState === 'levelComplete') {
        restartLevel();
    } else if (gameState === 'gameOver') {
        restartGame();
    } else if (gameState === 'playing') {
        player.jump();
    }
}

// Load Kiro logo
const kiroImage = new Image();
kiroImage.src = 'kiro-logo.png';

// Audio System using Web Audio API for retro sounds
const AudioSystem = {
    audioContext: null,
    musicPlaying: false,
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },
    
    // Create a simple tone
    playTone(frequency, duration, type = 'square') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    },
    
    // Jump sound effect
    playJump() {
        if (!this.audioContext) return;
        this.playTone(400, 0.1, 'square');
        setTimeout(() => this.playTone(600, 0.1, 'square'), 50);
    },
    
    // Collision/hit sound effect
    playHit() {
        if (!this.audioContext) return;
        this.playTone(100, 0.2, 'sawtooth');
    },
    
    // Death/dying sound effect (dramatic descending sound)
    playDeath() {
        if (!this.audioContext) return;
        // Dramatic descending chromatic scale
        const deathNotes = [800, 700, 600, 500, 400, 300, 200, 150, 100];
        deathNotes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, 0.08, 'sawtooth'), i * 40);
        });
    },
    
    // Score/coin sound effect
    playScore() {
        if (!this.audioContext) return;
        this.playTone(800, 0.05, 'square');
        setTimeout(() => this.playTone(1000, 0.05, 'square'), 50);
    },
    
    // Level complete fanfare
    playLevelComplete() {
        if (!this.audioContext) return;
        const notes = [523, 659, 784, 1047]; // C, E, G, C (major chord)
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, 0.3, 'sine'), i * 100);
        });
    },
    
    // Game over sound
    playGameOver() {
        if (!this.audioContext) return;
        const notes = [400, 350, 300, 250];
        notes.forEach((note, i) => {
            setTimeout(() => this.playTone(note, 0.2, 'sawtooth'), i * 100);
        });
    },
    
    // Background music loop (simple melody)
    startMusic() {
        if (!this.audioContext || this.musicPlaying) return;
        this.musicPlaying = true;
        this.playMusicLoop();
    },
    
    stopMusic() {
        this.musicPlaying = false;
    },
    
    playMusicLoop() {
        if (!this.musicPlaying) return;
        
        // Extended Donkey Kong-inspired melody with variations
        // Using classic arcade game chord progressions
        const melodyA = [
            { note: 523, duration: 0.2 },  // C
            { note: 659, duration: 0.2 },  // E
            { note: 784, duration: 0.2 },  // G
            { note: 659, duration: 0.2 },  // E
            { note: 523, duration: 0.2 },  // C
            { note: 392, duration: 0.2 },  // G (lower)
            { note: 523, duration: 0.4 },  // C (hold)
            { note: 0, duration: 0.2 },    // Rest
        ];
        
        const melodyB = [
            { note: 587, duration: 0.2 },  // D
            { note: 698, duration: 0.2 },  // F
            { note: 880, duration: 0.2 },  // A
            { note: 698, duration: 0.2 },  // F
            { note: 587, duration: 0.2 },  // D
            { note: 494, duration: 0.2 },  // B
            { note: 587, duration: 0.4 },  // D (hold)
            { note: 0, duration: 0.2 },    // Rest
        ];
        
        const melodyC = [
            { note: 659, duration: 0.15 }, // E
            { note: 784, duration: 0.15 }, // G
            { note: 880, duration: 0.15 }, // A
            { note: 1047, duration: 0.15 },// C (high)
            { note: 880, duration: 0.15 }, // A
            { note: 784, duration: 0.15 }, // G
            { note: 659, duration: 0.3 },  // E (hold)
            { note: 523, duration: 0.3 },  // C (hold)
            { note: 0, duration: 0.3 },    // Rest
        ];
        
        // Combine melodies for longer, less repetitive music
        const fullMelody = [...melodyA, ...melodyB, ...melodyA, ...melodyC];
        
        let time = 0;
        fullMelody.forEach(({ note, duration }) => {
            setTimeout(() => {
                if (this.musicPlaying && note > 0) {
                    this.playTone(note, duration * 0.7, 'triangle');
                }
            }, time * 1000);
            time += duration;
        });
        
        // Loop the music with a longer pause
        setTimeout(() => this.playMusicLoop(), time * 1000 + 800);
    }
};

// Initialize audio on first user interaction
let audioInitialized = false;
function initAudio() {
    if (!audioInitialized) {
        AudioSystem.init();
        audioInitialized = true;
    }
}

// Platform and ladder definitions
// Platforms with alternating angles: +15° and -15°
const platforms = [
    { x: 0, y: 550, width: 800, height: 20, angle: 0 }, // Bottom - index 0: +15°
    { x: 50, y: 450, width: 725, height: 20, angle: -2 }, // index 1: -15°
    { x: 25, y: 350, width: 700, height: 20, angle: 2 }, // index 2: +15°
    { x: 75, y: 250, width: 700, height: 20, angle: -2 }, // index 3: -15°
    { x: 25, y: 150, width: 700, height: 20, angle: 2 }, // Top - index 4: +15°
    { x: 100, y: 50, width: 700, height: 20, angle: -2  }  // Very top for DK - index 5: -15°
];

const ladders = [
    { x: 150, y: 450, width: 30, height: 100 },
    { x: 600, y: 350, width: 30, height: 100 },
    { x: 200, y: 250, width: 30, height: 100 },
    { x: 550, y: 150, width: 30, height: 100 }
];

// Player object
const player = {
    x: 50,
    y: 500,
    width: 40,
    height: 40,
    vx: 0,
    vy: 0,
    onGround: false,
    onLadder: false,
    climbing: false,
    invincible: false,
    invincibilityTimer: 0,
    maxJumpHeight: 80,  // Maximum vertical distance (less than platform spacing)
    jumpStartY: 0,      // Y position when jump started
    
    reset() {
        this.x = 50;
        this.y = 500;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.climbing = false;
        this.invincible = true;
        this.invincibilityTimer = INVINCIBILITY_TIME;
    },
    
    update() {
        if (this.invincible) {
            this.invincibilityTimer--;
            if (this.invincibilityTimer <= 0) {
                this.invincible = false;
            }
        }
        
        // Check if on ladder
        this.onLadder = false;
        for (let ladder of ladders) {
            if (this.x + this.width > ladder.x && 
                this.x < ladder.x + ladder.width &&
                this.y + this.height > ladder.y && 
                this.y < ladder.y + ladder.height) {
                this.onLadder = true;
                break;
            }
        }
        
        // Horizontal movement
        const moveLeft = keys['ArrowLeft'] || mobileInput.left;
        const moveRight = keys['ArrowRight'] || mobileInput.right;
        const moveUp = keys['ArrowUp'] || mobileInput.up;
        const moveDown = keys['ArrowDown'] || mobileInput.down;
        
        if (!this.climbing) {
            if (moveLeft) this.vx = -PLAYER_SPEED;
            else if (moveRight) this.vx = PLAYER_SPEED;
            else this.vx = 0;
        } else {
            this.vx = 0;
        }
        
        // Ladder climbing
        if (this.onLadder) {
            if (moveUp) {
                this.climbing = true;
                this.vy = -3;
                this.onGround = false;
            } else if (moveDown) {
                this.climbing = true;
                this.vy = 3;
            } else if (this.climbing) {
                this.vy = 0;
            }
        } else {
            this.climbing = false;
        }
        
        // Apply gravity when not climbing
        if (!this.climbing) {
            this.vy += GRAVITY;
        }
        
        // Limit jump height to prevent level-skipping
        // Cap upward velocity when max height reached
        if (this.jumpStartY - this.y >= this.maxJumpHeight && this.vy < 0) {
            this.vy = 0;  // Stop upward movement
        }
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Boundary check
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        
        // Platform collision with angled surfaces
        this.onGround = false;
        for (let platform of platforms) {
            // Use angled collision detection
            if (PlatformGeometry.checkAngledCollision(this, platform, this.width, this.height)) {
                // Position player on angled platform surface
                const playerCenterX = this.x + this.width / 2;
                this.y = PlatformGeometry.getAngledPlatformY(playerCenterX, platform, this.height);
                this.vy = 0;
                this.onGround = true;
                this.climbing = false;
            }
        }
        
        // Fall off bottom
        if (this.y > canvas.height) {
            this.loseLife();
        }
    },
    
    jump() {
        if (this.onGround && !this.climbing) {
            this.vy = JUMP_POWER;
            this.jumpStartY = this.y;  // Track where jump started
            this.onGround = false;
            AudioSystem.playJump();
        }
    },
    
    loseLife() {
        lives--;
        AudioSystem.playDeath(); // Play dramatic death sound
        if (lives <= 0) {
            gameState = 'gameOver';
            AudioSystem.stopMusic();
            setTimeout(() => AudioSystem.playGameOver(), 400); // Delay game over sound
        } else {
            this.reset();
        }
    },
    
    draw() {
        // Flicker when invincible
        if (this.invincible && Math.floor(frameCount / 10) % 2 === 0) {
            return;
        }
        
        if (kiroImage.complete) {
            ctx.drawImage(kiroImage, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#790ECB';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
};

// Barrel object
class Barrel {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15; // Changed from width/height to radius
        this.vx = BARREL_SPEED;
        this.vy = 0;
        this.rotation = 0;
        this.onPlatform = false;
        this.currentPlatform = null;
    }
    
    checkPlatformEdge() {
        // Check if barrel center is beyond current platform bounds
        if (this.currentPlatform) {
            const platformLeft = this.currentPlatform.x;
            const platformRight = this.currentPlatform.x + this.currentPlatform.width;
            
            // Barrel is at edge if center is beyond platform bounds
            if (this.x < platformLeft || this.x > platformRight) {
                return true;
            }
        }
        return false;
    }
    
    update() {
        // Update rotation proportional to horizontal velocity before moving
        // Rotation is based on distance traveled: angle = distance / radius
        // This creates realistic rolling motion
        if (this.vx !== 0) {
            this.rotation += this.vx / this.radius;
        }
        
        // Maintain rotation during falling by adding vertical component
        // This ensures continuous rotation animation when falling between platforms
        if (this.vy !== 0 && !this.onPlatform) {
            // Add slight rotation based on vertical velocity to show tumbling
            this.rotation += this.vy * 0.02;
        }
        
        // Apply gravity when not on platform
        if (!this.onPlatform) {
            this.vy += GRAVITY;
        }
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Keep barrel within screen bounds horizontally
        if (this.x < this.radius) {
            this.x = this.radius;
        }
        if (this.x > canvas.width - this.radius) {
            this.x = canvas.width - this.radius;
        }
        
        // Check if at platform edge before collision check
        if (this.onPlatform && this.checkPlatformEdge()) {
            this.onPlatform = false;
            this.currentPlatform = null;
        }
        
        // Platform collision with angled surfaces
        this.onPlatform = false;
        for (let platform of platforms) {
            // Create a temporary entity object for collision check
            const barrelAsEntity = {
                x: this.x - this.radius,
                y: this.y - this.radius,
                vy: this.vy
            };
            
            if (PlatformGeometry.checkAngledCollision(barrelAsEntity, platform, this.radius * 2, this.radius * 2)) {
                // Position barrel on angled platform surface
                this.y = PlatformGeometry.getAngledPlatformY(this.x, platform, this.radius);
                this.vy = 0;
                this.onPlatform = true;
                this.currentPlatform = platform;
                
                // Calculate which side of platform is lower
                const platformCenterX = platform.x + platform.width / 2;
                const leftY = PlatformGeometry.getAngledPlatformY(platform.x, platform, 0);
                const rightY = PlatformGeometry.getAngledPlatformY(platform.x + platform.width, platform, 0);
                
                // Roll toward the lower side
                if (leftY > rightY) {
                    // Left side is lower, roll left
                    this.vx = -BARREL_SPEED;
                } else if (rightY > leftY) {
                    // Right side is lower, roll right
                    this.vx = BARREL_SPEED;
                } else {
                    // Flat platform - keep rolling
                    if (this.vx === 0) this.vx = BARREL_SPEED;
                }
                
                break; // Only collide with one platform at a time
            }
        }
        
        // Check if on ladder (chance to fall down)
        for (let ladder of ladders) {
            if (this.x + this.radius > ladder.x && 
                this.x - this.radius < ladder.x + ladder.width &&
                Math.abs(this.y + this.radius - ladder.y) < 5 &&
                Math.random() < 0.02) {
                this.vy = 2;
                this.onPlatform = false;
                this.currentPlatform = null;
            }
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw circular barrel
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw darker outline
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Add visual texture lines to show rolling
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(this.radius, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.stroke();
        
        ctx.restore();
    }
}

let barrels = [];

// Particle class for visual effects
class Particle {
    constructor(x, y, vx, vy, color, lifetime, type) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
        this.type = type;
        this.size = Math.random() * 2 + 2; // 2-4 pixels
    }
    
    update() {
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Apply gravity
        this.vy += GRAVITY * 0.3;
        
        // Decrease lifetime
        this.lifetime--;
    }
    
    draw(ctx) {
        // Fade out based on remaining lifetime
        const alpha = this.lifetime / this.maxLifetime;
        ctx.globalAlpha = alpha;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
    }
    
    isDead() {
        return this.lifetime <= 0;
    }
}

// Particle System for managing all particle effects
const ParticleSystem = {
    particles: [],
    MAX_PARTICLES: 200,
    
    // Create explosion effect at position
    createExplosion(x, y) {
        const colors = ['#FF6600', '#FF0000', '#FFFF00']; // orange, red, yellow
        const particleCount = Math.floor(Math.random() * 6) + 15; // 15-20 particles
        
        for (let i = 0; i < particleCount; i++) {
            // Radial velocity distribution (360 degrees)
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
            const speed = Math.random() * 3 + 3; // 3-6 pixels per frame
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            const color = colors[Math.floor(Math.random() * colors.length)];
            const lifetime = Math.floor(Math.random() * 16) + 30; // 30-45 frames
            
            this.addParticle(new Particle(x, y, vx, vy, color, lifetime, 'explosion'));
        }
    },
    
    // Create confetti effect from top of screen
    createConfetti() {
        const colors = ['#790ECB', '#FFD700', '#00FFFF', '#FF69B4']; // purple, yellow, cyan, pink
        const particleCount = Math.floor(Math.random() * 31) + 50; // 50-80 particles
        
        for (let i = 0; i < particleCount; i++) {
            // Random horizontal positions across screen width
            const x = Math.random() * canvas.width;
            const y = -10; // Start just above screen
            
            // Initial downward velocity with horizontal drift
            const vx = (Math.random() - 0.5) * 4; // -2 to 2 horizontal drift
            const vy = Math.random() * 2 + 1; // 1-3 downward
            
            const color = colors[Math.floor(Math.random() * colors.length)];
            const lifetime = Math.floor(Math.random() * 61) + 120; // 120-180 frames
            
            this.addParticle(new Particle(x, y, vx, vy, color, lifetime, 'confetti'));
        }
    },
    
    // Add particle to system with limit check
    addParticle(particle) {
        if (this.particles.length < this.MAX_PARTICLES) {
            this.particles.push(particle);
        }
    },
    
    // Update all active particles
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            
            // Remove dead particles
            if (this.particles[i].isDead()) {
                this.particles.splice(i, 1);
            }
        }
    },
    
    // Draw all active particles
    draw(ctx) {
        for (let particle of this.particles) {
            particle.draw(ctx);
        }
    }
};

// Donkey Kong at the top
const donkeyKong = {
    x: 340,
    y: 5,
    width: 80,
    height: 50,
    defeated: false,
    animationFrame: 0,
    
    draw() {
        if (this.defeated) return;
        
        // Animate DK (simple breathing effect)
        this.animationFrame++;
        const breathe = Math.sin(this.animationFrame * 0.05) * 2;
        
        const x = this.x;
        const y = this.y + breathe;
        
        // Body (brown fur)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x + 15, y + 20, 50, 30); // Torso
        
        // Arms
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(x + 5, y + 25, 12, 20); // Left arm
        ctx.fillRect(x + 63, y + 25, 12, 20); // Right arm
        
        // Hands (darker)
        ctx.fillStyle = '#654321';
        ctx.fillRect(x + 5, y + 40, 12, 8); // Left hand
        ctx.fillRect(x + 63, y + 40, 12, 8); // Right hand
        
        // Head (larger, brown)
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(x + 20, y + 5, 40, 25); // Head
        
        // Ears
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x + 15, y + 10, 8, 10); // Left ear
        ctx.fillRect(x + 57, y + 10, 8, 10); // Right ear
        
        // Face (lighter brown)
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(x + 25, y + 12, 30, 15); // Face
        
        // Eyes (white with black pupils)
        ctx.fillStyle = 'white';
        ctx.fillRect(x + 28, y + 14, 8, 8); // Left eye white
        ctx.fillRect(x + 44, y + 14, 8, 8); // Right eye white
        
        ctx.fillStyle = 'black';
        ctx.fillRect(x + 30, y + 16, 4, 4); // Left pupil
        ctx.fillRect(x + 46, y + 16, 4, 4); // Right pupil
        
        // Nose
        ctx.fillStyle = '#654321';
        ctx.fillRect(x + 37, y + 22, 6, 4);
        
        // Mouth (angry expression)
        ctx.fillStyle = '#654321';
        ctx.fillRect(x + 32, y + 26, 3, 2);
        ctx.fillRect(x + 45, y + 26, 3, 2);
        
        // Red tie
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x + 35, y + 30, 10, 3); // Tie knot
        ctx.fillRect(x + 37, y + 33, 6, 12); // Tie body
        
        // Chest highlight (lighter brown)
        ctx.fillStyle = '#CD853F';
        ctx.fillRect(x + 25, y + 35, 30, 10);
        
        // Add some detail lines for fur texture
        ctx.fillStyle = '#654321';
        ctx.fillRect(x + 20, y + 8, 2, 2);
        ctx.fillRect(x + 58, y + 8, 2, 2);
    }
};

// Goal area
const goal = {
    x: 320,
    y: 10,
    width: 160,
    height: 40
};

function spawnBarrel() {
    barrels.push(new Barrel(donkeyKong.x + 25, donkeyKong.y + donkeyKong.height));
}

function checkCollisions() {
    if (player.invincible) return;
    
    // Check barrel collisions using circular hitbox
    for (let barrel of barrels) {
        // Calculate distance between player center and barrel center
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const dx = playerCenterX - barrel.x;
        const dy = playerCenterY - barrel.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Collision if distance is less than sum of radii (approximate player as circle)
        const playerRadius = Math.min(player.width, player.height) / 2;
        if (distance < playerRadius + barrel.radius) {
            // Create explosion effect at collision point
            ParticleSystem.createExplosion(barrel.x, barrel.y);
            
            // Check if jumping over (player's bottom is above barrel's center)
            if (player.vy < 0 || player.y + player.height < barrel.y) {
                score += 100;
                AudioSystem.playScore();
                updateHighScore();
            } else {
                player.loseLife();
                return;
            }
        }
    }
    
    // Check goal collision
    if (!donkeyKong.defeated &&
        player.x + player.width > goal.x && 
        player.x < goal.x + goal.width &&
        player.y + player.height > goal.y && 
        player.y < goal.y + goal.height) {
        donkeyKong.defeated = true;
        updateHighScore();
        AudioSystem.stopMusic();
        AudioSystem.playLevelComplete();
        gameState = 'levelComplete';
    }
}

function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        StorageManager.saveHighScore(highScore);
        
        // Trigger confetti effect on new high score
        ParticleSystem.createConfetti();
    }
}

function startGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    frameCount = 0;
    barrelSpawnTimer = 0;
    barrels = [];
    player.reset();
    donkeyKong.defeated = false;
    AudioSystem.startMusic();
}

function restartLevel() {
    gameState = 'playing';
    frameCount = 0;
    barrelSpawnTimer = 0;
    barrels = [];
    player.reset();
    donkeyKong.defeated = false;
    AudioSystem.startMusic();
}

function restartGame() {
    startGame();
}

function update() {
    if (gameState !== 'playing') return;
    
    frameCount++;
    
    // Update player
    player.update();
    
    // Spawn barrels
    if (!donkeyKong.defeated) {
        barrelSpawnTimer++;
        if (barrelSpawnTimer >= BARREL_SPAWN_INTERVAL) {
            spawnBarrel();
            barrelSpawnTimer = 0;
        }
    }
    
    // Update barrels
    for (let i = barrels.length - 1; i >= 0; i--) {
        barrels[i].update();
        
        // Remove barrels that fall off
        if (barrels[i].y > canvas.height) {
            barrels.splice(i, 1);
        }
    }
    
    // Update particle system
    ParticleSystem.update();
    
    // Check collisions
    checkCollisions();
    
    // Increase score over time
    if (frameCount % 60 === 0) {
        score += 10;
        updateHighScore();
    }
}

// Platform Geometry System for angled platforms
const PlatformGeometry = {
    // Transform entity position to platform's rotated coordinate space
    transformToRotatedSpace(entityX, entityY, platform) {
        const centerX = platform.x + platform.width / 2;
        const centerY = platform.y + platform.height / 2;
        const angleRad = (-platform.angle * Math.PI) / 180; // Negative for inverse transform
        
        // Translate to origin
        const dx = entityX - centerX;
        const dy = entityY - centerY;
        
        // Rotate
        const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        
        return { x: rotatedX, y: rotatedY };
    },
    
    // Check collision with angled platform in rotated space
    checkAngledCollision(entity, platform, entityWidth, entityHeight) {
        // Transform entity corners to platform's rotated space
        const bottomCenterX = entity.x + entityWidth / 2;
        const bottomY = entity.y + entityHeight;
        
        const transformed = this.transformToRotatedSpace(bottomCenterX, bottomY, platform);
        
        // In rotated space, platform is axis-aligned
        const halfWidth = platform.width / 2;
        const halfHeight = platform.height / 2;
        
        // Check if entity is within platform bounds in rotated space
        if (transformed.x >= -halfWidth && transformed.x <= halfWidth &&
            transformed.y >= -halfHeight && transformed.y <= halfHeight + 10 &&
            entity.vy >= 0) {
            return true;
        }
        
        return false;
    },
    
    // Get the Y position where entity should rest on angled platform
    getAngledPlatformY(entityX, platform, entityHeight) {
        const centerX = platform.x + platform.width / 2;
        const centerY = platform.y + platform.height / 2;
        const angleRad = (platform.angle * Math.PI) / 180;
        
        // Calculate the slope of the platform
        const dx = entityX - centerX;
        const offsetY = dx * Math.tan(angleRad);
        
        // Return Y position where entity should be (top of platform minus entity height)
        return centerY + offsetY - entityHeight;
    }
};

// Draw angled platform with rotation
function drawAngledPlatform(ctx, platform) {
    ctx.save();
    
    // Calculate center point of platform for rotation
    const centerX = platform.x + platform.width / 2;
    const centerY = platform.y + platform.height / 2;
    
    // Translate to center, rotate, then draw
    ctx.translate(centerX, centerY);
    ctx.rotate((platform.angle * Math.PI) / 180); // Convert degrees to radians
    
    // Draw platform centered at origin
    ctx.fillStyle = '#790ECB';
    ctx.fillRect(-platform.width / 2, -platform.height / 2, platform.width, platform.height);
    
    ctx.restore();
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw platforms with angles
    for (let platform of platforms) {
        drawAngledPlatform(ctx, platform);
    }
    
    // Draw ladders
    ctx.fillStyle = '#FFD700';
    for (let ladder of ladders) {
        ctx.fillRect(ladder.x, ladder.y, ladder.width, ladder.height);
        // Rungs
        ctx.fillStyle = '#FFA500';
        for (let i = 0; i < ladder.height; i += 20) {
            ctx.fillRect(ladder.x, ladder.y + i, ladder.width, 3);
        }
        ctx.fillStyle = '#FFD700';
    }
    
    // Draw Donkey Kong
    donkeyKong.draw();
    
    // Draw barrels
    for (let barrel of barrels) {
        barrel.draw();
    }
    
    // Draw player
    player.draw();
    
    // Draw particle effects (on top of game elements)
    ParticleSystem.draw(ctx);
    
    // Draw HUD
    ctx.fillStyle = 'white';
    ctx.font = '20px Courier New';
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`High Score: ${highScore}`, 10, 55);
    ctx.fillText(`Lives: ${lives}`, 10, 80);
    
    // Draw game state screens
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'levelComplete') {
        drawLevelCompleteScreen();
    } else if (gameState === 'gameOver') {
        drawGameOverScreen();
    }
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#790ECB';
    ctx.font = 'bold 60px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('KIRO KONG', canvas.width / 2, canvas.height / 2 - 80);
    
    ctx.fillStyle = 'white';
    ctx.font = '20px Courier New';
    ctx.fillText('Use LEFT/RIGHT to move', canvas.width / 2, canvas.height / 2);
    ctx.fillText('UP/DOWN on ladders', canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillText('SPACE to jump', canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText('Reach the top and defeat Donkey Kong!', canvas.width / 2, canvas.height / 2 + 100);
    
    ctx.fillStyle = '#790ECB';
    ctx.font = 'bold 24px Courier New';
    ctx.fillText('Press SPACE to start!', canvas.width / 2, canvas.height / 2 + 150);
    
    ctx.textAlign = 'left';
}

function drawLevelCompleteScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#790ECB';
    ctx.font = 'bold 50px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 60);
    
    ctx.fillStyle = 'white';
    ctx.font = '30px Courier New';
    ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2);
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 40);
    
    ctx.fillStyle = '#790ECB';
    ctx.font = 'bold 24px Courier New';
    ctx.fillText('Press SPACE to play again!', canvas.width / 2, canvas.height / 2 + 100);
    
    ctx.textAlign = 'left';
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 50px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);
    
    ctx.fillStyle = 'white';
    ctx.font = '30px Courier New';
    ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2);
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 40);
    
    ctx.fillStyle = '#790ECB';
    ctx.font = 'bold 24px Courier New';
    ctx.fillText('Press SPACE to restart!', canvas.width / 2, canvas.height / 2 + 100);
    
    ctx.textAlign = 'left';
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
