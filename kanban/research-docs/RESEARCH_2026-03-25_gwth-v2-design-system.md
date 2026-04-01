Excellent! Now I have comprehensive information about the GWTH v2 project. Let me compile a thorough documentation report.

## GWTH v2 — Complete Design System & Architecture Documentation

This document comprehensively documents the GWTH v2 project's design system, component patterns, and architecture for replication in new projects.

---

## 1. CSS & DESIGN TOKENS (src/app/globals.css)

### Theme Strategy

- **Color Space:** OKLCH (perceptually uniform, better for light/dark modes)
- **Approach:** CSS custom properties mapped to Tailwind @theme
- **Fonts:** Inter (sans-serif), JetBrains Mono (monospace)
- **Border Radius:** Base 0.625rem (10px) with calculated variants

### Light Mode Color System

```
--background: oklch(0.98 0 0)           /* Near-white */
--foreground: oklch(0.18 0.04 175)      /* Very dark teal */

--primary: oklch(0.7 0.18 220)          /* Bright aqua #33BBFF */
--primary-foreground: oklch(0.98 0 0)   /* White */

--accent: oklch(0.65 0.16 165)          /* Mint green #1CBA93 */
--accent-foreground: oklch(0.98 0 0)    /* White */

--secondary: oklch(0.95 0.01 220)       /* Very light blue-gray */
--secondary-foreground: oklch(0.18 0.04 175)

--muted: oklch(0.95 0.01 220)           /* Light backgrounds */
--muted-foreground: oklch(0.5 0.02 220) /* Medium gray */

--success: oklch(0.6 0.18 145)          /* Green */
--warning: oklch(0.75 0.15 75)          /* Yellow */
--info: oklch(0.7 0.18 220)             /* Aqua (same as primary) */
--destructive: oklch(0.577 0.245 27.325) /* Red */

--border: oklch(0.9 0.02 220)           /* Light borders */
--input: oklch(0.9 0.02 220)            /* Input backgrounds */
--ring: oklch(0.7 0.18 220)             /* Focus rings (primary) */

--card: oklch(1 0 0)                    /* Pure white cards */
--card-foreground: oklch(0.18 0.04 175) /* Dark text */

--sidebar: oklch(0.97 0.005 175)        /* Nearly white, warm tint */
--sidebar-primary: oklch(0.7 0.18 220)  /* Primary for sidebar active states */
--sidebar-accent: oklch(0.93 0.02 165)  /* Subtle mint for hover/focus */
--sidebar-border: oklch(0.9 0.01 220)   /* Very subtle borders */
```

### Dark Mode ("Graphite Warm")

```
Warm charcoal based on hue 60, low chroma (warm-leaning neutrals)
--background: oklch(0.17 0.005 60)      /* Dark warm gray #191817 */
--card: oklch(0.21 0.005 60)            /* Slightly lighter #232221 */
--foreground: oklch(0.93 0.008 60)      /* Off-white */

--primary: oklch(0.75 0.16 220)         /* Lighter aqua (higher L for readability) */
--accent: oklch(0.75 0.14 165)          /* Lighter mint */

--border: oklch(1 0 0 / 12%)            /* White with 12% opacity */
--input: oklch(1 0 0 / 15%)             /* White with 15% opacity */
```

### Status & Grade Colors

```
--status-completed: oklch(0.6 0.18 145)   /* Green */
--status-in-progress: oklch(0.7 0.18 220) /* Aqua */
--status-not-started: oklch(0.6 0.02 220) /* Light gray */
--status-locked: oklch(0.45 0.02 220)     /* Dark gray */

--grade-a: oklch(0.6 0.18 145)   /* Green */
--grade-b: oklch(0.65 0.16 165)  /* Mint */
--grade-c: oklch(0.75 0.15 75)   /* Yellow */
--grade-d: oklch(0.65 0.18 50)   /* Orange */
--grade-f: oklch(0.577 0.245 27.325) /* Red */
```

### Chart Colors (5-color palette)

```
--chart-1: oklch(0.7 0.18 220)           /* Primary blue */
--chart-2: oklch(0.65 0.16 165)          /* Accent mint */
--chart-3: oklch(0.6 0.118 184.704)      /* Teal */
--chart-4: oklch(0.828 0.189 84.429)     /* Yellow-green */
--chart-5: oklch(0.627 0.265 303.9)      /* Magenta */
```

### Tailwind @theme Configuration

Maps CSS variables to Tailwind utilities:

