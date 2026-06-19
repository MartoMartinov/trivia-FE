export const environment = {
  production: false,
  staging: true,
  // apiUrl: 'https://backend-mock-fawn.vercel.app/api/trivia/en',
  apiUrl: 'https://backend.pm.trivia.kipo.work/api/trivia/en',
  appName: 'Practical Machinist Trivia',
  useMockApi: false,
  // Public game URL the booth QR code points to (spec §8.3).
  playUrl: 'https://staging.practicalmachinist.com/trivia',
  // QR image endpoint; `{data}`/`{size}` placeholders are substituted at render time.
  qrApiUrl: 'https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={data}',
};
