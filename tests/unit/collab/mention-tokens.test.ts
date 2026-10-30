import { describe, expect, it } from "bun:test";
import {
  activeMentionQuery,
  extractMentionRefs,
  MAX_MENTIONS,
  mentionToken,
  normaliseMentions,
  tokenizeMentions,
} from "../../../src/components/portal/collab/mention-tokens";

describe("tokenizeMentions", () => {
  it("splits picker tokens into mention parts", () => {
    expect(tokenizeMentions("Hi @[Jane Doe](cjane12345) please review")).toEqual([
      { type: "text", value: "Hi " },
      { type: "mention", name: "Jane Doe", userId: "cjane12345" },
      { type: "text", value: " please review" },
    ]);
  });

  it("recognises @email only at a word boundary", () => {
    expect(tokenizeMentions("ping @Bob@Acme.com now")).toEqual([
      { type: "text", value: "ping " },
      { type: "email", email: "bob@acme.com" },
      { type: "text", value: " now" },
    ]);
    // A plain address is not a mention.
    expect(tokenizeMentions("mail bob@acme.com")).toEqual([{ type: "text", value: "mail bob@acme.com" }]);
  });

  it("treats HTML as plain text", () => {
    const body = '<img src=x onerror="alert(1)"> @[<b>x</b>](cabcdef123)';
    const parts = tokenizeMentions(body);
    expect(parts[0]).toEqual({ type: "text", value: '<img src=x onerror="alert(1)"> ' });
    expect(parts[1]).toEqual({ type: "mention", name: "<b>x</b>", userId: "cabcdef123" });
  });

  it("round-trips text exactly when there are no mentions", () => {
    const body = "line 1\n  line 2 @ not-a-mention";
    expect(tokenizeMentions(body)).toEqual([{ type: "text", value: body }]);
  });
});

describe("extractMentionRefs", () => {
  it("deduplicates ids and emails", () => {
    const refs = extractMentionRefs("@[A](cuser00001) @[A again](cuser00001) @x@y.io and @X@Y.io");
    expect(refs.ids).toEqual(["cuser00001"]);
    expect(refs.emails).toEqual(["x@y.io"]);
  });

  it("caps the number of references", () => {
    const body = Array.from({ length: 30 }, (_, i) => `@[U${i}](cuser${String(i).padStart(5, "0")})`).join(" ");
    const refs = extractMentionRefs(body);
    expect(refs.ids.length + refs.emails.length).toBe(MAX_MENTIONS);
  });
});

describe("normaliseMentions", () => {
  const byId = new Map([["cuser00001", { id: "cuser00001", name: "Real Name" }]]);
  const byEmail = new Map([["ok@acme.com", { id: "cuser00001", name: "Real Name" }]]);

  it("replaces spoofed display names with the real name", () => {
    expect(normaliseMentions("hey @[CEO](cuser00001)", { byId, byEmail })).toBe("hey @[Real Name](cuser00001)");
  });

  it("downgrades unpermitted mentions to plain text", () => {
    expect(normaliseMentions("hey @[Outsider](cother9999) and @no@acme.com", { byId, byEmail })).toBe("hey @Outsider and @no@acme.com");
  });

  it("converts permitted @email mentions into tokens", () => {
    expect(normaliseMentions("cc @ok@acme.com", { byId, byEmail })).toBe("cc @[Real Name](cuser00001)");
  });
});

describe("mention picker helpers", () => {
  it("strips token-breaking characters from names", () => {
    expect(mentionToken("Weird [Name] (x)", "cuser00001")).toBe("@[Weird Name x](cuser00001)");
  });

  it("detects an in-progress @query before the caret", () => {
    expect(activeMentionQuery("hello @ja", 9)).toEqual({ start: 6, query: "ja" });
    expect(activeMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
    expect(activeMentionQuery("email a@b", 9)).toBeNull();
    expect(activeMentionQuery("hello @jane doe", 15)).toBeNull();
  });
});
