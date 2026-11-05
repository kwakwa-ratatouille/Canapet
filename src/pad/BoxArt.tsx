// Dessins des boîtes : chacune a sa forme et ses couleurs, celles de saison sont de vrais objets à thème.
import type { BoxDef } from '../shared/lootTable';

const INK = '#3a2140';

const Gift = ({ body, lid, ribbon, knot }: { body: string; lid: string; ribbon: string; knot: string }) => (
  <>
    <rect x="16" y="46" width="68" height="44" rx="7" fill={body} stroke={INK} strokeWidth="5" />
    <path d="M22 52h56v8H22z" fill="#000" opacity=".14" />
    <rect x="10" y="30" width="80" height="20" rx="7" fill={lid} stroke={INK} strokeWidth="5" />
    <path d="M16 35h68" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
    <rect x="41" y="30" width="18" height="60" fill={ribbon} stroke={INK} strokeWidth="4" />
    <path d="M50 30C36 6 14 10 22 23C27 31 42 30 50 30C58 30 73 31 78 23C86 10 64 6 50 30Z" fill={knot} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
  </>
);

const Star = ({ x, y, r, fill = '#ffd60a' }: { x: number; y: number; r: number; fill?: string }) => (
  <path d={`M${x} ${y - r}l${r * 0.3} ${r * 0.7}l${r * 0.7} ${r * 0.3}l${-r * 0.7} ${r * 0.3}l${-r * 0.3} ${r * 0.7}l${-r * 0.3} ${-r * 0.7}l${-r * 0.7} ${-r * 0.3}l${r * 0.7} ${-r * 0.3}Z`} fill={fill} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
);

