module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo agrega automáticamente react-native-worklets/plugin (Reanimated 4).
    presets: ['babel-preset-expo'],
  };
};
