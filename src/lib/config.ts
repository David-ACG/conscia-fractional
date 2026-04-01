/** Sidebar width in pixels when fully expanded */
export const SIDEBAR_WIDTH = 280;

/** Sidebar width in pixels when collapsed (icon-only mode) */
export const SIDEBAR_COLLAPSED_WIDTH = 64;

/** Header height in pixels */
export const HEADER_HEIGHT = 64;

/** Maximum width of the main content area in pixels */
export const CONTENT_MAX_WIDTH = 1400;

/** Default spring transition for Motion layout animations */
export const SPRING_TRANSITION = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

/** Default fade-in transition duration in seconds */
export const FADE_DURATION = 0.2;

/** Stagger delay between children in list animations (seconds) */
export const STAGGER_DELAY = 0.05;

/** Breakpoint (px) below which the sidebar becomes a sheet overlay */
export const MOBILE_BREAKPOINT = 768;

/** Breakpoint (px) for tablet layouts */
export const TABLET_BREAKPOINT = 1024;

/** Application name used in metadata and UI */
export const APP_NAME = "FractionalBuddy";

/** Application tagline */
export const APP_TAGLINE = "Your Fractional Executive OS";

/** Base URL for the production site */
export const APP_URL = "https://fractionalbuddy.com";