- `--color-*` for colors
- `--font-sans`, `--font-mono` for typography
- `--radius-*` (sm, md, lg, xl, 2xl) for border radius
- Sidebar-specific: sidebar, sidebar-foreground, sidebar-primary, sidebar-accent, sidebar-border, sidebar-ring

### Base Layer Utilities

- All elements inherit `border-border` and `outline-ring/50`
- Body: antialiased, smooth scrolling
- Focus: 2px ring with 2px offset, uses ring color
- Selection: primary/20 background with foreground text
- Code blocks: monospace, muted background

### Custom Utilities

- `.text-gradient` — gradient from primary → accent, text clipped
- `.hover-lift` — translate-y[-2px] on hover (200ms)
- `.animate-in` — fade in + slide up (0.3s ease-out)
- `.skeleton` — pulse animation with muted background
- `.animate-progress` — width 0→100% with opacity fade (0.5s)
- `.custom-scrollbar` — 6px wide, border color track, primary hover

### Lesson Prose Styling

Custom typography for lesson content (does NOT modify site-wide .prose):

- h1: 2rem, 700 weight, 1.2 line-height, 0.75em bottom margin
- h2: 1.5rem, 600 weight, 2em top margin
- h3: 1.25rem, 600 weight, 1.5em top margin
- h4: 1.125rem, 600 weight
- p: 1rem, 1.75 line-height, 1.25em bottom margin
- links: primary color, underline on hover
- lists: 1.5em left padding, disc/decimal
- blockquotes: 3px left border, muted-foreground, italic
- tables: 100% width, striped rows, 0.9375rem font
- inline code: monospace, muted bg, smaller font
- images: max-width 100%, 0.5rem radius

---

## 2. CONFIGURATION FILES

### package.json — Dependency Versions (exact)

#### Core Framework & UI

```json
"next": "16.1.6",
"react": "19.2.3",
"react-dom": "19.2.3",
"react-hook-form": "^7.71.1",
"next-themes": "^0.4.6",
"motion": "^12.34.0"
```

#### UI Components & Icons

```json
"radix-ui": "^1.4.3",
"class-variance-authority": "^0.7.1",
"clsx": "^2.1.1",
"tailwind-merge": "^3.4.1",
"lucide-react": "^0.564.0",
"cmdk": "^1.1.1",
"react-day-picker": "^9.13.2"
```

#### Content & Markdown

```json
"react-markdown": "^10.1.0",
"remark-gfm": "^4.0.1",
"rehype-raw": "^7.0.0",
"shiki": "^3.22.0",
"isomorphic-dompurify": "^2.36.0"
```

#### Authentication & Database

```json
"@supabase/supabase-js": "^2.98.0",
"@supabase/ssr": "^0.8.0"
```

#### Notifications

```json
"sonner": "^2.0.7"
```

#### Validation & Utilities

```json
"zod": "^4.3.6",
"date-fns": "^4.1.0"
```

#### Security

```json
"@nosecone/next": "^1.1.0"
```

#### Dev Dependencies