export function BoxArt({ box, size }: { box: BoxDef; size: number }) {
  const inner = (() => {
    switch (box.season ?? box.id) {
      case 'petite':
        return <Gift body="#35d6ad" lid="#5ce8c6" ribbon="#fff" knot="#ff8ac0" />;
      case 'moyenne':
        return (
          <>
            <Gift body="#2e9bff" lid="#62b8ff" ribbon="#ffd60a" knot="#ffd60a" />
            <Star x={88} y={22} r={8} fill="#fff" />
          </>
        );
      case 'grosse':
        return (
          <>
            <Gift body="#8a4dff" lid="#a97bff" ribbon="#ffc400" knot="#ffc400" />
            <path d="M16 76h68" stroke="#ffc400" strokeWidth="4" />
            <circle cx="50" cy="66" r="9" fill="#ff4f9a" stroke={INK} strokeWidth="3.5" />
            <Star x={8} y={24} r={8} />
            <Star x={92} y={18} r={10} />
          </>
        );
      case 'coffre':
        return (
          <>
            <path d="M10 48C10 14 90 14 90 48V54H10Z" fill="#b5532a" stroke={INK} strokeWidth="5" />
            <path d="M16 38C24 22 76 22 84 38" fill="none" stroke="#e08a55" strokeWidth="4" strokeLinecap="round" />
            <rect x="10" y="52" width="80" height="38" rx="7" fill="#d9713c" stroke={INK} strokeWidth="5" />
            <path d="M26 24V90M74 24V90" stroke="#ffc400" strokeWidth="7" />
            <path d="M10 53h80" stroke={INK} strokeWidth="5" />
            <rect x="38" y="44" width="24" height="26" rx="6" fill="#ffc400" stroke={INK} strokeWidth="4.5" />
            <circle cx="50" cy="54" r="4" fill={INK} />
            <path d="M50 54v9" stroke={INK} strokeWidth="4" strokeLinecap="round" />
            <Star x={92} y={22} r={9} fill="#ff4f9a" />
          </>
        );
      case 'halloween':
        return (
          <>
            <path d="M50 22C50 12 56 8 64 6" fill="none" stroke="#4e8a2a" strokeWidth="7" strokeLinecap="round" />
            <ellipse cx="50" cy="58" rx="42" ry="34" fill="#ff8a1f" stroke={INK} strokeWidth="5" />
            <path d="M34 26C24 42 24 74 34 90M66 26C76 42 76 74 66 90" fill="none" stroke="#d9650a" strokeWidth="4" />
            <path d="M26 48l14 3l-8 10ZM74 48l-14 3l8 10Z" fill="#ffe680" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M28 68Q50 92 72 68L62 72L56 66L50 72L44 66L38 72Z" fill="#ffe680" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M6 18C10 12 18 12 22 18C26 12 34 12 38 18C32 20 30 26 22 28C14 26 12 20 6 18Z" fill={INK} />
          </>
        );
      case 'noel':
        return (
          <>
            <Gift body="#d9213c" lid="#f04a5d" ribbon="#0f8f4f" knot="#ffd60a" />
            <path d="M8 34C8 22 20 28 26 24C32 18 42 26 50 22C58 18 68 26 74 22C82 18 92 24 92 34C92 42 8 42 8 34Z" fill="#fff" stroke={INK} strokeWidth="4" />
            <circle cx="20" cy="66" r="4" fill="#fff" />
            <circle cx="78" cy="74" r="3.5" fill="#fff" />
            <circle cx="72" cy="58" r="3" fill="#fff" />
          </>
        );
      case 'amour':
        return (
          <>
            <path d="M50 92C10 66 4 44 12 28C20 12 42 14 50 32C58 14 80 12 88 28C96 44 90 66 50 92Z" fill="#ff4f9a" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
            <path d="M22 34C26 26 34 26 38 30" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <rect x="44" y="26" width="12" height="62" fill="#ffd6e7" stroke={INK} strokeWidth="3.5" />
            <path d="M50 30C40 14 24 18 30 26C34 32 44 30 50 30C56 30 66 32 70 26C76 18 60 14 50 30Z" fill="#ffd60a" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          </>
        );
      case 'printemps':
        return (
          <>
            <path d="M50 8C72 8 86 40 86 60C86 82 70 92 50 92C30 92 14 82 14 60C14 40 28 8 50 8Z" fill="#fff4b8" stroke={INK} strokeWidth="5" />
            <path d="M16 52l11 9l11-9l12 9l12-9l11 9l11-9" fill="none" stroke="#ff8ac0" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="30" cy="74" r="5" fill="#7bd13b" stroke={INK} strokeWidth="2.5" />
            <circle cx="50" cy="78" r="5" fill="#2ec5ff" stroke={INK} strokeWidth="2.5" />
            <circle cx="70" cy="74" r="5" fill="#9b5cff" stroke={INK} strokeWidth="2.5" />
            <circle cx="42" cy="30" r="4.5" fill="#ff8ac0" stroke={INK} strokeWidth="2.5" />
            <circle cx="60" cy="36" r="4.5" fill="#ffd60a" stroke={INK} strokeWidth="2.5" />
          </>
        );
      case 'ete':
        return (
          <>
            <path d="M10 60h80v22a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8Z" fill="#f2c26b" stroke={INK} strokeWidth="5" />
            <path d="M10 44a8 8 0 0 1 8-8h64a8 8 0 0 1 8 8v18H10Z" fill="#1fb6d9" stroke={INK} strokeWidth="5" />
            <path d="M16 46h68" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".6" />
            <rect x="42" y="52" width="16" height="16" rx="4" fill="#ffc400" stroke={INK} strokeWidth="4" />
            <circle cx="80" cy="16" r="11" fill="#ffd60a" stroke={INK} strokeWidth="4" />
            <path d="M20 34C20 24 26 16 34 12M22 18C28 16 34 18 38 22M22 22C18 18 12 18 8 22" fill="none" stroke="#2f8f3a" strokeWidth="5" strokeLinecap="round" />
          </>
        );
      default:
        return <Gift body={box.color} lid={box.color} ribbon="#fff" knot="#ffd60a" />;
    }
  })();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="box-art">
      {inner}
    </svg>
  );
}
