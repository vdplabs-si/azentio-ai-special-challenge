import { AI_OFFERINGS, INDUSTRIES, OFFERINGS, PRODUCT_LINES, type IndustrySlug, type OfferingDef } from "@/content/catalogue";

const AI_SLUGS = new Set(AI_OFFERINGS.map((o) => o.slug));

export const industryName = (slug: IndustrySlug | string) =>
  INDUSTRIES.find((i) => i.slug === slug)?.name ?? (slug === "cross-industry" ? "Cross-industry" : slug);

export const findOffering = (slug: string): OfferingDef | undefined => OFFERINGS.find((o) => o.slug === slug);

export const findIndustry = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);

export const isAiOffering = (o: OfferingDef) => AI_SLUGS.has(o.slug);

export const productLinesFor = (industry: IndustrySlug) => PRODUCT_LINES.filter((o) => o.industry === industry);

/** AI offerings that apply to an industry: those tagged with it plus cross-industry ones. */
export const aiOfferingsFor = (industry: IndustrySlug) =>
  AI_OFFERINGS.filter((o) => o.industry === industry || o.industry === "cross-industry");

/** Interest options for the demo form, grouped for the select. */
export const INTEREST_GROUPS = [
  { label: "azentio.ai AI offerings", options: AI_OFFERINGS.map((o) => ({ value: o.slug, label: o.name })) },
  { label: "Azentio product lines", options: PRODUCT_LINES.map((o) => ({ value: o.slug, label: o.name })) },
];

/** Industry name for use mid-sentence: "banking", "capital markets", "ERP". */
export function industryPhrase(name: string) {
  const short = name.replace(/^Azentio /, "");
  return short === short.toUpperCase() ? short : short.toLowerCase();
}
