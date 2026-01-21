// Enhanced SPA router with parameter support
type RenderFn = (params?: Record<string, string>) => void;

class Router {
  private routes: Map<string, RenderFn> = new Map();
  private paramRoutes: { pattern: RegExp; fn: RenderFn; keys: string[] }[] = [];

  register(path: string, fn: RenderFn) {
    // Check if this is a parameterized route
    if (path.includes(':')) {
      const keys: string[] = [];
      const pattern = this.pathToRegex(path, keys);
      this.paramRoutes.push({ pattern, fn, keys });
    } else {
      this.routes.set(path, fn);
    }
  }

  start() {
    // intercept clicks on anchors with data-link
    document.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("a[data-link]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      this.navigate(href);
    });

    // handle back/forward
    window.addEventListener("popstate", () => {
      this.renderCurrent();
    });

    // initial render
    this.renderCurrent();
  }

  navigate(path: string) {
    history.pushState({}, "", path);
    this.renderCurrent();
  }

  private renderCurrent() {
    const pathname = location.pathname || "/";

    // Clear the app container first (use safe DOM removal)
    const app = document.getElementById("app");
    if (app) {
      while (app.firstChild) {
        app.removeChild(app.firstChild);
      }
    }

    // Try exact match first
    const exactFn = this.routes.get(pathname);
    if (exactFn) {
      exactFn();
      window.dispatchEvent(new CustomEvent('route-changed', { detail: { path: pathname } }));
      return;
    }

    // Try parameterized routes
    for (const route of this.paramRoutes) {
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.keys.forEach((key, index) => {
          params[key] = match[index + 1];
        });
        route.fn(params);
        window.dispatchEvent(new CustomEvent('route-changed', { detail: { path: pathname } }));
        return;
      }
    }

    // fallback to root
    const fallback = this.routes.get("/");
    if (fallback) {
      fallback();
    } else {
      console.warn(`[ROUTER] no route for ${pathname}`);
      // Show 404 page or redirect to home
      this.navigate("/");
    }
  }

  private pathToRegex(path: string, keys: string[]): RegExp {
    const pattern = path
      .replace(/:(\w+)/g, (_, key) => {
        keys.push(key);
        return '([^/]+)';
      })
      .replace(/\//g, '\\/');

    return new RegExp(`^${pattern}$`);
  }
}

export const router = new Router();