# Beach weapons

Enabled by default; uncheck **Beach weapons** before hosting for the original game. Requires the unmodified USA ROM (524,288 bytes, CRC32 `4aafa462`); a 512-byte copier header is accepted. ZIP extraction is handled by EmulatorJS. Other ROMs run without the mod and show an explanation.

Two Gatlings wait near the water at the first beach; two rocket launchers wait farther up the sand. Approach and face an item, then press **X / SNES B** to pick it up with the original animation. The weapon occupies the normal co-op inventory slot and displays its icon in that box. Taking the grappling gun, another weapon, or another native item exchanges it with your equipped item. The old item stays on the ground and can be picked back up by either player.

Use **S / SNES Y**, or **Q / gamepad left shoulder / Fire** as a shortcut. Gatlings fire every four frames; rockets every forty frames. Rockets explode on impact, defeat nearby pirates, and remove wall/tree graphics and collision. NPCs and other players are not damaged. Water, room boundaries and item pickups are preserved. The original destructible-wall handler is triggered for wall sprites. Ordinary terrain destruction is remembered across room revisits during the session. Two native Jolly pirates spawn for beach target practice after the first weapon pickup.

Regular pirates are the supported enemy family; bosses and other families keep their original behavior. Native inventory animations and pauses stop custom firing. Custom weapon identity, dropped-item records, and destroyed scenery are session state, not part of emulator save states/rewind. Reload/start a new game to reset the playground.

## Implementation

This is a browser runtime mod of the original game, not a full decompilation or a replacement engine. No modified ROM, disassembly, game graphics or game audio is distributed. The host renders custom art and projectiles over the emulated scene, and composites both into the video stream. Guests need neither a ROM nor a patch. The mod runs immediately after the pinned core's main-loop iteration; it does not depend on foreground browser animation callbacks.

`gatling.js` verifies the ROM fingerprint before accessing game memory. It locates WRAM using a temporary eight-byte Pro Action Replay marker at unused `$7F:FFF0` through Snes9x's cheat interface, and clears the startup probes in a `finally` block. It accepts exactly one matching memory region and obtains a fresh heap view each frame. No fixed WASM address is assumed. The original ROM bytes are never changed. This bridge is specific to EmulatorJS 4.2.3's legacy Snes9x core.

`gatling-model.js` reads the two players at `$7E:0100` and `$7E:0180`, coordinates at offsets `$11`/`$14`, and facing at `$47`. Gameplay mode is `$A0 = 8`, normal room state `$A2 = 4`, pause/freeze `$AB`/`$AC`, and level/room `$B6`/`$B7`. Collision data is the 32-column array of 8-pixel tiles at `$1400`.

Pirates are sprite ID `$0C` in 24 slots at `$0200 + n*$50`. A bullet sets HP `$1C` to zero, preserves the previous HP in `$1D`, chooses the impact direction in `$0D`, cancels a previous stun, and enters hurt state `$02 = 4`, substate `$03 = 0`. The original routines `$81:E5B3` (skinny pirates) and `$81:F174` (burly pirates) choose their proper death sprites. `$81:FC88` launches the enemy with the original `$03A0` vertical speed and four-pixel horizontal/vertical velocity; `$81:FCA9` applies gravity. The game plays its defeat sound and eventually releases the sprite/graphics slot through `$80:8F0F`. We do not delete enemies or fake their flight with an overlay.

Two empty normal sprite slots on the beach are initialized as Jolly pirates. Their original initialization allocates graphics through `$80:8EE9`. Spawning requires two available graphics slots and two free sprite slots. This happens only in the opening room; regular room loading retains responsibility for the game's enemy and door bookkeeping.

