import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Libre+Franklin:ital,wght@0,400..800;1,400..600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details =
    "The page could not be loaded. Try again, or go back to your home page.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      message = "Page not found";
      details =
        typeof error.data === "string" && error.data
          ? error.data
          : "This page does not exist or is not yours to view.";
    } else {
      details = error.statusText || details;
    }
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-sheet bg-sheet p-8 shadow-sheet">
        <Link to="/" className="text-sm font-extrabold tracking-[-0.02em]">
          Resume<span className="text-exhibit">&nbsp;Fit</span>
        </Link>
        <h1 className="mt-6 text-[1.75rem] font-bold leading-tight">
          {message}
        </h1>
        <p className="mt-2 text-ink-2">{details}</p>
        <Link
          to="/"
          className="pressable mt-6 inline-flex h-9 items-center rounded-control bg-exhibit px-3.5 text-sm font-medium text-sheet hover:bg-exhibit-deep"
        >
          Go to home
        </Link>
        {stack ? (
          <pre className="mt-6 w-full overflow-x-auto rounded-control bg-sheet-sunk p-4 font-mono text-xs">
            <code>{stack}</code>
          </pre>
        ) : null}
      </div>
    </main>
  );
}
