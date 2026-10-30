import { z } from "zod";
import { OFFERINGS } from "@/content/catalogue";

/**
 * Public form schemas, shared by the client forms (react-hook-form) and the API routes, so the
 * browser and server enforce identical rules. The server is authoritative.
 */

const OFFERING_SLUGS = new Set(OFFERINGS.map((o) => o.slug));

/** Remove control characters (keeping newlines/tabs when multiline) and bidi override characters. */
export function stripControl(value: string, multiline = false) {
  const normalised = value.replace(/\r\n?/g, "\n").replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
  return multiline
    ? normalised.replace(/[^\P{Cc}\n\t]/gu, "")
    : normalised.replace(/\p{Cc}/gu, " ").replace(/ {2,}/g, " ");
}

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `Please enter your ${label}.` })
    .max(max * 4, `${capitalise(label)} is too long.`)
    .overwrite((v) => stripControl(v))
    .trim()
    .min(min, min <= 1 ? `Please enter your ${label}.` : `${capitalise(label)} must be at least ${min} characters.`)
    .max(max, `${capitalise(label)} must be at most ${max} characters.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max * 4, `${capitalise(label)} is too long.`)
    .overwrite((v) => stripControl(v))
    .trim()
    .max(max, `${capitalise(label)} must be at most ${max} characters.`)
    .optional();

const longText = (min: number, max: number, label: string) =>
  z
    .string({ error: `Please enter a ${label}.` })
    .max(max * 2, `${capitalise(label)} is too long.`)
    .overwrite((v) => stripControl(v, true))
    .trim()
    .min(min, `${capitalise(label)} must be at least ${min} characters.`)
    .max(max, `${capitalise(label)} must be at most ${max} characters.`);

const email = z
  .string({ error: "Please enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Please enter a valid email address." }).max(254, "Email address is too long."));

const consent = z.boolean({ error: "Please confirm we may contact you." }).refine((v) => v === true, {
  error: "Please confirm we may contact you about this request.",
});

/** Honeypot: real visitors never see or fill this field. */
const honeypot = z.string().max(500).optional();

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ───────────────────────────── Demo request / contact ─────────────────────────────

export const contactSchema = z.object({
  name: text(2, 100, "name"),
  email,
  company: text(2, 150, "company"),
  jobTitle: optionalText(100, "job title"),
  country: optionalText(100, "country"),
  interest: z
    .string({ error: "Please choose what you're interested in." })
    .refine((v) => v === "general" || OFFERING_SLUGS.has(v), { error: "Please choose a product or “General enquiry”." }),
  message: longText(10, 4000, "message"),
  consentContact: consent,
  website: honeypot,
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;

// ───────────────────────────── Hackathon registration ─────────────────────────────

export const PARTICIPANT_TYPES = [
  { value: "employee", label: "Azentio employee" },
  { value: "client", label: "Azentio client" },
  { value: "partner", label: "Partner" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
] as const;

export const hackathonRegistrationSchema = z.object({
  eventId: z.string({ error: "Please choose a hackathon." }).trim().min(1, "Please choose a hackathon.").max(64, "Invalid hackathon."),
  name: text(2, 100, "name"),
  email,
  organisation: optionalText(150, "organisation"),
  participantType: z.enum(["employee", "client", "partner", "student", "other"], {
    error: "Please tell us how you're taking part.",
  }),
  teamName: optionalText(100, "team name"),
  ideaSummary: z
    .string()
    .max(4000, "Idea summary is too long.")
    .overwrite((v) => stripControl(v, true))
    .trim()
    .max(2000, "Idea summary must be at most 2000 characters.")
    .optional(),
  consentContact: consent,
  website: honeypot,
});

export type HackathonRegistrationInput = z.input<typeof hackathonRegistrationSchema>;
export type HackathonRegistrationData = z.output<typeof hackathonRegistrationSchema>;