```json
"@tailwindcss/postcss": "^4",
"tailwindcss": "^4",
"typescript": "^5",
"eslint": "^9",
"eslint-config-next": "16.1.6",
"vitest": "^4.0.18",
"@vitest/coverage-v8": "^4.0.18",
"@playwright/test": "^1.58.2",
"@commitlint/cli": "^20.4.2",
"@commitlint/config-conventional": "^20.4.2",
"husky": "^9.1.7",
"lint-staged": "^16.2.7",
"postcss": "^8.5.6"
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

### next.config.ts

```typescript
const nextConfig: NextConfig = {
  output: "standalone", // For containerized deployment
  compress: true,
  images: {
    remotePatterns: [], // Add as image sources are identified
  },
};
```

### postcss.config.mjs

```javascript
{
  plugins: {
    "@tailwindcss/postcss": {}
  }
}
```

### components.json (shadcn configuration)

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### vitest.config.ts

```typescript
{
  plugins: [react()],
  test: {
    environment: "jsdom",
    testTimeout: 10000,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 35,
        statements: 40
      }
    }
  }
}
```

### playwright.config.ts

```typescript
{
  testDir: "./src/__tests__/pages",
  fullyParallel: true,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    navigationTimeout: 45000
  },
  projects: [
    { name: "desktop-chromium", use: devices["Desktop Chrome"] },
    { name: "desktop-dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
    { name: "mobile-chromium", use: devices["Pixel 5"] }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000"
  }
}
```

### .commitlintrc.json

```json
{
  "extends": ["@commitlint/config-conventional"]
}
```

### Husky Hooks

- **pre-commit:** `npx lint-staged` → run eslint on staged files, then `npm test`
- **commit-msg:** `npx --no -- commitlint --edit $1` → enforce conventional commits
- **post-merge:** `npm install` → auto-install deps after pull

### ESLint Config (eslint.config.mjs)

```javascript
defineConfig([
  ...nextVitals, // Core Web Vitals rules
  ...nextTs, // TypeScript rules
  globalIgnores([".next/**", "out/**", "build/**", "docs/old-site/**"]),
]);
```

### Renovate (renovate.json)

- Schedule: weekly
- Auto-merge: minor and patch
- Group: @types/\*, testing, linting, shadcn dependencies separately

### knip.json (Unused Code Detection)

```json
{
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "src/components/ui/**",
    "src/components/course/courses-filter.tsx",
    "src/components/landing/waitlist-form.tsx",
    "src/components/shared/audio-player.tsx",
    "src/components/tech-radar/tech-radar-grid.tsx"
  ],
  "ignoreDependencies": [
    "tw-animate-css",
    "shadcn",
    "axe-playwright",
    "tailwindcss",
    "date-fns",
    "react-day-picker",
    "@nosecone/next",
    "fast-check"
  ]
}
```

---

## 3. ARCHITECTURE & PROJECT STRUCTURE

### Directory Layout

```
src/
├── app/                           # Next.js App Router
│   ├── globals.css               # Global styles & design tokens
│   ├── layout.tsx                # Root layout (metadata, fonts, providers)
│   ├── (auth)/                   # Auth routes: login, signup, forgot-password
│   │   └── layout.tsx            # Auth layout (no sidebar)
│   ├── (dashboard)/              # Protected routes (sidebar + header)
│   │   ├── layout.tsx            # Dashboard layout structure
│   │   ├── dashboard/            # Home page
│   │   ├── course/               # Course viewer with lessons
│   │   ├── labs/                 # Labs with code challenges
│   │   ├── progress/             # User progress dashboard
│   │   ├── bookmarks/            # Saved lessons/labs
│   │   ├── notifications/        # Activity feed
│   │   ├── profile/              # User profile editing
│   │   ├── settings/             # Account settings
│   │   └── error.tsx             # Error boundary for dashboard
│   ├── (public)/                 # Public routes
│   │   ├── layout.tsx            # Public nav layout
│   │   ├── page.tsx              # Home page
│   │   ├── about/                # About page
│   │   ├── pricing/              # Pricing page
│   │   ├── lessons/              # Public lessons directory
│   │   ├── labs/                 # Public labs directory
│   │   ├── news/                 # News/blog section
│   │   ├── contact/              # Contact form
│   │   └── error.tsx             # Error boundary for public
│   ├── middleware.ts             # Security headers, auth, password gate
│   └── robots.ts, sitemap.ts     # SEO
│
├── components/
│   ├── ui/                       # shadcn/ui components (26 components)
│   ├── layout/                   # Layout components
│   │   ├── sidebar.tsx           # Dashboard sidebar with nav items
│   │   ├── header.tsx            # Dashboard header with breadcrumb
│   │   ├── public-nav.tsx        # Public site navigation
│   │   ├── footer.tsx            # Footer
│   │   └── breadcrumb-nav.tsx    # Breadcrumb trail
│   ├── shared/                   # Global reusable components
│   │   ├── route-progress.tsx    # Top bar + spinner during navigation
│   │   ├── spinner.tsx           # Branded loading spinner
│   │   ├── theme-toggle.tsx      # Light/dark mode toggle
│   │   ├── empty-state.tsx       # Empty state card
│   │   ├── notes-panel.tsx       # Lesson notes editor
│   │   ├── audio-player.tsx      # Audio playback
│   │   ├── video-player.tsx      # Video playback
│   │   ├── bookmark-button.tsx   # Add/remove bookmark
│   │   ├── markdown-renderer.tsx # Render lesson markdown
│   │   └── web-vitals.tsx        # Performance monitoring
│   ├── course/                   # Course viewer components
│   ├── lesson/                   # Lesson-specific components
│   ├── lab/                      # Lab challenge components
│   ├── progress/                 # Progress chart components
│   ├── search/                   # Search palette (Cmd+K)
│   ├── auth/                     # Login/signup forms
│   ├── landing/                  # Home page sections
│   ├── news/                     # News/blog components
│   └── dev/                      # Dev-only state switcher
│
├── hooks/                        # Custom React hooks
│   ├── use-sidebar.ts           # Sidebar state (open/mobile)
│   ├── use-search.ts            # Search palette state
│   ├── use-bookmark.ts          # Bookmark management
│   ├── use-progress.ts          # Progress fetching
│   ├── use-vote.ts              # News comment voting
│   └── use-reduced-motion.ts    # Accessibility: prefers-reduced-motion
│
├── lib/
│   ├── config.ts                # App-wide constants (layout, animation, pagination, pricing)
│   ├── utils.ts                 # Utility functions (cn, formatDate, slugify, etc.)
│   ├── types.ts                 # TypeScript interfaces (User, DynamicScore, TechRadarTool)
│   ├── validations.ts           # Zod schemas for forms
│   ├── demo-utils.ts            # Mock data & demo helpers
│   ├── actions/                 # Server actions
│   │   ├── auth.ts             # signOut, login, signup
│   │   ├── news.ts             # News CRUD
│   │   └── site-access.ts      # Password gate verification
│   ├── data/                    # Data fetching & mock data
│   │   ├── bookmarks.ts        # Bookmark queries
│   │   ├── courses.ts          # Course catalog
│   │   ├── lessons.ts          # Lesson data
│   │   ├── labs.ts             # Lab challenges
│   │   ├── progress.ts         # User progress data
│   │   ├── news.ts             # News articles
│   │   ├── notifications.ts    # User notifications
│   │   └── tech-radar.ts       # Tool radar data
│   └── supabase/
│       ├── server.ts           # Server-side Supabase client
│       ├── client.ts           # Client-side Supabase client
│       └── middleware.ts       # Auth session refresh
│
├── providers/                   # Root-level providers
│   ├── root-provider.tsx       # Composes all providers
│   └── theme-provider.tsx      # next-themes ThemeProvider wrapper
│
└── __tests__/
    ├── pages/                  # Playwright E2E tests
    └── (other test files)      # Unit tests alongside source files (.test.ts)
