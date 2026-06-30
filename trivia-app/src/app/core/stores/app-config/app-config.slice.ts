export interface AppConfigSlice {
  eventLogoUrl: string | null;
  /** Combined app + event logo for the booth/TV display. */
  tvLogoUrl: string | null;
}

export const initialAppConfigSlice: AppConfigSlice = {
  eventLogoUrl: null,
  tvLogoUrl: null,
};
