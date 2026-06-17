export const environment = {
  production: false,
  staging: false,
  apiUrl: 'http://localhost:3000/api/trivia',
  appName: 'Practical Machinist Trivia',
  useMockApi: false,
  // Public game URL the booth QR code points to (spec §8.3).
  playUrl: 'https://practicalmachinist.com/trivia',
  // QR image endpoint; `{data}`/`{size}` placeholders are substituted at render time.
  qrApiUrl: 'https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={data}',
};
