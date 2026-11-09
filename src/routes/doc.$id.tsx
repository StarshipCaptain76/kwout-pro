import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/routes/doc-page";

export const Route = createFileRoute("/doc/$id")({
  component: DocPage,
  head: ({ params }) => ({
    meta: [
      { title: `Document ${params.id} — KWOUT` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: `View and manage document ${params.id} in KWOUT.` },
      { property: "og:title", content: `Document ${params.id} — KWOUT` },
      { property: "og:description", content: `View and manage document ${params.id} in KWOUT.` },
      { property: "og:url", content: `https://kwout.co.za/doc/${params.id}` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `https://kwout.co.za/doc/${params.id}` }],
  }),
});
