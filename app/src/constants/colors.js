// All colors used across the app — never hardcode hex strings in components.
// Import from here: import { Colors } from '../constants/colors';

export const Colors = {
  primary:     '#7C4A2D',              // brown — buttons, active states, headers
  accent:      '#D4A853',              // gold — CTAs, price tags, highlights, FAB
  background:  '#FAF6F0',              // cream — all screen backgrounds
  surface:     '#FFFFFF',              // white — cards, modals, inputs
  textPrimary: '#1A1108',              // near-black — all primary text
  textMuted:   '#9A8070',              // muted brown — labels, placeholders, secondary
  border:      '#E8DDD4',              // light brown — input borders, dividers
  success:     '#4CAF82',              // green — confirmed, completed
  error:       '#E05252',              // red — cancelled, disputes, errors
  warning:     '#F0A500',              // amber — pending, en_route
  info:        '#4A90D9',              // blue — en_route badge
  shadow:      'rgba(124, 74, 45, 0.08)',  // warm shadow for all elevations
  overlay:     'rgba(26, 17, 8, 0.45)',    // dark overlay for modals/sheets
};

// Status → color mapping (badge background tints and text)
export const StatusColors = {
  pending:      { bg: '#FFF8E6', text: Colors.warning },
  pending_bids: { bg: '#FFF8E6', text: Colors.warning },
  bid_selected: { bg: '#E6F4FF', text: Colors.info },
  confirmed:    { bg: '#E8F7F0', text: Colors.success },
  en_route:     { bg: '#E6F4FF', text: Colors.info },
  in_progress:  { bg: '#E6F4FF', text: Colors.info },
  completed:    { bg: '#F0F0F0', text: '#6B6B6B' },
  cancelled:    { bg: '#FEECEC', text: Colors.error },
  timed_out:    { bg: '#F0F0F0', text: '#6B6B6B' },
};
