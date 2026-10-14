/**
 * Shared filters for anonymous / public record reads.
 * Drafts never appear; isPublic:false (explicit) is excluded; missing isPublic = public.
 */

function publicPublishedRecordFilter(extra = {}) {
  return {
    status: 'published',
    isPublic: { $ne: false },
    ...extra,
  };
}

/** Non-draft public surface (leaderboards, hot aggregates). */
function publicNonDraftRecordFilter(extra = {}) {
  return {
    status: { $ne: 'draft' },
    isPublic: { $ne: false },
    ...extra,
  };
}

module.exports = {
  publicPublishedRecordFilter,
  publicNonDraftRecordFilter,
};
