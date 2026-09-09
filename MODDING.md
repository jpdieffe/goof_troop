# Story and Zombie modes

The host chooses the game type after the native player-selection screen. The selector runs on the same host simulation clock and is composited into the guest video. It waits for a new button press so holding Start through player selection cannot skip it. The host can also click/tap either option. Gameplay input is suppressed until selection and arena preparation finish.

Normal story makes no custom gameplay changes. Zombie mode uses the original USA ROM (524,288 bytes, CRC32 4aafa462; a 512-byte copier header is accepted). Unsupported ROMs run normally and show an explanation. No ROM, modified ROM, game graphics, or disassembly is distributed.

## Survival loop

Each survival level has three waves: initially four, six and eight enemies. Later levels add enemies, up to eight extra per wave. No more than four living wave enemies spawn at once; the native graphics-slot pool also limits spawning. Bad guys enter at the right in three lanes and pursue the players. Every third spawn also fires green projectiles that shields can reflect.

The director watches each native enemy through initialization, defeat and cleanup. A defeat creates one random item drop. Wave completion waits for every queued enemy and native death animation to finish. After wave three, all surviving players move to the right to advance. Cleared-wave loot remains collectable but no longer blocks movement to the exit. This starts a new survival arena, moves players to its left edge, rebuilds the local-ROM island scenery with a different cover pattern, and increases difficulty. These are custom survival levels, not the original story-room sequence.

Random drops choose among Gatling, rockets, mech, shield, sword, sniper and grenades. They use free walkable grid positions and retain their ammo when swapped. At most 18 ground records are kept; an old unbound drop can be replaced when the floor is full. New levels clear floor loot while preserving held weapons and remaining ammo.

The pistol and sword are unlimited. Gatlings have 120 rounds, rockets six, mechs 120 laser pulses, sniper rifles ten rounds, grenades four, and shields one activation. An exhausted item returns the player to the pistol. Shields last 600 active simulation frames, repel enemies and reflect their projectiles, and remain active after switching weapons. Native pause/pickup animations pause combat and shield timers. Sniper rounds pierce enemies; swords sweep an arc; grenades travel over obstacles and detonate after 45 active frames.

## Runtime integration

This is a browser runtime mod of the original game, not a full decompilation. `game-session.js` gates the original-game path and `zombie-mode.js` owns the survival loop. `gatling-model.js` implements weapons, and `weapons.js` defines supplies and firing cadence. The host renders custom art and effects over the emulated scene and composites both into the stream. Effects audio enters the emulator's existing audio gain. Guests need no ROM or patch.

The pinned EmulatorJS 4.2.3 legacy Snes9x main-loop hook runs the mod immediately after each core iteration. The existing worker clock and hidden-host OpenAL/video fixes remain in use. `gatling.js` verifies the ROM fingerprint and locates WRAM through a temporary eight-byte PAR marker at unused $7F:FFF0, cleared in a finally block. It accepts exactly one heap match; no fixed WASM pointer is assumed.

Players are at $0100/$0180; position is at offsets $11/$14, facing at $47. Gameplay is $A0=8 and room-ready is $A2=4. The selector and arena preparation use the native $AC freeze while the core continues ticking. Ordinary pauses are $AB. Input held across preparation is restored when play resumes.

Items use the valid native bell ID $0C as their inventory carrier, with custom identity and ammo stored separately. Native pickup animation and swap events drive inventory changes. Solo Zombie mode keeps the primary slot selected; Story retains its original inventory behavior. Four native world slots at $1040/$1060/$1080/$10A0 are lent to nearby custom pickups. Distant idle custom objects can be evicted, restoring collision exactly as native cleanup $82:B100 does. Native items and in-progress pickups are not evicted. Original persistence flag nibbles are restored after synthetic-item updates.

Wave enemies are native wandering pirates, sprite ID $0C. Their own initialization allocates graphics. Weapon damage zeroes HP $1C, preserves previous HP in $1D, selects impact direction, clears old stun, and enters native hurt state 4. The native routines choose the defeat animation, launch the enemy, play sound, and release its sprite/graphics slot. Projectile hits on players enter the game's normal hurt/death handler. Story NPCs are not targets. Survival only spawns this supported pirate family; the weapon bridge does not add boss-specific damage handlers.

`weapon-terrain.js` decodes map metatiles from the selected ROM. Destruction changes native collision at $1400 and backing collision at $7F:F800, plus real foreground/background VRAM maps $5000/$5800. Bounded uploads use the native DMA queue at $1800 and scratch words at $7F:FC00. Queue writes wait for prior transfers to finish. Arena rebuilding uploads the original map before carving its new lanes. Pickups, water and outer map boundaries are protected.

Custom weapon identity/ammo, shields, projectiles, survival state and terrain destruction are session state, outside emulator save states/rewind. Reload to start a fresh session. Weapons use the original player movement footprint even when a large mech is drawn over the character.

