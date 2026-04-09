export interface TemplateSeed {
  id: string;
  name: string;
  description: string;
  isBuiltin: true;
}

export interface SectionSeed {
  blockType: string;
  sortOrder: number;
  visible: boolean;
  config: Record<string, unknown>;
  content: { en: Record<string, unknown>; de: Record<string, unknown> };
}

export const defaultTemplate: TemplateSeed = {
  id: "default",
  name: "Default",
  description: "A clean, minimal landing page suitable for any community.",
  isBuiltin: true
};

export const cyberpunkTemplate: TemplateSeed = {
  id: "cyberpunk",
  name: "Gaming",
  description: "Retro futurism — neon glow, scanlines, angular geometry, and synthwave accents for gaming communities.",
  isBuiltin: true
};

export const esportsTemplate: TemplateSeed = {
  id: "esports",
  name: "eSports",
  description: "Professional eSports layout with team showcase, stats, and tournament focus.",
  isBuiltin: true
};

export const templates: TemplateSeed[] = [defaultTemplate, cyberpunkTemplate, esportsTemplate];

export const defaultSections: SectionSeed[] = [
  {
    blockType: "hero",
    sortOrder: 0,
    visible: true,
    config: { layout: "centered" },
    content: {
      en: {
        eyebrowLabel: "Applications Open",
        heading: "Build Your Legacy",
        subheading: "A competitive multi-game community for players who are serious about improving, competing, and belonging.",
        ctaText: "Apply Now",
        ctaLink: "/apply",
        ctaExploreLabel: "Learn More"
      },
      de: {
        eyebrowLabel: "Bewerbungen offen",
        heading: "Schreib deine Geschichte",
        subheading: "Eine kompetitive Multi-Game-Community für Spieler, die es ernst meinen mit Verbesserung, Wettkampf und Zugehörigkeit.",
        ctaText: "Jetzt bewerben",
        ctaLink: "/apply",
        ctaExploreLabel: "Mehr erfahren"
      }
    }
  },
  {
    blockType: "features",
    sortOrder: 1,
    visible: true,
    config: { columns: 3 },
    content: {
      en: {
        sectionTitle: "What We're About",
        features: [
          { icon: "trophy", title: "Tournaments", description: "Weekly in-house tournaments and external competitions across multiple titles." },
          { icon: "swords", title: "Ranked Scrims", description: "Structured scrim sessions against other guilds to keep your competitive edge sharp." },
          { icon: "video", title: "Content & Clips", description: "We clip it, we edit it, we post it. Join our content team or share your highlights." },
          { icon: "graduation-cap", title: "Coaching", description: "Dedicated coaches and veteran players who break down your gameplay and help you level up." },
          { icon: "party-popper", title: "Community Nights", description: "Regular game nights, watch parties, and events where the whole guild comes together." },
          { icon: "gamepad-2", title: "Multi-Game", description: "From FPS to Battle Royale to MMO — we cover multiple titles and are always expanding." }
        ]
      },
      de: {
        sectionTitle: "Was uns ausmacht",
        features: [
          { icon: "trophy", title: "Turniere", description: "Wöchentliche In-House-Turniere und externe Wettkämpfe über mehrere Titel." },
          { icon: "swords", title: "Ranked Scrims", description: "Strukturierte Scrim-Sessions gegen andere Guilds, um deine Wettkampfstärke zu schärfen." },
          { icon: "video", title: "Content & Clips", description: "Wir clippen es, schneiden es und posten es. Tritt unserem Content-Team bei." },
          { icon: "graduation-cap", title: "Coaching", description: "Coaches und erfahrene Spieler analysieren dein Gameplay und helfen dir, besser zu werden." },
          { icon: "party-popper", title: "Community Nights", description: "Regelmäßige Spieleabende, Watch Parties und Events für die ganze Guild." },
          { icon: "gamepad-2", title: "Multi-Game", description: "Von FPS über Battle Royale bis MMO — wir decken mehrere Titel ab." }
        ]
      }
    }
  },
  {
    blockType: "how-it-works",
    sortOrder: 2,
    visible: true,
    config: {},
    content: {
      en: {
        sectionTitle: "Your Path In",
        steps: [
          { title: "Apply", description: "Fill in our short application: your game, rank, and why you want in." },
          { title: "Review", description: "Our council reviews every application within 48 hours." },
          { title: "Onboarding", description: "Get your Discord roles, meet your team lead, and join your first session." },
          { title: "First Match", description: "Jump into your first scrim or tournament and start building your rank." }
        ]
      },
      de: {
        sectionTitle: "Dein Weg rein",
        steps: [
          { title: "Bewerben", description: "Füll unsere kurze Bewerbung aus: dein Game, dein Rang und warum du dabei sein willst." },
          { title: "Überprüfung", description: "Unser Council prüft jede Bewerbung innerhalb von 48 Stunden." },
          { title: "Onboarding", description: "Hol dir deine Discord-Rollen, lern deinen Team-Lead kennen und nimm teil." },
          { title: "Erster Match", description: "Spring in deinen ersten Scrim oder ein Turnier und bau deinen Rang auf." }
        ]
      }
    }
  },
  {
    blockType: "rich-text",
    sortOrder: 3,
    visible: true,
    config: {},
    content: {
      en: {
        title: "About Us",
        body: "Founded by a group of dedicated gamers who wanted something different: a guild with structure, ambition, and genuine respect for every member — no matter their skill level. Today we are 300+ strong across multiple game titles, running weekly tournaments, coaching sessions, and community events."
      },
      de: {
        title: "Über uns",
        body: "Gegründet von einer Gruppe leidenschaftlicher Gamer, die etwas Anderes wollten: eine Guild mit Struktur, Ehrgeiz und echtem Respekt für jedes Mitglied — unabhängig vom Skill-Level. Heute sind wir 300+ Mitglieder stark, verteilt auf mehrere Game-Titel, mit wöchentlichen Turnieren, Coaching-Sessions und Community-Events."
      }
    }
  },
  {
    blockType: "discord-invite",
    sortOrder: 4,
    visible: true,
    config: {},
    content: {
      en: {
        heading: "300+ Members. One Discord.",
        description: "All guild activity lives on Discord — matchmaking, announcements, coaching bookings, and after-game talk. Join now and introduce yourself."
      },
      de: {
        heading: "300+ Mitglieder. Ein Discord.",
        description: "Alle Guild-Aktivitäten laufen über Discord — Matchmaking, Ankündigungen, Coaching-Buchungen und After-Game-Talk. Tritt jetzt bei."
      }
    }
  },
  {
    blockType: "cta",
    sortOrder: 5,
    visible: true,
    config: { variant: "accent" },
    content: {
      en: {
        heading: "Applications Are Open — Limited Spots",
        description: "We accept new members in cohorts to keep quality high. Spots for this cycle are limited. Don't miss your chance to join.",
        buttonText: "Apply Now",
        buttonLink: "/apply"
      },
      de: {
        heading: "Bewerbungen offen — Begrenzte Plätze",
        description: "Wir nehmen neue Mitglieder in Kohorten auf, um die Qualität hoch zu halten. Plätze sind begrenzt.",
        buttonText: "Jetzt bewerben",
        buttonLink: "/apply"
      }
    }
  }
];

