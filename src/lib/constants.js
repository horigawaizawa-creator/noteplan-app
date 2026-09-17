export const DOC_TYPES = {
  NOTE: 'note',
  PLAN: 'plan',
  WBS: 'wbs',
  PROJECT: 'project',
};

export const DOC_TYPE_LABELS = {
  note: 'Нотатка',
  plan: 'План',
  wbs: 'WBS План',
  project: 'Проєкт',
};

export const DOC_TYPE_ICONS = {
  note: '📝',
  plan: '📋',
  wbs: '🗂️',
  project: '📁',
};

export const DEFAULT_TITLES = {
  note: 'Нова нотатка',
  plan: 'Новий план',
  wbs: 'Новий WBS План',
  project: 'Новий проєкт',
};

// Preset palette for document priority tags and stage colors.
export const LABEL_COLORS = [
  { key: 'red', hex: '#e0473a', name: 'Червоний' },
  { key: 'orange', hex: '#e08a3a', name: 'Помаранчевий' },
  { key: 'gold', hex: '#cf9f4f', name: 'Золотий' },
  { key: 'yellow', hex: '#dccb4a', name: 'Жовтий' },
  { key: 'green', hex: '#5cb85c', name: 'Зелений' },
  { key: 'teal', hex: '#4fb8a8', name: 'Бірюзовий' },
  { key: 'blue', hex: '#5c8fd9', name: 'Синій' },
  { key: 'violet', hex: '#9b6fd9', name: 'Фіолетовий' },
  { key: 'pink', hex: '#d95c9e', name: 'Рожевий' },
  { key: 'gray', hex: '#8a8790', name: 'Сірий' },
];

export const DEFAULT_CATEGORY_ORDER = ['project', 'note', 'plan', 'wbs'];

export const CATEGORY_LABELS = {
  project: 'Проєкти',
  note: 'Нотатки',
  plan: 'Плани',
  wbs: 'WBS Плани',
};

export const CATEGORY_EMPTY_LABELS = {
  project: 'Немає проєктів',
  note: 'Немає нотаток',
  plan: 'Немає планів',
  wbs: 'Немає WBS планів',
};
export const DEFAULT_STAGES = [
  { id: 'stage_idea', name: 'Ідея', color: '#8a8790' },
  { id: 'stage_progress', name: 'У роботі', color: '#5c8fd9' },
  { id: 'stage_review', name: 'На перевірці', color: '#e08a3a' },
  { id: 'stage_done', name: 'Завершено', color: '#5cb85c' },
];

export const STORAGE_KEY = 'noteplan_wbs_react_v1';

// Alternating brand accents used for WBS block depth (left border).
export const DEPTH_ACCENTS = ['#b8433a', '#cf9f4f'];

export const CHECKLIST_WIDTH_DEFAULT = 300;
export const CHECKLIST_WIDTH_MIN = 220;
export const CHECKLIST_WIDTH_MAX = 560;
export const CHECKLIST_COLLAPSED_WIDTH = 44;
export const SIDEBAR_COLLAPSED_WIDTH = 52;

export const WBS_VIEWS = { LIST: 'list', DIAGRAM: 'diagram', NETWORK: 'network' };

export const NETWORK_FIELD_LABELS = {
  es: 'Early Start',
  duration: 'Duration',
  ef: 'Early Finish',
  ls: 'Late Start',
  slack: 'Slack',
  lf: 'Late Finish',
};

export const DEADLINE_STATUS_LABELS = {
  overdue: 'Прострочено',
  today: 'Сьогодні',
  upcoming: 'Заплановано',
};

// Below this width the app switches from the 3-pane desktop layout to a
// single-pane mobile layout with back/forward panel navigation.
// Keep this in sync with the `@media (max-width: 899px)` rules in index.css.
export const MOBILE_BREAKPOINT_PX = 900;

// Pastel "paper" backgrounds for individual notes. Each entry pairs a light
// background with a dark text color -- the app's default text color is
// light-on-dark, so a light background needs its own dark text or it
// becomes unreadable.
export const NOTE_BG_COLORS = [
  { key: 'cream', bg: '#f2e9d8', text: '#3a3020', name: 'Молочний' },
  { key: 'sand', bg: '#ede3cc', text: '#3a3020', name: 'Пісочний' },
  { key: 'sage', bg: '#e3ead9', text: '#2c3524', name: 'Шавлієвий' },
  { key: 'sky', bg: '#dce8ef', text: '#1f3540', name: 'Небесний' },
  { key: 'blush', bg: '#f3e0e0', text: '#3d2424', name: 'Рожевий' },
  { key: 'lavender', bg: '#e8e2f2', text: '#2e2640', name: 'Лавандовий' },
];

// Paper background patterns for notes -- like choosing a type of physical
// notebook. 'lined'/'diagonal'/'grid'/'dotted' are the most common school
// and stationery notebook styles.
export const PAPER_PATTERNS = [
  { key: 'none', name: 'Чистий' },
  { key: 'lined', name: 'Лінія' },
  { key: 'diagonal', name: 'Коса лінія' },
  { key: 'grid', name: 'Клітинка' },
  { key: 'dotted', name: 'Крапки' },
];

// The app's default accent color (buttons, focus rings, links, WBS icon
// color) before any customization -- matches the original hardcoded value.
export const DEFAULT_ACCENT = '#b8433a';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mixToward(rgb, target, amount) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return {
    r: clamp(rgb.r + (target - rgb.r) * amount),
    g: clamp(rgb.g + (target - rgb.g) * amount),
    b: clamp(rgb.b + (target - rgb.b) * amount),
  };
}
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Derives the hover/active/soft-background shades the CSS expects (see
// --accent-hover / --accent-active / --accent-soft in index.css) from a
// single base color, so picking any accent color "just works" everywhere
// it's used without needing 4 separate pickers.
export function deriveAccentVars(hex) {
  const rgb = hexToRgb(hex);
  const hover = rgbToHex(mixToward(rgb, 255, 0.14));
  const active = rgbToHex(mixToward(rgb, 0, 0.14));
  return {
    '--accent': hex,
    '--accent-hover': hover,
    '--accent-active': active,
    '--accent-soft': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`,
  };
}
