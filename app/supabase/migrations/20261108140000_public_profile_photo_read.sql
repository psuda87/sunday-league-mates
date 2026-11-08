-- Profile photos are intentionally public. Keep writes/deletes restricted to the existing
-- session-verified accounts Edge Function, which uses the service role.
-- Do not grant direct upload/update/delete permissions to anon/authenticated.
update storage.buckets
set public = true
where id = 'slm-profile-photos';

-- Public read is limited to this bucket. Metadata and all other storage
-- buckets remain subject to their existing access controls.
-- The Storage public object URL is /storage/v1/object/public/slm-profile-photos/<path>.
