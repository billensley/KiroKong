# 🎮 Kiro Kong

A retro-style arcade platformer inspired by the classic Donkey Kong, built with vanilla JavaScript and HTML5 Canvas. Climb platforms, avoid rolling barrels, and defeat Donkey Kong at the top!

![Kiro Kong Game](kiro-logo.png)

## 🕹️ Game Features

- **Classic Platformer Gameplay**: Navigate through zigzag platforms and ladders
- **Realistic Physics**: Gravity-based movement with smooth jumping mechanics
- **Angled Platforms**: Barrels roll downhill on tilted platforms for dynamic gameplay
- **Smart Enemies**: Barrels spawn regularly and can fall through ladders
- **Lives System**: Start with 3 lives and respawn with invincibility period
- **Score Tracking**: Earn points over time and bonus points for jumping over barrels
- **High Score Persistence**: Your best score is saved locally
- **Retro Audio**: Chiptune-style background music and sound effects
- **Visual Effects**: Particle explosions and confetti celebrations
- **Responsive Design**: Works on desktop and mobile devices
- **Touch Controls**: Mobile-friendly on-screen buttons

## 🎯 How to Play

### Desktop Controls
- **Arrow Keys**: Move left/right
- **Up/Down Arrows**: Climb ladders
- **Space Bar**: Jump

### Mobile Controls
- Use the on-screen touch buttons for all controls

### Objective
Climb to the top of the level while avoiding rolling barrels. Reach Donkey Kong at the summit to complete the level!

## 🚀 Getting Started

### Play Instantly
Simply open `index.html` in any modern web browser. No installation or build process required!

### Local Server (Optional)
For the best experience, you can run a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Then open http://localhost:8000
```

## 🛠️ Technical Details

### Built With
- **Vanilla JavaScript (ES6+)** - No frameworks or dependencies
- **HTML5 Canvas API** - For rendering and animations
- **Web Audio API** - For retro sound effects and music

### Architecture
- Object-oriented design with player, barrel, and particle systems
- 60 FPS game loop using `requestAnimationFrame`
- Angled platform geometry system for realistic physics
- Particle system for visual effects
- Local storage for high score persistence

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🎨 Game Design

### Visual Style
- Retro arcade aesthetic with modern polish
- Kiro brand colors (Purple #790ECB)
- Smooth 60 FPS animations
- Pixel-art inspired graphics

### Audio
- Authentic Donkey Kong background music (MP3)
- Jump and walking sound effects from original game
- Web Audio API for seamless music looping
- HTML5 Audio fallback for maximum compatibility
- Mobile-optimized audio initialization

## 📁 Project Structure

```
/
├── index.html          # Main HTML entry point
├── game.js             # Complete game implementation
├── kiro-logo.png       # Player sprite
├── backmusic.mp3       # Background music
├── jump.wav            # Jump sound effect
├── walking.wav         # Walking sound effect
└── README.md           # This file
```

## 🎓 Workshop Project

This game was created as part of the AWS Re:Invent workshop, demonstrating how to build games with AI assistance using Kiro.

## 🏆 Features Implemented

- ✅ Single-screen platformer level
- ✅ Player character with Kiro logo sprite
- ✅ Barrel enemies with realistic physics
- ✅ Fireball enemies with bouncing and ladder navigation
- ✅ Ladder climbing mechanics
- ✅ Angled platforms for dynamic barrel movement
- ✅ Score and lives system
- ✅ High score persistence with smart confetti triggers
- ✅ Particle effects (explosions, confetti)
- ✅ Authentic Donkey Kong audio (background music, jump, walking)
- ✅ Seamless audio looping with Web Audio API
- ✅ Detailed Donkey Kong sprite with animation
- ✅ Frame-rate independent gameplay (locked to 60 FPS)
- ✅ Mobile responsive design
- ✅ Touch controls for mobile with audio initialization

## 🎮 Gameplay Tips

1. **Timing is Everything**: Wait for the right moment to move between platforms
2. **Use Ladders Wisely**: Climb up or down to avoid barrels and fireballs
3. **Jump Over Barrels**: Earn 100 bonus points by jumping over barrels
4. **Jump Over Fireballs**: Earn 200 bonus points by jumping over fireballs
5. **Watch the Angles**: Barrels roll downhill on angled platforms
6. **Beware of Fireballs**: They bounce periodically and can climb down ladders
7. **Invincibility Period**: After losing a life, you have 2 seconds of invincibility (flickering)

## 📝 License

This project is open source and available for educational purposes.

## 🙏 Acknowledgments

- Inspired by the classic Donkey Kong arcade game
- Built with Kiro AI assistance
- Created for AWS Re:Invent workshop

---

**Enjoy the game! 🎮🍌**
