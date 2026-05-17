// Spacing system — always use these values, never raw numbers in components.

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// Layout constants
export const Layout = {
  screenHorizontalPadding: 16,   // Spacing.md — applied to all screen sides
  cardPadding:             16,   // Card internal padding (all sides)
  listItemGap:              8,   // Spacing.sm — between list items
  sectionGap:              24,   // Spacing.lg — between page sections
  borderRadius: {
    sm:  6,    // status badges
    md:  10,   // inputs
    lg:  12,   // cards
    xl:  14,   // primary buttons
    xxl: 20,   // bottom sheet corners
  },
  buttonHeight:  52,   // all buttons
  inputHeight:   52,   // all text inputs
  tabBarHeight:  60,
};

// Card shadow — apply to any white card surface
export const CardShadow = {
  shadowColor:   'rgba(124, 74, 45, 0.08)',
  shadowOffset:  { width: 0, height: 2 },
  shadowOpacity: 1,
  shadowRadius:  8,
  elevation:     3,
};
