import type { Database, Json } from './database.types';

/**
 * Database row helpers.
 *
 * The generated types in database.types.ts are the source of truth for every
 * column in the schema. Nothing in this file restates a column — it exists so
 * that reading a row does not require an `any`, and so that the one place a
 * cast is genuinely unavoidable is named rather than scattered.
 */

export type { Json };

/** A table's `Row` type, by table name. */
export type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/**
 * Read a `jsonb` column back as the shape it was written with.
 *
 * This is an unchecked cast and deliberately so. Postgres cannot type a `jsonb`
 * column beyond `Json`, and every blob this is used on is written by this
 * codebase — the party, the cost breakdown, a travel leg, a normalised image
 * credit. Anything that ever came from a person is validated with Zod *before*
 * it is stored, which is where that check belongs: once per write rather than
 * once per read, on a path a public trip page sits on.
 *
 * The rule this encodes: if you find yourself reaching for this on a blob a
 * user can put arbitrary content into, validate it at the write instead.
 */
export function jsonAs<T>(value: Json | null | undefined): T | null {
  return (value ?? null) as T | null;
}