```

### shadcn/ui Components Installed (26 total)

```
accordion, alert-dialog, avatar, badge, breadcrumb, button, calendar,
card, checkbox, command, dialog, dropdown-menu, form, input, label,
navigation-menu, popover, progress, radio-group, select, separator,
sheet, skeleton, tabs, textarea, tooltip
```

---

## 4. ROOT LAYOUT & PROVIDERS

### src/app/layout.tsx

```typescript
- Metadata: title template, description, OG tags, robots (noindex for pre-launch)
- Fonts: Inter (--font-inter), JetBrains Mono (--font-jetbrains)
- Root providers: RootProvider, RouteProgress, WebVitals, Toaster
- Analytics: Plausible (deferred, outbound-links module)
- Body class: antialiased
```

### src/providers/root-provider.tsx

```typescript
Composes:
1. ThemeProvider (next-themes)
2. TooltipProvider (radix-ui, 300ms delay)
3. DevStateSwitcher (visible only in development)
```

### src/providers/theme-provider.tsx

```typescript
next-themes ThemeProvider:
- attribute: "class" (class-based strategy for Tailwind v4)
- defaultTheme: "light"
- enableSystem: true (respects system preference)
- disableTransitionOnChange: true (prevents flashing)
```

---

## 5. MIDDLEWARE & SECURITY

### src/middleware.ts

**Purpose:** Security headers, site password gate, auth session refresh

**Security Headers Applied to All Responses:**

- X-DNS-Prefetch-Control: on
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: disables camera, microphone, geolocation
- Strict-Transport-Security: max-age 63072000 (2 years) + preload
- X-XSS-Protection: 0
- X-Robots-Tag: noindex, nofollow, noarchive (pre-launch)
- Content-Security-Policy:
  - default-src: 'self'
  - script-src: 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.gwth.ai
  - style-src: 'self' 'unsafe-inline'
  - img-src: 'self' data: blob: https:
  - font-src: 'self' data:
  - connect-src: 'self' https:
  - frame-src: 'self'

**Site Password Gate:**

- Enabled when `SITE_PASSWORD` env var is set
- Exempt paths: "/", "/access", "/auth/_", "/api/_"
- Enforcement: Redirect to /access if no `site_access=granted` cookie
- Cookie preserved for session duration

**Auth Session Refresh:**

- Calls `updateSession()` from supabase/middleware to refresh auth tokens
- Protects dashboard routes (requires authenticated session)

**Route Matching:**

```
Covers all routes EXCEPT:
- _next/static
- _next/image
- favicon.ico, robots.txt, sitemap.xml
- Static files (.svg, .png, .jpg, .gif, .webp, .ico)
```

---

## 6. LAYOUT COMPONENTS

### src/app/layout.tsx (Root)

- Metadata with OG tags, robots (noindex), icons (favicon + apple-touch)
- Font variables passed to html element
- RootProvider wrapping all children
- RouteProgress + WebVitals + Toaster

### src/app/(dashboard)/layout.tsx

```typescript
- Grid layout: flex with sidebar on left
- Main area: flex-col with sticky header + scrollable main
- Fetches current user (name, email, avatarUrl)
- Passes user info to DashboardHeader
- MaxWidth 1400px on main content
- SearchPalette global component (Cmd+K accessible anywhere)
```

### src/components/layout/sidebar.tsx

**Collapsible Navigation:**

- Uses `useSidebar()` hook to manage open/collapsed state
- Mobile: Sheet overlay (below 768px)
- Desktop: Persistent sidebar (280px expanded, 64px collapsed)
- Logo shows only when expanded
- Main nav items: Dashboard, The Course, Labs, Progress
- Secondary nav: Bookmarks, Notifications, Profile, Settings
- Icons from lucide-react

**Styling:**

- Flex column layout, full height
- Separator after logo
- Nav items with active state detection (pathname matching)
- Icons animate rotation on collapse

### src/components/layout/header.tsx

**Dashboard Header:**

- Sticky, z-40, 64px height
- Breadcrumb on left
- Right side: Search trigger (Cmd+K), Theme toggle, User dropdown
- Mobile: Menu button to open sidebar
- User dropdown: avatar + name initials, signOut action

### src/components/layout/breadcrumb-nav.tsx

- Generates breadcrumb trail from current route
- Responsive, shows fewer items on mobile

---

## 7. SHARED COMPONENTS

### src/components/shared/route-progress.tsx

```typescript
- Detects route changes via usePathname()
- Shows top progress bar + corner spinner during navigation
- Progress bar: gradient primary → accent → primary
- Auto-dismisses after 500ms
- Skips first pathname change (hydration, not real nav)
```

### src/components/shared/spinner.tsx

**Branded Loading Spinner:**

```typescript
- Dual-ring design: outer ring (primary) + inner counter-rotating ring (accent)
- SVG-based, scales with size parameter
- Outer: 0.8s rotate, Inner: 1.2s reverse-rotate
- Border width calculated from size (max 2px)
- Sizes: 20px (corner), 40px (default), 48px (full-page)
```

### src/components/shared/theme-toggle.tsx

- Button with Sun/Moon icons
- Smooth rotation/scale transitions
- Uses next-themes `useTheme()` hook
- Toggles between light and dark

### src/components/shared/empty-state.tsx

```typescript
- Icon + Title + Description + optional CTA button
- Centered, 16px vertical padding
- Icon in 4px padded rounded container
- Uses Lucide icons
```

### src/components/shared/spinner.tsx

**PageSpinner (full-page variant):**

```typescript
- Centered, 60vh min-height
- Large spinner (48px) + animated "Loading..." text
```

---

## 8. CONFIGURATION CONSTANTS (src/lib/config.ts)

### Layout Dimensions

```typescript
SIDEBAR_WIDTH = 280; // pixels
SIDEBAR_COLLAPSED_WIDTH = 64;
HEADER_HEIGHT = 64;
CONTENT_MAX_WIDTH = 1400;
```

### Animation Config

```typescript
SPRING_TRANSITION = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};
FADE_DURATION = 0.2; // seconds
STAGGER_DELAY = 0.05; // seconds between children
PROGRESS_ANIMATION_DURATION = 0.8;
```

### Pagination & Limits

```typescript
DEFAULT_PAGE_SIZE = 12;
MAX_QUIZ_ATTEMPTS = 3;
MAX_NOTES_PER_LESSON = 50;
```

### Breakpoints

```typescript
MOBILE_BREAKPOINT = 768; // sidebar becomes sheet overlay
TABLET_BREAKPOINT = 1024;
```

### App Metadata

```typescript
APP_NAME = "GWTH.ai";
APP_TAGLINE = "Learn to Build with AI";
APP_URL = "https://gwth.ai";
SUPPORT_EMAIL = "support@gwth.ai";
TEAMS_EMAIL = "teams@gwth.ai";
```

### Pricing (GBP)

```typescript
COURSE_MONTHLY_PRICE = 29;
ONGOING_MONTHLY_PRICE = 7.5;
TOTAL_COURSE_MONTHS = 3;
TOTAL_COURSE_COST = 87;
GRACE_PERIOD_DAYS = 14;
POINTS_PER_LESSON = 1.5;
```

### Course Structure (3 Months)

```typescript
MONTH_CONFIGS: [
  {
    month: 1,
    title: "From Zero to Building",
    mandatoryLessons: 24,
    optionalLessons: 0,
    capstoneName: "Family AI Bot",
  },
  {
    month: 2,
    title: "Building Real Apps",
    mandatoryLessons: 20,
    optionalLessons: 15,
    capstoneName: "AI Customer-Support Chatbot",
  },
  {
    month: 3,
    title: "Enterprise AI & Multi-Agent Systems",
    mandatoryLessons: 20,
    optionalLessons: 15,
    capstoneName: "AI Readiness Assessment Tool",
  },
];
```

### Feature Flags

```typescript
ENABLE_SEARCH = true;
ENABLE_STREAKS = true;
ENABLE_NOTES = true;
ENABLE_CERTIFICATES = false;
ENABLE_DEV_TOOLBAR = process.env.NODE_ENV === "development";
ENABLE_NEWS = true;
NEWS_PAGE_SIZE = 12;
NEWS_DEFAULT_SORT = "hot";
```

### News Categories (with Tailwind Colors)

```typescript
"ai-launch": { label: "AI Launch", color: "text-primary", bgColor: "bg-primary/10" }
"research": { label: "Research", color: "text-accent", bgColor: "bg-accent/10" }
"tool": { label: "Tool", color: "text-info", bgColor: "bg-info/10" }
"industry": { label: "Industry", color: "text-warning", bgColor: "bg-warning/10" }
"tutorial": { label: "Tutorial", color: "text-success", bgColor: "bg-success/10" }
```

---

## 9. UTILITY FUNCTIONS (src/lib/utils.ts)

```typescript
cn(...inputs); // Merge Tailwind classes (clsx + twMerge)
formatDuration(minutes); // "1h 30m" or "45m"
formatDate(date); // "Feb 15, 2026"
formatRelativeDate(date); // "1 day ago", "just now"
slugify(text); // "AI Fundamentals" → "ai-fundamentals"
getGradeFromScore(score); // 95 → "A", 72 → "C", etc.
getGradeColor(grade); // "A" → "var(--grade-a)"
getStatusColor(status); // "completed" → "var(--status-completed)"
clamp(value, min, max); // Constrain number between bounds
formatProgress(progress); // 0.756 → "76%"
```

---

## 10. TYPESCRIPT TYPES (src/lib/types.ts)

### SubscriptionState (7 states)

```typescript
"visitor" |
  "registered" |
  "month1" |
  "month2" |
  "month3" |
  "ongoing" |
  "lapsed";
