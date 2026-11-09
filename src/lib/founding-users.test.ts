import { describe, expect, test } from "bun:test";
import { assertBillableUser, foundingSubscription, isFoundingUser } from "./founding-users";

describe("permanent founding-user access", () => {
  test("marlindakii.hugo@gmail.com is never billable", () => {
    expect(isFoundingUser("marlindakii.hugo@gmail.com")).toBe(true);
    expect(isFoundingUser("MARLINDAKII.HUGO@gmail.com")).toBe(true);
    expect(() => assertBillableUser("marlindakii.hugo@gmail.com")).toThrow();
    expect(foundingSubscription()).toMatchObject({
      status: "legacy_free", needsPayment: false, trialExpired: false, currentPeriodEnd: null,
    });
  });
  test("existing free users keep their exemptions", () => {
    for (const email of ["dawie@polka.co.za", "julius@polka.co.za", "nadia.jvr1668@gmail.com"]) {
      expect(isFoundingUser(email)).toBe(true);
    }
  });
  test("ordinary users are not exempt", () => {
    expect(isFoundingUser("ordinary@example.com")).toBe(false);
    expect(() => assertBillableUser("ordinary@example.com")).not.toThrow();
  });
});