// Shared (client-safe) geography types — no server imports.
export type GeoPath = {
  state?: { id: string; name: string } | null;
  district?: { id: string; name: string; latitude: number | null; longitude: number | null } | null;
  localBody?: { id: string; name: string; type: string; subDistrict: string | null } | null;
  ward?: { id: string; number: number; name: string } | null;
};

export const LOCAL_BODY_TYPE_LABEL: Record<string, string> = {
  GRAM_PANCHAYAT: "Gram Panchayat",
  MUNICIPALITY: "Municipality",
  MUNICIPAL_CORPORATION: "Municipal Corporation",
  NAGAR_PANCHAYAT: "Nagar Panchayat",
  MANDAL: "Mandal",
};

/** Approximate centre of Andhra Pradesh, for maps before a place is chosen. */
export const AP_CENTER = { lat: 15.9, lng: 80.6 };
export const AP_BOUNDS: [[number, number], [number, number]] = [[12.6, 76.7], [19.25, 84.85]];
