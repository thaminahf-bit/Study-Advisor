import rawCatalog from 
"@/data/catalog.json";

export type Programme = {
  id: string;
  name_en: string;
  name_ar: string;
  field: string;
  host: string;
  country: string;
  teaching_language: "en" | "ar";
  weeks: number;
  fee: number;
  currency: string;
  min_ielts: number | null;
  scholarship: boolean;
};

export type CatalogFilters = {
  query?: string;
  field?: string;
  country?: string;
  currency?: string;
  maxFee?: number;
  maxWeeks?: number;
  scholarship?: boolean;
  language?: "en" | "ar";
};

const catalog = rawCatalog as Programme[];

export function getAllProgrammes(): Programme[] {
  return catalog;
}

export function getProgrammeById(
  id: string,
): Programme | undefined {
  return catalog.find((programme) => programme.id === id);
}

export function searchCatalog(
  filters: CatalogFilters = {},
): Programme[] {
  const query = filters.query?.trim().toLowerCase();

  return catalog.filter((programme) => {
    const searchableText = [
      programme.id,
      programme.name_en,
      programme.name_ar,
      programme.field,
      programme.host,
      programme.country,
    ]
      .join(" ")
      .toLowerCase();

    if (query && !searchableText.includes(query)) {
      // Also support broad field searches such as "AI".
      const aliases: Record<string, string> = {
        ai: "computing",
        technology: "computing",
        programming: "computing",
        art: "design",
        medical: "medicine",
        entrepreneurship: "business",
      };

      const expandedQuery = aliases[query];

      if (!expandedQuery || programme.field !== expandedQuery) {
        return false;
      }
    }

    if (
      filters.field &&
      programme.field !== filters.field.toLowerCase()
    ) {
      return false;
    }

    if (
      filters.country &&
      programme.country.toLowerCase() !==
        filters.country.toLowerCase()
    ) {
      return false;
    }

    // Never compare fees in different currencies as if they
    // were equivalent.
    if (
      filters.maxFee !== undefined &&
      (!filters.currency ||
        programme.currency !== filters.currency.toUpperCase() ||
        programme.fee > filters.maxFee)
    ) {
      return false;
    }

    if (
      filters.maxWeeks !== undefined &&
      programme.weeks > filters.maxWeeks
    ) {
      return false;
    }

    if (
      filters.scholarship !== undefined &&
      programme.scholarship !== filters.scholarship
    ) {
      return false;
    }

    if (
      filters.language &&
      programme.teaching_language !== filters.language
    ) {
      return false;
    }

    return true;
  });
}