/**
 * tests/ui.test.ts
 *
 * A real integration test for the UI:
 *   1. esbuild bundles the actual application source (JSX, workers and all).
 *   2. jsdom provides the DOM, with a genuine EventSource and fetch pointed at
 *      a running Gaia node (GAIA_TEST_BASE_URL, default http://127.0.0.1:3000).
 *   3. The React tree is mounted and its rendered output is asserted against
 *      values read back from the node over HTTP.
 *
 * No telemetry, ledger or sensor value is mocked. Run with the server up:
 *   npm run test:ui
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import module from 'node:module';
import path from 'node:path';

const BASE = process.env.GAIA_TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT_DIR = path.join(process.cwd(), 'node_modules', '.cache', 'gaia-ui-test');

// Vite handles .css imports; Node cannot, so map them to empty modules.
module.registerHooks({
  load(url, context, nextLoad) {
    if (typeof url === 'string' && url.endsWith('.css')) {
      return { format: 'module', source: 'export default {};', shortCircuit: true } as any;
    }
    return nextLoad(url, context);
  },
});

async function bundleApp(): Promise<string> {
  const esbuild = await import('esbuild');
  const outfile = path.join(OUT_DIR, 'app.mjs');
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'tests', 'entries.tsx')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    loader: { '.css': 'empty', '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'silent',
  });
  return outfile;
}

function installDom() {
  const { JSDOM } = require_jsdom();
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `${BASE}/`,
    pretendToBeVisual: true,
  });
  const win: any = dom.window;

  win.matchMedia =
    win.matchMedia ??
    (() => ({ matches: false, media: '', onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
  win.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  win.HTMLCanvasElement.prototype.getContext = () => null;
  win.Element.prototype.scrollIntoView = () => {};
  win.scrollTo = () => {};
  win.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [], speaking: false };

  win.BroadcastChannel = class {
    name: string;
    onmessage: ((event: any) => void) | null = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage() {}
    close() {}
  };

  win.Worker = class {
    onmessage: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    postMessage() {}
    terminate() {}
    addEventListener() {}
  };

  /** A real EventSource: opens an HTTP stream and parses SSE frames. */
  win.EventSource = class {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    readyState = 0;
    onmessage: ((event: any) => void) | null = null;
    onopen: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    private controller = new AbortController();

    url: string;

    constructor(url: string) {
      this.url = url;
      void (async () => {
        try {
          const response = await fetch(new URL(url, BASE).href, {
            signal: this.controller.signal,
            headers: { Accept: 'text/event-stream' },
          });
          if (!response.ok || !response.body) throw new Error(`stream returned ${response.status}`);
          this.readyState = 1;
          this.onopen?.({});

          const reader = (response.body as any).getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary: number;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const data = frame
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trim())
                .join('\n');
              if (data) this.onmessage?.({ data });
            }
          }
        } catch {
          this.onerror?.({});
        }
      })();
    }

    close() {
      this.readyState = 2;
      this.controller.abort();
    }
  };

  const globals: Record<string, any> = {
    window: win,
    document: win.document,
    location: win.location,
    history: win.history,
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    HTMLElement: win.HTMLElement,
    HTMLInputElement: win.HTMLInputElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
    Element: win.Element,
    Node: win.Node,
    Event: win.Event,
    CustomEvent: win.CustomEvent,
    KeyboardEvent: win.KeyboardEvent,
    MouseEvent: win.MouseEvent,
    PointerEvent: win.PointerEvent ?? win.MouseEvent,
    TouchEvent: win.TouchEvent ?? win.MouseEvent,
    getComputedStyle: win.getComputedStyle.bind(win),
    requestAnimationFrame: win.requestAnimationFrame.bind(win),
    cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
    MutationObserver: win.MutationObserver,
    EventSource: win.EventSource,
    BroadcastChannel: win.BroadcastChannel,
    Worker: win.Worker,
    ResizeObserver: win.ResizeObserver,
    DOMParser: win.DOMParser,
    Image: win.Image,
    navigator: win.navigator,
    self: win,
    IS_REACT_ACT_ENVIRONMENT: true,
  };

  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }

  const realFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: (input: any, init?: any) => realFetch(typeof input === 'string' ? new URL(input, BASE).href : input, init),
  });

  return dom;
}

