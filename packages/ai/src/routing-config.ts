/**
 * packages/ai/src/routing-config.ts — T-019 C4. A tiny (<=60 LOC) hand-rolled parser for
 * `config/ai-routing.yaml`'s flat `key: [a, b, c]` shape. No YAML dependency exists anywhere in
 * this workspace yet (checked: no package.json under packages/ or sources/whatsapp_msg lists
 * `yaml`/`js-yaml`); this shape is simple enough that a real parser would be more machinery than
 * the format needs. One definition — `router.ts` and tests both import this, nothing re-parses.
 */

/** Parses `jobKind: [provider, provider, ...]` lines into an ordered-chain map. */
export function parseRoutingYaml(text: string): Record<string, string[]> {
  const chains: Record<string, string[]> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = /^([A-Za-z0-9_-]+):\s*\[(.*)\]\s*$/.exec(line);
    if (!match) continue;

    const [, key, itemsRaw] = match;
    const items = (itemsRaw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (key) chains[key] = items;
  }

  return chains;
}
