import { requireAdminSession } from "../../../utils/auth";
import { createError } from "h3";

const blockTypes = [
  {
    type: "hero",
    name: { en: "Hero", de: "Hero" },
    description: { en: "Large banner with headline, subline, and call-to-action buttons", de: "Großes Banner mit Überschrift, Untertitel und Call-to-Action-Buttons" },
    icon: "layout-template"
  },
  {
    type: "features",
    name: { en: "Features", de: "Features" },
    description: { en: "Grid of feature cards with icons, titles, and descriptions", de: "Raster von Feature-Karten mit Icons, Titeln und Beschreibungen" },
    icon: "grid-3x3"
  },
  {
    type: "how-it-works",
    name: { en: "How It Works", de: "So funktioniert's" },
    description: { en: "Step-by-step process visualization", de: "Schritt-für-Schritt-Prozess-Visualisierung" },
    icon: "list-ordered"
  },
  {
    type: "cta",
    name: { en: "Call to Action", de: "Call to Action" },
    description: { en: "Highlighted section with heading, text, and button", de: "Hervorgehobener Bereich mit Überschrift, Text und Button" },
    icon: "megaphone"
  },
  {
    type: "rich-text",
    name: { en: "Rich Text", de: "Freitext" },
    description: { en: "Free-form text content with formatting", de: "Freier Textinhalt mit Formatierung" },
    icon: "text"
  },
  {
    type: "gallery",
    name: { en: "Gallery", de: "Galerie" },
    description: { en: "Image gallery in grid or carousel layout", de: "Bildergalerie im Raster- oder Karussell-Layout" },
    icon: "images"
  },
  {
    type: "youtube",
    name: { en: "YouTube Video", de: "YouTube-Video" },
    description: { en: "Embedded YouTube video player", de: "Eingebetteter YouTube-Videoplayer" },
    icon: "youtube"
  },
  {
    type: "discord-invite",
    name: { en: "Discord Invite", de: "Discord-Einladung" },
    description: { en: "Discord server invite with live member count", de: "Discord-Server-Einladung mit Live-Mitgliederzahl" },
    icon: "message-circle"
  },
  {
    type: "testimonials",
    name: { en: "Testimonials", de: "Stimmen" },
    description: { en: "Quotes and reviews from community members", de: "Zitate und Bewertungen von Community-Mitgliedern" },
    icon: "quote"
  },
  {
    type: "stats",
    name: { en: "Stats", de: "Statistiken" },
    description: { en: "Key numbers and statistics display", de: "Anzeige von Kennzahlen und Statistiken" },
    icon: "bar-chart-3"
  },
  {
    type: "faq",
    name: { en: "FAQ", de: "FAQ" },
    description: { en: "Frequently asked questions in accordion format", de: "Häufig gestellte Fragen im Akkordeon-Format" },
    icon: "help-circle"
  },
  {
    type: "team",
    name: { en: "Team", de: "Team" },
    description: { en: "Team or member showcase with avatars and roles", de: "Team- oder Mitglieder-Vorstellung mit Avataren und Rollen" },
    icon: "users"
  },
  {
    type: "applications",
    name: { en: "Applications", de: "Bewerbungen" },
    description: { en: "Apply button linked to an application flow or external URL", de: "Bewerben-Button verknüpft mit einem Bewerbungsablauf oder externer URL" },
    icon: "clipboard-list"
  }
];

export default defineEventHandler(async (event) => {
try {
  await requireAdminSession(event);
  return { blocks: blockTypes };
} catch (error) {
  if (error && (error as any).statusCode) throw error;
  throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
}
});
