import { describe, expect, it } from "vitest";
import { camelCase, modelName, singular, sqlIdent, toPrisma, toSql, type ErdSchema } from "./erd-export";

const blog: ErdSchema = {
  tables: [
    {
      name: "users",
      columns: [
        { name: "id", type: "uuid", pk: true, fk: false },
        { name: "email", type: "text", pk: false, fk: false },
        { name: "created_at", type: "timestamp", pk: false, fk: false },
      ],
    },
    {
      name: "posts",
      columns: [
        { name: "id", type: "uuid", pk: true, fk: false },
        { name: "author_id", type: "uuid", pk: false, fk: true },
        { name: "title", type: "text", pk: false, fk: false },
        { name: "published", type: "boolean", pk: false, fk: false },
      ],
    },
  ],
  relations: [{ fromTable: "posts", fromColumn: "author_id", toTable: "users", toColumn: "id" }],
};

describe("naming helpers", () => {
  it("converts names", () => {
    expect(camelCase("author_id")).toBe("authorId");
    expect(camelCase("createdAt")).toBe("createdAt");
    expect(modelName("order_items")).toBe("OrderItem");
    expect(modelName("categories")).toBe("Category");
    expect(singular("status")).toBe("status");
    expect(singular("addresses")).toBe("address");
    expect(singular("statuses")).toBe("status");
    expect(singular("boxes")).toBe("box");
  });

  it("quotes only identifiers that need it", () => {
    expect(sqlIdent("posts")).toBe("posts");
    expect(sqlIdent("user")).toBe('"user"');
    expect(sqlIdent("Order Items")).toBe('"Order Items"');
  });
});

describe("toSql", () => {
  it("creates tables, then adds foreign keys", () => {
    const sql = toSql(blog);
    expect(sql).toContain("CREATE TABLE users (\n  id uuid PRIMARY KEY,\n  email text,\n  created_at timestamp\n);");
    expect(sql).toContain(
      "ALTER TABLE posts\n  ADD CONSTRAINT fk_posts_author_id\n  FOREIGN KEY (author_id) REFERENCES users (id);"
    );
    expect(sql.indexOf("ALTER TABLE")).toBeGreaterThan(sql.lastIndexOf("CREATE TABLE"));
  });

  it("writes a composite primary key as a table constraint", () => {
    const sql = toSql({
      tables: [
        {
          name: "post_tags",
          columns: [
            { name: "post_id", type: "uuid", pk: true, fk: true },
            { name: "tag_id", type: "uuid", pk: true, fk: true },
          ],
        },
      ],
      relations: [],
    });
    expect(sql).toContain("PRIMARY KEY (post_id, tag_id)");
    expect(sql).not.toContain("uuid PRIMARY KEY");
  });

  it("says so when there are no tables", () => {
    expect(toSql({ tables: [], relations: [] })).toMatch(/No tables/);
  });
});

describe("toPrisma", () => {
  it("maps tables to models with relations on both sides", () => {
    const prisma = toPrisma(blog);
    expect(prisma).toContain("model User {");
    expect(prisma).toContain('@@map("users")');
    expect(prisma).toMatch(/id\s+String @id @default\(uuid\(\)\) @db\.Uuid/);
    expect(prisma).toMatch(/createdAt\s+DateTime @default\(now\(\)\) @map\("created_at"\)/);
    expect(prisma).toMatch(/author\s+User @relation\(fields: \[authorId\], references: \[id\]\)/);
    expect(prisma).toMatch(/posts\s+Post\[\]/);
  });

  it("names relations when two point at the same table", () => {
    const prisma = toPrisma({
      tables: [
        { name: "users", columns: [{ name: "id", type: "int", pk: true, fk: false }] },
        {
          name: "messages",
          columns: [
            { name: "id", type: "int", pk: true, fk: false },
            { name: "sender_id", type: "int", pk: false, fk: true },
            { name: "recipient_id", type: "int", pk: false, fk: true },
          ],
        },
      ],
      relations: [
        { fromTable: "messages", fromColumn: "sender_id", toTable: "users", toColumn: "id" },
        { fromTable: "messages", fromColumn: "recipient_id", toTable: "users", toColumn: "id" },
      ],
    });
    expect(prisma).toContain('@relation("MessageSender", fields: [senderId], references: [id])');
    expect(prisma).toContain('@relation("MessageRecipient", fields: [recipientId], references: [id])');
    expect(prisma).toMatch(/senderMessages\s+Message\[\] @relation\("MessageSender"\)/);
  });

  it("handles a table that references itself", () => {
    const prisma = toPrisma({
      tables: [
        {
          name: "employees",
          columns: [
            { name: "id", type: "int", pk: true, fk: false },
            { name: "manager_id", type: "int", pk: false, fk: true },
          ],
        },
      ],
      relations: [{ fromTable: "employees", fromColumn: "manager_id", toTable: "employees", toColumn: "id" }],
    });
    expect(prisma).toMatch(/manager\s+Employee @relation\("EmployeeManager", fields: \[managerId\], references: \[id\]\)/);
    expect(prisma).toMatch(/managerEmployees\s+Employee\[\] @relation\("EmployeeManager"\)/);
  });

  it("skips relations to columns that don't exist", () => {
    const prisma = toPrisma({
      ...blog,
      relations: [{ fromTable: "posts", fromColumn: "editor_id", toTable: "users", toColumn: "id" }],
    });
    expect(prisma).not.toContain("@relation");
  });

  it("flags a table without a primary key", () => {
    const prisma = toPrisma({
      tables: [{ name: "logs", columns: [{ name: "message", type: "text", pk: false, fk: false }] }],
      relations: [],
    });
    expect(prisma).toMatch(/needs a primary key/);
  });
});
