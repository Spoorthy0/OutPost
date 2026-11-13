"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, FileText, Globe, LayoutGrid, Lock, RotateCcw, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { setWorkspaceSharing } from "@/actions/workspace";
import { useFetch } from "@/hooks/use-fetch";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { UPGRADE_REASONS, type LimitError } from "@/lib/plan-limits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  isTeamWorkspace,
}: {
  workspaceId: string;
  workspaceName: string;
  initialShareToken: string | null;
  // Org workspaces are open to every member; personal ones only to their creator.
  isTeamWorkspace: boolean;
  // From the workspace owner's plan, checked on the server (sharing is enforced there too).
  canShare: boolean;
  canExportPdf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [exporting, setExporting] = useState<"doc" | "canvas" | null>(null);
  const [copied, setCopied] = useState(false);
  // Resetting breaks the current link for everyone who has it, so it asks first.
  const [confirmingReset, setConfirmingReset] = useState(false);
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
    setConfirmingReset(false);
    return result.shareToken;
  };

  const resetLink = async () => {
    const token = await updateSharing(true);
    if (token) toast.success("New link created. The old one no longer works.");
  };

  const copyLink = async () => {
    if (await copyText(shareUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
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

  const busy = loading ?? false;
  const isPublic = shareToken !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmingReset(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 border-b border-white/6 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
            <Share2 className="size-[18px]" />
          </span>
          <div className="min-w-0 space-y-0.5 text-left">
            <DialogTitle className="text-base">Share workspace</DialogTitle>
            <DialogDescription className="truncate">{workspaceName}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-5">
          {/* Who can open it */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Access</p>

            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/2 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
                {isTeamWorkspace ? <Users className="size-4" /> : <Lock className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{isTeamWorkspace ? "Your organization" : "Only you"}</p>
                <p className="text-xs text-muted-foreground">
                  {isTeamWorkspace
                    ? "Every member can open and edit it."
                    : "A personal workspace, private to your account."}
                </p>
              </div>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {isTeamWorkspace ? "Can edit" : "Owner"}
              </span>
            </div>

            <div
              className={`rounded-xl border p-3 transition-colors ${
                isPublic ? "border-primary/30 bg-primary/5" : "border-white/8 bg-white/2"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    isPublic ? "bg-primary/15 text-primary" : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  <Globe className="size-4" />
                </span>
                <label htmlFor="share-link" className="min-w-0 flex-1 cursor-pointer">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    Public link
                    {!canShare && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Lock className="size-2.5" />
                        Pro
                      </span>
                    )}
                    {isPublic && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Live
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {isPublic
                      ? "Anyone with the link can view the doc and canvas."
                      : "Let anyone view it without signing in. Viewers can’t edit."}
                  </span>
                </label>
                <Switch id="share-link" checked={isPublic} onCheckedChange={updateSharing} disabled={busy} />
              </div>

              {isPublic && (
                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-background/70 p-1 pl-3">
                    <input
                      readOnly
                      value={shareUrl}
                      aria-label="Share link"
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs text-foreground/80 outline-none"
                    />
                    <Button size="sm" onClick={copyLink} className="h-7 min-w-20 gap-1 rounded-md">
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>

                  {confirmingReset ? (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 animate-in fade-in duration-150">
                      <p className="flex-1 text-xs text-amber-200/90">
                        The current link will stop working for everyone who has it.
                      </p>
                      <Button variant="ghost" size="xs" onClick={() => setConfirmingReset(false)} disabled={busy}>
                        Cancel
                      </Button>
                      <Button variant="destructive" size="xs" onClick={resetLink} disabled={busy}>
                        {busy ? "Resetting..." : "Reset"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                        Open as a viewer
                      </a>
                      <button
                        type="button"
                        onClick={() => setConfirmingReset(true)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" />
                        Reset link
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Download */}
          <section className="space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Export as PDF
              {!canExportPdf && <Lock className="size-3" />}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ExportTile
                icon={FileText}
                title="Doc"
                busy={exporting === "doc"}
                onClick={canExportPdf ? exportDoc : () => showUpgrade("pdfExport")}
                disabled={canExportPdf && (!docEditor || exporting !== null)}
              />
              <ExportTile
                icon={LayoutGrid}
                title="Canvas"
                busy={exporting === "canvas"}
                onClick={canExportPdf ? exportCanvas : () => showUpgrade("pdfExport")}
                disabled={canExportPdf && (!canvasEditor || exporting !== null)}
              />
            </div>
            {canExportPdf && (!docEditor || !canvasEditor) && (
              <p className="text-xs text-muted-foreground">
                Switch to the Both view to export{" "}
                {!docEditor && !canvasEditor ? "either" : !docEditor ? "the doc" : "the canvas"}.
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportTile({
  icon: Icon,
  title,
  busy,
  onClick,
  disabled,
}: {
  icon: typeof FileText;
  title: string;
  busy: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/2 p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {busy ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
        ) : (
          <Icon className="size-4" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{busy ? "Exporting..." : "Download PDF"}</span>
      </span>
    </button>
  );
}
