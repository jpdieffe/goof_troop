# Goof Troop Online

A browser SNES player with two-person rooms. The host runs the original ROM through EmulatorJS 4.2.3. Their friend receives live video/audio and sends controller input over WebRTC using PeerJS 1.5.5. This is an emulator-based adaptation, **not a decompilation or source port**.

**[Play online](https://jpdieffe.github.io/goof_troop/)** — choose your local ROM, create a room, and send the invite link to your friend. No local server or launcher is needed for the published site.

## New: beach Gatling gun

Leave **Beach Gatling prototype** enabled when hosting. Two guns wait on the first beach, just below the players. Walk over one, face a direction, and hold **Q** (gamepad left shoulder, or the **Fire** touch button). Bullets launch regular pirates using the original defeat animation. Two pirates appear on the beach for testing after the first pickup. Both players can carry a gun; the guest sees everything in the host’s stream.

This browser runtime mod requires the original USA ROM and uses custom graphics plus the game’s actual enemy routines. It does not require a separately patched ROM. See [MODDING.md](MODDING.md) for scope, source references and testing.

## Play on this computer

Double-click `start-game.bat`, or run `npm start` and open http://localhost:3000. Node.js is required; the app server has no npm runtime dependencies.

1. Click **Create a room**. The supplied `Goof Troop.zip` has been copied to `public/local-rom.zip` for local play. You can also choose an `.sfc`, `.smc`, or `.zip` file.
2. Send your friend the invite link or the 12-character room code.
3. An invite link joins automatically. Alternatively, your friend opens this app, enters the code, and clicks **Join** or presses Enter. The game receives keyboard focus automatically. They do not need the ROM. Click **Enable sound** after the video appears (browsers require an interaction for sound).
4. On the title screen, choose **GAME** and press Enter. Press Enter again to skip the story. On **PLAYER SELECT**, press Down to highlight a bottom-row team showing both **1P** and **2P**, then Enter. The host controls player one; the friend controls player two.

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
# Beach pickups, bullets, native pirate flight, and guest firing:
npm run test:gatling
```

The unit/integration tests validate input bounds, key release, room codes, and static server boundaries. The browser test loads the actual ROM, creates a real room, joins from a second tab, checks rendered video and non-silent audio samples, verifies player-two press/release at the emulator API, and tests leaving/rejoining. Screenshots are saved in `test-results/`. The browser test needs internet access and `public/local-rom.zip`. Testing two tabs cannot prove connectivity between all home networks.

The movement regression opens real Chrome tabs and disables Playwright's forced-focus emulation and background-throttling overrides. It requires the host to report `document.hidden === true`, then checks normal emulation speed, advancing guest video, moving ocean pixels, independent player-two movement, and non-silent audio. This catches freezes that the ordinary headless connection test can miss.

The controller and canvas integration uses pinned EmulatorJS internals. Re-test it before upgrading EmulatorJS. A worker supplies background frame callbacks; `host-core.js` patches the pinned Snes9x JavaScript glue before execution to keep its native video loop and OpenAL scheduler active while hidden, and disables RetroArch's pause-on-focus-loss setting. The patch checks its expected source patterns and displays an error if they change. It does not modify browser visibility, the ROM, or the core's WebAssembly. Audio is captured from the emulator's Web Audio output; no microphone or screen capture permission is requested.

References: [EmulatorJS options](https://emulatorjs.org/docs/options/), [controller mapping](https://emulatorjs.org/docs4devs/control-mapping/), [PeerJS connections](https://peerjs.com/client/getting-started). Emulator and PeerJS code retain their respective upstream licenses; the game ROM is separate from the application code.