export const cyberpunkSections: SectionSeed[] = [
  {
    blockType: "hero",
    sortOrder: 0,
    visible: true,
    config: { layoutVariant: "cyberpunk" },
    content: {
      en: {
        eyebrowLabel: "Season 4 Now Live",
        heading: "Level Up Your Game",
        subheading: "Join the most competitive gaming community. Weekly tournaments, ranked scrims, and a crew that plays to win.",
        ctaText: "Join the Fight",
        ctaLink: "/apply",
        ctaExploreLabel: "See Our Games"
      },
      de: {
        eyebrowLabel: "Season 4 jetzt live",
        heading: "Level Up dein Game",
        subheading: "Tritt der kompetitivsten Gaming-Community bei. Wöchentliche Turniere, Ranked Scrims und ein Team, das spielt um zu gewinnen.",
        ctaText: "Mach mit",
        ctaLink: "/apply",
        ctaExploreLabel: "Unsere Games"
      }
    }
  },
  {
    blockType: "stats",
    sortOrder: 1,
    visible: true,
    config: { layoutVariant: "cyberpunk" },
    content: {
      en: {
        sectionTitle: "By the Numbers",
        stats: [
          { value: "300+", label: "Active Members" },
          { value: "6", label: "Game Titles" },
          { value: "50+", label: "Weekly Matches" },
          { value: "12", label: "Tournament Wins" }
        ]
      },
      de: {
        sectionTitle: "In Zahlen",
        stats: [
          { value: "300+", label: "Aktive Mitglieder" },
          { value: "6", label: "Game-Titel" },
          { value: "50+", label: "Matches pro Woche" },
          { value: "12", label: "Turnier-Siege" }
        ]
      }
    }
  },
  {
    blockType: "features",
    sortOrder: 2,
    visible: true,
    config: { columns: 3, layoutVariant: "cyberpunk" },
    content: {
      en: {
        sectionTitle: "Why We're Different",
        features: [
          { icon: "trophy", title: "Weekly Tournaments", description: "Compete in organized brackets every week with real prizes and rankings." },
          { icon: "swords", title: "Ranked Scrims", description: "Structured practice against other top guilds to sharpen your skills." },
          { icon: "graduation-cap", title: "Free Coaching", description: "Get reviewed by veterans who've hit the highest ranks." },
          { icon: "gamepad-2", title: "Multi-Title", description: "FPS, MOBA, Battle Royale — we play it all competitively." },
          { icon: "video", title: "Clip Culture", description: "Our content team highlights the best plays every week." },
          { icon: "party-popper", title: "Game Nights", description: "Casual sessions where the whole community hangs out." }
        ]
      },
      de: {
        sectionTitle: "Was uns anders macht",
        features: [
          { icon: "trophy", title: "Wöchentliche Turniere", description: "Tritt jede Woche in organisierten Brackets mit echten Preisen an." },
          { icon: "swords", title: "Ranked Scrims", description: "Strukturiertes Training gegen andere Top-Guilds." },
          { icon: "graduation-cap", title: "Kostenloses Coaching", description: "Lass dich von Veteranen reviewen, die die höchsten Ränge erreicht haben." },
          { icon: "gamepad-2", title: "Multi-Titel", description: "FPS, MOBA, Battle Royale — wir spielen alles kompetitiv." },
          { icon: "video", title: "Clip-Kultur", description: "Unser Content-Team hebt die besten Plays jede Woche hervor." },
          { icon: "party-popper", title: "Spieleabende", description: "Casual Sessions, bei denen die ganze Community zusammenkommt." }
        ]
      }
    }
  },
  {
    blockType: "discord-invite",
    sortOrder: 3,
    visible: true,
    config: { layoutVariant: "cyberpunk" },
    content: {
      en: { heading: "Join the Server", description: "Our Discord is where everything happens — matchmaking, strategy talks, and epic highlights." },
      de: { heading: "Tritt dem Server bei", description: "Unser Discord ist der Ort, wo alles passiert — Matchmaking, Strategie-Talks und epische Highlights." }
    }
  },
  {
    blockType: "cta",
    sortOrder: 4,
    visible: true,
    config: { variant: "accent", layoutVariant: "cyberpunk" },
    content: {
      en: { heading: "Ready to Compete?", description: "Applications are open. Show us what you've got.", buttonText: "Apply Now", buttonLink: "/apply" },
      de: { heading: "Bereit für den Wettkampf?", description: "Bewerbungen sind offen. Zeig uns, was du drauf hast.", buttonText: "Jetzt bewerben", buttonLink: "/apply" }
    }
  }
];