Memory and routine references were investigated using [Yoshifanatic1's disassembly](https://github.com/Yoshifanatic1/Goof-Troop-Disassembly), [FURiOUS's practice cart](https://github.com/furious/gooftroop), and [GoofTroopEditor](https://github.com/Zarby89/GoofTroopEditor). Those research checkouts are ignored and not shipped. Application code implements the behavior independently; upstream projects retain their licenses.

## Inventory and scenery

`weapon-inventory.js` uses the game's valid bell item ID (`$0C`) as the native carrier and tracks Gatling/rocket identity separately. Custom ground objects use the four native item slots `$1040..$10A0`. The original pickup code exchanges the carrier in `$0142`/`$01C2`, updates the inventory and plays the pickup animation. The mod consumes the native pickup/exchange event once, transfers custom identity to the recipient, and tags the dropped item. Native grappling guns remain original items and regain their original Y-button behavior immediately after a swap. Native item-use input is suppressed only while a custom weapon occupies that player's slot. The renderer replaces the carrier's ground and HUD artwork with the correct sprite.

Synthetic ground items temporarily borrow a native persistence nibble; its original value is restored after native processing so collecting a beach weapon does not change an unrelated level-item flag. Dropped native items at synthetic locations are also tracked. Room revisits rebind existing native ground objects before allocating free slots, avoiding duplicate drops. No custom item ID is passed to an out-of-range native dispatch table.

`weapon-terrain.js` decodes the room's original 32/16/8-pixel metatiles directly from the locally supplied ROM. A rocket clears affected collision bytes at `$1400` and their backing copy at `$7F:F800`. It replaces foreground tiles and supplies matching walkable ground underneath. Item collision is protected. Tall scenery above impact is included in the blast so tree canopies are removed along with their footprint.

Background changes use the native DMA queue at `$1800`, bounded by its `$40` cursor. Small tile uploads target foreground/background VRAM maps `$5000` and `$5800`, with transient source words at unused `$7F:FC00`. Uploads wait when the game's queue is busy. This changes the actual emulated background, so characters can walk through the resulting hole and guests see the same scene. Destruction records are reapplied when returning to a room; original dynamic objects and native wall sprites retain their own handlers.

## Art

`public/assets/gatling.png` was generated with the built-in image generation tool. The original transparent PNG is preserved; the renderer trims transparent margins and draws it on a small pixel grid. Final prompt:

> Use case: stylized-concept. Asset type: production pixel-art game weapon sprite on a truly transparent background. Create ONE compact Gatling gun pickup sprite for a colorful 1990s 16-bit top-down adventure game in the visual spirit of SNES Goof Troop. The object should have clearly readable oversized rotating multi-barrel assembly pointing to the RIGHT, dark navy outlines, polished slate-blue steel, brass barrel bands, a small reddish-brown wooden pistol grip, a round ammunition drum, and a few bright cyan highlight pixels. Slight three-quarter top-down view, with the top and side visible, suitable for being held by a small cartoon character. Flat crisp pixel-art clusters, no anti-aliasing, no gradients, no text, no watermark, no scene or ground. Designed on a 32 by 24 pixel logical grid, nearest-neighbor enlarged if needed. Keep all parts inside a compact silhouette with a small transparent margin. No bullets, no muzzle flash, no person. Gun occupies most of the image. Truly transparent background.

`public/assets/rocket.png` was also generated with the built-in image generation tool. Final prompt:

> Production game asset: ONE compact cartoon rocket launcher pickup sprite for a colorful 1990s SNES top-down adventure, matching a chunky Goof Troop-style pixel-art weapon. Truly transparent background. Right-facing three-quarter view showing top and side. Short oversized olive-green tube with a wide dark muzzle ring on the RIGHT, orange-red bands, pale steel sights, small wooden grip and a tiny yellow warning stripe. Friendly exaggerated toy-like silhouette, dark navy pixel outlines, crisp flat pixel clusters, no gradients, no antialiasing. Readable at a 32x20 logical-pixel size. Gun alone, no rocket flying, no person, no shadow, no scene, no text, no watermark. Center the full gun with a small transparent margin. Render as pixel art enlarged with nearest-neighbor edges.

## Verification

`npm test` covers native inventory exchange events (including same-carrier weapon swaps), loss of gun firing after taking a grapple, independent firing, native pirate damage, rocket cadence, pauses, collision removal, item protection, bounded DMA writes and terrain persistence, plus the original controller/server tests.

`npm run test:gatling` exercises two real Chrome tabs, native pickups, remote firing with a hidden host, original pirate flight/cleanup and independent host controls. `npm run test:weapons` adds a native grappling-gun fixture to exercise swapping, original grapple use and re-pickup, then collects a rocket, destroys trees/walls, and walks through the former obstacles using normal controller input. It supports an optional live URL and local ROM path. `npm run test:movement` checks animated guest video, background-host speed and audio. Screenshots go to ignored `test-results/`.
