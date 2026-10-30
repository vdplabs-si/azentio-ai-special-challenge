import { describe, it, expect } from "bun:test";
import { ibanValid, luhnValid, maskValue, parseFlags, scanContribution, scanText } from "@/server/learning/sensitive-scan";

const kinds = (text: string) => scanText(text).map((f) => f.kind);

describe("sensitive scan", () => {
  it("returns no flags for clean text", () => {
    const clean =
      "Several regional lenders are moving SME credit reviews earlier in the onboarding journey and see fewer escalations as a result.";
    expect(scanText(clean)).toEqual([]);
    expect(scanContribution({ title: "Earlier SME credit review", body: clean, topics: ["sme lending"], links: ["https://example.org/report"] })).toEqual([]);
  });

  it("flags email addresses and masks them", () => {
    const flags = scanText("Contact jane.doe@examplebank.com for details.");
    expect(flags.map((f) => f.kind)).toEqual(["email"]);
    expect(flags[0]!.excerpt).not.toContain("jane.doe");
    expect(flags[0]!.excerpt).not.toContain("examplebank");
    expect(flags[0]!.index).toBe(8);
    expect(flags[0]!.length).toBe("jane.doe@examplebank.com".length);
  });

  it("flags card numbers only when the Luhn check passes", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(kinds("Card 4111 1111 1111 1111 was declined")).toContain("card_number");
    expect(kinds("Card 4111-1111-1111-1111 was declined")).toContain("card_number");
    expect(kinds("Reference 4111111111111112 was declined")).not.toContain("card_number");
  });

  it("still flags a long digit run that fails Luhn as account-like", () => {
    expect(kinds("Reference 4111111111111112 was declined")).toContain("account_number");
    expect(kinds("Account 12345678 is overdrawn")).toEqual(["account_number"]);
    expect(kinds("Only 1234567 digits")).toEqual([]);
  });

  it("flags valid IBANs (mod-97)", () => {
    expect(ibanValid("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(ibanValid("GB82 WEST 1234 5698 7654 33")).toBe(false);
    expect(kinds("Pay into GB82 WEST 1234 5698 7654 32 today")).toContain("iban");
    expect(kinds("Pay into GB82WEST12345698765432 today")).toContain("iban");
  });

  it("flags credentials and secrets", () => {
    expect(kinds("password=hunter2")).toEqual(["credential"]);
    expect(kinds("Use api_key: abcd1234efgh")).toEqual(["credential"]);
    expect(kinds("We shared the API key with the vendor")).toEqual(["credential"]);
    expect(kinds("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")).toContain("credential");
    expect(kinds("-----BEGIN RSA PRIVATE KEY-----\nMIIE...")).toContain("credential");
    const masked = scanText("password=hunter2")[0]!;
    expect(masked.excerpt).not.toContain("hunter2");
  });

  it("flags phone numbers", () => {
    expect(kinds("Call +971 50 123 4567 after 5")).toContain("phone");
  });

  it("flags exact currency amounts", () => {
    expect(kinds("The loan was $250,000")).toContain("currency_amount");
    expect(kinds("A fee of AED 1,200 applied")).toContain("currency_amount");
    expect(kinds("Roughly 3 million USD in volume")).toContain("currency_amount");
  });

  it("flags specific calendar dates but not month-level periods", () => {
    expect(kinds("Go-live was on 2026-03-14")).toContain("specific_date");
    expect(kinds("Go-live was on 14 March 2026")).toContain("specific_date");
    expect(kinds("Go-live was on March 14, 2026")).toContain("specific_date");
    expect(kinds("Go-live happened in March 2026")).toEqual([]);
  });

  it("flags restricted terms", () => {
    expect(kinds("This is confidential and under NDA")).toEqual(["restricted_term", "restricted_term"]);
    expect(kinds("Their pricing changed")).toEqual(["restricted_term"]);
  });

  it("attributes flags to the field they were found in", () => {
    const flags = scanContribution({ title: "Mail me at a.b@c.io", body: "password: x1y2z3 is shared" });
    expect(flags.map((f) => [f.field, f.kind])).toEqual([
      ["title", "email"],
      ["body", "credential"],
    ]);
  });

  it("masks values and round-trips persisted JSON safely", () => {
    expect(maskValue("1234567890")).not.toContain("345678");
    expect(parseFlags(null)).toEqual([]);
    expect(parseFlags([{ kind: "email", index: 1, excerpt: "a•••" }, { bogus: true }])).toEqual([
      { kind: "email", index: 1, excerpt: "a•••", field: "body", length: 0 },
    ]);
  });
});