RAM investigation used [Yoshifanatic1's disassembly](https://github.com/Yoshifanatic1/Goof-Troop-Disassembly), [FURiOUS's practice cart](https://github.com/furious/gooftroop), and [GoofTroopEditor](https://github.com/Zarby89/GoofTroopEditor). Research checkouts are ignored and not shipped.

## Art

`public/assets/zombie-items.png` contains the new pistol, sniper rifle, grenade,
sword and shield projector. It was generated with the built-in image generation
tool. The transparent original is preserved; the renderer trims each object and
preserves its proportions at game resolution. Final prompt:

> Use case: stylized-concept. Production pixel-art pickup sprite sheet for a colorful 1990s SNES top-down cartoon adventure. Truly transparent background. EXACTLY FIVE separate objects in one horizontal row of FIVE equal-width cells, generous transparent separation, each object centered fully within its cell. From LEFT to RIGHT: 1 a chunky silver and orange compact PISTOL facing right; 2 a long dark teal SNIPER RIFLE with scope and brass barrel facing right; 3 a round olive-green GRENADE with brass safety lever and pin; 4 a gleaming steel SWORD with blue hilt, blade angled up-right; 5 a small cobalt SHIELD PROJECTOR device with a bright cyan hexagonal shield emblem. Crisp dark navy pixel outlines, flat limited 16-bit palette, chunky readable shapes, slight top-down three-quarter perspective, no gradients or antialiasing. These must read at 24x20 logical pixels. No lasers, no explosions, no people, no scenery, no labels, no text, no cell borders, no watermark. Wide transparent sprite sheet.

`public/assets/mech.png` was generated with the built-in image generation tool.
The original transparent three-view sheet is preserved. The renderer crops the
three cells at runtime and mirrors the generated left-facing side view for right.
Final prompt:

> Use case: stylized-concept. Production pixel-art sprite sheet for a colorful 1990s SNES top-down adventure game. Truly transparent background. EXACTLY THREE separate full-body views of the SAME large friendly combat mech robot arranged in three equal horizontal cells: LEFT CELL facing DOWN toward the viewer, MIDDLE CELL facing RIGHT in side three-quarter view, RIGHT CELL facing UP away from viewer showing its back. Each robot fully contained and centered in its own cell with generous transparent space separating them. Chunky teal and cobalt armor, warm brass joints, bright cyan visor, oversized shoulder plates, heavy stomping feet, one oversized cylindrical arm cannon with glowing cyan muzzle. Broad squat imposing silhouette, approximately twice a cartoon adventurer's size. Clear dark navy pixel outlines, crisp flat pixel clusters, limited 16-bit palette, no gradients or antialiasing. Top-down game perspective with top surfaces visible; feet aligned at the same baseline in all three cells. Same robot proportions and scale in all views. Idle standing poses, no laser or effects. No people, no shadows, no scenery, no text, no cell labels, no borders, no watermark. Each view should read clearly at a logical 44x48 pixel size. Wide horizontal sprite sheet.

`public/assets/gatling.png` was generated with the built-in image generation tool. The original transparent PNG is preserved; the renderer trims transparent margins and draws it on a small pixel grid. Final prompt:

> Use case: stylized-concept. Asset type: production pixel-art game weapon sprite on a truly transparent background. Create ONE compact Gatling gun pickup sprite for a colorful 1990s 16-bit top-down adventure game in the visual spirit of SNES Goof Troop. The object should have clearly readable oversized rotating multi-barrel assembly pointing to the RIGHT, dark navy outlines, polished slate-blue steel, brass barrel bands, a small reddish-brown wooden pistol grip, a round ammunition drum, and a few bright cyan highlight pixels. Slight three-quarter top-down view, with the top and side visible, suitable for being held by a small cartoon character. Flat crisp pixel-art clusters, no anti-aliasing, no gradients, no text, no watermark, no scene or ground. Designed on a 32 by 24 pixel logical grid, nearest-neighbor enlarged if needed. Keep all parts inside a compact silhouette with a small transparent margin. No bullets, no muzzle flash, no person. Gun occupies most of the image. Truly transparent background.

`public/assets/rocket.png` was also generated with the built-in image generation tool. Final prompt:

> Production game asset: ONE compact cartoon rocket launcher pickup sprite for a colorful 1990s SNES top-down adventure, matching a chunky Goof Troop-style pixel-art weapon. Truly transparent background. Right-facing three-quarter view showing top and side. Short oversized olive-green tube with a wide dark muzzle ring on the RIGHT, orange-red bands, pale steel sights, small wooden grip and a tiny yellow warning stripe. Friendly exaggerated toy-like silhouette, dark navy pixel outlines, crisp flat pixel clusters, no gradients, no antialiasing. Readable at a 32x20 logical-pixel size. Gun alone, no rocket flying, no person, no shadow, no scene, no text, no watermark. Center the full gun with a small transparent margin. Render as pixel art enlarged with nearest-neighbor edges.

## Verification

`npm test` covers input/server boundaries, Story isolation, selector input edges, native item exchange and ammo persistence, finite ammo fallback, firing, terrain collision/DMA bounds, shield bounce/reflection, one drop per defeat, and three-wave/next-level rules.

`npm run test:zombie` runs real Chrome host/guest tabs. It checks Story gameplay, the streamed selector, native shield pickup, activation/bounce/reflection, each weapon through normal controller input, three complete waves, enemy loot pickup, guest firing with a truly hidden host, and walking through the right exit into level two. Controlled test fixtures position initialized enemies in a firing lane and provide loadouts for weapon coverage; production spawning, native death, slot cleanup, loot and wave counters are exercised directly. The older test:gatling/test:weapons/test:mech commands are aliases for this current survival test.

`npm run test:movement` (also test:browser) checks Story-mode player isolation, guest ocean animation, background-host frame rate, non-silent audio, invite auto-join and reconnect focus. Screenshots are saved to ignored test-results/.
