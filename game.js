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
    const maxHeight = 700;  // Increased from 600 to 700
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
            initAudio(); // Initialize audio on any touch
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
    bgMusic: null,
    bgMusicBuffer: null,
    bgMusicSource: null,
    bgMusicGain: null,
    useWebAudio: true,
    
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load background music using Web Audio API for seamless looping
            fetch('backmusic.mp3')
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.bgMusicBuffer = audioBuffer;
                    console.log('Background music buffer loaded');
                })
                .catch(e => {
                    console.warn('Failed to load background music buffer:', e);
                    this.useWebAudio = false;
                });
            
            // Fallback: HTML5 Audio for background music
            this.bgMusic = new Audio('backmusic.mp3');
            this.bgMusic.loop = true;
            this.bgMusic.volume = 0.4;
            this.bgMusic.preload = 'auto';
            
            // Load sound effects using HTML5 Audio (simpler for one-shots)
            this.jumpSound = new Audio('jump.wav');
            this.jumpSound.volume = 0.5;
            
            this.walkSound = new Audio('walking.wav');
            this.walkSound.volume = 0.3;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.useWebAudio = false;
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
        if (this.jumpSound) {
            this.jumpSound.currentTime = 0;
            this.jumpSound.play().catch(e => console.warn('Jump sound failed:', e));
        }
    },
    
    // Walking sound effect
    playWalk() {
        if (this.walkSound && this.walkSound.paused) {
            this.walkSound.currentTime = 0;
            this.walkSound.play().catch(e => console.warn('Walk sound failed:', e));
        }
    },
    
    stopWalk() {
        if (this.walkSound) {
            this.walkSound.pause();
            this.walkSound.currentTime = 0;
        }
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
    
    // Background music with Web Audio API fallback to HTML5 Audio
    startMusic() {
        if (this.musicPlaying) return;
        
        // Resume audio context if suspended (required for mobile)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // Try Web Audio API first (seamless looping)
        if (this.useWebAudio && this.audioContext && this.bgMusicBuffer) {
            try {
                // Create gain node for volume control
                this.bgMusicGain = this.audioContext.createGain();
                this.bgMusicGain.gain.value = 0.4;
                this.bgMusicGain.connect(this.audioContext.destination);
                
                // Create and start the source
                this.bgMusicSource = this.audioContext.createBufferSource();
                this.bgMusicSource.buffer = this.bgMusicBuffer;
                this.bgMusicSource.loop = true; // Seamless looping!
                this.bgMusicSource.connect(this.bgMusicGain);
                this.bgMusicSource.start(0);
                
                this.musicPlaying = true;
                console.log('Music started with Web Audio API');
                return;
            } catch (e) {
                console.warn('Failed to start Web Audio music:', e);
            }
        }
        
        // Fallback to HTML5 Audio
        if (this.bgMusic) {
            this.musicPlaying = true;
            this.bgMusic.currentTime = 0;
            
            // Force play with promise handling for mobile
            const playPromise = this.bgMusic.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('Music started with HTML5 Audio');
                    })
                    .catch(e => {
                        console.error('HTML5 Audio play failed:', e);
                        this.musicPlaying = false;
                    });
            }
        }
    },
    
    stopMusic() {
        this.musicPlaying = false;
        
        // Stop Web Audio source
        if (this.bgMusicSource) {
            try {
                this.bgMusicSource.stop();
                this.bgMusicSource.disconnect();
            } catch (e) {
                // Already stopped
            }
            this.bgMusicSource = null;
        }
        
        // Stop HTML5 Audio
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }
    }
};

// Initialize audio on first user interaction
let audioInitialized = false;
function initAudio() {
    if (!audioInitialized) {
        AudioSystem.init();
        audioInitialized = true;
        
        // Resume audio context for mobile browsers
        if (AudioSystem.audioContext && AudioSystem.audioContext.state === 'suspended') {
            AudioSystem.audioContext.resume().then(() => {
                console.log('Audio context resumed');
            });
        }
    }
}

