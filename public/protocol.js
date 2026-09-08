export const KEY_MAP = {ArrowUp:4,ArrowDown:5,ArrowLeft:6,ArrowRight:7,KeyZ:8,KeyX:0,KeyA:9,KeyS:1,KeyQ:10,KeyW:11,Enter:3,ShiftLeft:2,ShiftRight:2};
export function validState(data) { return data?.type === 'input' && Number.isInteger(data.mask) && data.mask >= 0 && data.mask < 4096; }
export function normalizeCode(value) { return value.trim().toUpperCase(); }
export function validCode(value) { return /^[A-Z2-9]{12}$/.test(value); }
export function applyMask(previous, next, apply) { for(let i=0;i<12;i++) if ((previous ^ next) & (1<<i)) apply(i, (next>>i)&1); }
