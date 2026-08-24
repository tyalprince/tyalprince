export type ImportedRow = {
  siteName: string;
  siteUrl: string;
  username: string;
  password: string;
  notes: string;
};

/** Minimal RFC 4180 CSV parser (handles quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0);
}

// Chrome/Edge/Brave: name,url,username,password[,note]
// Firefox:           url,username,password,httpRealm,formActionOrigin,guid,...
// Apple/Safari/Keychain: Title,URL,Username,Password,Notes[,OTPAuth]
const HEADER_ALIASES: Record<string, keyof ImportedRow> = {
  name: "siteName",
  title: "siteName",
  url: "siteUrl",
  login_uri: "siteUrl",
  username: "username",
  login_username: "username",
  password: "password",
  login_password: "password",
  note: "notes",
  notes: "notes",
};

export function parseCredentialCsv(text: string): ImportedRow[] {
  const rows = parseCsv(text.trim());
  if (rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  const columns = headerRow.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);

  return dataRows
    .map((row) => {
      const entry: ImportedRow = { siteName: "", siteUrl: "", username: "", password: "", notes: "" };
      columns.forEach((key, i) => {
        if (key) entry[key] = (row[i] ?? "").trim();
      });
      if (!entry.siteName) {
        entry.siteName = entry.siteUrl.replace(/^https?:\/\//, "").split("/")[0] || "Imported";
      }
      return entry;
    })
    .filter((e) => e.siteName || e.username || e.password);
}
