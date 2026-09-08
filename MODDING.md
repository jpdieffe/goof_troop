# Beach Gatling prototype

Enabled by default; uncheck **Beach Gatling prototype** before hosting for the original game. The host needs the unmodified USA ROM (524,288 bytes, CRC32 `4aafa462`); a 512-byte copier header is also accepted. ZIP extraction is handled by EmulatorJS. Other ROMs run without the mod and show an explanation.

There are two gun pickups on the sand just below the players in stage one's first room. Walk over one to equip it. Aim with the directional controls and hold **Q / SNES L / gamepad left shoulder / Fire**. Each player gets one gun, with unlimited ammunition and 15 shots per second. Equipment stays with you between rooms for the session. Two native Jolly pirates spawn on the beach after the first pickup for testing. Start a new game/session to reset the playground.

This first prototype targets regular pirates. NPCs, bosses, scenery and other enemy families do not receive Gatling damage. Bullets stop at solid collision tiles, expire offscreen and clear on room changes. Gameplay pauses stop the weapon simulation. Original buttons, inventory and puzzle mechanics still work. Custom equipment and bullets are browser session state; emulator save states/rewind do not save or restore them.

## Implementation

This is a browser runtime mod of the original game, not a full decompilation or a replacement engine. No modified ROM, disassembly, game graphics or game audio is distributed. The host renders custom art and projectiles over the emulated scene, and composites both into the video stream. Guests need neither a ROM nor a patch. The mod runs immediately after the pinned core's main-loop iteration; it does not depend on foreground browser animation callbacks.

`gatling.js` verifies the ROM fingerprint before accessing game memory. It locates WRAM using a temporary eight-byte Pro Action Replay marker at unused `$7F:FFF0` through Snes9x's cheat interface, and clears the startup probes in a `finally` block. It accepts exactly one matching memory region and obtains a fresh heap view each frame. No fixed WASM address is assumed. The original ROM bytes are never changed. This bridge is specific to EmulatorJS 4.2.3's legacy Snes9x core.

`gatling-model.js` reads the two players at `$7E:0100` and `$7E:0180`, coordinates at offsets `$11`/`$14`, and facing at `$47`. Gameplay mode is `$A0 = 8`, normal room state `$A2 = 4`, pause/freeze `$AB`/`$AC`, and level/room `$B6`/`$B7`. Collision data is the 32-column array of 8-pixel tiles at `$1400`.

Pirates are sprite ID `$0C` in 24 slots at `$0200 + n*$50`. A bullet sets HP `$1C` to zero, preserves the previous HP in `$1D`, chooses the impact direction in `$0D`, cancels a previous stun, and enters hurt state `$02 = 4`, substate `$03 = 0`. The original routines `$81:E5B3` (skinny pirates) and `$81:F174` (burly pirates) choose their proper death sprites. `$81:FC88` launches the enemy with the original `$03A0` vertical speed and four-pixel horizontal/vertical velocity; `$81:FCA9` applies gravity. The game plays its defeat sound and eventually releases the sprite/graphics slot through `$80:8F0F`. We do not delete enemies or fake their flight with an overlay.

Two empty normal sprite slots on the beach are initialized as Jolly pirates. Their original initialization allocates graphics through `$80:8EE9`. Spawning requires two available graphics slots and two free sprite slots. This happens only in the opening room; regular room loading retains responsibility for the game's enemy and door bookkeeping.

Memory and routine references were investigated using [Yoshifanatic1's disassembly](https://github.com/Yoshifanatic1/Goof-Troop-Disassembly), [FURiOUS's practice cart](https://github.com/furious/gooftroop), and [GoofTroopEditor](https://github.com/Zarby89/GoofTroopEditor). Those research checkouts are ignored and not shipped. Application code implements the behavior independently; upstream projects retain their licenses.

## Art

`public/assets/gatling.png` was generated with the built-in image generation tool. The original transparent PNG is preserved; the renderer trims transparent margins and draws it on a small pixel grid. Final prompt:

> Use case: stylized-concept. Asset type: production pixel-art game weapon sprite on a truly transparent background. Create ONE compact Gatling gun pickup sprite for a colorful 1990s 16-bit top-down adventure game in the visual spirit of SNES Goof Troop. The object should have clearly readable oversized rotating multi-barrel assembly pointing to the RIGHT, dark navy outlines, polished slate-blue steel, brass barrel bands, a small reddish-brown wooden pistol grip, a round ammunition drum, and a few bright cyan highlight pixels. Slight three-quarter top-down view, with the top and side visible, suitable for being held by a small cartoon character. Flat crisp pixel-art clusters, no anti-aliasing, no gradients, no text, no watermark, no scene or ground. Designed on a 32 by 24 pixel logical grid, nearest-neighbor enlarged if needed. Keep all parts inside a compact silhouette with a small transparent margin. No bullets, no muzzle flash, no person. Gun occupies most of the image. Truly transparent background.

## Verification

`npm test` checks independent pickups/firing, native fatal damage fields, NPC immunity, solid terrain, pauses, room changes and ROM fingerprinting, as well as the original input/server tests.

`npm run test:gatling` uses the local ROM in real Chrome tabs. It tests player two picking up and firing through WebRTC while the host is hidden, observes native death substates/altitude/velocity in live RAM, checks firing release and player one's independent pickup/fire. Screenshots go to `test-results/`. An optional URL and ROM path can follow the command, for example `npm run test:gatling -- https://jpdieffe.github.io/goof_troop/ "Goof Troop.zip"`.
