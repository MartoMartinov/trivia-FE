export interface AppConfigSlice {
  eventLogoUrl: string | null;
}

export const initialAppConfigSlice: AppConfigSlice = {
  eventLogoUrl: null,
};
