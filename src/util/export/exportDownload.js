import { getAuth } from 'firebase/auth';
import { notifyInfo, notifyError } from '../core/notify';
import { exportListClientSide } from './clientSideExport';

function parseFilenameFromContentDisposition(header) {
  if (!header) return null;
  try {
    // e.g., attachment; filename="Name-YYYYMMDD.csv"
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(header);
    const value = decodeURIComponent(match?.[1] || match?.[2] || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

function utcDateYYYYMMDD() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function buildFallbackFilename(listId, listName) {
  const base = listId === 'watchlist' ? 'Watchlist' : (listName || 'List');
  return `${base}-${utcDateYYYYMMDD()}.csv`;
}

export async function exportListCsv(listId, listName) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    notifyError('Please sign in to export.');
    return { ok: false, status: 401 };
  }

  // Check if we should try server-side export
  const useServerExport = import.meta.env.PROD || import.meta.env.USE_FIREBASE_EMULATOR === 'true';

  if (useServerExport) {
    try {
      // Try server-side export (production or with emulator)
      const token = await user.getIdToken(/* forceRefresh */ true);
      const resp = await fetch(`/lists/${encodeURIComponent(listId)}/export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 204) {
        notifyInfo('No items to export');
        return { ok: false, status: 204 };
      }
      
      if (resp.ok) {
        // Server export succeeded
        const blob = await resp.blob();
        const cd = resp.headers.get('Content-Disposition');
        const headerName = parseFilenameFromContentDisposition(cd);
        const filename = headerName || buildFallbackFilename(listId, listName);

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        return { ok: true, status: 200, filename };
      }
      
      // Server failed - fall back to client-side export
      console.log('Server export failed, using client-side export...');
    } catch (error) {
      // Network error or server unreachable - fall back to client-side export
      console.log('Server export error, using client-side export:', error.message);
    }
  }

  // Use client-side export (development without emulator or fallback)
  try {
    const result = await exportListClientSide(listId, listName, user.uid);
    
    if (result.isEmpty) {
      notifyInfo('No items to export');
      return { ok: false, status: 204 };
    }
    
    if (result.success) {
      notifyInfo(`Exported ${result.count} items successfully`);
      return { ok: true, status: 200 };
    }
    
    throw new Error(result.message || 'Export failed');
    
  } catch (error) {
    console.error('Export error:', error);
    notifyError(`Export failed: ${error.message}`);
    return { ok: false, status: 500 };
  }
}
