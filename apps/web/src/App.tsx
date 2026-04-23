import { useEffect, useState } from "react";
import { Block } from "./blocks/index.tsx";
import { sanity } from "./sanity.ts";
import type { PageDoc } from "./types.ts";

/**
 * Slug-based routing without a router. The path's first non-empty segment
 * becomes the slug; `/` falls back to `home`. Trailing segments and
 * query strings are ignored. Listens to `popstate` so back/forward
 * updates the page without a hard reload.
 */
const PAGE_QUERY = `*[_type == "page" && slug.current == $slug][0]{
  _id,
  _type,
  title,
  slug,
  pageBuilder
}`;

function slugFromPath(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  return first ? decodeURIComponent(first) : "home";
}

export function App() {
  const [slug, setSlug] = useState(() =>
    typeof window === "undefined" ? "home" : slugFromPath(window.location.pathname),
  );
  const [page, setPage] = useState<PageDoc | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSlug(slugFromPath(window.location.pathname));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError(null);
    sanity
      .fetch<PageDoc | null>(PAGE_QUERY, { slug })
      .then((doc) => {
        if (cancelled) return;
        setPage(doc ?? "missing");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) return <StatusScreen title="Something went wrong" detail={error} tone="error" />;
  if (page === null)
    return <StatusScreen title="Loading" detail={`Fetching “${slug}” from Sanity…`} />;
  if (page === "missing")
    return (
      <StatusScreen
        title="Page not found"
        detail={`No published page with slug “${slug}”. Try /home or /inspiration.`}
      />
    );

  return (
    <div>
      <Header title={page.title} />
      <main>
        {(page.pageBuilder ?? []).map((block) => {
          const b = block as { _key: string; _type: string; [k: string]: unknown };
          return <Block key={b._key} block={b} />;
        })}
      </main>
      <Footer />
    </div>
  );
}

function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-outline)] bg-[color:var(--color-surface)]">
      <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-6 px-6 py-4 md:px-10">
        <a
          href="/"
          className="text-lg font-semibold tracking-tight text-[color:var(--color-on-surface)]"
        >
          David's Bridal
        </a>
        <nav className="hidden items-center gap-5 text-sm text-[color:var(--color-on-surface-muted)] md:flex">
          <a href="/home" className="hover:text-[color:var(--color-primary)] transition-colors">
            Home
          </a>
          <a
            href="/inspiration"
            className="hover:text-[color:var(--color-primary)] transition-colors"
          >
            Inspiration
          </a>
        </nav>
        {title ? (
          <p className="label-eyebrow hidden truncate md:block max-w-[24rem]">{title}</p>
        ) : null}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-[color:var(--color-surface-cream)] py-12">
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        <p className="label-eyebrow mb-2">Migrated from AEM</p>
        <p className="text-lg text-[color:var(--color-on-surface)]">
          Preview of the home page content model, rendered against Sanity.
        </p>
      </div>
    </footer>
  );
}

function StatusScreen({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone?: "error";
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="label-eyebrow mb-3">David's Bridal</p>
      <h1 className="text-3xl md:text-4xl font-normal text-[color:var(--color-on-surface)]">
        {title}
      </h1>
      <p
        className={`mt-3 text-sm ${tone === "error" ? "text-[color:var(--color-error)]" : "text-[color:var(--color-on-surface-muted)]"}`}
      >
        {detail}
      </p>
    </div>
  );
}
