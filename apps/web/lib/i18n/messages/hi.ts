/**
 * हिन्दी — the Hindi catalogue (NFR-016).
 *
 * > **Not yet reviewed by a native speaker.** This was written by the same person who wrote the
 * > English, and that is a limit worth stating at the top of the file rather than in a ticket:
 * > register and politeness level are the parts most likely to be wrong, and they are exactly the
 * > parts a school will notice. `PRD/10-completeness.md` records NFR-016 as ◐ for this reason, and
 * > it should not be moved to ✅ until somebody who teaches in Hindi has read this file.
 *
 * Two conventions, applied throughout:
 *
 * **आप throughout, never तू or तुम.** The product speaks to parents, to teachers and to children,
 * often on the same screen, and the polite second person is the only one that is not wrong for any
 * of them. English has no such choice to make, which is precisely why it has to be made once, here,
 * rather than per string.
 *
 * **Established English terms are kept in Devanagari transliteration where a school actually uses
 * them** — ईमेल, पासवर्ड, ऐप — rather than translated into Sanskritised coinages nobody says out
 * loud. The test applied to each was whether a teacher would use the word in a staffroom.
 */
import type { Messages } from './en';

const hi: Messages = {
  locale: {
    label: 'भाषा',
    change: 'भाषा बदलें',
  },

  common: {
    signOut: 'साइन आउट करें',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    somethingWentWrong: 'कुछ गड़बड़ हो गई।',
    loading: 'लोड हो रहा है…',
  },

  nav: {
    main: 'मुख्य',
    home: 'होम',
    notices: 'सूचनाएँ',
    events: 'कार्यक्रम',
    leave: 'छुट्टी',
    complaints: 'शिकायतें',
    social: 'सामुदायिक',
    messages: 'संदेश',
    notifications: 'अधिसूचनाएँ',
    settings: 'सेटिंग्स',
    reports: 'रिपोर्टें',
    unread: '{label}, {count} अपठित',
  },

  schoolNav: {
    portal: 'विद्यालय पोर्टल',
    navLabel: 'विद्यालय पोर्टल',
    profile: 'प्रोफ़ाइल',
    classes: 'कक्षाएँ',
    terms: 'सत्र',
    notices: 'सूचनाएँ',
    events: 'कार्यक्रम',
    complaints: 'शिकायतें',
    members: 'सदस्य',
    verifications: 'सत्यापन',
    analytics: 'विश्लेषण',
    billing: 'बिलिंग',
    yourData: 'आपका डेटा',
  },

  marketing: {
    // The product's name is a name. Translating it would leave a school unable to find us.
    title: 'GetConnected',
    tagline: 'विद्यार्थियों, अभिभावकों, शिक्षकों और विद्यालयों को जोड़ने वाला मंच।',
    getStarted: 'शुरू करें',
    signIn: 'साइन इन करें',
    or: 'या',
    createAccount: 'खाता बनाएँ',
    webOnlyNote:
      'विद्यालय वेब पोर्टल का उपयोग करते हैं। विद्यार्थी, अभिभावक और शिक्षक वेब या मोबाइल ऐप दोनों का उपयोग कर सकते हैं।',
  },

  login: {
    metaTitle: 'साइन इन · GetConnected',
    title: 'साइन इन करें',
    welcome: 'GetConnected में आपका फिर से स्वागत है।',
    sessionExpired: 'आपका सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।',
    noAccount: 'अभी तक खाता नहीं है?',
    createOne: 'एक बनाएँ',
    schoolWebOnly:
      'विद्यालय के खाते यहाँ वेब पर साइन इन करते हैं। मोबाइल ऐप में इनका उपयोग नहीं हो सकता।',
    email: 'ईमेल',
    password: 'पासवर्ड',
    submit: 'साइन इन करें',
    submitting: 'साइन इन हो रहा है…',
    unreachable: 'सर्वर तक नहीं पहुँच सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
    codePrompt: 'अपने ऑथेंटिकेटर ऐप का कोड दर्ज करें।',
    code: 'कोड',
    lostPhone:
      'फ़ोन खो गया? यह सुविधा चालू करते समय आपने जो रिकवरी कोड सहेजे थे, उनमें से एक का उपयोग करें।',
    checking: 'जाँचा जा रहा है…',
  },

  register: {
    metaTitle: 'खाता बनाएँ · GetConnected',
    title: 'खाता बनाएँ',
    intro:
      'आप एक सामान्य सदस्य के रूप में शुरू करेंगे। शैक्षणिक भूमिकाएँ बाद में माँगी जाती हैं और आपका विद्यालय उनकी पुष्टि करता है।',
    fullName: 'पूरा नाम',
    handle: 'हैंडल',
    handleHint: 'छोटे अक्षर, अंक, बिंदु और अंडरस्कोर।',
    email: 'ईमेल',
    password: 'पासवर्ड',
    passwordHint:
      'कम से कम 12 अक्षर। एक याद रहने वाला वाक्यांश छोटे जटिल पासवर्ड से बेहतर होता है।',
    submit: 'खाता बनाएँ',
    submitting: 'खाता बनाया जा रहा है…',
    haveAccount: 'पहले से खाता है?',
    signIn: 'साइन इन करें',
  },

  notices: {
    metaTitle: 'सूचनाएँ · GetConnected',
    title: 'सूचनाएँ',
    description: 'आपके विद्यालय की ओर से।',
    noSchools: 'जैसे ही कोई विद्यालय आपको सदस्य के रूप में सत्यापित करेगा, सूचनाएँ यहाँ दिखेंगी।',
    schoolNav: 'विद्यालय',
    schoolFallback: 'विद्यालय',
    empty: 'अभी तक कुछ भी नहीं भेजा गया है।',
    unread: 'अपठित',
    readBy: '{count} लोगों ने पढ़ा',
    older: 'पुरानी सूचनाएँ',
  },

  events: {
    metaTitle: 'कार्यक्रम · GetConnected',
    title: 'कार्यक्रम',
    upcomingDescription: 'आगे क्या होने वाला है।',
    allDescription: 'सब कुछ, बीते हुए कार्यक्रमों सहित।',
    noSchools: 'जैसे ही कोई विद्यालय आपको सत्यापित करेगा, कार्यक्रम यहाँ दिखेंगे।',
    rangeNav: 'अवधि',
    upcoming: 'आगामी',
    includingPast: 'बीते हुए सहित',
    emptyUpcoming: 'आगे कुछ नहीं है। बाद में देखें।',
    emptyPast: 'अभी तक कोई कार्यक्रम नहीं।',
  },

  notifications: {
    metaTitle: 'अधिसूचनाएँ · GetConnected',
    title: 'अधिसूचनाएँ',
    unreadCount: '{count} अपठित',
    allRead: 'यहाँ सब कुछ पढ़ा जा चुका है।',
    empty: 'अभी कुछ नहीं। गृहकार्य, आपके सत्यापन पर निर्णय, और विद्यालय की घोषणाएँ यहाँ आती हैं।',
  },

  complaints: {
    metaTitle: 'शिकायतें · GetConnected',
    title: 'शिकायतें और सुझाव',
    description: 'आपके विद्यालय के सामने रखी जाती हैं, और वही उनका उत्तर देता है।',
    notEligible:
      'शिकायतें अभिभावक और कर्मचारी दर्ज करते हैं। जैसे ही कोई विद्यालय आपको इनमें से किसी भूमिका में सत्यापित करेगा, यहाँ फ़ॉर्म दिखने लगेगा।',
    schoolNav: 'विद्यालय',
    yourSchool: 'आपका विद्यालय',
    raiseSomething: 'कुछ दर्ज करें',
    whatYouRaised: 'आपने जो दर्ज किया है',
  },

  connections: {
    metaTitle: 'कनेक्शन · GetConnected',
    title: 'कनेक्शन',
    backToSocial: '← सामुदायिक',
    waitingOnYou: 'आपके उत्तर की प्रतीक्षा में',
    waitingOnThem: 'उनके उत्तर की प्रतीक्षा में',
    connected: 'जुड़े हुए',
    emptyWaitingOnYou: 'उत्तर देने के लिए कोई अनुरोध नहीं।',
    emptyWaitingOnThem: 'आपका कोई अनुरोध लंबित नहीं है।',
    emptyConnected:
      'अभी कोई नहीं। किसी पोस्ट या कक्षा से किसी को ढूँढ़ें और जुड़ने का अनुरोध भेजें।',
  },

  social: {
    metaTitle: 'सामुदायिक · GetConnected',
    title: 'सामुदायिक',
    description: 'जिन लोगों और विद्यालयों को आप फ़ॉलो करते हैं, उनकी ओर से।',
    connections: 'कनेक्शन',
    newPost: 'नई पोस्ट',
    feed: 'फ़ीड',
    empty:
      'अभी यहाँ कुछ नहीं है। किसी विद्यालय को फ़ॉलो करें या किसी से जुड़ें, और उनकी पोस्ट इस फ़ीड में दिखने लगेंगी।',
    older: 'पुरानी पोस्ट',
  },

  messages: {
    metaTitle: 'संदेश · GetConnected',
    title: 'संदेश',
    unreadCount: '{count} अपठित',
    nothingUnread: 'कुछ भी अपठित नहीं।',
    empty: 'कोई बातचीत नहीं। किसी की प्रोफ़ाइल खोलें और बातचीत शुरू करने के लिए “संदेश” चुनें।',
    youPrefix: 'आप: ',
    noMessagesYet: 'अभी कोई संदेश नहीं।',
  },

  home: {
    metaTitle: 'होम · GetConnected',
    greeting: 'नमस्ते, {name}',
    schoolDescription: 'आप एक संस्था के रूप में साइन इन हैं।',
    memberDescription: 'आपकी कक्षाएँ, और उनमें प्रकाशित सब कुछ।',
    unverifiedDescription:
      'आप साइन इन हैं। अपनी कक्षाएँ देखने के लिए अपने विद्यालय से सत्यापन कराएँ।',
    schoolPortalNote: 'कक्षाएँ, सदस्य और सत्यापन अनुरोध आपके',
    schoolPortalLink: 'विद्यालय पोर्टल',
    yourClasses: 'आपकी कक्षाएँ',
    noClasses:
      'आप अभी किसी कक्षा के सत्यापित सदस्य नहीं हैं। जैसे ही आपका विद्यालय आपके अनुरोध को स्वीकार करेगा, कक्षा यहाँ दिखने लगेगी।',
    classFallback: 'कक्षा',
    schoolFallback: 'विद्यालय',
    parentOf: '{name} के अभिभावक',
    parent: 'अभिभावक',
    student: 'विद्यार्थी',
    teacher: 'शिक्षक',
    principal: 'प्रधानाचार्य',
    user: 'सदस्य',
    truncated: 'ऊपर दिया गया कार्य और सूचनाएँ आपकी पहली {count} कक्षाओं से ली गई हैं।',
    yourAccount: 'आपका खाता',
    name: 'नाम',
    accountType: 'खाते का प्रकार',
    email: 'ईमेल',
    role: 'भूमिका',
    handle: 'हैंडल',
    notApplicable: 'लागू नहीं',
    emailVerifiedLabel: 'ईमेल सत्यापित',
    verified: 'सत्यापित',
    notVerified: 'अभी सत्यापित नहीं',
  },

  dashboard: {
    dueSoon: 'जल्द देय',
    noDeadlines: 'अगले सप्ताह किसी की अंतिम तिथि नहीं है।',
    dueToday: 'आज देय',
    dueTomorrow: 'कल देय',
    dueInDays: '{count} दिनों में देय',
    dueOn: '{date} को देय',
    unread: 'अपठित',
    subjectFallback: 'विषय',
    schoolFallback: 'विद्यालय',
    notReadYet: 'अभी तक नहीं पढ़ा',
    whatYouTeach: 'आप क्या पढ़ाते हैं',
    noAllocation:
      'आपके विद्यालय ने अभी आपको किसी विषय से नहीं जोड़ा है। तब तक आप अपनी कक्षाएँ पढ़ सकते हैं, पर उनमें कुछ प्रकाशित नहीं कर सकते।',
    syllabusCoverage: 'पाठ्यक्रम की प्रगति',
    fromYourSchool: 'आपके विद्यालय की ओर से',
    allNotices: 'सभी सूचनाएँ',
  },

  post: {
    addComment: 'टिप्पणी जोड़ें',
    reportLabel: 'इसमें क्या ग़लत है?',
    reportHint: 'आपका विद्यालय शिकायतें नहीं देख सकता; वे मंच तक जाती हैं।',
    schoolBadge: 'विद्यालय',
    edited: ' · संपादित',
    like: 'पसंद करें',
    liked: 'पसंद किया',
    countSuffix: ', {count}',
    comments: 'टिप्पणियाँ',
    delete: 'हटाएँ',
    report: 'शिकायत करें',
    sendReport: 'शिकायत भेजें',
    sendingReport: 'भेजा जा रहा है…',
    reported: 'शिकायत दर्ज हो गई। आपके विद्यालय में किसी को नहीं बताया जाता।',
    commentsList: 'टिप्पणियाँ',
    noComments: 'अभी कोई टिप्पणी नहीं।',
    comment: 'टिप्पणी करें',
    posting: 'भेजा जा रहा है…',
    commentAdded: 'टिप्पणी जोड़ दी गई।',
    saySomething: 'कुछ कहें',
    composerHint: 'जो लोग आपको फ़ॉलो करते हैं या आपसे जुड़े हैं, वे इसे देख सकते हैं।',
    post: 'पोस्ट करें',
    posted: 'पोस्ट हो गया।',
  },

  connectionList: {
    waitingOnThem: 'उनकी प्रतीक्षा में',
    waitingOnYou: 'आपकी प्रतीक्षा में',
    connected: 'जुड़े हुए',
    accept: 'स्वीकार करें',
    disconnect: 'संबंध हटाएँ',
    cancel: 'रद्द करें',
    decline: 'अस्वीकार करें',
  },

  notificationList: {
    markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
    marking: 'चिह्नित किया जा रहा है…',
    unread: 'अपठित',
    older: 'पुराने',
    academicPublishedFallback: 'आपकी कक्षा में नया कार्य प्रकाशित हुआ है।',
    academicPublished: 'नया {itemType}: {title}',
    verificationSubmitted: 'किसी ने आपके विद्यालय से जुड़ने का अनुरोध किया है।',
    verificationDecided: 'आपके जुड़ने के अनुरोध पर आपके विद्यालय ने निर्णय ले लिया है।',
    membershipRevoked: 'एक विद्यालय ने आपकी सदस्यता समाप्त कर दी है।',
    exportReady: 'आपके डेटा की प्रति डाउनलोड के लिए तैयार है।',
  },

  classFeed: {
    metaTitle: 'कक्षा · GetConnected',
    backToClasses: '← आपकी कक्षाएँ',
    classFallback: 'कक्षा',
    timetable: 'समय-सारणी',
    syllabus: 'पाठ्यक्रम',
    marks: 'अंक',
    attendance: 'उपस्थिति',
    reportCards: 'प्रगति पत्र',
    publishHeading: 'इस कक्षा में प्रकाशित करें',
    recent: 'हाल का',
    nothingOlder: 'दिखाने के लिए इससे पुराना कुछ नहीं।',
    empty: 'इस कक्षा में अभी तक कुछ प्रकाशित नहीं हुआ है।',
    unread: 'अपठित',
    readBy: '{count} लोगों ने पढ़ा',
    subjectFallback: 'विषय',
    staffFallback: 'कर्मचारी',
    dueSuffix: ' · {date} तक',
    older: 'पुरानी प्रविष्टियाँ',
  },

  academicItem: {
    metaTitle: 'प्रविष्टि · GetConnected',
    backToClass: '← कक्षा पर वापस',
    byline: '{subject} · {author}',
    subjectFallback: 'विषय',
    staffFallback: 'कर्मचारी',
    due: '{date} तक',
    readBy: '{count} लोगों ने पढ़ा',
    attachmentAlt: '{title} के साथ संलग्न चित्र',
    published: '{date} को प्रकाशित',
  },

  attendanceRegister: {
    metaTitle: 'उपस्थिति · GetConnected',
    backToClass: '← कक्षा पर वापस',
    title: 'उपस्थिति',
    description: '{date} की उपस्थिति।',
    present: 'उपस्थित',
    absent: 'अनुपस्थित',
    late: 'देर से',
    excused: 'छूट प्राप्त',
    none: 'अभी तक कोई उपस्थिति दर्ज नहीं हुई है।',
    fromLeave: ' (विद्यालय द्वारा स्वीकृत छुट्टी)',
    yourAttendance: 'आपकी उपस्थिति',
    yourChild: 'आपका बच्चा',
    unlinked:
      'आपके विद्यालय ने अभी {name} को उनके विद्यार्थी खाते से नहीं जोड़ा है, इसलिए उनकी उपस्थिति यहाँ नहीं दिखाई जा सकती। विद्यालय से जोड़ने के लिए कहें।',
    nothingToSee: 'इस कक्षा में आपके देखने के लिए कोई उपस्थिति नहीं है।',
  },

  marksPage: {
    metaTitle: 'अंक · GetConnected',
    backToClass: '← कक्षा पर वापस',
    title: 'अंक',
    description: 'इस कक्षा ने जो परीक्षाएँ दी हैं, उनके परिणाम।',
    kindTEST: 'परीक्षण',
    kindEXAM: 'परीक्षा',
    kindASSIGNMENT: 'असाइनमेंट',
    kindPRACTICAL: 'प्रायोगिक',
    notMarked: 'अंक नहीं दिए गए',
    scoreOutOf: '{max} में से',
    noneYet: 'अभी तक कोई अंक प्रकाशित नहीं हुए हैं।',
    yourChild: 'आपका बच्चा',
    unlinked:
      'आपके विद्यालय ने अभी {name} को उनके विद्यार्थी खाते से नहीं जोड़ा है, इसलिए उनके अंक यहाँ नहीं दिखाए जा सकते। विद्यालय से जोड़ने के लिए कहें।',
    assessments: 'परीक्षाएँ',
    newAssessment: 'नई परीक्षा',
    noAssessments: 'अभी तक कोई परीक्षा नहीं।',
    assessmentMeta: '{subject} · {max} में से · {state}',
    published: 'प्रकाशित',
    draft: 'मसौदा — कक्षा को दिखाई नहीं देता',
    nothingToSee: 'इस कक्षा में आपके देखने के लिए कोई अंक नहीं हैं।',
  },

  reportCardsPage: {
    metaTitle: 'प्रगति पत्र · GetConnected',
    backToClass: '← कक्षा पर वापस',
    title: 'प्रगति पत्र',
    description:
      'प्रगति पत्र में वही अंक बने रहते हैं जो जारी करते समय थे। बाद में किसी अंक का सुधार पहले जारी हो चुके पत्र को नहीं बदलता।',
    issue: 'जारी करें',
    thisClass: 'यह कक्षा',
    termShown: 'दिखाया जा रहा सत्र',
    show: 'दिखाएँ',
    noneForTerm: 'इस सत्र के लिए अभी कोई प्रगति पत्र जारी नहीं हुआ है।',
    yours: 'आपके प्रगति पत्र',
    noneYours: 'आपके विद्यालय ने इस कक्षा के लिए अभी प्रगति पत्र जारी नहीं किया है।',
    yourChild: 'आपका बच्चा',
    nothingToSee: 'इस कक्षा में आपके देखने के लिए कोई प्रगति पत्र नहीं है।',
  },

  syllabusPage: {
    metaTitle: 'पाठ्यक्रम · GetConnected',
    backToClass: '← कक्षा पर वापस',
    title: 'पाठ्यक्रम की प्रगति',
    description: 'हर विषय कहाँ तक पहुँचा है।',
    noSubjects: 'इस कक्षा में अभी कोई विषय नहीं है।',
    subjectFallback: 'विषय',
  },

  timetablePage: {
    metaTitle: 'समय-सारणी · GetConnected',
    backToClass: '← कक्षा पर वापस',
    title: 'समय-सारणी',
    version: 'संस्करण {version}',
    imageAlt: 'कक्षा की समय-सारणी, संस्करण {version}',
    uploaded: '{date} को अपलोड की गई',
    none: 'आपके विद्यालय ने इस कक्षा के लिए अभी समय-सारणी अपलोड नहीं की है।',
  },

  noticeDetail: {
    metaTitle: 'सूचना · GetConnected',
    back: '← सभी सूचनाएँ',
    byline: '{author} · {date}',
    schoolFallback: 'विद्यालय',
    readBy: '{count} लोगों ने पढ़ा',
  },

  thread: {
    metaTitle: 'बातचीत · GetConnected',
    back: '← सभी संदेश',
    fallbackTitle: 'बातचीत',
  },

  profileSettings: {
    metaTitle: 'आपकी प्रोफ़ाइल · GetConnected',
    back: '← दूसरे आपको कैसे देखते हैं',
    title: 'आपकी प्रोफ़ाइल',
  },

  leavePage: {
    metaTitle: 'छुट्टी · GetConnected',
    title: 'छुट्टी',
    description: 'आवेदन करें, और देखें कि आपके आवेदन कहाँ तक पहुँचे।',
    toDecide: 'निर्णय के लिए आवेदन',
    yourSchool: 'आपका विद्यालय',
    notEligible:
      'छुट्टी का आवेदन अभिभावक अपने बच्चे की ओर से और शिक्षक अपने लिए करते हैं। अभी इनमें से कोई भी आप पर लागू नहीं होता।',
    applyForChild: 'अपने बच्चे के लिए आवेदन करें',
    applyForSelf: 'अपने लिए आवेदन करें',
    yourApplications: 'आपके आवेदन',
  },

  approvals: {
    metaTitle: 'अनुमोदन · GetConnected',
    back: '← आपकी छुट्टी',
    title: 'निर्णय के लिए आवेदन',
    yourSchool: 'आपका विद्यालय',
    notAnApprover:
      'आप न कक्षा-शिक्षक हैं और न प्रधानाचार्य, इसलिए कोई आवेदन आप पर लंबित नहीं है। यदि यह ग़लत लगे, तो कक्षा-शिक्षक आपका विद्यालय अपने पोर्टल से नियुक्त करता है।',
    noClassLeave: 'इस कक्षा के लिए कोई छुट्टी लंबित नहीं है।',
    teacherLeaveHeading: 'शिक्षकों की छुट्टी · {school}',
    noTeacherLeave: 'शिक्षकों की कोई छुट्टी लंबित नहीं है।',
  },

  publicProfile: {
    metaTitle: 'प्रोफ़ाइल · GetConnected',
    editYours: 'अपनी प्रोफ़ाइल संपादित करें',
    schoolBadge: 'विद्यालय',
    followCounts: '{followers} उन्हें फ़ॉलो करते हैं · वे {following} को फ़ॉलो करते हैं',
    restricted:
      'यह प्रोफ़ाइल केवल उनके कनेक्शन देख सकते हैं। आप फिर भी जुड़ने का अनुरोध भेज सकते हैं।',
    posts: 'पोस्ट',
    noPosts: 'अभी तक कुछ पोस्ट नहीं किया गया।',
  },

  feedback: {
    statusOPEN: 'अभी पढ़ा नहीं गया',
    statusUNDER_REVIEW: 'देखा जा रहा है',
    statusRESOLVED: 'निपटा दिया गया',
    submit: 'विद्यालय को भेजें',
    sending: 'भेजा जा रहा है…',
    sent: 'भेज दिया गया। विद्यालय देख सकता है कि यह किसने दर्ज किया।',
    kind: 'प्रकार',
    complaint: 'शिकायत',
    suggestion: 'सुझाव',
    details: 'विवरण',
    detailsHint: 'आपका नाम इसके साथ जुड़ा रहता है — यह गुमनाम नहीं है।',
    noneRaised: 'आपने अभी तक कुछ दर्ज नहीं किया है।',
    historyLabel: 'आपने जो दर्ज किया है',
    queueEmpty: 'यहाँ कुछ नहीं है। शिकायतें और सुझाव इसी सूची में आते हैं।',
    queueLabel: 'शिकायतें और सुझाव',
    memberFallback: 'एक सदस्य',
    markUnderReview: 'देखा जा रहा है, ऐसा चिह्नित करें',
    markResolved: 'निपटा हुआ चिह्नित करें',
  },

  leaveForms: {
    firstDay: 'पहला दिन',
    lastDay: 'अंतिम दिन',
    reason: 'कारण',
    reasonHint: 'जो व्यक्ति आवेदन पर निर्णय लेता है, वह इसे देखता है।',
    submit: 'छुट्टी के लिए आवेदन करें',
    sending: 'भेजा जा रहा है…',
    sentToClassTeacher: 'कक्षा-शिक्षक को भेज दिया गया।',
    sentToPrincipal: 'प्रधानाचार्य को भेज दिया गया।',
    child: 'बच्चा',
    childOption: '{child} — {className}',
    childFallback: 'बच्चा',
    classFallback: 'कक्षा',
    school: 'विद्यालय',
  },

  messageThread: {
    label: 'संदेश',
    empty: 'अभी तक कुछ नहीं कहा गया। नीचे से बातचीत शुरू करें।',
    listLabel: 'संदेश',
    you: 'आप',
    them: 'वे',
    send: 'भेजें',
    sending: 'भेजा जा रहा है…',
    sent: 'भेज दिया गया।',
  },

  profileActions: {
    reportLabel: 'क्या ग़लत है?',
    blockedNotice: 'आपने इस खाते को अवरुद्ध कर रखा है।',
    unblock: 'अवरोध हटाएँ',
    follow: 'फ़ॉलो करें',
    unfollow: 'फ़ॉलो हटाएँ',
    connect: 'जुड़ें',
    requestSent: 'अनुरोध भेजा गया',
    connected: 'जुड़े हुए',
    message: 'संदेश',
    report: 'शिकायत करें',
    block: 'अवरुद्ध करें',
    sendReport: 'शिकायत भेजें',
    sending: 'भेजा जा रहा है…',
    reported: 'शिकायत दर्ज हो गई। आपके विद्यालय में किसी को नहीं बताया जाता।',
    blockTitle: 'इस खाते को अवरुद्ध करें?',
    cancel: 'रद्द करें',
    blockExplained:
      'आप दोनों एक-दूसरे की पोस्ट, टिप्पणियाँ और संदेश नहीं देख पाएँगे। अवरोध हटाने पर सब कुछ वापस आ जाता है — कुछ भी मिटाया नहीं जाता।',
  },

  leaveQueue: {
    applicantFallback: 'आवेदक',
    accept: 'स्वीकार करें',
    reject: 'अस्वीकार करें',
    rejectTitle: 'इस आवेदन को अस्वीकार करें?',
    cancel: 'रद्द करें',
    rejectConfirm: 'आवेदन अस्वीकार करें',
    rejectExplained:
      'आवेदक को सूचित किया जाता है। अस्वीकृत आवेदन दोबारा नहीं खोला जा सकता — उन्हें फिर से आवेदन करना होगा।',
    noneApplied: 'आपने किसी छुट्टी के लिए आवेदन नहीं किया है।',
    statusRECEIVED: 'प्रतीक्षा में',
    statusACCEPTED: 'स्वीकृत',
    statusREJECTED: 'अस्वीकृत',
  },

  authForm: {
    somethingWentWrong: 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।',
    unreachable: 'सर्वर तक नहीं पहुँच सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  },

  settings: {
    nav: 'सेटिंग्स',
    profile: 'प्रोफ़ाइल',
    notifications: 'अधिसूचनाएँ',
    security: 'सुरक्षा',
    privacy: 'आपका डेटा',
  },

  privacy: {
    metaTitle: 'आपका डेटा · GetConnected',
    title: 'आपका डेटा',
    description: 'हमारे पास आपका जो कुछ है उसकी एक प्रति, और उसे हटवाने का तरीका।',

    exportHeading: 'अपना डेटा डाउनलोड करें',
    exportIntro:
      'एक फ़ाइल जिसमें आपकी प्रोफ़ाइल, आपकी सदस्यताएँ, आपके अंक, आपकी उपस्थिति, आपके प्रगति पत्र और आपका लिखा सब कुछ होता है। इसे तैयार होने में थोड़ा समय लगता है, और लिंक सात दिन तक काम करता है।',
    requestCopy: 'एक प्रति माँगें',
    requestedNotice: 'हम आपकी फ़ाइल तैयार कर रहे हैं। तैयार होते ही यह पृष्ठ उसे दिखाएगा।',
    notWhileErasing: 'जब तक आपका खाता हटाने के लिए निर्धारित है तब तक नहीं — पहले उसे रद्द करें।',
    noExportsYet: 'आपने पहले कभी प्रति नहीं माँगी।',
    requestedOn: '{date} को माँगी गई',
    availableUntil: '{size} · {date} तक उपलब्ध',
    download: 'डाउनलोड करें',
    downloadFailed: 'वह फ़ाइल नहीं मिल सकी।',

    statusPending: 'तैयार की जा रही है',
    statusReady: 'डाउनलोड के लिए तैयार',
    statusFailed: 'विफल',
    statusExpired: 'अवधि समाप्त',

    eraseHeading: 'अपना खाता हटाएँ',
    schoolCannotErase:
      'विद्यालय का खाता यहाँ से नहीं हटाया जा सकता। उसकी कक्षाएँ, उपस्थिति रजिस्टर और प्रगति पत्र जितने संस्था के हैं उतने ही उसके विद्यार्थियों और उनके परिवारों के भी हैं, इसलिए ऐसा खाता बंद करना एक बटन नहीं, एक बातचीत है। हमसे संपर्क करें और हम साथ मिलकर यह प्रक्रिया पूरी करेंगे।',
    graceExplained:
      'कुछ भी हटाने से पहले हम 30 दिन प्रतीक्षा करेंगे, और उस दौरान आप कभी भी अपना निर्णय बदल सकते हैं। उसके बाद इसे पलटा नहीं जा सकता।',
    confirmLabel: 'पुष्टि के लिए ERASE लिखें',
    confirmHint: 'इस साइट पर जो एक काम पलटा नहीं जा सकता, उससे पहले जानबूझकर रखी गई एक रुकावट।',
    scheduleDeletion: 'हटाना निर्धारित करें',
    scheduledOn:
      'आपका खाता {date} को हटाने के लिए निर्धारित है। तब तक सब कुछ सामान्य रूप से चलता रहेगा, और आप इसे रोक सकते हैं।',
    keepAccount: 'मेरा खाता रहने दें',
    scheduledNotice:
      'आपका खाता हटाने के लिए निर्धारित है। आप अगले 30 दिनों में कभी भी इसे रोक सकते हैं।',
    cancelledNotice: 'आपका खाता नहीं हटाया जाएगा।',

    limitsHeading: 'जो हम पलट नहीं सकते',
    limitsBody:
      'खाता हटाने से वह बैकअप नहीं बदलता जो उससे पहले लिया गया था, न ही आपके द्वारा पहले डाउनलोड की गई प्रति, और न ही आपके बारे में किसी और की दर्ज की गई शिकायत। अंक, उपस्थिति रजिस्टर और प्रगति पत्र आपके विद्यालय के पास रहते हैं: वे जितने आपके हैं उतने ही उसके भी रिकॉर्ड हैं, और अधिकतर जगहों पर उन्हें रखना उसकी बाध्यता है।',
    limitsWhatGoes:
      'जो जाता है वह आप हैं — आपकी प्रोफ़ाइल, आपका हैंडल, आपकी पोस्ट और टिप्पणियाँ, आपके संदेश, और आपका साइन इन। उसके बाद विद्यालय जो कुछ रखता है उसमें आपके नाम की जगह “एक पूर्व सदस्य” दिखता है।',

    bytes: '{count} बाइट',
    kilobytes: '{count} KB',
    megabytes: '{count} MB',
  },

  notificationPrefs: {
    metaTitle: 'अधिसूचनाएँ · GetConnected',
    title: 'अधिसूचनाएँ',
    description:
      'आप किन बातों की जानकारी चाहते हैं। किसी को बंद करने पर वह आपकी सूची में आना ही बंद हो जाती है।',
    academic: 'गृहकार्य, असाइनमेंट और परियोजनाएँ',
    notice: 'विद्यालय की सूचनाएँ',
    event: 'कार्यक्रम',
    leaveCategory: 'छुट्टी के आवेदन और निर्णय',
    socialCategory: 'फ़ॉलो, कनेक्शन, लाइक और टिप्पणियाँ',
    message: 'सीधे संदेश',
    alwaysTold:
      'सत्यापन के निर्णय और आपके विद्यालय की सदस्यता से जुड़ी बातें आपको हमेशा बताई जाएँगी — वे आपके पूछे हुए सवालों के उत्तर हैं, घोषणाएँ नहीं।',
    save: 'प्राथमिकताएँ सहेजें',
    saved: 'सहेज दिया गया।',
  },

  security: {
    metaTitle: 'सुरक्षा · GetConnected',
    title: 'सुरक्षा',
    description: 'आप यह कैसे सिद्ध करते हैं कि यह आप ही हैं।',
    twoFactorHeading: 'दो-चरणीय प्रमाणीकरण',
    notAvailable:
      'यह विद्यालय के खातों और प्रधानाचार्यों के लिए उपलब्ध है — वे खाते जो सदस्यों को स्वीकृति दे सकते हैं और विद्यालय के हर परिवार तक पहुँच सकते हैं। आपका खाता इनमें से कुछ नहीं करता, इसलिए एक मज़बूत पासवर्ड पर्याप्त है।',
  },
};

export default hi;
