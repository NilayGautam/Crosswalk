import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <main className="w-full max-w-sm">
        <p className="text-lg font-bold tracking-tight">Crosswalk</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">There is no page here</h1>
        <p className="mt-2 text-mute">The address may be mistyped, or the page may have moved.</p>
        <p className="mt-6">
          <Link href="/" className="link font-medium">
            Go to your projects
          </Link>
        </p>
      </main>
    </div>
  );
}
