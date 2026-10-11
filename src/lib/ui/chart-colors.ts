// Categorical slots in the validated dark-surface order (adjacent pairs pass the CVD and normal-vision checks); labels always accompany color.
export const PIE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"] as const;
export const OTHER_COLOR = "#7b8190";

export interface Slice {
  name: string;
  value: number;
}

// Keeps the largest `keep` slices and folds the rest into one neutral "Other" slice; zero-value slices are dropped.
export function topWithOther(items: Slice[], keep: number = PIE_COLORS.length, otherLabel = "Other"): (Slice & { color: string })[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, keep).map((s, i) => ({ ...s, color: PIE_COLORS[i] }));
  const rest = sorted.slice(keep).reduce((n, s) => n + s.value, 0);
  return rest > 0 ? [...head, { name: otherLabel, value: rest, color: OTHER_COLOR }] : head;
}