```

### User Interface

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  subscriptionState: SubscriptionState;
  subscriptionMonth: number;
  gracePeriodEnds: Date | null;
  lastPaymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### DynamicScore (Student Performance)

```typescript
interface DynamicScore {
  overallScore: number;
  maxPossibleScore: number;
  percentile: number; // 0-100
  curiosityIndex: number; // Ratio of optional lessons explored
  consistencyScore: number; // Study regularity (0-100)
  improvementRate: number; // Trend in quiz scores (-100 to 100)
  scoreHistory: { date: Date; score: number }[];
}
```

### TechRadarTool

```typescript
interface TechRadarTool {
  name: string;
  slug: string;
  version: string;
  category: string;
  status: "GA" | "Beta" | "Alpha" | "Deprecated" | "Research Preview";
  cost_tier: "free" | "freemium" | "paid" | "open_source";
  url: string;
  description: string;
  tags: string[];
  is_hot: boolean;
  country_code: string; // ISO 3166-1 alpha-2
  last_verified: string;
}
```

### MonthConfig

```typescript
interface MonthConfig {
  month: 1 | 2 | 3;
  title: string;
  subtitle: string;
  description: string;
  mandatoryLessons: number;
  optionalLessons: number;
  capstoneName: string;
  capstoneDomain: string;
  capstoneDescription: string;
}
```

---

## 11. SHADCN/UI COMPONENT PATTERNS

### Button (button.tsx)

```typescript
CVA (Class Variance Authority) for variants:
- variant: default, destructive, outline, secondary, ghost, link
- size: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg
- asChild: true (use Slot to render as Link, etc.)

