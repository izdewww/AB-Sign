module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'ab-sign',
    ignore: (path) => Boolean(path) && !/^\/(dist(?:-electron)?|node_modules)(?:\/|$)|^\/package\.json$/.test(path),
  },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['win32'] }],
};
