import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Convert basic markdown to HTML for print/PDF rendering.
 * Handles headings, bold, lists, blockquotes, and paragraph breaks.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;

  function closeLists() {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>",
      );
      html += `<h${level}>${text}</h${level}>`;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      closeLists();
      const text = trimmed
        .slice(2)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html += `<blockquote>${text}</blockquote>`;
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
      if (!inUl) {
        html += "<ul>";
        inUl = true;
      }
      const text = ulMatch[1].replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html += `<li>${text}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
      if (!inOl) {
        html += "<ol>";
        inOl = true;
      }
      const text = olMatch[1].replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html += `<li>${text}</li>`;
      continue;
    }

    // Plain paragraph
    closeLists();
    const text = trimmed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html += `<p>${text}</p>`;
  }

  closeLists();
  return html;
}

export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}