Data attributes: data-slot="button", data-variant, data-size
Focus: ring-ring/50 focus-visible ring-3px with ring-offset
SVG icons: auto-sized to 4 if not explicit
```

### Card (card.tsx)

```typescript
Data slots: card, card-header, card-title, card-description, card-action, card-content, card-footer
Card: bg-card, 11px rounded border, shadow-sm, py-6, gap-6
CardHeader: container queries, grid-based layout for action placement
CardTitle: font-semibold
CardDescription: text-sm, muted-foreground
CardContent: px-6
CardFooter: flex, px-6
```

### Badge (badge.tsx)

```typescript
CVA variants: default, secondary, destructive, outline, ghost, link
Rounded-full, inline-flex, text-xs, font-medium
Focus ring support, can be used as <a> with asChild
```

---

## 12. CUSTOM HOOKS

### usePathname(), useRouter(), useTheme()

- From Next.js and next-themes

### useSidebar() (src/hooks/use-sidebar.ts)

```typescript
Returns:
- isOpen: boolean
- isMobile: boolean
- toggle(): void
- open(): void
- close(): void
```

### useSearch()

```typescript
Manage search palette (Cmd+K) open state
```

### useBookmark()

```typescript
Toggle bookmark status for lessons/labs
```

### useProgress()

```typescript
Fetch user's course progress
```

### useReducedMotion()

```typescript
Respect prefers-reduced-motion media query
```

---

## 13. DOCKER BUILD

### Dockerfile

```dockerfile
Multi-stage build:
1. base: node:22-alpine
2. deps: npm ci (install dependencies)
3. builder: npm run build (Next.js build with standalone output)
4. runner: Copy public + .next/standalone + .next/static
   - Non-root user (nextjs:1001)
   - PORT=3000, HOSTNAME=0.0.0.0
   - CMD: node server.js
