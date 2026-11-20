const paths = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  book: 'M12 6a8 8 0 0 0-9-2v14a8 8 0 0 1 9 2 8 8 0 0 1 9-2V4a8 8 0 0 0-9 2Zm0 0v14',
  match: 'M12 2l2.6 6 6.4.6-4.8 4.3 1.4 6.3-5.6-3.3-5.6 3.3 1.4-6.3L3 8.6 9.4 8 12 2Z',
  chart: 'M4 20h16M7 16v-4m5 4V7m5 9V4',
  teach: 'M3 4h18v12H3zM8 21l4-5 4 5M7 8h7m-7 4h4',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  back: 'M20 12H5m6-6-6 6 6 6',
  retry: 'M4 11a8 8 0 1 1 2 6M4 5v6h6',
  camera: 'M3 6h12v12H3zM15 10l6-4v12l-6-4',
  sound: 'M3 9h4l5-4v14l-5-4H3zM16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12',
  mute: 'M3 9h4l5-4v14l-5-4H3zM16 10l5 5m0-5-5 5',
  trophy: 'M8 3h8v9a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 4v5m-4 0h8',
  flame: 'M13 2c1 7 7 7 7 13a8 8 0 0 1-16 0c0-3 2-6 4-8 0 4 2 4 2 4 2-2 3-5 3-9Z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4m-4 4v2',
  spark: 'M12 2l2.4 5 5 2.4-5 2.4-2.4 5-2.4-5-5-2.4 5-2.4 2.4-5Z',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
