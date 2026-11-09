import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, Plus, Receipt, Truck } from "lucide-react";
import { createDocument } from "@/lib/create-document";
import { useCan, type DocType } from "@/lib/store";

export function NewDocumentButton() {
  const navigate = useNavigate();
  const canCreate = useCan("jobs.create");
  if (!canCreate) return null;
  const create = (type: DocType) => {
    const id = createDocument(type);
    void navigate({ to: "/doc/$id", params: { id } });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Create new</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => create("quote")}><FileText /> New Quote</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => create("invoice")}><Receipt /> New Invoice</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => create("job")}><Truck /> New Job</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}