import { describe, it, expect } from "vitest";
import { checkSafety } from "../safety";

describe("checkSafety", () => {
  it("blocks impaired-driving requests", () => {
    const v = checkSafety("I need someone to drive me somewhere while I've been drinking.");
    expect(v.allowed).toBe(false);
    expect(v.guidance).toBeDefined();
  });

  it("blocks weapon requests", () => {
    expect(checkSafety("Does anyone have a gun I can borrow?").allowed).toBe(false);
  });

  it("redirects medical emergencies", () => {
    const v = checkSafety("my friend is not breathing, help");
    expect(v.allowed).toBe(false);
    expect(v.guidance).toMatch(/911|988/);
  });

  it("allows ordinary community requests", () => {
    expect(checkSafety("I need a USB-C to HDMI adapter in 15 minutes.").allowed).toBe(true);
    expect(checkSafety("Can someone help me carry boxes?").allowed).toBe(true);
    expect(checkSafety("I need a ride to the airport tomorrow morning.").allowed).toBe(true);
  });
});
