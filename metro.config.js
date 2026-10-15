// Metro: тексти (Біблія, молитвослов, календар) — кирилиця. Типовий мініфікатор записує кожну літеру як \uXXXX
// (6 байтів замість 2), через що збірка втричі більша; зберігаємо UTF-8 як є.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  output: { ...config.transformer.minifierConfig?.output, ascii_only: false },
};

module.exports = config;
