import {
  Suspense,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type JSX,
  type MouseEvent,
} from "react";
import { routes } from "./routes";

const NAVIGATE_EVENT = "oix-navigate";

function currentPath(): string {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

export function navigate(to: string): void {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
  window.scrollTo(0, 0);
}

function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = (): void => setPath(currentPath());
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATE_EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATE_EVENT, update);
    };
  }, []);
  return path;
}

/** Client-side link for internal paths; modified clicks and new-tab clicks keep the browser default. */
export function Link({
  href,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }): JSX.Element {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== "_self") return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handleClick} {...rest} />;
}

function setRobots(noindex: boolean): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!noindex) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "robots";
    document.head.appendChild(meta);
  }
  meta.content = "noindex";
}

function NotFound(): JSX.Element {
  useEffect(() => {
    document.title = "404 — openinvoicexml";
    setRobots(true);
  }, []);
  return (
    <main className="mx-auto max-w-xl px-5 py-20 text-center">
      <h1 className="text-xl font-semibold">404</h1>
      <p className="mt-3">
        <Link className="text-accent no-underline hover:underline" href="/">
          openinvoicexml
        </Link>
      </p>
    </main>
  );
}

export function Router(): JSX.Element {
  const path = usePath();
  const route = routes[path];

  useEffect(() => {
    if (route) setRobots(route.noindex === true);
  }, [route]);

  if (!route) return <NotFound />;
  const Page = route.component;
  return (
    <Suspense fallback={null}>
      <Page key={path} />
    </Suspense>
  );
}