export const esportsSections: SectionSeed[] = [
  {
    blockType: "hero",
    sortOrder: 0,
    visible: true,
    config: { layoutVariant: "esports" },
    content: {
      en: {
        eyebrowLabel: "Professional eSports Organization",
        heading: "Compete. Win. Dominate.",
        subheading: "An elite eSports organization with competitive rosters, professional coaching, and a winning mindset.",
        ctaText: "Apply for Roster",
        ctaLink: "/apply"
      },
      de: {
        eyebrowLabel: "Professionelle eSports-Organisation",
        heading: "Antreten. Gewinnen. Dominieren.",
        subheading: "Eine Elite-eSports-Organisation mit kompetitiven Rostern, professionellem Coaching und Sieger-Mentalität.",
        ctaText: "Für Roster bewerben",
        ctaLink: "/apply"
      }
    }
  },
  {
    blockType: "team",
    sortOrder: 1,
    visible: true,
    config: { layoutVariant: "esports" },
    content: {
      en: {
        sectionTitle: "Our Roster",
        members: [
          { name: "Captain", role: "Team Captain / IGL", avatarUrl: "" },
          { name: "Fragger", role: "Entry Fragger", avatarUrl: "" },
          { name: "Support", role: "Support / Anchor", avatarUrl: "" },
          { name: "Coach", role: "Head Coach", avatarUrl: "" }
        ]
      },
      de: {
        sectionTitle: "Unser Roster",
        members: [
          { name: "Captain", role: "Team Captain / IGL", avatarUrl: "" },
          { name: "Fragger", role: "Entry Fragger", avatarUrl: "" },
          { name: "Support", role: "Support / Anchor", avatarUrl: "" },
          { name: "Coach", role: "Head Coach", avatarUrl: "" }
        ]
      }
    }
  },
  {
    blockType: "stats",
    sortOrder: 2,
    visible: true,
    config: { layoutVariant: "esports" },
    content: {
      en: {
        sectionTitle: "Track Record",
        stats: [
          { value: "1st", label: "Regional Championship" },
          { value: "Top 8", label: "National League" },
          { value: "95%", label: "Scrim Win Rate" },
          { value: "3", label: "Active Rosters" }
        ]
      },
      de: {
        sectionTitle: "Erfolge",
        stats: [
          { value: "1.", label: "Regionale Meisterschaft" },
          { value: "Top 8", label: "Nationale Liga" },
          { value: "95%", label: "Scrim-Siegesrate" },
          { value: "3", label: "Aktive Roster" }
        ]
      }
    }
  },
  {
    blockType: "features",
    sortOrder: 3,
    visible: true,
    config: { columns: 3, layoutVariant: "esports" },
    content: {
      en: {
        sectionTitle: "What We Offer",
        features: [
          { icon: "trophy", title: "Tournament Circuit", description: "Compete in official leagues and community tournaments year-round." },
          { icon: "graduation-cap", title: "Pro Coaching", description: "VOD reviews, strategy sessions, and personalized improvement plans." },
          { icon: "swords", title: "Daily Scrims", description: "Structured practice schedule against top-tier opponents." }
        ]
      },
      de: {
        sectionTitle: "Was wir bieten",
        features: [
          { icon: "trophy", title: "Turnier-Circuit", description: "Tritt ganzjährig in offiziellen Ligen und Community-Turnieren an." },
          { icon: "graduation-cap", title: "Profi-Coaching", description: "VOD-Reviews, Strategie-Sessions und personalisierte Verbesserungspläne." },
          { icon: "swords", title: "Tägliche Scrims", description: "Strukturierter Trainingsplan gegen Top-Gegner." }
        ]
      }
    }
  },
  {
    blockType: "discord-invite",
    sortOrder: 4,
    visible: true,
    config: { layoutVariant: "esports" },
    content: {
      en: { heading: "Join Our Discord", description: "Connect with the team, watch scrims, and stay updated on roster changes." },
      de: { heading: "Tritt unserem Discord bei", description: "Vernetze dich mit dem Team, schau bei Scrims zu und bleib über Roster-Änderungen informiert." }
    }
  },
  {
    blockType: "cta",
    sortOrder: 5,
    visible: true,
    config: { variant: "accent", layoutVariant: "esports" },
    content: {
      en: { heading: "Think You've Got What It Takes?", description: "We're always looking for dedicated players. Apply for a roster spot.", buttonText: "Apply Now", buttonLink: "/apply" },
      de: { heading: "Glaubst du, du hast das Zeug dazu?", description: "Wir suchen immer nach engagierten Spielern. Bewirb dich für einen Roster-Platz.", buttonText: "Jetzt bewerben", buttonLink: "/apply" }
    }
  }
];

export const templateSections: Record<string, SectionSeed[]> = {
  default: defaultSections,
  cyberpunk: cyberpunkSections,
  esports: esportsSections
};
