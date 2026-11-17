"use client";

import { useState } from "react";
import { TldrawUiToolbarButton, useEditor } from "tldraw";
import { Check, Copy, Download, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toPrisma, toSql, type ErdSchema } from "@/lib/erd-export";
import { readErdSchema } from "@/lib/erd-export-editor";

const FORMATS = {
  sql: { label: "PostgreSQL", file: "schema.sql", generate: toSql },
  prisma: { label: "Prisma", file: "schema.prisma", generate: toPrisma },
} as const;
type Format = keyof typeof FORMATS;

// Toolbar button: turns the ERD tables on the canvas into SQL or a Prisma schema.
export function ExportSchemaButton() {
  const editor = useEditor();
  const [schema, setSchema] = useState<ErdSchema | null>(null);

  // Read when the dialog opens, so it shows the canvas as it is now.
  const open = () => setSchema(readErdSchema(editor));

  return (
    <>
      <TldrawUiToolbarButton type="tool" tooltip="Export schema as code" aria-label="Export schema" onClick={open}>
        <FileCode2 className="size-4.5" strokeWidth={1.75} />
      </TldrawUiToolbarButton>
      <Dialog open={!!schema} onOpenChange={(isOpen) => !isOpen && setSchema(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export schema</DialogTitle>
            <DialogDescription>
              {schema && schema.tables.length > 0
                ? `${schema.tables.length} table(s) and ${schema.relations.length} relation(s) from this canvas.`
                : "Add ERD tables to the canvas (or ask the agent for a database schema) to export them."}
            </DialogDescription>
          </DialogHeader>
          {schema && schema.tables.length > 0 && <ExportTabs schema={schema} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExportTabs({ schema }: { schema: ErdSchema }) {
  const [format, setFormat] = useState<Format>("sql");
  return (
    <Tabs value={format} onValueChange={(value) => setFormat(value as Format)} className="min-w-0">
      <TabsList>
        {Object.entries(FORMATS).map(([key, { label }]) => (
          <TabsTrigger key={key} value={key}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {(Object.keys(FORMATS) as Format[]).map((key) => (
        <TabsContent key={key} value={key} className="min-w-0">
          <CodeBlock code={FORMATS[key].generate(schema)} fileName={FORMATS[key].file} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CodeBlock({ code, fileName }: { code: string; fileName: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <pre className="max-h-[55vh] overflow-auto rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" onClick={download}>
          <Download />
          Download {fileName}
        </Button>
      </div>
    </div>
  );
}
