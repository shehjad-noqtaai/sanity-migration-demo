import { useEffect, useState } from "react";
import { Block } from "./blocks/index.tsx";
import { sanity } from "./sanity.ts";
import type { PageDoc } from "./types.ts";

const HOME_ID = "content.aem-integration.us.en.home";

/**
 * GROQ that dereferences the full pageBuilder. We pull every scalar the
 * block renderers need in one round trip — Sanity's CDN dedupes identical
 * selections, so there's no benefit to splitting the query by block type.
 * When the dataset grows to multiple pages, replace the hard-coded `_id`
 * with a slug-based lookup (`*[_type == "page" && slug.current == $slug]`).
 */
const HOME_QUERY = `*[_id == $id][0]{
  _id,
  _type,
  title,
  slug,
  pageBuilder
}`;

export function App() {
  const [page, setPage] = useState<PageDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sanity
      .fetch<PageDoc | null>(HOME_QUERY, { id: HOME_ID })
      .then((doc) => {
        if (!cancelled) setPage(doc);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <StatusScreen title="Something went wrong" detail={error} tone="error" />;
  if (!page)
    return <StatusScreen title="Loading" detail={`Fetching ${HOME_ID} from Sanity…`} />;

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
  // Clean white chrome, hairline bottom divider — matches the production
  // DB header treatment (bg-white + border-b-gray-200).
  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-outline)] bg-[color:var(--color-surface)]">
      <div className="mx-auto flex max-w-[88rem] items-center justify-between px-6 py-4 md:px-10">
        <a href="/" className="text-lg font-semibold tracking-tight text-[color:var(--color-on-surface)]">
          David's Bridal
        </a>
        {title ? (
          <p className="label-eyebrow hidden truncate md:block">{title}</p>
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
      <h1 className="text-3xl md:text-4xl font-normal text-[color:var(--color-on-surface)]">{title}</h1>
      <p
        className={`mt-3 text-sm ${tone === "error" ? "text-[color:var(--color-error)]" : "text-[color:var(--color-on-surface-muted)]"}`}
      >
        {detail}
      </p>
    </div>
  );
}
