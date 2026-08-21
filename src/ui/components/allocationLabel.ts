// Slice labels come from the domain layer as provider-neutral instrument ids
// ('NYSE:BMA'), which groupAllocation also uses as its aggregation key — so
// the exchange prefix is stripped here for display only, never upstream,
// to avoid silently merging same-ticker instruments from different exchanges.
export function displayLabel(label: string): string {
  const colonIndex = label.indexOf(':');
  return colonIndex === -1 ? label : label.slice(colonIndex + 1);
}