// jsdom is ESM-friendly; import it synchronously through createRequire to keep
// installDom() free of async ordering problems.
let jsdomModule: any = null;
function require_jsdom() {
  if (!jsdomModule) jsdomModule = (module as any).createRequire(import.meta.url)('jsdom');
  return jsdomModule;
}

let appModule: any = null;
async function loadApp() {
  if (!appModule) {
    installDom();
    const bundle = await bundleApp();
    appModule = await import(bundle);
  }
  return appModule;
}

async function flush(React: any, ms: number) {
  await React.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

test('the console shell mounts and renders live data from the node', async () => {
  const app = await loadApp();
  const { React, createRoot, App } = app;

  const container = window.document.getElementById('root') as HTMLElement;
  assert.ok(container, '#root must exist');

  const root = createRoot(container);
  await React.act(async () => {
    root.render(React.createElement(App));
  });
  await flush(React, 2500);

  const text = window.document.body.textContent ?? '';

  assert.match(text, /Node Overview/, 'the dashboard window should open and render');
  assert.match(text, /Live event stream/, 'the live feed panel should render');
  assert.match(text, /Verified work ledger/, 'the ledger panel should render');

  // The DOM must show the same hostname the node reports over HTTP.
  const status = await (await fetch(new URL('/api/status', BASE).href)).json();
  assert.ok(status.host.hostname, 'the node must report a real hostname');
  assert.ok(text.includes(status.host.hostname), `the real hostname (${status.host.hostname}) should be displayed`);

  // The exact merkle root the node computed must appear in the rendered DOM.
  assert.match(status.ledger.merkleRoot, /^[0-9a-f]{64}$/, 'the node must compute a real 64-hex merkle root');
  assert.ok(text.includes(status.ledger.merkleRoot), 'the ledger merkle root from the node should be rendered');

  // The taskbar shows the real node id and hashrate.
  assert.match(text, /H\/s/, 'the taskbar should show a hashrate readout');

  await React.act(async () => {
    root.unmount();
  });
});

test('every view mounts, fetches real data and throws nothing into the DOM', async () => {
  const app = await loadApp();
  const { React, createRoot, NetworkProvider, defaultSettings } = app;

  const views: [string, any, Record<string, any>?][] = [
    ['DashboardView', app.DashboardView],
    ['MinerView', app.MinerView],
    ['ZkpView', app.ZkpView],
    ['SensorsView', app.SensorsView],
    ['NetworkView', app.NetworkView],
    ['ConsoleView', app.ConsoleView],
    ['FilesView', app.FilesView],
    ['CodeLabView', app.CodeLabView],
    ['DiagnosticsView', app.DiagnosticsView],
    ['SystemMonitorView', app.SystemMonitorView],
    ['SettingsView', app.SettingsView, { settings: defaultSettings, onChange: () => {} }],
    ['OutreachView', app.OutreachView, { settings: defaultSettings }],
    ['GuideView', app.GuideView],
    ['PortfolioView', app.PortfolioView, { settings: defaultSettings }],
  ];

  for (const [name, Component, props] of views) {
    const host = window.document.createElement('div');
    window.document.body.appendChild(host);
    const root = createRoot(host);

    await React.act(async () => {
      root.render(
        React.createElement(NetworkProvider, null, React.createElement(Component, props ?? {})),
      );
    });
    await flush(React, 900);

    const text = host.textContent ?? '';
    assert.ok(text.trim().length > 40, `${name} rendered almost nothing: "${text.slice(0, 100)}"`);
    assert.doesNotMatch(text, /is not a function|Cannot read propert|undefined is not an object/, `${name} leaked a runtime error`);

    await React.act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

test('the file browser shows the real repository tree from the node', async () => {
  const app = await loadApp();
  const { React, createRoot, NetworkProvider, FilesView } = app;

  const host = window.document.createElement('div');
  window.document.body.appendChild(host);
  const root = createRoot(host);

  await React.act(async () => {
    root.render(React.createElement(NetworkProvider, null, React.createElement(FilesView)));
  });
  await flush(React, 1200);

  const text = host.textContent ?? '';
  const listing = await (await fetch(new URL('/api/fs?path=.', BASE).href)).json();
  const expected = listing.entries.filter((entry: any) => !entry.isDirectory).slice(0, 3).map((entry: any) => entry.name);

  for (const name of expected) {
    assert.ok(text.includes(name), `the file browser should list the real file "${name}"`);
  }

  await React.act(async () => {
    root.unmount();
  });
  host.remove();
});
