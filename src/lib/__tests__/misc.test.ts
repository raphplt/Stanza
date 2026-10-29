import { describe, expect, it } from "vitest";
import { invitationPath, invitationToken } from "@/lib/tokens";
import { describeUserAgent } from "@/lib/user-agent";

describe("invitation tokens", () => {
  it("are stable per invitation and distinct across invitations", () => {
    expect(invitationToken("a")).toBe(invitationToken("a"));
    expect(invitationToken("a")).not.toBe(invitationToken("b"));
    expect(invitationPath("a")).toBe(`/invitation/${invitationToken("a")}`);
    expect(invitationToken("a")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("describeUserAgent", () => {
  it("names browser and system", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari sur iOS");
    expect(describeUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe(
      "Firefox sur Linux",
    );
    expect(describeUserAgent(null)).toBe("Appareil inconnu");
  });
});
