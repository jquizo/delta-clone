/** Minimal RFC 4180-style CSV encode/decode — quoting only where a field needs it. */

function fieldNeedsQuoting(field: string): boolean {
  return field.includes(',') || field.includes('"') || field.includes('\n');
}

function quoteField(field: string): string {
  return `"${field.replace(/"/g, '""')}"`;
}

export function stringifyCsv(rows: string[][]): string {
  return rows.map((row) => row.map((field) => (fieldNeedsQuoting(field) ? quoteField(field) : field)).join(',')).join('\n');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    if (char === '\r') {
      i++;
      continue;
    }

    field += char;
    i++;
  }

  // Flush the final field/row unless the text ended cleanly on a newline already flushed above.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
