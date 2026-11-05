import { Suspense } from "react";
import { redirect } from "next/navigation";
import { checkUser } from "@/actions/check-user";

// With cacheComponents on, anything that reads the request (checkUser -> currentUser -> cookies)
// must sit inside <Suspense>. The heading stays in the static shell; the user-specific part streams in.
export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <p className="text-xs text-muted-foreground">Dashboard</p>
      <h2 className="text-lg font-semibold">Recent workspaces</h2>

      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Loading your workspaces…</p>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const user = await checkUser();
  if (!user) redirect("/sign-in");

  return <p className="mt-6 text-sm text-muted-foreground">Welcome back{user.name ? `, ${user.name}` : ""}.</p>;
}
