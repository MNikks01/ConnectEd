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

  notices: {
    metaTitle: 'Notices · GetConnected',
    title: 'Notices',
    description: 'From your school.',
    noSchools: 'Notices appear here once a school has verified you as a member.',
    schoolNav: 'School',
    schoolFallback: 'School',
    empty: 'Nothing has been posted yet.',
    unread: 'Unread',
    readBy: 'Read by {count}',
    older: 'Older notices',
  },

  events: {
    metaTitle: 'Events · GetConnected',
    title: 'Events',
    upcomingDescription: 'What is coming up.',
    allDescription: 'Everything, including past.',
    noSchools: 'Events appear here once a school has verified you.',
    rangeNav: 'Range',
    upcoming: 'Upcoming',
    includingPast: 'Including past',
    emptyUpcoming: 'Nothing coming up. Check back later.',
    emptyPast: 'No events yet.',
  },

  notifications: {
    metaTitle: 'Notifications · GetConnected',
    title: 'Notifications',
    unreadCount: '{count} unread',
    allRead: 'Everything here has been read.',
    empty:
      'Nothing yet. Homework, decisions on your verification, and school announcements arrive here.',
  },

  complaints: {
    metaTitle: 'Complaints · GetConnected',
    title: 'Complaints and suggestions',
    description: 'Raised with your school, and answered by it.',
    notEligible:
      'Complaints are raised by parents and staff. Once a school has verified you in one of those roles, the form appears here.',
    schoolNav: 'School',
    yourSchool: 'Your school',
    raiseSomething: 'Raise something',
    whatYouRaised: 'What you have raised',
  },

  connections: {
    metaTitle: 'Connections · GetConnected',
    title: 'Connections',
    backToSocial: '← Social',
    waitingOnYou: 'Waiting on you',
    waitingOnThem: 'Waiting on them',
    connected: 'Connected',
    emptyWaitingOnYou: 'No requests to answer.',
    emptyWaitingOnThem: 'You have no requests open.',
    emptyConnected: 'Nobody yet. Find someone from a post or a class and ask to connect.',
  },

  social: {
    metaTitle: 'Social · GetConnected',
    title: 'Social',
    description: 'From the people and schools you follow.',
    connections: 'Connections',
    newPost: 'New post',
    feed: 'Feed',
    empty:
      'Nothing here yet. Follow a school or connect with someone and their posts appear in this feed.',
    older: 'Older posts',
  },

  messages: {
    metaTitle: 'Messages · GetConnected',
    title: 'Messages',
    unreadCount: '{count} unread',
    nothingUnread: 'Nothing unread.',
    empty: 'No conversations. Open someone’s profile and choose Message to start one.',
    /** Prefixes the preview of a thread's last message when the reader sent it. */
    youPrefix: 'You: ',
    noMessagesYet: 'No messages yet.',
  },

  home: {
    metaTitle: 'Home · GetConnected',
    greeting: 'Hello, {name}',
    schoolDescription: 'You are signed in as an institution.',
    memberDescription: 'Your classes, and everything published to them.',
    unverifiedDescription: 'You are signed in. Ask your school to verify you to see your classes.',
    schoolPortalNote: 'Classes, members, and verification requests live in your',
    schoolPortalLink: 'school portal',
    yourClasses: 'Your classes',
    noClasses:
      'You are not a verified member of any class yet. A class appears here once your school approves your request.',
    classFallback: 'Class',
    schoolFallback: 'School',
    /** A parent's membership reads as a person, not a role — "Parent of Aarav". */
    parentOf: 'Parent of {name}',
    parent: 'Parent',
    student: 'Student',
    teacher: 'Teacher',
    principal: 'Principal',
    user: 'Member',
    truncated: 'Work and notices above are drawn from your first {count} classes.',
    yourAccount: 'Your account',
    name: 'Name',
    accountType: 'Account type',
    email: 'Email',
    role: 'Role',
    handle: 'Handle',
    notApplicable: 'Not applicable',
    emailVerifiedLabel: 'Email verified',
    verified: 'Verified',
    notVerified: 'Not yet verified',
  },

  dashboard: {
    dueSoon: 'Due soon',
    noDeadlines: 'Nothing with a deadline in the next week.',
    dueToday: 'due today',
    dueTomorrow: 'due tomorrow',
    dueInDays: 'due in {count} days',
    dueOn: 'due {date}',
    unread: 'Unread',
    subjectFallback: 'Subject',
    schoolFallback: 'School',
    notReadYet: 'Not read yet',
    whatYouTeach: 'What you teach',
    noAllocation:
      'Your school has not allocated you to a subject yet. Until it does, you can read your classes but not publish to them.',
    syllabusCoverage: 'Syllabus coverage',
    fromYourSchool: 'From your school',
    allNotices: 'All notices',
  },

  post: {
    addComment: 'Add a comment',
    reportLabel: 'What is wrong with this?',
    reportHint: 'Your school cannot see reports; they go to the platform.',
    schoolBadge: 'School',
    edited: ' · edited',
    like: 'Like',
    liked: 'Liked',
    /** Appended to a button label, so a screen reader hears "Liked, 3" rather than an icon. */
    countSuffix: ', {count}',
    comments: 'Comments',
    delete: 'Delete',
    report: 'Report',
    sendReport: 'Send report',
    sendingReport: 'Sending…',
    reported: 'Reported. Nobody at your school is told.',
    commentsList: 'Comments',
    noComments: 'No comments yet.',
    comment: 'Comment',
    posting: 'Posting…',
    commentAdded: 'Comment added.',
    saySomething: 'Say something',
    composerHint: 'Anyone who follows or is connected to you can see this.',
    post: 'Post',
    posted: 'Posted.',
  },

  connectionList: {
    waitingOnThem: 'Waiting on them',
    waitingOnYou: 'Waiting on you',
    connected: 'Connected',
    accept: 'Accept',
    disconnect: 'Disconnect',
    cancel: 'Cancel',
    decline: 'Decline',
  },

  notificationList: {
    markAllRead: 'Mark all as read',
    marking: 'Marking…',
    unread: 'Unread',
    older: 'Older',
    /** Each event gets its own sentence: a generic "you have a notification" says nothing. */
    academicPublishedFallback: 'New work was published to your class.',
    academicPublished: 'New {itemType}: {title}',
    verificationSubmitted: 'Someone asked to join your school.',
    verificationDecided: 'Your school decided on your request to join.',
    membershipRevoked: 'A school ended your membership.',
    exportReady: 'Your data export is ready to download.',
  },

  classFeed: {
    metaTitle: 'Class · GetConnected',
    backToClasses: '← Your classes',
    classFallback: 'Class',
    timetable: 'Timetable',
    syllabus: 'Syllabus',
    marks: 'Marks',
    attendance: 'Attendance',
    reportCards: 'Report cards',
    publishHeading: 'Publish to this class',
    recent: 'Recent',
    nothingOlder: 'Nothing older to show.',
    empty: 'Nothing has been published to this class yet.',
    unread: 'Unread',
    readBy: 'Read by {count}',
    subjectFallback: 'Subject',
    staffFallback: 'Staff',
    dueSuffix: ' · due {date}',
    older: 'Older items',
  },

  academicItem: {
    metaTitle: 'Item · GetConnected',
    backToClass: '← Back to the class',
    byline: '{subject} · {author}',
    subjectFallback: 'Subject',
    staffFallback: 'Staff',
    due: 'Due {date}',
    readBy: 'Read by {count}',
    attachmentAlt: 'Attachment for {title}',
    published: 'Published {date}',
  },

  attendanceRegister: {
    metaTitle: 'Register · GetConnected',
    backToClass: '← Back to the class',
    title: 'Attendance',
    description: 'Register for {date}.',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
    none: 'No attendance has been recorded yet.',
    fromLeave: ' (leave the school accepted)',
    yourAttendance: 'Your attendance',
    yourChild: 'Your child',
    unlinked:
      'Your school has not yet linked {name} to their student account, so their attendance cannot be shown here. Ask the school to link them.',
    nothingToSee: 'There is no attendance for you to see in this class.',
  },

  marksPage: {
    metaTitle: 'Marks · GetConnected',
    backToClass: '← Back to the class',
    title: 'Marks',
    description: 'Results for assessments this class has sat.',
    kindTEST: 'test',
    kindEXAM: 'exam',
    kindASSIGNMENT: 'assignment',
    kindPRACTICAL: 'practical',
    notMarked: 'Not marked',
    scoreOutOf: 'out of {max}',
    noneYet: 'No marks have been published yet.',
    yourChild: 'Your child',
    unlinked:
      'Your school has not yet linked {name} to their student account, so their marks cannot be shown here. Ask the school to link them.',
    assessments: 'Assessments',
    newAssessment: 'New assessment',
    noAssessments: 'No assessments yet.',
    assessmentMeta: '{subject} · out of {max} · {state}',
    published: 'published',
    draft: 'draft — not visible to the class',
    nothingToSee: 'There are no marks for you to see in this class.',
  },

  reportCardsPage: {
    metaTitle: 'Report cards · GetConnected',
    backToClass: '← Back to the class',
    title: 'Report cards',
    description:
      'A card keeps the numbers it was issued with. Correcting a mark later does not change one that has already gone out.',
    issue: 'Issue',
    thisClass: 'This class',
    termShown: 'Term shown',
    show: 'Show',
    noneForTerm: 'No cards have been issued for this term yet.',
    yours: 'Your report cards',
    noneYours: 'Your school has not issued a report card for this class yet.',
    yourChild: 'Your child',
    nothingToSee: 'There are no report cards for you to see in this class.',
  },

  syllabusPage: {
    metaTitle: 'Syllabus · GetConnected',
    backToClass: '← Back to the class',
    title: 'Syllabus coverage',
    description: 'How far each subject has got.',
    noSubjects: 'This class has no subjects yet.',
    subjectFallback: 'Subject',
  },

  timetablePage: {
    metaTitle: 'Timetable · GetConnected',
    backToClass: '← Back to the class',
    title: 'Timetable',
    version: 'Version {version}',
    imageAlt: 'Class timetable, version {version}',
    uploaded: 'Uploaded {date}',
    none: 'Your school has not uploaded a timetable for this class yet.',
  },

  noticeDetail: {
    metaTitle: 'Notice · GetConnected',
    back: '← All notices',
    byline: '{author} · {date}',
    schoolFallback: 'School',
    readBy: 'Read by {count}',
  },

  thread: {
    metaTitle: 'Conversation · GetConnected',
    back: '← All messages',
    fallbackTitle: 'Conversation',
  },

  profileSettings: {
    metaTitle: 'Your profile · GetConnected',
    back: '← How others see you',
    title: 'Your profile',
  },

  leavePage: {
    metaTitle: 'Leave · GetConnected',
    title: 'Leave',
    description: 'Apply, and see where your applications got to.',
    toDecide: 'Applications to decide',
    yourSchool: 'Your school',
    notEligible:
      'Leave is for parents applying on behalf of a child, and for teachers applying for themselves. Neither applies to you yet.',
    applyForChild: 'Apply for your child',
    applyForSelf: 'Apply for yourself',
    yourApplications: 'Your applications',
  },

  approvals: {
    metaTitle: 'Approvals · GetConnected',
    back: '← Your leave',
    title: 'Applications to decide',
    yourSchool: 'Your school',
    notAnApprover:
      'You are not a class teacher or a principal, so no applications wait on you. If that looks wrong, your school allocates class teachers from its portal.',
    noClassLeave: 'No leave waiting for this class.',
    teacherLeaveHeading: 'Teacher leave · {school}',
    noTeacherLeave: 'No teacher leave waiting.',
  },

  publicProfile: {
    metaTitle: 'Profile · GetConnected',
    editYours: 'Edit your profile',
    schoolBadge: 'School',
    followCounts: '{followers} following them · {following} they follow',
    restricted: 'This profile is only visible to their connections. You can still ask to connect.',
    posts: 'Posts',
    noPosts: 'Nothing posted yet.',
  },

  feedback: {
    statusOPEN: 'Not yet read',
    statusUNDER_REVIEW: 'Being looked at',
    statusRESOLVED: 'Resolved',
    submit: 'Send to the school',
    sending: 'Sending…',
    sent: 'Sent. The school can see who raised it.',
    kind: 'Type',
    complaint: 'Complaint',
    suggestion: 'Suggestion',
    details: 'Details',
    detailsHint: 'Your name is attached — this is not anonymous.',
    noneRaised: 'You have not raised anything yet.',
    historyLabel: 'What you have raised',
    queueEmpty: 'Nothing here. Complaints and suggestions arrive in this list.',
    queueLabel: 'Complaints and suggestions',
    memberFallback: 'A member',
    markUnderReview: 'Mark as being looked at',
    markResolved: 'Mark resolved',
  },

  leaveForms: {
    firstDay: 'First day',
    lastDay: 'Last day',
    reason: 'Reason',
    reasonHint: 'Seen by whoever decides the application.',
    submit: 'Apply for leave',
    sending: 'Sending…',
    sentToClassTeacher: 'Sent to the class teacher.',
    sentToPrincipal: 'Sent to the principal.',
    child: 'Child',
    childOption: '{child} — {className}',
    childFallback: 'Child',
    classFallback: 'Class',
    school: 'School',
  },

  messageThread: {
    label: 'Message',
    empty: 'Nothing said yet. Start the conversation below.',
    listLabel: 'Messages',
    you: 'You',
    them: 'Them',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Sent.',
  },

  profileActions: {
    reportLabel: 'What is wrong?',
    blockedNotice: 'You have blocked this account.',
    unblock: 'Unblock',
    follow: 'Follow',
    unfollow: 'Unfollow',
    connect: 'Connect',
    requestSent: 'Request sent',
    connected: 'Connected',
    message: 'Message',
    report: 'Report',
    block: 'Block',
    sendReport: 'Send report',
    sending: 'Sending…',
    reported: 'Reported. Nobody at your school is told.',
    blockTitle: 'Block this account?',
    cancel: 'Cancel',
    blockExplained:
      'You will not see each other’s posts, comments or messages, in either direction. Unblocking puts everything back — nothing is deleted.',
  },

  leaveQueue: {
    applicantFallback: 'Applicant',
    accept: 'Accept',
    reject: 'Reject',
    rejectTitle: 'Reject this application?',
    cancel: 'Cancel',
    rejectConfirm: 'Reject application',
    rejectExplained:
      'The applicant is told. A rejected application cannot be reopened — they would have to apply again.',
    noneApplied: 'You have not applied for any leave.',
    statusRECEIVED: 'Waiting',
    statusACCEPTED: 'Accepted',
    statusREJECTED: 'Rejected',
  },

  authForm: {
    somethingWentWrong: 'Something went wrong. Please try again.',
    unreachable: 'Could not reach the server. Check your connection and try again.',
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
