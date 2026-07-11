import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export function LogoUploader({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function pick() {
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("Logo must be under 2 MB");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|svg\+xml|webp)$/i.test(f.type)) {
      toast.error("Use PNG, JPG, SVG or WebP");
      return;
    }
    const r = new FileReader();
    r.onload = () => onChange(r.result as string);
    r.onerror = () => toast.error("Could not read file");
    r.readAsDataURL(f);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 rounded border bg-muted grid place-items-center overflow-hidden">
        {value ? (
          <img src={value} alt="Logo preview" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">No logo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={onFile}
          className="hidden"
        />
        <Button type="button" variant="outline" size="sm" onClick={pick}>
          <Upload className="h-4 w-4 mr-1.5" />
          {value ? "Replace" : "Upload logo"}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange(undefined)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Remove
          </Button>
        ) : null}
        <p className="text-[11px] text-muted-foreground max-w-[180px]">
          PNG, JPG, SVG or WebP. Max 2 MB. Shown in the header and on PDFs.
        </p>
      </div>
    </div>
  );
}