```

**For Coolify deployment:**

- Standalone output reduces image size
- Alpine base (~4MB vs ~900MB debian)
- Health check required: curl http://localhost:3000

---

## 14. ENVIRONMENT VARIABLES

### Phase 1 (Development/Demo) — No vars required

Mock data mode works out-of-box

### Phase 2 (Authentication) — Supabase

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Phase 2 (Payments) — Stripe

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Email — Plunk (Transactional)

```
PLUNK_SECRET_KEY=...
```

### Email — MailerLite (Newsletter)

```
MAILERLITE_API_KEY=...
MAILERLITE_GROUP_ID=...
```

### Storage — S3-compatible

```
S3_ENDPOINT=...
S3_BUCKET=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

### Pipeline Integration

```
PIPELINE_API_KEY=...  # Shared secret for lesson imports
```

### Pre-launch — Site Password Gate

```
SITE_PASSWORD=...  # Set to enable password gate, leave empty to disable
```

---

## 15. TESTING SETUP

### Vitest (src/test-setup.ts)

```typescript
jsdom environment
10-second timeout per test
Coverage thresholds: 40% lines/functions/statements, 35% branches
Coverage report formats: text, html, lcov
```

### Playwright (playwright.config.ts)

```typescript
Test dir: src/__tests__/pages
Three projects:
  - desktop-chromium (Chrome desktop)
  - desktop-dark (Chrome dark mode)
  - mobile-chromium (Pixel 5)
Base URL: http://localhost:3000
Web server: npm run dev (auto-started)
Timeout: 60 seconds
```

---

## 16. LINTING & CODE QUALITY

### ESLint (eslint.config.mjs)

- Extends: eslint-config-next/core-web-vitals + typescript
- Ignores: .next/, build/, docs/old-site/
- No custom rules; relies on Next.js + TypeScript recommendations

### Prettier (lint-staged)

- Configured via lint-staged in package.json
- Formats: _.json, _.md, \*.css

### TypeScript

- Strict mode enabled
- noUncheckedIndexedAccess: true
- Target: ES2017

### knip

- Finds unused files and exports
- Ignores UI components and specific feature components
- Ignores: tw-animate-css, shadcn, tailwindcss, date-fns, react-day-picker

---

## 17. COMMIT MESSAGE CONVENTIONS

### CommitLint (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, docs, style, refactor, perf, test, chore, ci, revert

**Enforced by:**

