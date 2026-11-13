"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Tldraw,
  atom,
  computed,
  createTLCurrentUser,
  createUserId,
  getUserPreferences,
  UserRecordType,
  DefaultToolbar,
  DefaultToolbarContent,
  inlineBase64AssetStore,
  defaultShapeUtils,
  defaultBindingUtils,
  type Editor,
  type TLEditorSnapshot,
  type TLComponents,
} from "tldraw";
import { useSync, useSyncDemo, type RemoteTLStoreWithStatus } from "@tldraw/sync";
import { RotateCw, WifiOff } from "lucide-react";
import "tldraw/tldraw.css";
import { toast } from "sonner";
import { saveCanvasContent } from "@/actions/canvas";
import type { Prisma } from "@/lib/generated/prisma/client";
import { EntityTableShapeUtil } from "@/components/EntityTable/EntityTableShapeUtil";
import { AddEntityTableButton } from "@/components/EntityTable/AddEntityTableButton";
import { registerArrowRowSnapping } from "@/components/EntityTable/snapArrowToRow";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { colorForUser } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 1000;

// One toast per failure streak rather than one per debounced save.
let lastFailureToast = 0;
function notifySaveFailure() {
  if (Date.now() - lastFailureToast < 30_000) return;
  lastFailureToast = Date.now();
  toast.error("Couldn't back up the canvas. Your changes are still live; we'll retry on the next edit.");
}

const shapeUtils = [EntityTableShapeUtil];

// Our own sync server (the tldraw-sync/ Cloudflare Worker). Without it, tldraw's public demo
// server is used: fine for trying things out, but rooms there are public and get wiped.
const SYNC_URL = process.env.NEXT_PUBLIC_TLDRAW_SYNC_URL;

// Unlike useSyncDemo, useSync doesn't add tldraw's built-in shapes itself. Built once here:
// a new array on every render would make useSync rebuild the store in a loop.
const syncShapeUtils = [...defaultShapeUtils, ...shapeUtils];

type SyncOptions = { roomId: string; users?: Parameters<typeof useSyncDemo>[0]["users"] };

// Chosen once at load, so it's always the same hook. Images are stored inside the room.
const useCanvasSync = SYNC_URL
  ? ({ roomId, users }: SyncOptions) =>
      useSync({
        uri: `${SYNC_URL}/connect/${roomId}`,
        assets: inlineBase64AssetStore,
        shapeUtils: syncShapeUtils,
        bindingUtils: defaultBindingUtils,
        users,
      })
  : ({ roomId, users }: SyncOptions) => useSyncDemo({ roomId, shapeUtils, users });

// A cleaner, single-page canvas: no style panel, page menu or main menu, and a vertical toolbar
// on the left with our Add table button.
const components: TLComponents = {
  StylePanel: null,
  PageMenu: null,
  MainMenu: null,
  Toolbar: () => (
    <DefaultToolbar orientation="vertical">
      <AddEntityTableButton />
      <DefaultToolbarContent />
    </DefaultToolbar>
  ),
};

