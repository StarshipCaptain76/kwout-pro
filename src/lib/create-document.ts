import { newId, useStore, type Doc, type DocType } from "./store";

export function createDocument(type: DocType): string {
  const { billing, nextDocNumber, upsertDoc, currentUserId, currentStaff } = useStore.getState();
  const id = newId();
  const doc: Doc = {
    id,
    number: nextDocNumber(type),
    type,
    status: "draft",
    createdAt: new Date().toISOString(),
    customer: { id: newId(), name: "", phone: "", email: "" },
    items: [],
    depositPct: type === "job" ? 0 : billing.defaultDepositPct,
    depositPaid: false,
    scheduledDate: type === "job" ? new Date().toISOString().slice(0, 10) : undefined,
    assignedTo: currentStaff && currentUserId ? currentUserId : undefined,
  };
  upsertDoc(doc);
  return id;
}