"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, FileText, LayoutGrid, Lock, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { setWorkspaceSharing } from "@/actions/workspace";
import { useFetch } from "@/hooks/use-fetch";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { UPGRADE_REASONS, type LimitError } from "@/lib/plan-limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// window only exists in the browser, so read the site origin through React's external-store API,
// which renders "" on the server and the real origin once hydrated.
const noopSubscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

// Some browsers start the download after click() returns, so the URL is revoked a little later.
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Workspace names can hold characters that aren't allowed in file names on Windows or macOS.
function fileName(workspaceName: string, part: string) {
  const safe = workspaceName.replace(/[\\/:*?"<>|]+/g, "-").trim() || "workspace";
  return `${safe} - ${part}.pdf`;
}

// Browsers can't draw canvases much past ~16k px a side, and PDF pages max out at 14,400 units.
const MAX_IMAGE_PX = 8000;
const MAX_PDF_UNITS = 14_400;

// Clipboard API needs a secure context (https or localhost); fall back to the old copy command.
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

export function ShareDialog({
  workspaceId,
  workspaceName,
  initialShareToken,
  canShare,
  canExportPdf,
}: {
  workspaceId: string;
  workspaceName: string;
  initialShareToken: string | null;
  // From the workspace owner's plan, checked on the server (sharing is enforced there too).
  canShare: boolean;
  canExportPdf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [exporting, setExporting] = useState<"doc" | "canvas" | null>(null);
  const { canvasEditor, docEditor } = useWorkspaceEditors();
  const { fn: setSharingFn, loading } = useFetch(setWorkspaceSharing);
  const origin = useSyncExternalStore(noopSubscribe, getOrigin, getServerOrigin);
  const shareUrl = `${origin}/shared/${shareToken}`;

  const openUpgrade = useUpgradeDialog();

  // Close this dialog first: two modal dialogs at once fight over focus.
  const showUpgrade = (reason: LimitError) => {
    setOpen(false);
    openUpgrade(UPGRADE_REASONS[reason]);
  };

  const updateSharing = async (enabled: boolean) => {
    if (enabled && !canShare) return showUpgrade("sharing");
    const result = await setSharingFn(workspaceId, enabled);
    if (!result) return;
    if ("limit" in result) return showUpgrade(result.limit);
    setShareToken(result.shareToken);
  };

  const copyLink = async () => {
    if (await copyText(shareUrl)) toast.success("Link copied");
    else toast.error("Couldn't copy. Select the link and copy it instead.");
  };

  // BlockNote's own exporter builds a real, tagged text PDF from the live doc (Typst compiled
  // to WebAssembly, all in the browser). If that fails, it falls back to the older react-pdf
  // exporter. Everything is loaded only on click, since it's too big to ship with the page.
  const exportDoc = async () => {
    if (!docEditor) return;
    setExporting("doc");
    try {
      let blob: Blob;
      try {
        const { PDFExporter, typstDefaultSchemaMappings } = await import("@blocknote/xl-pdf-exporter");
        const exporter = new PDFExporter(docEditor.schema, typstDefaultSchemaMappings);
        const result = await exporter.toPDF(docEditor.document, { title: workspaceName, lang: "en" });
        if (result.error) throw new Error(result.compileErrors.map((e) => e.message).join("; "));
        blob = result.blob;
      } catch (error) {
        console.warn("[export doc] Typst exporter failed, using react-pdf", error);
        const [{ PDFExporter, pdfDefaultSchemaMappings }, { pdf }] = await Promise.all([
          import("@blocknote/xl-pdf-exporter/react-pdf"),
          import("@react-pdf/renderer"),
        ]);
        const exporter = new PDFExporter(docEditor.schema, pdfDefaultSchemaMappings);
        blob = await pdf(await exporter.toReactPDFDocument(docEditor.document)).toBlob();
      }
      downloadBlob(blob, fileName(workspaceName, "doc"));
    } catch (error) {
      console.error("[export doc]", error);
      toast.error("Couldn't export the doc");
    } finally {
      setExporting(null);
    }
  };

  // Renders the canvas to a high-res PNG, then wraps it in a single PDF page of the same size.
  const exportCanvas = async () => {
    if (!canvasEditor) return;
    const shapeIds = [...canvasEditor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) {
      toast.error("The canvas is empty");
      return;
    }

    setExporting("canvas");
    try {
      // Render at 2x for a crisp PDF, less for very large canvases the browser couldn't draw.
      const bounds = canvasEditor.getCurrentPageBounds();
      const largestSide = bounds ? Math.max(bounds.w, bounds.h) + 64 : 0;
      const scale = largestSide ? Math.min(2, MAX_IMAGE_PX / largestSide) : 2;
      const { url, width, height } = await canvasEditor.toImageDataUrl(shapeIds, {
        format: "png",
        background: true,
        padding: 32,
        scale,
      });
      const { jsPDF } = await import("jspdf");
      // The page is the canvas's own size (image pixels / scale), shrunk only past PDF's limit.
      const fit = Math.min(1, MAX_PDF_UNITS / Math.max(width / scale, height / scale));
      const [pageWidth, pageHeight] = [(width / scale) * fit, (height / scale) * fit];
      const pdf = new jsPDF({
        orientation: pageWidth > pageHeight ? "landscape" : "portrait",
        unit: "px",
        format: [pageWidth, pageHeight],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(url, "PNG", 0, 0, pageWidth, pageHeight);
      pdf.save(fileName(workspaceName, "canvas"));
    } catch (error) {
      console.error("[export canvas]", error);
      toast.error("Couldn't export the canvas");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share &ldquo;{workspaceName}&rdquo;</DialogTitle>
          <DialogDescription>
            Anyone in your organization can already open this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="share-link" className="flex flex-col items-start gap-1">
              <span className="flex items-center gap-1.5">
                Public link
                {!canShare && <Lock className="size-3 text-muted-foreground" />}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                Anyone with the link can view the doc and canvas, without signing in.
              </span>
            </Label>
            <Switch
              id="share-link"
              checked={shareToken !== null}
              onCheckedChange={updateSharing}
              disabled={loading ?? false}
            />
          </div>

          {shareToken && (
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                <Copy className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateSharing(true)}
                disabled={loading ?? false}
                aria-label="Reset link"
                title="Reset link (the old link stops working)"
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="flex items-center gap-1.5">
            Export as PDF
            {!canExportPdf && <Lock className="size-3 text-muted-foreground" />}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={canExportPdf ? exportDoc : () => showUpgrade("pdfExport")}
              disabled={canExportPdf && (!docEditor || exporting !== null)}
            >
              <FileText className="size-4" />
              {exporting === "doc" ? "Exporting..." : "Doc"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={canExportPdf ? exportCanvas : () => showUpgrade("pdfExport")}
              disabled={canExportPdf && (!canvasEditor || exporting !== null)}
            >
              <LayoutGrid className="size-4" />
              {exporting === "canvas" ? "Exporting..." : "Canvas"}
            </Button>
          </div>
          {canExportPdf && (!docEditor || !canvasEditor) && (
            <p className="text-xs text-muted-foreground">
              Switch to the Both view to export{" "}
              {!docEditor && !canvasEditor ? "either" : !docEditor ? "the doc" : "the canvas"}.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}