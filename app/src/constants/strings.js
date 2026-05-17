// All user-facing strings — never hardcode text in JSX.
// Roman Urdu where applicable for Pakistani market context.

export const Strings = {
  // App
  appName: 'HomeMaid',

  // RoleSelectScreen
  roleSelect: {
    title: 'HomeMaid',
    subtitle: 'Ghar ki safai, aapki marzi',
    homeownerLabel: 'Homeowner',
    homeownerSubtitle: 'Ghar ke liye maid dhundein',
    maidLabel: 'Maid / Worker',
    maidSubtitle: 'Kaam dhundein apne liye',
    maidComingSoon: 'Coming Soon',
  },

  // HomeMapScreen
  map: {
    searchPlaceholder: 'Aapki location...',
    maidsNearby: (count) => `${count} maid${count === 1 ? '' : 's'} qareeb`,
    noMaidsNearby: 'Koi maid qareeb nahi',
    demoModeBanner: 'Demo mode: Karachi location show ho rahi hai',
    fabQuickService: 'Quick Service',
    fabBookMaid: 'Maid Book Karein',
    loadingMaids: 'Maids dhundhna...',
    errorLoadingMaids: 'Maids load nahi hui. Dobara try karein.',
  },

  // QuickServiceScreen
  quickService: {
    title: 'Quick Service',
    subtitle: 'Abhi ki zaroorat ke liye',
    serviceLabel: 'Kaam ka type',
    complexityLabel: 'Kaam ki miqdar',
    estimatedPrice: 'Takmini qeemat',
    submitButton: 'Maid Dhundein',
    submitting: 'Dhundh raha hai...',
  },

  // BidListScreen
  bidList: {
    title: 'Bids',
    waitingForBids: 'Maids bid kar rahi hain...',
    noBids: 'Koi bid nahi aayi',
    noBidsSubtitle: 'Radius barha kar dobara try karein',
    timerLabel: 'Waqt bacha',
    selectButton: 'Chunein',
    selecting: 'Choose ho raha hai...',
    conflictError: 'Yeh maid pehle hi choose ho gayi. Doosri select karein.',
    busyError: 'Maid abhi ek aur kaam par hai. Doosra choose karein.',
  },

  // BookingScreen
  booking: {
    title: 'Maid Book Karein',
    dateLabel: 'Tarikh',
    startTimeLabel: 'Shuru ka waqt',
    endTimeLabel: 'Khatam ka waqt',
    findMatchesButton: 'Matches Dhundein',
    confirmButton: 'Book Karein',
    confirming: 'Book ho raha hai...',
    slotConflictError: 'Yeh slot pehle book ho gaya. Doosra waqt chunein.',
    pastDateError: 'Pichli tarikh select nahi kar sakte.',
    shortSlotError: 'Slot kam se kam 1 ghanta hona chahiye.',
    noMatchesTitle: 'Koi match nahi mila',
    noMatchesSubtitle: 'Is slot ke liye koi available nahi. Waqt badlein.',
  },

  // BookingStatusScreen
  bookingStatus: {
    waitingConfirm: 'Maid ki tasdeeq ka intezaar hai...',
    confirmed: 'Booking confirm ho gayi ✓',
    enRoute: 'Maid aa rahi hai',
    inProgress: 'Kaam chal raha hai',
    completed: 'Kaam mukammal ho gaya ✓',
    cancelled: 'Booking cancel ho gayi',
    demoControls: 'Demo Controls',
    advanceStatus: 'Status Aage Karein',
  },

  // Reviews
  review: {
    title: 'Review Dein',
    ratingLabel: 'Rating',
    commentPlaceholder: 'Apna tajurba share karein...',
    submitButton: 'Review Submit Karein',
    successMessage: 'Review de diya. Shukriya!',
    alreadyReviewed: 'Aap pehle hi review de chuke hain.',
    notCompletedError: 'Review sirf mukammal kaam par de sakte hain.',
  },

  // Disputes
  dispute: {
    title: 'Masla Report Karein',
    typeLabel: 'Masle ka qism',
    noShowLabel: 'Maid nahi aayi',
    qualityLabel: 'Kaam theek nahi tha',
    descriptionPlaceholder: 'Masla batayein...',
    submitButton: 'Report Karein',
    windowExpired: 'Complaint ki muddat khatam ho gayi (2 ghante baad).',
    tooEarlyNoShow: 'Abhi jaldi hai — maid ko 30 minute dein pohunchne ke liye.',
  },

  // Common
  common: {
    loading: 'Load ho raha hai...',
    error: 'Kuch masla aaya. Dobara try karein.',
    retry: 'Dobara Karein',
    cancel: 'Cancel',
    confirm: 'Tasdeeq',
    back: 'Wapas',
    close: 'Band Karein',
    save: 'Save Karein',
    submit: 'Submit',
    yes: 'Haan',
    no: 'Nahi',
    ok: 'Theek Hai',
  },

  // Status labels
  statusLabels: {
    pending:      'Intezaar mein',
    pending_bids: 'Bids aa rahi hain',
    bid_selected: 'Maid chuni gayi',
    confirmed:    'Confirm',
    en_route:     'Aa rahi hai',
    in_progress:  'Chal raha hai',
    completed:    'Mukammal',
    cancelled:    'Cancel',
    timed_out:    'Waqt khatam',
  },

  // Error codes → friendly messages
  errorMessages: {
    VALIDATION_ERROR: 'Galat information. Dobara check karein.',
    CONFLICT:         'Yeh action ab mumkin nahi. Page refresh karein.',
    AGENT_ERROR:      'AI service thodi der ke liye available nahi.',
    EXTERNAL_FAILURE: 'Notification bhejne mein masla hua.',
    SERVER_ERROR:     'Server mein masla. Thodi der baad try karein.',
    NETWORK_ERROR:    'Internet connection check karein.',
  },

  // Notifications
  notifications: {
    matchConfirmed: (name) => `${name} ne aapka kaam accept kar liya!`,
    bookingConfirmed: (name, time) => `${name} ${time} par pohunch rahi hai.`,
    reminder: (name) => `Yaad dehani: ${name} 1 ghante mein aayegi.`,
    cancellation: 'Aapka booking cancel ho gaya.',
  },

  // Navigation tabs
  tabs: {
    map: 'Map',
    bookings: 'Bookings',
    traces: 'Traces',
  },
};
