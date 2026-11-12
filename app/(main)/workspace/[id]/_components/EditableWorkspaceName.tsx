"use client";

import { useRef, useState } from "react";
import { updateWorkspace } from "@/actions/workspace";
import { useFetch } from "@/hooks/use-fetch";

const MAX_NAME_LENGTH = 120;

export function EditableWorkspaceName({
  workspaceId,
  initialName,
}: {
  workspaceId: string;
  initialName: string;
}) {
  const [editing, setEditing] = useState(false);
  // The last name the server accepted, so "unchanged" and Escape compare against the current
  // name rather than the one the page first loaded with.
  const [savedName, setSavedName] = useState(initialName);
  const [name, setName] = useState(initialName);
  // Enter commits and unmounts the input, which then fires blur: this keeps that to one save.
  const committing = useRef(false);
  const { fn: updateWorkspaceFn } = useFetch(updateWorkspace);

  // A rename from elsewhere (e.g. the board's edit dialog) arrives as a new initialName.
  const [prevInitialName, setPrevInitialName] = useState(initialName);
  if (initialName !== prevInitialName) {
    setPrevInitialName(initialName);
    setSavedName(initialName);
    if (!editing) setName(initialName);
  }

  const commit = async () => {
    if (committing.current) return;
    committing.current = true;
    setEditing(false);

    const trimmed = name.trim();
    // Nothing to save: revert rather than firing a no-op mutation.
    if (!trimmed || trimmed === savedName) {
      setName(savedName);
      committing.current = false;
      return;
    }

    setName(trimmed);
    const updated = await updateWorkspaceFn(workspaceId, trimmed);
    // On failure (already toasted by useFetch) go back to the name that's really saved.
    if (updated) setSavedName(updated.name);
    else setName(savedName);
    committing.current = false;
  };

  const cancel = () => {
    committing.current = true;
    setName(savedName);
    setEditing(false);
    // Released after the blur that unmounting the input triggers.
    queueMicrotask(() => (committing.current = false));
  };

  if (editing) {
    return (
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") cancel();
        }}
        maxLength={MAX_NAME_LENGTH}
        aria-label="Workspace name"
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-sm font-medium outline-none focus:border-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename workspace"
      className="min-w-0 truncate rounded-md px-1.5 py-0.5 text-sm font-medium transition-colors hover:bg-accent"
    >
      {name}
    </button>
  );
}
