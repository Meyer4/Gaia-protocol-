/**
 * tests/entries.tsx
 *
 * Single entry point that the jsdom integration test bundles with esbuild and
 * then mounts. React is re-exported from here so the test and the application
 * share exactly one React instance.
 */
import * as ReactNamespace from 'react';
import '../i18n';
export { ReactNamespace as React };
export { createRoot } from 'react-dom/client';

export { default as App } from '../App';
export { NetworkProvider } from '../lib/network';
export { DashboardView } from '../views/DashboardView';
export { MinerView } from '../views/MinerView';
export { ZkpView } from '../views/ZkpView';
export { SensorsView } from '../views/SensorsView';
export { NetworkView } from '../views/NetworkView';
export { ConsoleView } from '../views/ConsoleView';
export { FilesView } from '../views/FilesView';
export { CodeLabView } from '../views/CodeLabView';
export { DiagnosticsView } from '../views/DiagnosticsView';
export { SystemMonitorView } from '../views/SystemMonitorView';
export { SettingsView } from '../views/SettingsView';
export { OutreachView } from '../views/OutreachView';
export { GuideView } from '../views/GuideView';
export { PortfolioView } from '../views/PortfolioView';
export { defaultSettings } from '../lib/hooks';
