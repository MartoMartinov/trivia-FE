export const environment = {
  production: true,
  staging: false,
  apiUrl: 'https://practicalmachinist.com/api/en',
  appName: 'Practical Machinist Trivia',
  useMockApi: false,
  // Public game URL the booth QR code points to (spec §8.3).
  playUrl: 'https://practicalmachinist.com/trivia',
  // QR image endpoint; `{data}`/`{size}` placeholders are substituted at render time.
  qrApiUrl: 'https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={data}',
};
