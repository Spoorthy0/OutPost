// Turns the ERD tables on the canvas into code: PostgreSQL DDL or a Prisma schema. The generators
// are pure functions of an ErdSchema; readErdSchema (lib/erd-export-editor.ts) builds one from the
// live editor.

export type ErdColumn = { name: string; type: string; pk: boolean; fk: boolean };
export type ErdTable = { name: string; columns: ErdColumn[] };
// fromTable.fromColumn references toTable.toColumn (the foreign key lives on the "from" side).
export type ErdRelation = { fromTable: string; fromColumn: string; toTable: string; toColumn: string };
export type ErdSchema = { tables: ErdTable[]; relations: ErdRelation[] };

// ─── SQL ─────────────────────────────────────────────────────────────────────────────────────────

const RESERVED = new Set([
  "all", "and", "as", "check", "column", "constraint", "default", "desc", "from", "group", "in",
  "index", "key", "limit", "not", "null", "or", "order", "primary", "references", "select", "table",
  "to", "union", "unique", "user", "where", "with",
]);

// Plain snake_case names stay bare; anything else (spaces, capitals, reserved words) is quoted.
export function sqlIdent(name: string) {
  return /^[a-z_][a-z0-9_]*$/.test(name) && !RESERVED.has(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function sqlType(type: string) {
  return type.trim() || "text";
}

export function toSql(schema: ErdSchema): string {
  if (schema.tables.length === 0) return "-- No tables on the canvas yet.\n";

  const statements = schema.tables.map((table) => {
    const pks = table.columns.filter((c) => c.pk);
    const lines = table.columns.map((column) => {
      const inlinePk = column.pk && pks.length === 1 ? " PRIMARY KEY" : column.pk ? " NOT NULL" : "";
      return `  ${sqlIdent(column.name)} ${sqlType(column.type)}${inlinePk}`;
    });
    if (pks.length > 1) lines.push(`  PRIMARY KEY (${pks.map((c) => sqlIdent(c.name)).join(", ")})`);
    return `CREATE TABLE ${sqlIdent(table.name)} (\n${lines.join(",\n")}\n);`;
  });

  // Foreign keys come last, so tables can be created in any order (and reference each other).
  const foreignKeys = schema.relations.map(
    (r) =>
      `ALTER TABLE ${sqlIdent(r.fromTable)}\n  ADD CONSTRAINT ${sqlIdent(`fk_${r.fromTable}_${r.fromColumn}`)}\n` +
      `  FOREIGN KEY (${sqlIdent(r.fromColumn)}) REFERENCES ${sqlIdent(r.toTable)} (${sqlIdent(r.toColumn)});`
  );

  return [...statements, ...foreignKeys].join("\n\n") + "\n";
}

// ─── Prisma ──────────────────────────────────────────────────────────────────────────────────────

const words = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

// users → users, user_id → userId
export function camelCase(name: string) {
  const [first = "field", ...rest] = words(name);
  const result = first + rest.map(capitalize).join("");
  return /^[0-9]/.test(result) ? `_${result}` : result;
}

// A rough singular, good enough for table names: categories → category, users → user.
export function singular(word: string) {
  if (/ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/(ss|us|is)$/.test(word)) return word;
  if (/(x|ch|sh|ss|tus)es$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

// order_items → OrderItem
export function modelName(table: string) {
  const parts = words(table);
  if (parts.length === 0) return "Model";
  parts[parts.length - 1] = singular(parts[parts.length - 1]);
  const result = parts.map(capitalize).join("");
  return /^[0-9]/.test(result) ? `M${result}` : result;
}

function prismaType(type: string): { type: string; native?: string } {
  const t = type.trim().toLowerCase();
  if (/^uuid/.test(t)) return { type: "String", native: "@db.Uuid" };
  if (/^(big ?int|int8|bigserial)/.test(t)) return { type: "BigInt" };
  if (/^(int|integer|int4|smallint|int2|serial)/.test(t)) return { type: "Int" };
  if (/^(decimal|numeric|money)/.test(t)) return { type: "Decimal" };
  if (/^(float|double|real)/.test(t)) return { type: "Float" };
  if (/^(bool)/.test(t)) return { type: "Boolean" };
  if (/^(timestamp|datetime|date|time)/.test(t)) return { type: "DateTime" };
  if (/^json/.test(t)) return { type: "Json" };
  if (/^(bytea|blob|binary)/.test(t)) return { type: "Bytes" };
  return { type: "String" };
}

// The name of the relation field on the model that holds the foreign key: author_id → author.
function relationFieldName(fromColumn: string, target: string) {
  const stripped = fromColumn.replace(/(_id|Id|_uuid|_fk)$/, "");
  return stripped && stripped !== fromColumn ? camelCase(stripped) : camelCase(target);
}

function uniqueName(taken: Set<string>, name: string) {
  let candidate = name;
  for (let i = 2; taken.has(candidate); i++) candidate = `${name}${i}`;
  taken.add(candidate);
  return candidate;
}

export function toPrisma(schema: ErdSchema): string {
  const header = `generator client {\n  provider = "prisma-client"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n`;
  if (schema.tables.length === 0) return `${header}\n// No tables on the canvas yet.\n`;

  const byName = new Map(schema.tables.map((t) => [t.name.toLowerCase(), t]));
  const models = new Map<string, string>();
  const takenModels = new Set<string>();
  for (const table of schema.tables) models.set(table.name.toLowerCase(), uniqueName(takenModels, modelName(table.name)));

  type Line = { name: string; rest: string };
  const fieldLines = new Map<string, Line[]>(schema.tables.map((t) => [t.name.toLowerCase(), []]));
  const fieldNames = new Map<string, Set<string>>(schema.tables.map((t) => [t.name.toLowerCase(), new Set()]));

  // Scalar columns.
  for (const table of schema.tables) {
    const key = table.name.toLowerCase();
    const pks = table.columns.filter((c) => c.pk);
    for (const column of table.columns) {
      const name = uniqueName(fieldNames.get(key)!, camelCase(column.name));
      const { type, native } = prismaType(column.type);
      const attrs: string[] = [];
      if (column.pk && pks.length === 1) {
        attrs.push("@id");
        if (type === "String" && native === "@db.Uuid") attrs.push("@default(uuid())");
        else if (type === "Int" && /serial|auto/i.test(column.type)) attrs.push("@default(autoincrement())");
      }
      if (/^created_?at$/i.test(column.name) && type === "DateTime") attrs.push("@default(now())");
      if (/^updated_?at$/i.test(column.name) && type === "DateTime") attrs.push("@updatedAt");
      if (name !== column.name) attrs.push(`@map("${column.name}")`);
      if (native) attrs.push(native);
      fieldLines.get(key)!.push({ name, rest: [type, ...attrs].join(" ") });
    }
  }

  // Relations. Two relations between the same pair of tables (or a table pointing at itself) need
  // a name so Prisma can tell which sides belong together.
  const valid = schema.relations.filter((r) => {
    const from = byName.get(r.fromTable.toLowerCase());
    const to = byName.get(r.toTable.toLowerCase());
    return (
      from?.columns.some((c) => c.name.toLowerCase() === r.fromColumn.toLowerCase()) &&
      to?.columns.some((c) => c.name.toLowerCase() === r.toColumn.toLowerCase())
    );
  });
  const pairKey = (r: ErdRelation) => [r.fromTable.toLowerCase(), r.toTable.toLowerCase()].sort().join("|");
  const pairCount = new Map<string, number>();
  for (const r of valid) pairCount.set(pairKey(r), (pairCount.get(pairKey(r)) ?? 0) + 1);

  for (const r of valid) {
    const fromKey = r.fromTable.toLowerCase();
    const toKey = r.toTable.toLowerCase();
    const fromModel = models.get(fromKey)!;
    const toModel = models.get(toKey)!;
    const fromColumns = byName.get(fromKey)!.columns;
    const toColumns = byName.get(toKey)!.columns;
    const fkField = camelCase(fromColumns.find((c) => c.name.toLowerCase() === r.fromColumn.toLowerCase())!.name);
    const refField = camelCase(toColumns.find((c) => c.name.toLowerCase() === r.toColumn.toLowerCase())!.name);

    const forward = uniqueName(fieldNames.get(fromKey)!, relationFieldName(r.fromColumn, toModel));
    const named = (pairCount.get(pairKey(r)) ?? 0) > 1 || fromKey === toKey;
    const relationName = named ? `"${fromModel}${capitalize(forward)}"` : "";
    const back = uniqueName(fieldNames.get(toKey)!, camelCase(named ? `${forward} ${r.fromTable}` : r.fromTable));

    fieldLines.get(fromKey)!.push({
      name: forward,
      rest: `${toModel} @relation(${relationName ? `${relationName}, ` : ""}fields: [${fkField}], references: [${refField}])`,
    });
    fieldLines.get(toKey)!.push({ name: back, rest: `${fromModel}[]${relationName ? ` @relation(${relationName})` : ""}` });
  }

  const blocks = schema.tables.map((table) => {
    const key = table.name.toLowerCase();
    const lines = fieldLines.get(key)!;
    const width = Math.max(...lines.map((l) => l.name.length), 1);
    const body = lines.map((l) => `  ${l.name.padEnd(width)} ${l.rest}`);
    const pks = table.columns.filter((c) => c.pk);
    const extra: string[] = [];
    if (pks.length > 1) extra.push(`  @@id([${pks.map((c) => camelCase(c.name)).join(", ")}])`);
    if (models.get(key) !== table.name) extra.push(`  @@map("${table.name}")`);
    const warning = pks.length === 0 ? "// Prisma needs a primary key: mark one column as PK on the canvas.\n" : "";
    return `${warning}model ${models.get(key)} {\n${body.join("\n")}${extra.length ? `\n\n${extra.join("\n")}` : ""}\n}`;
  });

  return `${header}\n${blocks.join("\n\n")}\n`;
}
