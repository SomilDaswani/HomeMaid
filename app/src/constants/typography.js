// Typography — Poppins via @expo-google-fonts/poppins
// Load fonts in App.js using useFonts before rendering

export const FontFamily = {
  regular:    'Poppins_400Regular',
  medium:     'Poppins_500Medium',
  semiBold:   'Poppins_600SemiBold',
  bold:       'Poppins_700Bold',
};

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  26,
  hero: 34,
};

// Line heights — 1.5× for body, 1.2× for headings
export const LineHeight = {
  xs:   Math.round(11 * 1.5),   // 17
  sm:   Math.round(13 * 1.5),   // 20
  md:   Math.round(15 * 1.5),   // 23
  lg:   Math.round(17 * 1.5),   // 26
  xl:   Math.round(20 * 1.2),   // 24
  xxl:  Math.round(26 * 1.2),   // 31
  hero: Math.round(34 * 1.2),   // 41
};
