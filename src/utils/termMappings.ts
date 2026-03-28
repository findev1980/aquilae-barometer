/**
 * NL ↔ FR term mappings for growth_phase and priorities.
 * Each entry maps a canonical NL key to both NL and FR labels.
 * Used to merge bilingual survey data and display in the app's language.
 */

export interface TermMapping {
  nl: string;
  fr: string;
}

// Growth phases — 3 phases, each with NL and FR equivalent
export const GROWTH_PHASE_MAP: TermMapping[] = [
  {
    nl: "In volle opbouw – We leggen de fundamenten, bouwen aan zichtbaarheid en versterken stap voor stap ons klantenbestand.",
    fr: "En pleine expansion – Nous posons les fondations, renforçons notre visibilité et élargissons progressivement notre clientèle.",
  },
  {
    nl: "Stevig op koers – We hebben een stabiele klantenportefeuille en een goed draaiende werking. De focus ligt op efficiëntie, teamontwikkeling en verdere groei.",
    fr: "En bonne voie – Nous disposons d'un portefeuille de clients stable et d'un fonctionnement efficace. L'accent est mis sur l'efficacité, le développement de l'équipe et la poursuite de la croissance.",
  },
  {
    nl: "Verankerd en toekomstgericht – We zijn stevig ingebed in de markt, optimaliseren onze processen en rendabiliteit, en kijken vooruit naar mogelijke overname of opvolging.",
    fr: "Ancrés dans le présent et tournés vers l'avenir – Nous sommes solidement implantés sur le marché, optimisons nos processus et notre rentabilité, et envisageons l'avenir avec sérénité en réfléchissant à une éventuelle reprise ou succession.",
  },
];

// Priorities — mapped NL ↔ FR
export const PRIORITIES_MAP: TermMapping[] = [
  // Efficiëntie en werking
  {
    nl: "Efficiëntie en werking - Administratie en kantoorwerking verder digitaliseren",
    fr: "Efficacité et fonctionnement - Poursuivre la numérisation de l'administration et du fonctionnement des bureaux",
  },
  {
    nl: "Efficiëntie en werking - Interne processen en werkmethodes optimaliseren",
    fr: "Efficacité et fonctionnement - Optimiser les processus internes et les méthodes de travail",
  },
  {
    nl: "Efficiëntie en werking - Financiële opvolging en rendabiliteit verbeteren",
    fr: "Efficacité et fonctionnement - Améliorer le suivi financier et la rentabilité",
  },
  // Groei en klantenrelaties
  {
    nl: "Groei en klantenrelaties - Groei van het klantenbestand",
    fr: "Croissance et relations clients - Croissance de la clientèle",
  },
  {
    nl: "Groei en klantenrelaties - Meer cross- en upselling bij bestaande klanten",
    fr: "Croissance et relations clients - Plus de ventes croisées et incitatives auprès des clients existants",
  },
  {
    nl: "Groei en klantenrelaties - Klantenbinding en tevredenheid versterken",
    fr: "Croissance et relations clients - Renforcer la fidélisation et la satisfaction des clients",
  },
  // Marketing en communicatie
  {
    nl: "Marketing en communicatie - Actiever inzetten op sociale media en digitale kanalen",
    fr: "Marketing et communication - Utilisation plus active des réseaux sociaux et des canaux numériques",
  },
  {
    nl: "Marketing en communicatie - Naamsbekendheid, zichtbaarheid en merkpositionering versterken",
    fr: "Marketing et communication - Renforcer la notoriété, la visibilité et le positionnement de la marque",
  },
  {
    nl: "Marketing en communicatie - Professionelere communicatie met klanten (online en offline)",
    fr: "Marketing et communication - Communication plus professionnelle avec les clients (en ligne et hors ligne)",
  },
  // Mensen en organisatie
  {
    nl: "Mensen en organisatie - Talent aantrekken, ontwikkelen en behouden",
    fr: "Personnes et organisation - Attirer, développer et retenir les talents",
  },
  {
    nl: "Mensen en organisatie - Samenwerking en kennisdeling in het team versterken",
    fr: "Personnes et organisation - Renforcer la collaboration et le partage des connaissances au sein de l'équipe",
  },
  {
    nl: "Mensen en organisatie - Leiderschap en betrokkenheid binnen het kantoor uitbouwen",
    fr: "Personnes et organisation - Renforcer le leadership et l'engagement au sein du bureau",
  },
  // Toekomst en partnerschappen
  {
    nl: "Toekomst en partnerschappen - Groei via overname, fusie of samenwerking met andere kantoren",
    fr: "Avenir et partenariats - Croissance par acquisition, fusion ou collaboration avec d'autres bureaux",
  },
  {
    nl: "Toekomst en partnerschappen - Voorbereiding op opvolging of overname",
    fr: "Avenir et partenariats - Préparation à la succession ou à la reprise",
  },
  // AI
  {
    nl: "Ontwikkeling van AI",
    fr: "Développement de l'AI",
  },
];

/**
 * Normalize a raw value to a canonical key using a mapping table.
 * Returns the value in the target language, or the original if no mapping found.
 */
export function normalizeAndTranslate(
  rawValue: string,
  mappings: TermMapping[],
  targetLang: "nl" | "fr"
): string {
  const trimmed = rawValue.trim();
  for (const m of mappings) {
    if (m.nl === trimmed || m.fr === trimmed) {
      return m[targetLang];
    }
  }
  // No mapping found — return as-is
  return trimmed;
}

/**
 * Like calcFrequency but merges NL/FR equivalents and outputs in target language.
 */
export function calcFrequencyTranslated(
  records: { [key: string]: any }[],
  field: string,
  mappings: TermMapping[],
  targetLang: "nl" | "fr"
): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const val = r[field];
    if (Array.isArray(val)) {
      for (const v of val) {
        const translated = normalizeAndTranslate(v, mappings, targetLang);
        if (translated) counts[translated] = (counts[translated] || 0) + 1;
      }
    } else if (typeof val === "string" && val) {
      const translated = normalizeAndTranslate(val, mappings, targetLang);
      if (translated) counts[translated] = (counts[translated] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
