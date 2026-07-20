export interface AppConfigSlice {
  eventLogoUrl: string | null;
  /** Combined app + event logo for the booth/TV display. */
  tvLogoUrl: string | null;
  /** Register/landing hero headline (admin-editable). Null → use bundled fallback copy. */
  landingHeadline: string | null;
  /** Register/landing hero body copy (admin-editable). Null → use bundled fallback copy. */
  landingBody: string | null;
}

export const initialAppConfigSlice: AppConfigSlice = {
  eventLogoUrl: null,
  tvLogoUrl: null,
  landingHeadline: null,
  landingBody: null,
};
