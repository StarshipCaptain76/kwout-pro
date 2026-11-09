import { sharePdf } from "@/lib/share-pdf";

export async function sendEmailWithPdf(
  file: File,
  message: string,
  subject: string,
 ) {
  return sharePdf(file, subject, message);
}