// Platform and ladder definitions
// Platforms with alternating angles: +15° and -15°
const platforms = [
    { x: 0, y: 650, width: 800, height: 20, angle: 0 }, // Bottom - moved down 100px
    { x: 50, y: 540, width: 725, height: 20, angle: -2 }, // index 1
    { x: 25, y: 430, width: 700, height: 20, angle: 2 }, // indcx 2
    { x: 75, y: 320, width: 700, height: 20, angle: -2 }, // index 3
    { x: 25, y: 210, width: 700, height: 20, angle: 2 }, // index 4
    { x: 100, y: 100, width: 700, height: 20, angle: -2  }  // Very top for DK
];

const ladders = [
    { x: 150, y: 545, width: 30, height: 105 },  // Bottom (650) to platform 1 (540)
    { x: 600, y: 435, width: 30, height: 105 },  // Platform 1 (540) to 2 (430)
    { x: 200, y: 325, width: 30, height: 105 },  // Platform 2 (430) to 3 (320)
    { x: 550, y: 210, width: 30, height: 110 },  // Platform 3 (320) to 4 (210) - extended
    { x: 150, y: 105, width: 30, height: 100 }    // Platform 4 (210) to top (100) - much taller
];

// Player object
const player = {
    x: 50,
    y: 600,  // Adjusted for new platform height
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
    facingRight: true,  // Track which direction player is facing
    
    reset() {
        this.x = 50;
        this.y = 600;  // Adjusted for new platform height
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
        
        // Horizontal movement (always allow left/right to exit ladders)
        if (moveLeft) {
            this.vx = -PLAYER_SPEED;
            this.facingRight = false;
            if (this.onGround && !this.climbing) {
                AudioSystem.playWalk();
            }
        } else if (moveRight) {
            this.vx = PLAYER_SPEED;
            this.facingRight = true;
            if (this.onGround && !this.climbing) {
                AudioSystem.playWalk();
            }
        } else {
            this.vx = 0;
            AudioSystem.stopWalk();
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
                this.onGround = false; // Allow starting to climb down
            } else if (this.climbing) {
                this.vy = 0;
            }
            
            // Exit ladder if moving horizontally
            if (moveLeft || moveRight) {
                this.climbing = false;
            }
        } else {
            // Stop climbing when off ladder
            this.climbing = false;
        }
        
        // Apply gravity when not climbing
        if (!this.climbing) {
            this.vy += GRAVITY;
        }
        
        // Limit jump height to prevent level-skipping (but not when climbing)
        // Cap upward velocity when max height reached
        if (!this.climbing && this.jumpStartY - this.y >= this.maxJumpHeight && this.vy < 0) {
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
        
        // Only check platform collision if NOT climbing up
        if (!(this.climbing && this.vy < 0)) {
            for (let platform of platforms) {
                // Use angled collision detection
                if (PlatformGeometry.checkAngledCollision(this, platform, this.width, this.height)) {
                    // Check if we're at the bottom of a ladder (climbing down)
                    let atLadderBottom = false;
                    if (this.climbing && this.vy > 0) { // Climbing down
                        // Check if there's a ladder below us
                        for (let ladder of ladders) {
                            const playerCenterX = this.x + this.width / 2;
                            // If player is on a ladder and the ladder bottom is at or above this platform
                            if (playerCenterX > ladder.x && 
                                playerCenterX < ladder.x + ladder.width &&
                                this.y + this.height >= ladder.y + ladder.height - 10) {
                                atLadderBottom = true;
                                break;
                            }
                        }
                    }
                    
                    // Only stop if not climbing, or if climbing down and at ladder bottom
                    if (!this.climbing || atLadderBottom) {
                        // Position player on angled platform surface
                        const playerCenterX = this.x + this.width / 2;
                        this.y = PlatformGeometry.getAngledPlatformY(playerCenterX, platform, this.height);
                        this.vy = 0;
                        this.onGround = true;
                        this.climbing = false;
                    }
                }
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
        
        ctx.save();
        
        // Flip horizontally if facing left
        if (!this.facingRight) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            
            if (kiroImage.complete) {
                ctx.drawImage(kiroImage, 0, 0, this.width, this.height);
            } else {
                ctx.fillStyle = '#790ECB';
                ctx.fillRect(0, 0, this.width, this.height);
            }
        } else {
            if (kiroImage.complete) {
                ctx.drawImage(kiroImage, this.x, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = '#790ECB';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
        
        ctx.restore();
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
        this.scored = false; // Track if player already scored from jumping this barrel
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
        
        // Simple 8-bit style barrel
        // Main barrel body (brown)
        ctx.fillStyle = '#D2691E';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Two horizontal metal bands (thick lines)
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 3;
        
        // Top band
        ctx.beginPath();
        ctx.moveTo(-this.radius, -this.radius * 0.5);
        ctx.lineTo(this.radius, -this.radius * 0.5);
        ctx.stroke();
        
        // Bottom band
        ctx.beginPath();
        ctx.moveTo(-this.radius, this.radius * 0.5);
        ctx.lineTo(this.radius, this.radius * 0.5);
        ctx.stroke();
        
        // Outer rim (thick)
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

let barrels = [];

// Fireball class - bouncing enemy
class Fireball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.vx = BARREL_SPEED * 0.5; // Much slower than barrels (50% speed)
        this.vy = -2.5; // Very low initial bounce
        this.rotation = 0;
        this.animationFrame = 0;
        this.scored = false;
        this.onPlatform = false;
        this.bounceCount = 0;
        this.justBounced = false;
        this.climbingDown = false;
        this.lastLadderCheck = null; // Track which ladder we last checked
    }
    
    update() {
        this.rotation += 0.2;
        this.animationFrame++;
        
        // Apply gravity when not on platform
        if (!this.onPlatform) {
            this.vy += GRAVITY;
        }
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Keep within screen bounds horizontally
        if (this.x < this.radius) {
            this.x = this.radius;
        }
        if (this.x > canvas.width - this.radius) {
            this.x = canvas.width - this.radius;
        }
        
        // Check if over a ladder - commit to climbing down
        let overLadder = false;
        
        // If already climbing, keep going
        if (this.climbingDown) {
            overLadder = true;
            this.vy = 2;
            this.vx = 0;
            
            // Check if reached bottom of any ladder
            let stillOnLadder = false;
            for (let ladder of ladders) {
                if (Math.abs(this.x - (ladder.x + ladder.width / 2)) < 20 &&
                    this.y >= ladder.y && 
                    this.y <= ladder.y + ladder.height) {
                    stillOnLadder = true;
                    break;
                }
            }
            
            if (!stillOnLadder) {
                this.climbingDown = false; // Finished climbing
            }
        } else {
            // Not climbing yet - check if should start (only check once per ladder)
            for (let i = 0; i < ladders.length; i++) {
                const ladder = ladders[i];
                if (this.onPlatform &&
                    this.x > ladder.x && 
                    this.x < ladder.x + ladder.width &&
                    this.y + this.radius >= ladder.y - 10 &&
                    this.y + this.radius <= ladder.y + 30) {
                    
                    // Only roll the dice once per ladder
                    if (this.lastLadderCheck !== i) {
                        this.lastLadderCheck = i;
                        
                        // 30% chance to go down this ladder
                        if (Math.random() < 0.3) {
                            overLadder = true;
                            this.climbingDown = true;
                            
                            // Center on ladder
                            const ladderCenterX = ladder.x + ladder.width / 2;
                            this.x = ladderCenterX;
                            
                            this.vy = 2;
                            this.vx = 0;
                            this.onPlatform = false;
                            this.currentPlatform = null;
                        }
                    }
                    break;
                } else if (this.lastLadderCheck === i) {
                    // Left this ladder, reset check
                    this.lastLadderCheck = null;
                }
            }
        }
        
        // Platform collision with angled surfaces (skip if over ladder)
        if (!overLadder) {
            this.onPlatform = false;
            for (let platform of platforms) {
            // Create a temporary entity object for collision check
            const fireballAsEntity = {
                x: this.x - this.radius,
                y: this.y - this.radius,
                vy: this.vy
            };
            
            if (PlatformGeometry.checkAngledCollision(fireballAsEntity, platform, this.radius * 2, this.radius * 2)) {
                // Position fireball on angled platform surface
                this.y = PlatformGeometry.getAngledPlatformY(this.x, platform, this.radius);
                this.onPlatform = true;
                this.currentPlatform = platform;
                
                // Natural periodic bounce - smooth parabolic arc
                if (!this.justBounced) {
                    this.vy = 0; // Stop falling
                    this.bounceCount++;
                    
                    if (this.bounceCount >= 75) { // Every 75 frames (~1.25 seconds)
                        this.vy = -4.5; // Moderate bounce for smooth arc
                        this.bounceCount = 0;
                        this.justBounced = true;
                    }
                } else {
                    // In the air after bounce - let gravity create natural arc
                    if (this.vy >= -0.5) { // Reset when near peak or falling
                        this.justBounced = false;
                    }
                }
                
                // Calculate which side of platform is lower
                const leftY = PlatformGeometry.getAngledPlatformY(platform.x, platform, 0);
                const rightY = PlatformGeometry.getAngledPlatformY(platform.x + platform.width, platform, 0);
                
                // Roll toward the lower side
                if (leftY > rightY) {
                    this.vx = -BARREL_SPEED * 0.5;
                } else if (rightY > leftY) {
                    this.vx = BARREL_SPEED * 0.5;
                } else {
                    if (this.vx === 0) this.vx = BARREL_SPEED * 0.5;
                }
                
                break;
            }
        }
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const p = 3; // Pixel size for retro look
        
        // Animated flame colors
        const flamePhase = Math.floor(this.animationFrame / 10) % 2;
        const red = '#FF0000';
        const orange = '#FFA500';
        const yellow = '#FFD700';
        
        // Pixel-art fire hair on top (blocky flames - taller)
        const hairPositions = [
            { x: -2, y: -5, color: flamePhase ? orange : red },
            { x: -2, y: -6, color: flamePhase ? yellow : orange },
            { x: -1, y: -6, color: red },
            { x: -1, y: -7, color: orange },
            { x: 0, y: -7, color: yellow },
            { x: 0, y: -8, color: yellow },
            { x: 1, y: -7, color: orange },
            { x: 1, y: -6, color: red },
            { x: 2, y: -6, color: flamePhase ? yellow : orange },
            { x: 2, y: -5, color: flamePhase ? orange : red }
        ];
        
        for (let hair of hairPositions) {
            ctx.fillStyle = hair.color;
            ctx.fillRect(hair.x * p, hair.y * p, p, p);
        }
        
        // Outer flame body (red)
        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner flame (orange)
        ctx.fillStyle = orange;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Hot core (yellow/white)
        ctx.fillStyle = yellow;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Animated eyes (makes it alive)
        ctx.fillStyle = red;
        ctx.fillRect(-p, 0, p, p); // Left eye
        ctx.fillRect(p, 0, p, p); // Right eye
        
        ctx.restore();
    }
}

let fireballs = [];

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

// Donkey Kong at the top - Classic pixel art style
const donkeyKong = {
    x: 330,
    y: 45,
    baseY: 45,
    width: 100,
    height: 70,
    defeated: false,
    animationFrame: 0,
    pixelSize: 4, // Size of each "pixel" block
    
    draw() {
        if (this.defeated) return;
        
        // Angry hopping animation
        this.animationFrame++;
        const hop = Math.abs(Math.sin(this.animationFrame * 0.1)) * 8; // Hop up and down
        const armWave = Math.sin(this.animationFrame * 0.1) > 0 ? 0 : 1; // Alternate arms
        
        const x = this.x;
        const y = this.baseY - hop; // Hop up
        const p = this.pixelSize;
        
        // Classic DK red/brown color palette
        const red = '#C84C0C';
        const darkRed = '#880000';
        const tan = '#FCB514';
        const darkTan = '#FC9838';
        const white = '#FCFCFC';
        const black = '#000000';
        
        // Red body/fur (main mass)
        ctx.fillStyle = red;
        ctx.fillRect(x + p*6, y + p*3, p*10, p);
        ctx.fillRect(x + p*4, y + p*4, p*14, p);
        ctx.fillRect(x + p*3, y + p*5, p*16, p);
        ctx.fillRect(x + p*2, y + p*6, p*18, p);
        ctx.fillRect(x + p*2, y + p*7, p*18, p);
        ctx.fillRect(x + p*1, y + p*8, p*20, p);
        ctx.fillRect(x + p*1, y + p*9, p*20, p);
        ctx.fillRect(x + p*0, y + p*10, p*22, p);
        ctx.fillRect(x + p*0, y + p*11, p*22, p);
        
        // Tan face area
        ctx.fillStyle = tan;
        ctx.fillRect(x + p*7, y + p*4, p*8, p);
        ctx.fillRect(x + p*6, y + p*5, p*10, p);
        ctx.fillRect(x + p*5, y + p*6, p*12, p);
        ctx.fillRect(x + p*5, y + p*7, p*12, p);
        ctx.fillRect(x + p*6, y + p*8, p*10, p);
        
        // Eyes (white)
        ctx.fillStyle = white;
        ctx.fillRect(x + p*7, y + p*5, p*2, p*2);
        ctx.fillRect(x + p*13, y + p*5, p*2, p*2);
        
        // Pupils (black)
        ctx.fillStyle = black;
        ctx.fillRect(x + p*8, y + p*6, p, p);
        ctx.fillRect(x + p*14, y + p*6, p, p);
        
        // Mouth with teeth
        ctx.fillStyle = black;
        ctx.fillRect(x + p*8, y + p*8, p*6, p);
        
        // Teeth (white)
        ctx.fillStyle = white;
        ctx.fillRect(x + p*8, y + p*8, p, p);
        ctx.fillRect(x + p*10, y + p*8, p, p);
        ctx.fillRect(x + p*12, y + p*8, p, p);
        
        // Arms (darker tan/orange) - animated
        ctx.fillStyle = darkTan;
        if (armWave === 0) {
            // Left arm up, right arm down
            ctx.fillRect(x + p*0, y + p*6, p*2, p*2); // Left hand up
            ctx.fillRect(x + p*0, y + p*8, p*4, p*2); // Left arm
            ctx.fillRect(x + p*18, y + p*8, p*4, p*2); // Right arm
            ctx.fillRect(x + p*20, y + p*10, p*2, p*2); // Right hand down
        } else {
            // Right arm up, left arm down
            ctx.fillRect(x + p*0, y + p*8, p*4, p*2); // Left arm
            ctx.fillRect(x + p*0, y + p*10, p*2, p*2); // Left hand down
            ctx.fillRect(x + p*20, y + p*6, p*2, p*2); // Right hand up
            ctx.fillRect(x + p*18, y + p*8, p*4, p*2); // Right arm
        }
        
        // Legs (red)
        ctx.fillStyle = red;
        ctx.fillRect(x + p*6, y + p*12, p*4, p*2); // Left leg
        ctx.fillRect(x + p*12, y + p*12, p*4, p*2); // Right leg
        
        // Feet (tan)
        ctx.fillStyle = darkTan;
        ctx.fillRect(x + p*5, y + p*14, p*4, p*2); // Left foot
        ctx.fillRect(x + p*13, y + p*14, p*4, p*2); // Right foot
    }
};

// Goal area (tighter collision matching DK's actual body)
const goal = {
    x: 350,  // Match DK's x position more closely
    y: 55,   // Match DK's new y position
    width: 70,  // Match DK's actual width
    height: 50  // Match DK's actual height
};

let enemySpawnCount = 0;

function spawnBarrel() {
    barrels.push(new Barrel(donkeyKong.x + 25, donkeyKong.y + donkeyKong.height));
}

function spawnFireball() {
    fireballs.push(new Fireball(donkeyKong.x + 25, donkeyKong.y + donkeyKong.height));
}

function checkCollisions() {
    if (player.invincible) return;
    
    // Check barrel collisions using circular hitbox
    for (let i = barrels.length - 1; i >= 0; i--) {
        const barrel = barrels[i];
        
        // Calculate distance between player center and barrel center
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const dx = playerCenterX - barrel.x;
        const dy = playerCenterY - barrel.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if player is clearly above the barrel (jumping over it)
        const playerBottom = player.y + player.height;
        const barrelTop = barrel.y - barrel.radius;
        
        // Horizontal overlap check
        const horizontalOverlap = Math.abs(playerCenterX - barrel.x) < (player.width / 2 + barrel.radius);
        
        if (horizontalOverlap && !player.onGround && playerBottom < barrelTop + 5 && !barrel.scored) {
            // Successfully jumping over barrel!
            score += 100;
            AudioSystem.playScore();
            updateHighScore();
            
            // Mark barrel as scored to prevent double-scoring
            barrel.scored = true;
            continue;
        }
        
        // Collision if distance is less than sum of radii (approximate player as circle)
        const playerRadius = Math.min(player.width, player.height) / 2;
        if (distance < playerRadius + barrel.radius) {
            // Hit by barrel
            ParticleSystem.createExplosion(barrel.x, barrel.y);
            player.loseLife();
            return;
        }
    }
    
    // Check fireball collisions
    for (let i = fireballs.length - 1; i >= 0; i--) {
        const fireball = fireballs[i];
        
        // Calculate distance between player center and fireball center
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const dx = playerCenterX - fireball.x;
        const dy = playerCenterY - fireball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if player is clearly above the fireball (jumping over it)
        const playerBottom = player.y + player.height;
        const fireballTop = fireball.y - fireball.radius;
        
        // Horizontal overlap check
        const horizontalOverlap = Math.abs(playerCenterX - fireball.x) < (player.width / 2 + fireball.radius);
        
        if (horizontalOverlap && !player.onGround && playerBottom < fireballTop + 5 && !fireball.scored) {
            // Successfully jumping over fireball! (More points than barrel)
            score += 200;
            AudioSystem.playScore();
            updateHighScore();
            
            // Mark fireball as scored to prevent double-scoring
            fireball.scored = true;
            continue;
        }
        
        // Collision if distance is less than sum of radii
        const playerRadius = Math.min(player.width, player.height) / 2;
        if (distance < playerRadius + fireball.radius) {
            // Hit by fireball
            ParticleSystem.createExplosion(fireball.x, fireball.y);
            player.loseLife();
            return;
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

let lastHighScore = 0; // Track when we last celebrated a high score

function updateHighScore() {
    if (score > highScore) {
        const oldHighScore = highScore;
        highScore = score;
        StorageManager.saveHighScore(highScore);
        
        // Only trigger confetti when we beat the previous session's high score
        // Not on every single point increase
        if (oldHighScore > lastHighScore) {
            lastHighScore = oldHighScore;
            ParticleSystem.createConfetti();
        }
    }
}

function startGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    frameCount = 0;
    barrelSpawnTimer = 0;
    enemySpawnCount = 0;
    barrels = [];
    fireballs = [];
    player.reset();
    donkeyKong.defeated = false;
    
    // Spawn first barrel immediately
    spawnBarrel();
    
    AudioSystem.startMusic();
}

function restartLevel() {
    gameState = 'playing';
    frameCount = 0;
    barrelSpawnTimer = 0;
    enemySpawnCount = 0;
    barrels = [];
    fireballs = [];
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
    
    // Spawn barrels and fireballs
    if (!donkeyKong.defeated) {
        barrelSpawnTimer++;
        if (barrelSpawnTimer >= BARREL_SPAWN_INTERVAL) {
            enemySpawnCount++;
            
            // Spawn fireball every 4th enemy (1 fireball per 3 barrels)
            if (enemySpawnCount % 3 === 0) {
                spawnFireball();
            } else {
                spawnBarrel();
            }
            
            barrelSpawnTimer = 0;
        }
    }
    
    // Update barrels
    for (let i = barrels.length - 1; i >= 0; i--) {
        barrels[i].update();
        
        // Remove barrels that fall off bottom
        if (barrels[i].y > canvas.height) {
            barrels.splice(i, 1);
            continue;
        }
        
        // Remove barrels that hit walls on the bottom platform (y > 600)
        if (barrels[i].y > 600) {
            if (barrels[i].x - barrels[i].radius <= 0 || 
                barrels[i].x + barrels[i].radius >= canvas.width) {
                barrels.splice(i, 1);
            }
        }
    }
    
    // Update fireballs
    for (let i = fireballs.length - 1; i >= 0; i--) {
        fireballs[i].update();
        
        // Remove fireballs that fall off bottom
        if (fireballs[i].y > canvas.height) {
            fireballs.splice(i, 1);
            continue;
        }
        
        // Remove fireballs that hit walls on the bottom platform (y > 600)
        if (fireballs[i].y > 600) {
            if (fireballs[i].x - fireballs[i].radius <= 0 || 
                fireballs[i].x + fireballs[i].radius >= canvas.width) {
                fireballs.splice(i, 1);
            }
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

// Draw angled platform with rotation (girder style)
function drawAngledPlatform(ctx, platform) {
    ctx.save();
    
    // Calculate center point of platform for rotation
    const centerX = platform.x + platform.width / 2;
    const centerY = platform.y + platform.height / 2;
    
    // Translate to center, rotate, then draw
    ctx.translate(centerX, centerY);
    ctx.rotate((platform.angle * Math.PI) / 180); // Convert degrees to radians
    
    const w = platform.width / 2;
    const h = platform.height / 2;
    
    // Main girder body (dark red/orange)
    ctx.fillStyle = '#D2691E';
    ctx.fillRect(-w, -h, platform.width, platform.height);
    
    // Top highlight (lighter)
    ctx.fillStyle = '#F4A460';
    ctx.fillRect(-w, -h, platform.width, h / 2);
    
    // Bottom shadow (darker)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-w, h / 2, platform.width, h / 2);
    
    // Rivets along the girder
    ctx.fillStyle = '#654321';
    const rivetSpacing = 60;
    for (let x = -w + 20; x < w; x += rivetSpacing) {
        // Top rivets
        ctx.beginPath();
        ctx.arc(x, -h + 4, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Bottom rivets
        ctx.beginPath();
        ctx.arc(x, h - 4, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Outline for definition
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w, -h, platform.width, platform.height);
    
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
    
    // Draw ladders (realistic style)
    for (let ladder of ladders) {
        const railWidth = 6;
        const rungSpacing = 15;
        
        // Left rail (cyan/blue metal)
        ctx.fillStyle = '#00CED1';
        ctx.fillRect(ladder.x, ladder.y, railWidth, ladder.height);
        
        // Right rail
        ctx.fillRect(ladder.x + ladder.width - railWidth, ladder.y, railWidth, ladder.height);
        
        // Rail highlights (lighter blue)
        ctx.fillStyle = '#40E0D0';
        ctx.fillRect(ladder.x + 1, ladder.y, 2, ladder.height);
        ctx.fillRect(ladder.x + ladder.width - railWidth + 1, ladder.y, 2, ladder.height);
        
        // Rungs (yellow/gold)
        ctx.fillStyle = '#FFD700';
        for (let i = 0; i < ladder.height; i += rungSpacing) {
            // Main rung
            ctx.fillRect(ladder.x, ladder.y + i, ladder.width, 4);
            
            // Rung highlight
            ctx.fillStyle = '#FFED4E';
            ctx.fillRect(ladder.x, ladder.y + i, ladder.width, 2);
            ctx.fillStyle = '#FFD700';
        }
        
        // Rail shadows (darker)
        ctx.fillStyle = '#008B8B';
        ctx.fillRect(ladder.x + railWidth - 2, ladder.y, 2, ladder.height);
        ctx.fillRect(ladder.x + ladder.width - 2, ladder.y, 2, ladder.height);
    }
    
    // Draw Donkey Kong
    donkeyKong.draw();
    
    // Draw barrels
    for (let barrel of barrels) {
        barrel.draw();
    }
    
    // Draw fireballs
    for (let fireball of fireballs) {
        fireball.draw();
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
    ctx.fillText('Press SPACE or JUMP to start!', canvas.width / 2, canvas.height / 2 + 150);
    
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

// Game loop with delta time for frame-rate independence
let lastTime = 0;
const TARGET_FPS = 60;
const TARGET_FRAME_TIME = 1000 / TARGET_FPS;

function gameLoop(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    
    // Cap delta time to prevent huge jumps (e.g., when tab is inactive)
    const cappedDelta = Math.min(deltaTime, TARGET_FRAME_TIME * 2);
    
    // Only update if enough time has passed (throttle to 60 FPS)
    if (deltaTime >= TARGET_FRAME_TIME) {
        update();
        draw();
        lastTime = currentTime - (deltaTime % TARGET_FRAME_TIME);
    }
    
    requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);
