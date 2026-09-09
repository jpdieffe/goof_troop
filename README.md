# Goof Troop Online

A browser SNES player with two-person rooms. The host runs the original ROM through EmulatorJS 4.2.3. Their friend receives live video/audio and sends controller input over WebRTC using PeerJS 1.5.5. This is an emulator-based adaptation, **not a decompilation or source port**.

**[Play online](https://jpdieffe.github.io/goof_troop/)** — choose your local ROM, create a room, and send the invite link to your friend. No local server or launcher is needed for the published site.

## Game modes

After the original player-selection screen, the host chooses **Normal story** or **Zombie mode** with Up/Down and Enter, a controller, or the onscreen buttons. The guest sees the same selection screen.

**Normal story** follows the original adventure with two Gatling guns, two rocket launchers, and two mech pickups on the first beach. These weapons have unlimited ammo and swap with regular inventory items.

**Zombie mode** starts both players with an unlimited-ammo pistol. Four starter pickups include a sword, shield, Gatling and rocket launcher. Bad guys arrive from the right in three increasingly large waves. Defeated enemies drop random items. After wave three, all surviving players walk to the right-hand exit to enter the next survival level, with rebuilt scenery and harder waves. Cleared-wave loot stays collectable but becomes passable so it cannot block the exit. Solo play works too.

Face a pickup and press **X / SNES B** to take or swap it. Hold **S / SNES Y**, or **Q / gamepad left shoulder / Fire**, to use it. The old item stays on the ground with its remaining ammo. When a finite weapon runs out, you return to the unlimited pistol.

| Item | Use | Starting supply |
| --- | --- | --- |
| Pistol | Steady single shots | Unlimited |
| Sword | Short-range sweeping slash | Unlimited |
| Gatling | Rapid bullet stream | 120 rounds |
| Rocket launcher | Explosive rockets; destroys scenery | 6 rockets |
| Mech suit | Transforms you; piercing super laser | 120 energy pulses |
| Sniper rifle | Fast bullets that pierce multiple enemies | 10 rounds |
| Grenade | Lobbed explosive with a short fuse | 4 grenades |
| Shield projector | Ten-second bubble that repels enemies and reflects their shots | One activation |

The shield remains active while you use another weapon. Its bar shows time remaining. The HUD shows your current item, ammo, lives, level and wave. Heavy weapons, shields, swords, sniper rifles and grenades all appear in the random drop pool.

The host needs the original USA ROM for the mode selector and survival mod. Guests receive the whole scene and sound through the usual stream. See [MODDING.md](MODDING.md) for technical details and validation.

## Play on this computer

Double-click `start-game.bat`, or run `npm start` and open http://localhost:3000. Node.js is required; the app server has no npm runtime dependencies.

1. Click **Create a room**. The supplied `Goof Troop.zip` has been copied to `public/local-rom.zip` for local play. You can also choose an `.sfc`, `.smc`, or `.zip` file.
2. Send your friend the invite link or the 12-character room code.
3. An invite link joins automatically. Alternatively, your friend opens this app, enters the code, and clicks **Join** or presses Enter. The game receives keyboard focus automatically. They do not need the ROM. Click **Enable sound** after the video appears (browsers require an interaction for sound).
4. On the title screen, choose **GAME** and press Enter. Press Enter again to skip the story. On **PLAYER SELECT**, press Down to highlight a bottom-row team showing both **1P** and **2P**, then Enter. Choose **Normal story** or **Zombie mode** on the next screen. The host controls player one; the friend controls player two.

Keep the host tab open and the computer awake. Hosting continues when you switch to another tab, including when testing player two in the same browser. Chrome or Edge desktop is recommended for the initial setup. Mobile has touch buttons; browser support and network conditions affect streaming.

## Play with a friend over the internet

The app is published at **https://jpdieffe.github.io/goof_troop/**. Pushes to `main` automatically update it after tests pass. For deployment details, see [GITHUB-PAGES.md](GITHUB-PAGES.md).

`localhost` links work only on the computer opening them. Either both people run this app locally (share the **room code**), or put the app at a shared HTTPS URL:

```
npm run build
```

Upload only the contents of `dist/` to an HTTPS static host. This build includes the app files and **excludes the ROM**. On that site the host chooses their local ROM file; the guest just joins. Invite links then point to the shared site.

Room discovery uses the public PeerJS signaling service. STUN helps discover direct network routes. Gameplay media and controls travel directly between browsers; there is no gameplay server or TURN relay configured. Some corporate networks, carrier networks, and restrictive routers prevent direct WebRTC. If a connection fails, try a different network. Supporting those networks reliably would require a TURN relay, which would relay traffic instead of keeping it direct.

External downloads: EmulatorJS runtime/core from its pinned CDN path, PeerJS from unpkg, and optional Google Fonts. An internet connection is required. Room codes are unlisted bearer invitations: share them only with your friend. A room accepts one guest at a time.

## Controls

| Keyboard | SNES button |
| --- | --- |
| Arrow keys | D-pad |
| Z / X | A / B |
| A / S | X / Y |
| Q / W | L / R |
| Enter / Shift | Start / Select |

Both players use the same bindings on their own computers. Standard gamepads and onscreen buttons are also supported. Controller state is resent periodically; lost focus, connection loss, and input timeouts release held buttons. Reload to start a new session. Emulator save-state controls are available to the host in the game toolbar.

## Development and verification

```
npm install
npm test
npm start
# In a second terminal, with Google Chrome installed:
npm run test:browser
# Real foreground/background tabs, with ordinary browser throttling:
npm run test:movement
# Story selection, survival waves, all weapons, shields, loot and next level:
npm run test:zombie
```

The unit/integration tests validate input bounds, key release, room codes, static server boundaries, Story beach weapons, item/ammo swaps, weapon damage, shield reflection and wave progression. The browser test loads the actual ROM, creates a real room, joins from a second tab, checks rendered video and non-silent audio samples, verifies player-two press/release at the emulator API, and tests leaving/rejoining. Screenshots are saved in `test-results/`. The browser test needs internet access and `public/local-rom.zip`. Testing two tabs cannot prove connectivity between all home networks.

The movement regression opens real Chrome tabs and disables Playwright's forced-focus emulation and background-throttling overrides. It requires the host to report `document.hidden === true`, then checks normal emulation speed, advancing guest video, moving ocean pixels, independent player-two movement, and non-silent audio. This catches freezes that the ordinary headless connection test can miss.

The controller and canvas integration uses pinned EmulatorJS internals. Re-test it before upgrading EmulatorJS. A worker supplies background frame callbacks; `host-core.js` patches the pinned Snes9x JavaScript glue before execution to keep its native video loop and OpenAL scheduler active while hidden, and disables RetroArch's pause-on-focus-loss setting. The patch checks its expected source patterns and displays an error if they change. It does not modify browser visibility, the ROM, or the core's WebAssembly. Audio is captured from the emulator's Web Audio output; no microphone or screen capture permission is requested.

References: [EmulatorJS options](https://emulatorjs.org/docs/options/), [controller mapping](https://emulatorjs.org/docs4devs/control-mapping/), [PeerJS connections](https://peerjs.com/client/getting-started). Emulator and PeerJS code retain their respective upstream licenses; the game ROM is separate from the application code.

