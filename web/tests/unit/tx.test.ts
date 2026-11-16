import { describe, expect, it } from "vitest";
import { errorText } from "@/lib/tx";

describe("errorText (U-1: one sentence on what to do next)", () => {
  it("explains a declined request", () => {
    expect(errorText({ code: 4001 })).toContain("You declined");
  });

  it("explains an account the wallet has not shared with the page", () => {
    const e = { code: 4100, message: "The requested method and/or account has not been authorized by the user." };
    expect(errorText(e)).toContain("connect again with this account ticked");
  });

  it("explains a request already open in the wallet", () => {
    expect(errorText({ code: -32002 })).toContain("already has a request open");
  });

  it("explains missing funds", () => {
    expect(errorText({ shortMessage: "insufficient funds for gas * price + value" })).toContain("does not hold enough");
  });
});
