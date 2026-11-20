// Matching mandal names from boundary datasets to LGD sub-district names.
// Handles Telugu transliteration variants, abbreviations ("A.Konduru"), renamed places,
// numbered duplicates ("Gudur2") and cities LGD splits into several mandals. Pure module.

export type SubDistrict = { lgdCode: string; name: string; districtCode: string };
export type MandalMatch = { codes: string[]; method: "exact" | "position" | "split" | "alias" | "abbreviation" | "spelling" | null };

const letters = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");

/** Phonetic key for Telugu place names in Latin script (Kaikalur ≈ Kaikaluru, Laxmi ≈ Lakshmi, Thallarevu ≈ Tallarevu). */
export function phon(s: string): string {
  let t = letters(s);
  for (const [a, b] of [["ksh", "x"], ["ks", "x"], ["th", "t"], ["dh", "d"], ["bh", "b"], ["ph", "p"], ["kh", "k"], ["gh", "g"], ["ch", "c"], ["sh", "s"], ["ee", "i"], ["oo", "u"], ["w", "v"], ["y", "i"], ["z", "j"], ["q", "k"]] as const) t = t.split(a).join(b);
  t = t.replace(/(.)\1+/g, "$1").replace(/aa/g, "a");
  return t.replace(/[aeiou]+$/, "");
}

const PART = /\b(rural|urban|fully urban|east|west|north|south|central|r|u)\b/;
/** Split "Visakhapatnam(U)" / "Guntur East" / "Gudur2" / "X H/O Y" into a base name and a part. */
export function splitName(raw: string): { base: string; part: "rural" | "urban" | null } {
  let s = raw.toLowerCase().replace(/\bh\/o\b.*$/, "").replace(/[()]/g, " ").replace(/[-_]?\d+\b/g, " ").replace(/\s+/g, " ").trim();
  let part: "rural" | "urban" | null = null;
  const m = s.match(new RegExp(`${PART.source}\\s*$`));
  if (m) {
    const p = m[1];
    part = p === "rural" || p === "r" ? "rural" : "urban";
    s = s.slice(0, m.index).trim();
  }
  return { base: s, part };
}

/** Renamed places and city mandals LGD names differently from older boundary files. */
export const MANDAL_ALIASES: Record<string, string[]> = {
  "Rajahmundry": ["Rajamahendravaram"],
  "Vayalpad": ["Valmikipuram"],
  "Markapur": ["Markapuram"],
  "Cuddapah": ["Kadapa"],
  "Visakhapatnam (Urban)": ["Seethammadhara", "Gopalapatnam", "Maharanipeta", "Mulagada"],
};

function abbreviationMatches(src: string, lgd: string): boolean {
  const a = src.toLowerCase().split(/[^a-z]+/).filter(Boolean), b = lgd.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const fits = (short: string[], long: string[]) => {
    if (short.length < 2 || short.length !== long.length) return false;
    const last = phon(short[short.length - 1]) === phon(long[long.length - 1]);
    return last && short.slice(0, -1).every((t, i) => t.length <= 2 && long[i].startsWith(t[0]));
  };
  if (fits(a, b) || fits(b, a)) return true;
  // "Janakavarampanguluru" ≈ "J.Pangulur": one long word = initials + final word
  const oneWord = (whole: string[], parts: string[]) => whole.length === 1 && parts.length >= 2 && parts.slice(0, -1).every((t) => t.length <= 2)
    && phon(whole[0]).startsWith(parts[0][0]) && phon(whole[0]).endsWith(phon(parts[parts.length - 1]));
  return oneWord(a, b) || oneWord(b, a);
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
  return d[b.length];
}

/**
 * Match one boundary-file mandal name to LGD sub-district(s).
 * `prefer(candidates)` breaks ties by geography (e.g. the district the shape lies in, or nearest headquarters).
 */
