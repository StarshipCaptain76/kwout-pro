const FREE_EMAILS = new Set([
  "dawie@polka.co.za",
  "julius@polka.co.za",
  "nadia.jvr1668@gmail.com",
  "marlindakii.hugo@gmail.com",
]);

export function isFoundingUser(email: unknown): boolean {
  return typeof email === "string" && FREE_EMAILS.has(email.trim().toLowerCase());
}

export function assertBillableUser(email: unknown): void {
  if (isFoundingUser(email)) {
    throw new Error("Founding users have permanent free access and cannot be charged.");
  }
}

export function foundingSubscription() {
  return {
    status: "legacy_free" as const,
    trialStartedAt: "",
    currentPeriodEnd: null,
    daysLeftInTrial: 0,
    trialExpired: false,
    needsPayment: false,
  };
}