export function CanvasEditor({
  workspaceId,
  initialSnapshot,
}: {
  workspaceId: string;
  initialSnapshot: TLEditorSnapshot | null;
}) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setCanvasEditor, setCanvasVisible } = useWorkspaceEditors();

  // On screen, even before the editor exists: while the sync server connects, the agent waits for
  // the canvas instead of reporting that it isn't open.
  useEffect(() => {
    setCanvasVisible(true);
    return () => setCanvasVisible(false);
  }, [setCanvasVisible]);
  const { user } = useUser();

  // Gives other collaborators this user's real name/avatar on their cursor instead of "New User".
  // Memoized on primitives because useSync reconnects whenever the users object changes.
  const userId = user?.id;
  const userName = user?.fullName ?? user?.username ?? "Anonymous";
  const userImageUrl = user?.imageUrl ?? "";
  const users = useMemo(() => {
    if (!userId) return undefined;
    return {
      currentUser: atom(
        "currentUser",
        UserRecordType.create({
          id: createUserId(userId),
          name: userName,
          color: colorForUser(userId),
          imageUrl: userImageUrl,
        })
      ),
    };
  }, [userId, userName, userImageUrl]);

  // The editor's own identity (people menu, your own cursor) is separate from what gets synced —
  // pin its name/color to Clerk too, keeping every other preference from tldraw's local storage.
  const currentUser = useMemo(() => {
    if (!userId) return undefined;
    return createTLCurrentUser({
      userPreferences: computed("clerkUserPreferences", () => ({
        ...getUserPreferences(),
        id: userId,
        name: userName,
        color: colorForUser(userId),
      })),
    });
  }, [userId, userName]);

  // The Postgres autosave below also re-seeds a room that starts empty.
  const store = useCanvasSync({ roomId: `outpost-${workspaceId}`, users });

  const handleMount = (editor: Editor) => {
    setCanvasEditor(editor);
    // Seed from Postgres only when the room is empty, so a joining user doesn't overwrite
    // what others have already drawn.
    if (initialSnapshot && editor.getCurrentPageShapeIds().size === 0) {
      editor.loadSnapshot(initialSnapshot);
    }

    const save = () => {
      saveTimeout.current = null;
      // getSnapshot() carries non-plain internals (schema is a class instance, not JSON) that
      // occasionally fail to cross the Server Action boundary as "opaque temporary reference"
      // errors — round-tripping through JSON strips those and leaves genuinely plain data.
      const plainSnapshot = JSON.parse(JSON.stringify(editor.getSnapshot())) as Prisma.InputJsonValue;
      saveCanvasContent(workspaceId, plainSnapshot).catch((error) => {
        // Live collaboration still has the change; only the backup copy (share links, reseeding
        // empty rooms) missed it, and the next edit retries.
        console.error("[canvas save]", error);
        notifySaveFailure();
      });
    };

    const stopListening = editor.store.listen(
      () => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(save, SAVE_DEBOUNCE_MS);
      },
      { source: "user", scope: "document" }
    );

    // Arrows bound to an ERD table snap to the nearest row and stay on that column (see snapArrowToRow.ts).
    const stopRowSnapping = registerArrowRowSnapping(editor);

    // On unmount (e.g. switching to the Doc view): save any pending edit now, while the editor is
    // still alive, instead of dropping it, and clear it so nothing keeps a disposed editor.
    return () => {
      stopListening();
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        save();
      }
      stopRowSnapping();
      setCanvasEditor(null);
    };
  };

  return (
    // isolate keeps tldraw's high z-index layers inside the canvas, so dialogs render above them.
    // The toolbar moves up into the space left by the hidden page menu (! beats tldraw.css).
    <div className="relative isolate h-full [&_.tlui-main-toolbar--vertical]:top-4!">
      <ConnectionStatus store={store} />
      <Tldraw
        store={store}
        user={currentUser}
        onMount={handleMount}
        components={components}
        colorScheme="dark"
        shapeUtils={shapeUtils}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
      />
    </div>
  );
}

// tldraw's own loading state is a small spinner, easy to miss on a dark canvas, and nothing at all
// says when the sync connection drops. This makes both visible.
function ConnectionStatus({ store }: { store: RemoteTLStoreWithStatus }) {
  if (store.status === "loading") return <SlowConnecting />;

  if (store.status === "error") {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-card p-6 text-center shadow-2xl">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <WifiOff className="size-5" />
          </span>
          <p className="mt-4 font-medium">Couldn&apos;t connect to the canvas</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The live sync server didn&apos;t respond. Your canvas is saved; reload to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
          >
            <RotateCw className="size-4" />
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (store.connectionStatus === "offline") {
    return (
      <div className="pointer-events-none absolute top-3 left-1/2 z-50 -translate-x-1/2">
        <span className="flex items-center gap-2 rounded-full border border-amber-500/25 bg-card/95 px-3 py-1.5 text-xs text-amber-200 shadow-lg backdrop-blur">
          <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
          Reconnecting to live sync…
        </span>
      </div>
    );
  }
  return null;
}

// Most connections take well under a second, so the notice only appears if this one is slow.
function SlowConnecting() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(timer);
  }, []);
  if (!slow) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-card/95 px-6 py-5 text-center shadow-2xl backdrop-blur animate-in fade-in duration-300">
        <span className="size-5 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
        <div>
          <p className="text-sm font-medium">Connecting to the canvas…</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The agent will start drawing once it&apos;s ready.</p>
        </div>
      </div>
    </div>
  );
}