- husky pre-commit hook (runs lint-staged + tests)
- husky commit-msg hook (validates message format)
- husky post-merge hook (runs npm install)

---

## 18. NPM SCRIPTS

```json
"dev": "next dev"                    // Start dev server
"build": "next build"                // Build for production
"start": "next start"                // Start production server
"lint": "eslint"                     // Run linter
"test": "vitest run"                 // Run all unit tests
"test:watch": "vitest"               // Watch mode
"test:coverage": "vitest run --coverage"
"analyze": "ANALYZE=true next build" // Bundle analysis
"knip": "knip"                       // Find unused code
"knip:fix": "knip --fix"            // Auto-fix unused files
"typecheck": "tsc --noEmit"          // TypeScript checking
"prepare": "husky"                   // Install husky hooks
```

---

## 19. KEY PATTERNS & CONVENTIONS

### Component Structure

1. Server Components by default (faster, no JS shipped)
2. "use client" only for interactivity (theme, modals, forms)
3. Page components handle data fetching (async)
4. Layout components wrap content without fetching

### Routing Patterns

- Route groups: `(dashboard)`, `(public)`, `(auth)` for layout sharing
- Dynamic routes: `[slug]` for course, lessons, labs
- Error boundaries: `error.tsx` per layout
- Loading states: `loading.tsx` per route

### Data Flow

- Server Actions for mutations (not API routes)
- Supabase for real data, mock data in development
- Dynamic scores computed on-client where possible
- Type-safe with TypeScript interfaces

### Styling

- Tailwind utilities only (no custom CSS except globals.css)
- CSS variables in globals.css for theme colors
- CVA for component variants
- cn() for conditional classes

### Accessibility

- Focus visible with ring style
- ARIA labels on buttons/icons
- Reduced motion support (hooks + animations)
- Semantic HTML (button not div)

---

## 20. DEVELOPMENT WORKFLOW

### Local Setup

```bash
npm install
npm run dev         # Start on http://localhost:3000
npm test            # Run tests (required before commit)
npm run lint        # Check code quality
npm run typecheck   # TypeScript checking
```

### Pre-commit Checks (Husky)

1. lint-staged: eslint --fix on _.ts/_.tsx
2. Prettier on _.json, _.md, \*.css
3. npm test: vitest run

### Before Pushing

```bash
npm run lint        # Fix linting issues
npm run typecheck   # Resolve type errors
npm test            # Ensure all tests pass
```

---

## 21. ABSOLUTE FILE PATHS (for replication)

### Critical Files

- C:\Projects\GWTH_V2\src\app\globals.css — Design tokens
- C:\Projects\GWTH_V2\src\lib\config.ts — App constants
- C:\Projects\GWTH_V2\src\providers\root-provider.tsx — Provider composition
- C:\Projects\GWTH_V2\src\providers\theme-provider.tsx — Theme setup
- C:\Projects\GWTH_V2\src\middleware.ts — Security & auth
- C:\Projects\GWTH_V2\src\app\layout.tsx — Root layout
- C:\Projects\GWTH_V2\src\app\(dashboard)\layout.tsx — Dashboard layout
- C:\Projects\GWTH_V2\src\components\layout\sidebar.tsx — Navigation
- C:\Projects\GWTH_V2\src\components\layout\header.tsx — Dashboard header
- C:\Projects\GWTH_V2\src\components\shared\* — Reusable components
- C:\Projects\GWTH_V2\src\lib\utils.ts — Utility functions
- C:\Projects\GWTH_V2\src\lib\types.ts — Shared types
- C:\Projects\GWTH_V2\package.json — Dependencies (exact versions)
- C:\Projects\GWTH_V2\tsconfig.json — TypeScript config
- C:\Projects\GWTH_V2\eslint.config.mjs — Linting rules
- C:\Projects\GWTH_V2\.commitlintrc.json — Commit rules
- C:\Projects\GWTH_V2\Dockerfile — Container build
- C:\Projects\GWTH_V2\next.config.ts — Next.js config
- C:\Projects\GWTH_V2\postcss.config.mjs — PostCSS config
- C:\Projects\GWTH_V2\components.json — shadcn config
- C:\Projects\GWTH_V2\vitest.config.ts — Unit test config
- C:\Projects\GWTH_V2\playwright.config.ts — E2E test config

---

This documentation provides everything needed to replicate GWTH v2's design system, architecture, and patterns in a new project. The exact CSS variables, color values, component patterns, and configuration files are fully documented above.
