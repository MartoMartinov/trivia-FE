export interface BoothTokenSlice {
  /** Durable, admin-issued kiosk token (see register page) — kept in memory so any
   *  in-app link/redirect to /register can carry it forward without a URL round-trip. */
  boothToken: string | null;
}

export const initialBoothTokenSlice: BoothTokenSlice = {
  boothToken: null,
};
