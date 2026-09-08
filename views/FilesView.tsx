import React, { useCallback, useState } from 'react';
import { ArrowUp, FileText, Folder, HardDrive, Loader2 } from 'lucide-react';
import { api, type DirectoryListing, type FilePreview } from '@/lib/api';
import { formatBytes } from '@/lib/hooks';
import { EmptyState, Mono, Note, Panel, ViewHeader } from './parts';
import { cn } from '@/utils';

/**
 * A real file browser over the node's own source tree, served by the server's
 * fs module. Roots are an explicit allowlist; dotfiles, VCS and dependency
 * directories are excluded, and only text files under 256 KB are returned.
 */
export function FilesView() {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [file, setFile] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roots, setRoots] = useState<string[]>([]);

  const open = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const directory = await api.listDir(path);
      setListing(directory);
      setFile(null);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void open('.');
    api.config().then((config) => setRoots(config.browseRoots)).catch(() => {});
  }, [open]);

  const openFile = async (path: string) => {
    setError(null);
    try {
      setFile(await api.readFile(path));
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[520px]">
      <ViewHeader
        icon={HardDrive}
        title="File Explorer"
        subtitle={roots.length ? `Browsing ${roots.join(', ')}` : 'Reading browse roots…'}
        actions={
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
            <Mono>{listing?.path ?? '—'}</Mono>
          </div>
        }
      />

      {error && (
        <div className="mb-3">
          <Note tone="warn">{error}</Note>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        <Panel title="Directory" className="lg:col-span-1">
          <div className="space-y-0.5 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
            {listing?.parent !== null && listing?.parent !== undefined && (
              <button
                onClick={() => void open(listing.parent as string)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-zinc-400 hover:bg-white/5 text-xs"
              >
                <ArrowUp className="w-3.5 h-3.5" /> ..
              </button>
            )}
            {listing?.entries.length === 0 && <EmptyState>Empty directory.</EmptyState>}
            {listing?.entries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => (entry.isDirectory ? void open(entry.path) : void openFile(entry.path))}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left group',
                  file?.path === entry.path && 'bg-emerald-500/10',
                )}
              >
                {entry.isDirectory ? (
                  <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                )}
                <span className="text-xs text-zinc-300 truncate flex-1">{entry.name}</span>
                <Mono className="text-zinc-700 text-[10px] shrink-0">{entry.isDirectory ? '' : formatBytes(entry.size)}</Mono>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={file ? file.path : 'Preview'}
          className="lg:col-span-2"
          right={file ? <Mono>{formatBytes(file.size)}{file.truncated ? ' (truncated)' : ''}</Mono> : undefined}
        >
          <div className="max-h-[440px] overflow-auto custom-scrollbar">
            {!file && <EmptyState>Select a file to read it. Only text files inside the allowed roots are served.</EmptyState>}
            {file && <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-words">{file.content}</pre>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