export function matchMandal(raw: string, subs: SubDistrict[], prefer: (c: SubDistrict[]) => SubDistrict | undefined, hintDistrict?: string | null): MandalMatch {
  const pick = (c: SubDistrict[], method: MandalMatch["method"]): MandalMatch | null => {
    if (c.length === 1) return { codes: [c[0].lgdCode], method };
    if (c.length > 1) { const p = prefer(c); if (p) return { codes: [p.lgdCode], method: method === "exact" ? "position" : method }; }
    return null;
  };
  const key = letters(raw);
  const { base, part } = splitName(raw);
  const pb = phon(base);
  const tolerance = (n: number) => (n >= 8 ? 2 : 1);
  // Two different mandals can share a name ("Rompicherla1"/"Rompicherla2"): when the exact match lies in
  // another district than the shape itself, prefer a close spelling inside the shape's own district.
  const local = hintDistrict ? subs.filter((s) => s.districtCode === hintDistrict) : [];
  const localNear = () => local.map((s) => ({ s, d: lev(phon(splitName(s.name).base), pb) })).filter((x) => x.d <= tolerance(pb.length)).sort((a, b) => a.d - b.d)[0]?.s;
  const exactAll = subs.filter((s) => letters(s.name) === key);
  if (exactAll.length && hintDistrict && !exactAll.some((s) => s.districtCode === hintDistrict)) {
    const ln = localNear();
    if (ln) return { codes: [ln.lgdCode], method: "position" };
  }
  const exact = pick(exactAll, "exact");
  if (exact) return exact;
  // Renamed places / city mandals with different names
  const aliasKey = Object.keys(MANDAL_ALIASES).find((k) => { const a = splitName(k); return phon(a.base) === pb && (a.part == null || a.part === part); });
  const alias = aliasKey ? MANDAL_ALIASES[aliasKey] : undefined;
  if (alias) {
    const names = alias.map((a) => letters(a));
    const c = subs.filter((s) => { const sp = splitName(s.name); return names.includes(letters(s.name)) || (names.includes(letters(sp.base)) && (part == null || sp.part == null || sp.part === part)); });
    if (c.length) return { codes: c.map((s) => s.lgdCode), method: "alias" };
  }
  // Same place, LGD splits it (Kurnool → Kurnool Rural + Kurnool Urban; Vijayawada (Urban) → Central/East/North/West)
  const sameBase = subs.filter((s) => phon(splitName(s.name).base) === pb || phon(s.name.replace(/\s+(east|west|north|south|central)$/i, "")) === pb);
  if (sameBase.length) {
    const byPart = part ? sameBase.filter((s) => { const sp = splitName(s.name); return sp.part === part || (part === "urban" && /\b(east|west|north|south|central)$/i.test(s.name)); }) : sameBase;
    const group = byPart.length ? byPart : sameBase;
    const districts = new Set(group.map((s) => s.districtCode));
    if (districts.size === 1) return { codes: group.map((s) => s.lgdCode), method: group.length > 1 ? "split" : "spelling" };
    const p = prefer(group);
    if (p) { const g = group.filter((s) => s.districtCode === p.districtCode); return { codes: g.map((s) => s.lgdCode), method: g.length > 1 ? "split" : "position" }; }
  }
  const abbr = pick(subs.filter((s) => abbreviationMatches(raw, s.name)), "abbreviation");
  if (abbr) return abbr;
  // Closest spelling: same district first, then a unique near-identical name statewide
  const scored = subs.map((s) => ({ s, d: lev(phon(splitName(s.name).base), pb) })).sort((a, b) => a.d - b.d);
  const near = scored.filter((x) => x.d <= tolerance(pb.length));
  if (near.length) {
    const local = prefer(near.map((x) => x.s));
    if (local && near.find((x) => x.s === local)!.d === near[0].d) return { codes: [local.lgdCode], method: "spelling" };
    if (near.length === 1 || near[0].d < near[1].d) return { codes: [near[0].s.lgdCode], method: "spelling" };
  }
  return { codes: [], method: null };
}
