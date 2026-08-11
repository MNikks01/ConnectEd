/**
 * The English catalogue — and the schema every other locale is checked against (NFR-016).
 *
 * `Messages` is `typeof en`, so this file *is* the contract: adding a key here makes every other
 * catalogue fail to compile until it has one too. That is deliberate and it is the main thing this
 * approach buys over a bag of JSON files, where a missing translation is discovered by a user.
 *
 * **Grouping is by screen, not by word.** A tempting alternative is a `common.save` reused
 * everywhere, and it is a trap in any language with grammatical gender or politeness levels: the
 * same English word is two different words once it has a context. Keys here name where the string
 * appears, and repetition between screens is accepted as the price of being translatable.
 */
const en = {
  locale: {
    label: 'Language',
    /** Names the action, not the state — a switcher labelled "English" reads as a status. */
    change: 'Change language',
  },

  common: {
    signOut: 'Sign out',
    save: 'Save',
    cancel: 'Cancel',
    somethingWentWrong: 'Something went wrong.',
    loading: 'Loading…',
  },

  nav: {
    main: 'Main',
    home: 'Home',
    notices: 'Notices',
    events: 'Events',
    leave: 'Leave',
    complaints: 'Complaints',
    social: 'Social',
    messages: 'Messages',
    notifications: 'Notifications',
    settings: 'Settings',
    reports: 'Reports',
    unread: '{label}, {count} unread',
  },

  schoolNav: {
    portal: 'School portal',
    navLabel: 'School portal',
    profile: 'Profile',
    classes: 'Classes',
    terms: 'Terms',
    notices: 'Notices',
    events: 'Events',
    complaints: 'Complaints',
    members: 'Members',
    verifications: 'Verifications',
    analytics: 'Analytics',
    billing: 'Billing',
    yourData: 'Your data',
  },

  marketing: {
    title: 'GetConnected',
    tagline: 'The school-community platform connecting students, parents, teachers, and schools.',
    getStarted: 'Get started',
    signIn: 'Sign in',
    or: 'or',
    createAccount: 'create an account',
    webOnlyNote:
      'Schools use the web portal. Students, parents, and teachers can use the web or the mobile app.',
  },

  login: {
    metaTitle: 'Sign in · GetConnected',
    title: 'Sign in',
    welcome: 'Welcome back to GetConnected.',
    sessionExpired: 'Your session expired. Please sign in again.',
    noAccount: 'No account yet?',
    createOne: 'Create one',
    schoolWebOnly:
      'School accounts sign in here on the web. They cannot be used in the mobile app.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    unreachable: 'Could not reach the server. Check your connection and try again.',
    codePrompt: 'Enter the code from your authenticator app.',
    code: 'Code',
    lostPhone: 'Lost your phone? Use one of the recovery codes you saved when you turned this on.',
    checking: 'Checking…',
  },

  register: {
    metaTitle: 'Create an account · GetConnected',
    title: 'Create an account',
    intro:
      'You will start as a general member. Academic roles are requested afterwards and confirmed by your school.',
    fullName: 'Full name',
    handle: 'Handle',
    handleHint: 'Lowercase letters, numbers, dots, and underscores.',
    email: 'Email',
    password: 'Password',
    passwordHint: 'At least 12 characters. A memorable phrase beats a short complicated one.',
    submit: 'Create account',
    submitting: 'Creating account…',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
  },

  settings: {
    nav: 'Settings',
    profile: 'Profile',
    notifications: 'Notifications',
    security: 'Security',
    privacy: 'Your data',
  },

  privacy: {
    metaTitle: 'Your data · GetConnected',
    title: 'Your data',
    description: 'A copy of everything we hold about you, and the way to have it deleted.',

    exportHeading: 'Download your data',
    exportIntro:
      'One file containing your profile, your memberships, your marks, your attendance, your report cards, and everything you have written. It takes a moment to prepare, and the link works for seven days.',
    requestCopy: 'Request a copy',
    requestedNotice: 'We are preparing your file. This page will show it when it is ready.',
    notWhileErasing: 'Not while your account is scheduled for deletion — cancel that first.',
    noExportsYet: 'You have not asked for a copy before.',
    requestedOn: 'Requested {date}',
    availableUntil: '{size} · available until {date}',
    download: 'Download',
    downloadFailed: 'That file could not be fetched.',

    statusPending: 'Being prepared',
    statusReady: 'Ready to download',
    statusFailed: 'Failed',
    statusExpired: 'Expired',

    eraseHeading: 'Delete your account',
    schoolCannotErase:
      'A school account cannot be deleted here. Its classes, registers and report cards belong to its pupils and their families as much as to the institution, so closing one is a conversation rather than a button. Get in touch and we will walk through it.',
    graceExplained:
      'We will wait 30 days before deleting anything, and you can change your mind at any point in that time. After that it cannot be undone.',
    confirmLabel: 'Type ERASE to confirm',
    confirmHint:
      'A deliberate speed bump before the one thing on this site that cannot be reversed.',
    scheduleDeletion: 'Schedule deletion',
    scheduledOn:
      'Your account is scheduled for deletion on {date}. Until then everything works normally, and you can stop it.',
    keepAccount: 'Keep my account',
    scheduledNotice:
      'Your account is scheduled for deletion. You can stop it at any point in the next 30 days.',
    cancelledNotice: 'Your account will not be deleted.',

    limitsHeading: 'What we cannot undo',
    limitsBody:
      'Deleting your account does not reach a backup taken before it ran, a copy of your data you have already downloaded, or a report somebody else has raised about you. Marks, registers and report cards stay with your school: they are its records as much as yours, and in most places it is required to keep them.',
    limitsWhatGoes:
      'What goes is you — your profile, your handle, your posts and comments, your messages, and your sign-in. Anything the school keeps afterwards shows “A former member” where your name used to be.',

    bytes: '{count} bytes',
    kilobytes: '{count} KB',
    megabytes: '{count} MB',
  },

  notificationPrefs: {
    metaTitle: 'Notifications · GetConnected',
    title: 'Notifications',
    description:
      'What you want to hear about. Switching something off stops it appearing in your list at all.',
    academic: 'Homework, assignments and projects',
    notice: 'School notices',
    event: 'Events',
    leaveCategory: 'Leave applications and decisions',
    socialCategory: 'Follows, connections, likes and comments',
    message: 'Direct messages',
    alwaysTold:
      'You will always be told about a verification decision and anything to do with your school’s subscription — those are answers to things you asked for, not announcements.',
    save: 'Save preferences',
    saved: 'Saved.',
  },

  security: {
    metaTitle: 'Security · GetConnected',
    title: 'Security',
    description: 'How you prove it is you.',
    twoFactorHeading: 'Two-factor authentication',
    notAvailable:
      'Available to school accounts and principals — the accounts that can approve members and reach every family at a school. Yours does neither, so a password and a strong one is enough.',
  },
};

/**
 * No `as const`, deliberately. With it every value would be a *literal* type — `'Sign in'` rather
 * than `string` — and `const hi: Messages` would then demand the Hindi catalogue contain the
 * English words. The keys are what must match between locales; the values are what must not.
 */
export type Messages = typeof en;

export default en;
