import { afterEach, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { sharePdf } from "./share-pdf";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});
const file = new File(["%PDF-1.4"], "quote.pdf", { type: "application/pdf" });

describe("PDF sharing", () => {
  it("passes the real PDF attachment to native sharing", async () => {
    let attachment: File | undefined;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
      canShare: () => true,
      share: async (data: ShareData) => { attachment = data.files?.[0]; },
    } });
    assert.equal(await sharePdf(file, "Quote", "Message"), "shared");
    assert.equal(attachment, file);
  });
  it("does not treat cancelling as sending or opening a fallback", async () => {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
      canShare: () => true,
      share: async () => { throw new DOMException("Cancelled", "AbortError"); },
    } });
    assert.equal(await sharePdf(file, "Quote", "Message"), "cancelled");
  });
  it("offers manual attachment when the browser cannot share files", async () => {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { canShare: () => false, share: async () => {} } });
    assert.equal(await sharePdf(file, "Quote", "Message"), "fallback");
  });
});