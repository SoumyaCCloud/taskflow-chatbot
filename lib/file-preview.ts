export type PreviewKind = 'pdf' | 'markdown' | 'spreadsheet';

const EXTENSION_KINDS: Record<string, PreviewKind> = {
  pdf: 'pdf',
  md: 'markdown',
  markdown: 'markdown',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  csv: 'spreadsheet',
};

/** Which preview renderer (if any) a filename's extension maps to. */
export function getPreviewKind(filename: string): PreviewKind | null {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  return extension ? (EXTENSION_KINDS[extension] ?? null) : null;
}
