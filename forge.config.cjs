module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'src/renderer/public/ab-sign.ico',
    executableName: 'ab-sign',
    extraResource: ['docs/THIRD_PARTY.md'],
    ignore: (path) => Boolean(path) && !/^\/(dist(?:-electron)?|node_modules)(?:\/|$)|^\/package\.json$/.test(path),
  },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['win32'] }],
};
