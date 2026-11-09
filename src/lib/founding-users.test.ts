import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { assertBillableUser, foundingSubscription, isFoundingUser } from "./founding-users";

describe("permanent founding-user access", () => {
  test("marlindakii.hugo@gmail.com is never billable", () => {
    assert.equal(isFoundingUser("marlindakii.hugo@gmail.com"), true);
    assert.equal(isFoundingUser("MARLINDAKII.HUGO@gmail.com"), true);
    assert.throws(() => assertBillableUser("marlindakii.hugo@gmail.com"));
    const subscription = foundingSubscription();
    assert.equal(subscription.status, "legacy_free");
    assert.equal(subscription.needsPayment, false);
    assert.equal(subscription.trialExpired, false);
    assert.equal(subscription.currentPeriodEnd, null);
  });
  test("existing free users keep their exemptions", () => {
    for (const email of ["dawie@polka.co.za", "julius@polka.co.za", "nadia.jvr1668@gmail.com"]) {
      assert.equal(isFoundingUser(email), true);
    }
  });
  test("ordinary users are not exempt", () => {
    assert.equal(isFoundingUser("ordinary@example.com"), false);
    assert.doesNotThrow(() => assertBillableUser("ordinary@example.com"));
  });
});