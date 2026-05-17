// Canonical state machine for HomeMaid.
// Any PATCH that violates these transitions returns HTTP 409 CONFLICT.
// See implicit_assumptions.md Section 4 for full specification.

const VALID_TRANSITIONS = {
  quick_service: {
    pending_bids: ['bid_selected', 'cancelled', 'timed_out'],
    bid_selected: ['en_route'],
    en_route:     ['in_progress'],
    in_progress:  ['completed'],
    // completed, cancelled, timed_out → terminal (no entry = no valid transitions)
  },
  booking: {
    pending:    ['confirmed', 'cancelled'],
    confirmed:  ['en_route', 'cancelled'],
    en_route:   ['in_progress'],
    in_progress: ['completed'],
    // completed, cancelled → terminal
  },
};

/**
 * Returns true if the transition current → next is valid for the given flow type.
 * Any invalid transition should return HTTP 409 CONFLICT.
 */
function isValidTransition(type, current, next) {
  return VALID_TRANSITIONS[type]?.[current]?.includes(next) ?? false;
}

/**
 * Returns the list of valid next statuses from the current state.
 * Used to drive demo control buttons (which are shown to the presenter).
 */
function validNextStatuses(type, current) {
  return VALID_TRANSITIONS[type]?.[current] ?? [];
}

module.exports = { VALID_TRANSITIONS, isValidTransition, validNextStatuses };
