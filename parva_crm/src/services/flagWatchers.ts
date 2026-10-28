/**
 * Everyone who must be told about every flag raised in the company:
 * the Super Admin(s) and the Lead Acquisition Manager(s). People who already
 * get a more specific alert (e.g. the flagged employee) can be excluded.
 */
export function getFlagWatcherIds(
  employees: Array<{ id: string; role: string; status?: string }>,
  excludeIds: Array<string | undefined> = []
): string[] {
  const skip = new Set(excludeIds.filter((id): id is string => !!id))
  return employees
    .filter(
      (e) =>
        (e.status === undefined || e.status === 'active') &&
        (e.role === 'admin' || e.role === 'acquisition_manager') &&
        !skip.has(e.id)
    )
    .map((e) => e.id)
}
