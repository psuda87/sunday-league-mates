import { useEffect, useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';

// Short-lived signed URLs of profile photos of the active members of one group.
// The server checks membership; on any failure the rows simply keep their initials.
export function useGroupPhotos(manager: SessionManager | undefined, groupId: string | undefined): Record<string, string> {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!manager || !groupId) { setPhotos({}); return; }
    let live = true;
    manager.call<{ photos: Record<string, string> }>('profile_photo_group_list', { group_id: groupId })
      .then(r => { if (live) setPhotos(r && typeof r.photos === 'object' && r.photos ? r.photos : {}); })
      .catch(() => { if (live) setPhotos({}); });
    return () => { live = false; };
  }, [manager, groupId]);
  return photos;
}
