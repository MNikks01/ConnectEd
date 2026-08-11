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

  errorPages: {
    notFoundTitle: 'पृष्ठ नहीं मिला',
    notFoundBody:
      '404 — यह पता मौजूद नहीं है। हो सकता है यह बदल गया हो, या जिस लिंक से आप यहाँ आए वह पुराना हो।',
    backToStart: 'शुरुआत पर वापस',
    somethingWentWrong: 'कुछ गड़बड़ हो गई',
    portalFailed: 'पोर्टल लोड नहीं हो सका।',
    reference: 'संदर्भ: {digest}',
    tryAgain: 'फिर कोशिश करें',
  },

  schoolProfile: {
    metaTitle: 'विद्यालय प्रोफ़ाइल · GetConnected',
    title: 'विद्यालय प्रोफ़ाइल',
    description: 'सदस्य और आगंतुक यही देखते हैं। यहाँ सब कुछ संपादित किया जा सकता है।',
  },

  schoolNotices: {
    metaTitle: 'सूचनाएँ · GetConnected',
    title: 'सूचनाएँ',
    description: 'यहाँ प्रकाशित हर चीज़ विद्यालय के हर सत्यापित सदस्य तक पहुँचती है।',
    publishedLabel: 'प्रकाशित सूचनाएँ',
    publishHeading: 'सूचना प्रकाशित करें',
  },

  schoolEvents: {
    metaTitle: 'कार्यक्रम · GetConnected',
    title: 'कार्यक्रम',
    description: 'विद्यालय में सत्यापित हर व्यक्ति इन्हें देखता है।',
    rangeNav: 'अवधि',
    upcoming: 'आगामी',
    includingPast: 'बीते हुए सहित',
    scheduledLabel: 'निर्धारित कार्यक्रम',
    addHeading: 'कार्यक्रम जोड़ें',
  },

  schoolComplaints: {
    metaTitle: 'शिकायतें · GetConnected',
    title: 'शिकायतें और सुझाव',
    description: 'अभिभावकों और कर्मचारियों की ओर से। हर एक के साथ दर्ज करने वाले का नाम रहता है।',
    statusNav: 'स्थिति',
    all: 'सभी',
    open: 'अभी पढ़ा नहीं गया',
    underReview: 'देखा जा रहा है',
    resolved: 'निपटा दिया गया',
  },

  schoolClasses: {
    metaTitle: 'कक्षाएँ · GetConnected',
    title: 'कक्षाएँ',
    description:
      'हर कक्षा एक माध्यम, स्तर और अनुभाग से बनती है। विषय और कक्षा-शिक्षक हर कक्षा के भीतर तय होते हैं।',
    addHeading: 'कक्षा जोड़ें',
  },

  schoolTerms: {
    metaTitle: 'सत्र · GetConnected',
    title: 'सत्र',
    description:
      'वे अवधियाँ जिन्हें प्रगति पत्र दर्शाता है। अवधियाँ आपस में नहीं टकरा सकतीं, क्योंकि हर परीक्षा या तो किसी एक सत्र की होती है या किसी की नहीं।',
    listLabel: 'आपके सत्र',
    none: 'आपने अभी कोई सत्र नहीं बनाया है। जब तक आप ऐसा नहीं करते, कोई प्रगति पत्र जारी नहीं कर सकता।',
    colTerm: 'सत्र',
    colFrom: 'से',
    colTo: 'तक',
    colStatus: 'स्थिति',
    frozen: 'प्रगति पत्र जारी हो चुके — अब तिथियाँ नहीं बदलेंगी',
    notFrozen: 'अभी कोई प्रगति पत्र जारी नहीं हुआ',
    addHeading: 'सत्र जोड़ें',
  },

  schoolVerifications: {
    metaTitle: 'सत्यापन · GetConnected',
    title: 'सत्यापन',
    description:
      'अनुरोध स्वीकार करते ही सदस्य को उस कक्षा तक पहुँच मिल जाती है। अस्वीकार करने पर वे फिर से आवेदन कर सकते हैं।',
  },

  schoolMembers: {
    metaTitle: 'सदस्य · GetConnected',
    title: 'सदस्य',
    description:
      'इस विद्यालय ने जिन्हें सत्यापित किया है। किसी को हटाते ही उनकी शैक्षणिक पहुँच तुरंत समाप्त हो जाती है।',
  },

  schoolAnalytics: {
    metaTitle: 'विश्लेषण · GetConnected',
    title: 'विश्लेषण',
    description:
      'आपका विद्यालय ConnectEd का उपयोग कैसे कर रहा है, और आप जो प्रकाशित करते हैं उसका कितना पढ़ा जा रहा है।',
    notInPlan: 'अभी आपकी योजना में शामिल नहीं',
    seePlan: 'अपनी योजना देखें',
    periodNav: 'अवधि',
    last30: 'पिछले 30 दिन',
    last90: 'पिछले 90 दिन',
    lastYear: 'पिछला वर्ष',
  },

  billing: {
    metaTitle: 'बिलिंग · GetConnected',
    title: 'बिलिंग',
    description: 'आपकी योजना, उसमें क्या शामिल है, और आप उसका कितना उपयोग कर रहे हैं।',
    statusTRIALING: 'परीक्षण अवधि',
    statusACTIVE: 'सक्रिय',
    statusPAST_DUE: 'भुगतान विफल',
    statusCANCELED: 'रद्द',
    trialing:
      'आपकी परीक्षण अवधि {date} तक चलेगी — {days} शेष। उसके बाद परीक्षण की सीमाओं से आगे जोड़ने के लिए आपको एक सशुल्क योजना चाहिए होगी। आपने अब तक जो बनाया है, वह जस का तस बना रहेगा।',
    dayOne: '1 दिन',
    dayMany: '{count} दिन',
    pastDue:
      'भुगतान नहीं हो सका। आपके कर्मचारियों या विद्यार्थियों के लिए कुछ नहीं बदला है — यह सुलझने तक आपकी योजना की सारी सुविधाएँ बनी रहेंगी।',
    cancelled:
      'आपकी सदस्यता रद्द कर दी गई है, इसलिए अब निःशुल्क सीमाएँ लागू हैं। कुछ भी मिटाया नहीं गया है: आपकी सारी कक्षाएँ और सदस्य यथावत हैं, और दोबारा सदस्यता लेते ही आप फिर से जोड़ सकते हैं।',
    renews: 'आपकी योजना {date} को नवीनीकृत होगी।',
    freeLimits: 'आपका विद्यालय निःशुल्क सीमाओं पर है।',
    usageHeading: 'आप कितना उपयोग कर रहे हैं',
    usageNote:
      'सीमा तक पहुँचने पर आप नए नहीं जोड़ सकते। जो पहले से है उसे यह कभी नहीं हटाता और न छिपाता है।',
    changeHeading: 'अपनी योजना बदलना',
    changeNote:
      'स्वयं योजना बदलने की सुविधा अभी उपलब्ध नहीं है। बड़ी योजना पर जाने के लिए अपने ConnectEd संपर्क से बात करें; आपकी सीमाएँ उसी दिन बदल जाएँगी।',
  },

  schoolClassDetail: {
    back: '← सभी कक्षाएँ',
    subjectCountOne: '1 विषय',
    subjectCountMany: '{count} विषय',
    active: 'सक्रिय',
    inactive: 'निष्क्रिय',
    summary: '{subjects} · {state}',
    marks: 'अंक',
    reportCards: 'प्रगति पत्र',
    subjects: 'विषय',
    classTeacher: 'कक्षा-शिक्षक',
    timetable: 'समय-सारणी',
  },

  schoolMarks: {
    metaTitle: 'अंक · GetConnected',
    back: '← कक्षा पर वापस',
    title: 'अंक',
    description: 'इस कक्षा का हर मूल्यांकन, उन कार्यों सहित जो अभी प्रकाशित नहीं हुए।',
    none: 'इस कक्षा में अभी कोई परीक्षा नहीं है।',
    meta: '{subject} · {kind} · {date} · {max} में से · {state}',
    published: 'प्रकाशित',
    draft: 'मसौदा — कक्षा इसे नहीं देख सकती',
    nobodyMarked: 'अभी किसी को अंक नहीं दिए गए।',
    pupilCount: '{count} विद्यार्थी',
  },

  schoolReportCards: {
    metaTitle: 'प्रगति पत्र · GetConnected',
    back: '← कक्षा पर वापस',
    title: 'प्रगति पत्र',
    description: 'इस कक्षा के परिवारों को जो दिया गया, ठीक उसी रूप में जैसे वह जारी हुआ था।',
    noTerms: 'आपने अभी कोई सत्र नहीं बनाया है, इसलिए कुछ जारी हुआ ही नहीं हो सकता।',
    addTerm: 'सत्र जोड़ें',
    termShown: 'दिखाया जा रहा सत्र',
    show: 'दिखाएँ',
  },

  moderation: {
    metaTitle: 'रिपोर्टें · GetConnected',
    detailMetaTitle: 'रिपोर्ट · GetConnected',
    title: 'रिपोर्टें',
    description:
      'लोगों ने जो शिकायतें दर्ज की हैं, पुरानी पहले। हर निर्णय आपके खाते के विरुद्ध दर्ज होता है।',
    statusNav: 'स्थिति',
    statusOPEN: 'खुली',
    statusREVIEWED: 'दोबारा देखने की ज़रूरत',
    statusACTIONED: 'कार्रवाई हुई',
    statusDISMISSED: 'ख़ारिज',
    empty: 'यहाँ कुछ नहीं है।',
    subjectPOST: 'एक पोस्ट',
    subjectCOMMENT: 'एक टिप्पणी',
    subjectMESSAGE: 'एक संदेश',
    subjectACCOUNT: 'एक खाता',
    alreadyRemoved: 'पहले ही हटाया जा चुका',
    reportedByMany: '{count} लोगों ने शिकायत दर्ज की',
    messageWithheldShort:
      'संदेश स्वयं नहीं दिखाया जाता — शिकायत दर्ज होने से कोई निजी बातचीत सार्वजनिक नहीं हो जाती।',
    noContent: 'दिखाने के लिए कोई सामग्री नहीं।',
    reviewThis: 'इसकी समीक्षा करें',
    detailTitle: 'रिपोर्ट',
    backToQueue: 'सूची पर वापस',
    someone: 'कोई',
    messageWithheldLong:
      'संदेश स्वयं नहीं दिखाया जाता — शिकायत दर्ज होने से कोई निजी बातचीत सार्वजनिक नहीं हो जाती। आपके पास भेजने वाले का नाम और शिकायतकर्ता का विवरण है।',
    noContentDetail: 'इस प्रकार की शिकायत के लिए दिखाने को कोई सामग्री नहीं है।',
    reportedOnce: 'एक बार शिकायत दर्ज हुई। शिकायतकर्ताओं का नाम कभी नहीं बताया जाता।',
    reportedTimes: '{count} लोगों ने शिकायत दर्ज की। शिकायतकर्ताओं का नाम कभी नहीं बताया जाता।',
    decide: 'निर्णय लें',
  },

  classForm: {
    submit: 'कक्षा जोड़ें',
    adding: 'जोड़ा जा रहा है…',
    added: 'कक्षा जोड़ दी गई।',
    medium: 'माध्यम',
    english: 'अंग्रेज़ी',
    hindi: 'हिन्दी',
    level: 'स्तर',
    section: 'अनुभाग',
    levelPRE_NURSERY: 'प्री-नर्सरी',
    levelNURSERY: 'नर्सरी',
    levelKG1: 'केजी-1',
    levelKG2: 'केजी-2',
    levelCLASS_1: 'कक्षा 1',
    levelCLASS_2: 'कक्षा 2',
    levelCLASS_3: 'कक्षा 3',
    levelCLASS_4: 'कक्षा 4',
    levelCLASS_5: 'कक्षा 5',
    levelCLASS_6: 'कक्षा 6',
    levelCLASS_7: 'कक्षा 7',
    levelCLASS_8: 'कक्षा 8',
    levelCLASS_9: 'कक्षा 9',
    levelCLASS_10: 'कक्षा 10',
    levelCLASS_11: 'कक्षा 11',
    levelCLASS_12: 'कक्षा 12',
  },

  classTable: {
    caption: 'कक्षाएँ',
    colClass: 'कक्षा',
    colSubjects: 'विषय',
    colStatus: 'स्थिति',
    colActions: 'कार्रवाइयाँ',
    active: 'सक्रिय',
    inactive: 'निष्क्रिय',
    deactivate: 'निष्क्रिय करें',
    reactivate: 'फिर सक्रिय करें',
  },

  classTeacherForm: {
    currentTitle: 'वर्तमान कक्षा-शिक्षक',
    noneTitle: 'कोई कक्षा-शिक्षक नहीं',
    noneBody:
      'जब तक कक्षा-शिक्षक नियुक्त नहीं होता, इस कक्षा के विद्यार्थियों और अभिभावकों की छुट्टी स्वीकृत नहीं की जा सकती।',
    noTeachersTitle: 'नियुक्त करने के लिए कोई शिक्षक नहीं',
    noTeachersBody:
      'पहले इस विद्यालय के लिए किसी शिक्षक को सत्यापित करें — स्वीकृत होते ही वे यहाँ दिखेंगे।',
    replace: 'कक्षा-शिक्षक बदलें',
    allocate: 'कक्षा-शिक्षक नियुक्त करें',
    saving: 'सहेजा जा रहा है…',
    allocated: 'कक्षा-शिक्षक नियुक्त कर दिए गए।',
    teacher: 'शिक्षक',
  },

  subjectPanel: {
    name: 'विषय का नाम',
    nameHint: 'शिक्षक जब बताते हैं कि वे क्या पढ़ाते हैं, तब उन्हें यही दिखता है।',
    caption: 'इस कक्षा के विषय',
    colName: 'नाम',
    submit: 'विषय जोड़ें',
    adding: 'जोड़ा जा रहा है…',
    added: 'विषय जोड़ दिया गया।',
  },

  termForm: {
    name: 'नाम',
    nameHint: 'आपका विद्यालय इसे जो भी कहता है — “सत्र 1”, “प्रथम सत्र”।',
    firstDay: 'पहला दिन',
    lastDay: 'अंतिम दिन',
    lastDayHint:
      'सत्र आपस में नहीं टकरा सकते — हर परीक्षा या तो किसी एक सत्र की होती है या किसी की नहीं।',
    submit: 'सत्र जोड़ें',
    adding: 'जोड़ा जा रहा है…',
    added: 'जोड़ दिया गया। अब कक्षा-शिक्षक इसके विरुद्ध प्रगति पत्र जारी कर सकते हैं।',
  },

  publishForm: {
    type: 'प्रकार',
    typeHOMEWORK: 'गृहकार्य',
    typeASSIGNMENT: 'असाइनमेंट',
    typePROJECT: 'परियोजना',
    subject: 'विषय',
    subjectHint: 'आप केवल उसी विषय में प्रकाशित कर सकते हैं जो आपके विद्यालय ने आपको सौंपा है।',
    title: 'शीर्षक',
    details: 'विवरण',
    due: 'अंतिम तिथि',
    dueHint: 'वैकल्पिक।',
    submit: 'प्रकाशित करें',
    publishing: 'प्रकाशित किया जा रहा है…',
    published: 'प्रकाशित हो गया। कक्षा के सभी लोगों को सूचित कर दिया गया है।',
  },

  noticeAdmin: {
    title: 'शीर्षक',
    notice: 'सूचना',
    noticeHint: 'विद्यालय के हर सत्यापित व्यक्ति को सूचित किया जाता है।',
    submit: 'सूचना प्रकाशित करें',
    publishing: 'प्रकाशित की जा रही है…',
    published: 'सूचना प्रकाशित हो गई। विद्यालय के सभी लोगों को सूचित कर दिया गया है।',
    none: 'अभी कोई सूचना नहीं। पहली सूचना नीचे दिए फ़ॉर्म से जाएगी।',
    meta: '{date} · {author} · {count} लोगों ने पढ़ा',
    schoolFallback: 'विद्यालय',
    withdraw: 'वापस लें',
  },

  eventAdmin: {
    title: 'शीर्षक',
    details: 'विवरण',
    when: 'कब',
    submit: 'कार्यक्रम जोड़ें',
    adding: 'जोड़ा जा रहा है…',
    added: 'कार्यक्रम जोड़ दिया गया। विद्यालय के सभी लोगों को सूचित कर दिया गया है।',
    none: 'कुछ भी निर्धारित नहीं। पहला कार्यक्रम नीचे जोड़ें।',
  },

  assessmentComposer: {
    subject: 'विषय',
    kind: 'प्रकार',
    kindTEST: 'परीक्षण',
    kindEXAM: 'परीक्षा',
    kindASSIGNMENT: 'असाइनमेंट',
    kindPRACTICAL: 'प्रायोगिक',
    name: 'परीक्षा का नाम',
    nameHint: 'कक्षा इसे जिस नाम से देखेगी, जैसे “भिन्न परीक्षण”।',
    outOf: 'कुल अंक',
    outOfHint: 'हर अंक इसी के सापेक्ष पढ़ा जाता है।',
    dateSat: 'परीक्षा की तिथि',
    dateSatHint: 'जिस दिन कक्षा ने यह दी, आज की तिथि नहीं।',
    noSubjects:
      'इस कक्षा में आपको कोई विषय नहीं सौंपा गया है, इसलिए यहाँ मूल्यांकन के लिए कुछ नहीं है।',
    submit: 'परीक्षा बनाएँ',
    creating: 'बनाई जा रही है…',
    created:
      'बन गई। जब तैयार हों तब अंक भरें — जब तक आप प्रकाशित नहीं करते, कोई उन्हें नहीं देखता।',
  },

  roster: {
    caption: 'सत्यापित सदस्य',
    colMember: 'सदस्य',
    colRole: 'भूमिका',
    colScope: 'दायरा',
    colActions: 'कार्रवाइयाँ',
    unknown: 'अज्ञात',
    schoolWide: 'पूरे विद्यालय में',
    remove: 'हटाएँ',
    removeTitle: 'इस सदस्य को हटाएँ?',
    removeBody:
      '{name} की इस विद्यालय तक पहुँच तुरंत समाप्त हो जाएगी और उन्हें फिर से सत्यापित कराना होगा।',
    thisPerson: 'यह व्यक्ति',
    cancel: 'रद्द करें',
    removeConfirm: 'सदस्य हटाएँ',
  },

  verificationQueue: {
    caption: '{status} सत्यापन अनुरोध',
    filterNav: 'स्थिति के अनुसार छाँटें',
    statusPENDING: 'लंबित',
    statusVERIFIED: 'सत्यापित',
    statusREJECTED: 'अस्वीकृत',
    statusREVOKED: 'वापस लिया गया',
    selectAll: 'इस पृष्ठ के सभी लंबित चुनें',
    approveSelected: '{count} को स्वीकार करें',
    rejectSelected: '{count} को अस्वीकार करें',
    colRequester: 'अनुरोधकर्ता',
    colRole: 'भूमिका',
    colScope: 'दायरा',
    colStatus: 'स्थिति',
    colActions: 'कार्रवाइयाँ',
    unknown: 'अज्ञात',
    approve: 'स्वीकार करें',
    reject: 'अस्वीकार करें',
    decided: 'निर्णय हो चुका',
    emptyPending: 'कुछ लंबित नहीं। जैसे-जैसे सदस्य आवेदन करेंगे, नए अनुरोध यहाँ दिखेंगे।',
    emptyOther: 'इस स्थिति में कुछ नहीं है।',
    rejectTitle: 'इस अनुरोध को अस्वीकार करें?',
    rejectBody: '{name} को पहुँच नहीं मिलेगी, और वे फिर से आवेदन कर सकेंगे।',
    thisPerson: 'यह व्यक्ति',
    cancel: 'रद्द करें',
    rejectConfirm: 'अनुरोध अस्वीकार करें',
  },

  reportDecision: {
    remove: 'इसे हटाएँ',
    leave: 'इसे रहने दें',
    secondLook: 'दोबारा देखने की ज़रूरत',
    submit: 'निर्णय दर्ज करें',
    recording: 'दर्ज किया जा रहा है…',
    recorded: 'दर्ज हो गया।',
    decision: 'निर्णय',
    removableHint: 'हटाने पर सामग्री तुरंत हट जाती है।',
    notRemovableHint:
      'इस प्रकार की शिकायत यहाँ से नहीं हटाई जा सकती — किसी खाते को निलंबित करना इस सूची की कार्रवाई नहीं है।',
    note: 'टिप्पणी',
    noteHint:
      'यह ऑडिट रिकॉर्ड में आपके खाते के विरुद्ध दर्ज होती है। टीम के बाहर इसे कोई नहीं देखता।',
  },

  planUsage: {
    classes: 'कक्षाएँ',
    members: 'सदस्य',
    unlimited: '{used}, आपकी योजना में कोई सीमा नहीं',
    ofAllowed: '{allowed} में से {used}',
    full: ' · सीमा पूरी',
  },

  syllabusPanel: {
    topic: 'विषय-वस्तु',
    topicHint: 'वही विषय-वस्तु दोबारा दर्ज करने पर वह अद्यतन हो जाती है।',
    covered: 'पूरा हुआ (%)',
    subjectFallback: 'विषय',
    submit: 'प्रगति दर्ज करें',
    recording: 'दर्ज की जा रही है…',
    recorded: 'प्रगति दर्ज हो गई।',
  },
  profileForm: {
    submit: 'प्रोफ़ाइल सहेजें',
    saving: 'सहेजा जा रहा है…',
    saved: 'प्रोफ़ाइल अद्यतन हो गई।',
    name: 'नाम',
    about: 'अपने बारे में',
    achievements: 'उपलब्धियाँ',
    visibility: 'ऊपर दिया गया विवरण कौन देख सकता है',
    visibilityHint: 'आपका नाम और चित्र हमेशा दिखते हैं, ताकि लोग आपको ढूँढ़कर जुड़ सकें।',
    public: 'कोई भी जो साइन इन है',
    connectionsOnly: 'केवल मेरे कनेक्शन',
  },

  registerForm: {
    present: 'उपस्थित',
    absent: 'अनुपस्थित',
    late: 'देर से',
    excused: 'छूट प्राप्त',
    noPupils:
      'इस कक्षा में अभी कोई सत्यापित विद्यार्थी नहीं है, इसलिए उपस्थिति दर्ज नहीं की जा सकती।',
    save: 'परिवर्तन सहेजें',
    take: 'उपस्थिति दर्ज करें',
    saving: 'सहेजा जा रहा है…',
    saved: 'सहेज दिया गया।',
    alreadyTaken: 'यह उपस्थिति दर्ज हो चुकी है। इसमें किए गए बदलाव रिकॉर्ड किए जाते हैं।',
    notTaken: 'अभी किसी ने यह उपस्थिति दर्ज नहीं की है।',
  },

  timetablePanel: {
    image: 'समय-सारणी की छवि',
    imageHint:
      'JPEG, PNG या WebP। दोबारा अपलोड करने पर पुरानी छवि पिछले संस्करण के रूप में बनी रहती है।',
    imageAlt: 'समय-सारणी, संस्करण {version}',
    caption: 'संस्करण {version}, {date} को अपलोड किया गया',
    structuredOne:
      'संस्करण {version} एक संरचित सप्ताह है जिसमें 1 कालांश है, {date} को प्रकाशित। नीचे छवि अपलोड करने पर यह संस्करण {next} से बदल जाएगा; वह सप्ताह इतिहास में पढ़ा जा सकेगा।',
    structuredMany:
      'संस्करण {version} एक संरचित सप्ताह है जिसमें {count} कालांश हैं, {date} को प्रकाशित। नीचे छवि अपलोड करने पर यह संस्करण {next} से बदल जाएगा; वह सप्ताह इतिहास में पढ़ा जा सकेगा।',
    none: 'अभी कोई समय-सारणी नहीं। प्रकाशित होने तक इस कक्षा के सदस्यों को कुछ नहीं दिखता।',
    submit: 'समय-सारणी अपलोड करें',
    uploading: 'अपलोड हो रही है…',
    uploaded: 'समय-सारणी अपलोड हो गई।',
  },

  timetableGrid: {
    dayTimetable: '{day} की समय-सारणी',
    MONDAY: 'सोमवार',
    TUESDAY: 'मंगलवार',
    WEDNESDAY: 'बुधवार',
    THURSDAY: 'गुरुवार',
    FRIDAY: 'शुक्रवार',
    SATURDAY: 'शनिवार',
    SUNDAY: 'रविवार',
    empty: 'इस समय-सारणी में कोई कालांश नहीं है।',
    colTime: 'समय',
    colSubject: 'विषय',
    unnamed: 'बिना नाम का कालांश',
  },

  twoFactor: {
    codesHeading: 'इन्हें कहीं सुरक्षित रख लें',
    codesBody:
      'इनमें से हर कोड एक बार काम करता है, आपके ऐप के कोड की जगह। ये अभी दिखाए जा रहे हैं और फिर कभी नहीं — यदि इनके बिना आपका फ़ोन खो जाए, तो केवल डेटाबेस तक पहुँच रखने वाला सहकर्मी ही आपको वापस अंदर ला सकता है।',
    codesDone: 'मैंने इन्हें लिख लिया है',
    onHeading: 'दो-चरणीय प्रमाणीकरण चालू है',
    onBody:
      'साइन इन करते समय आपसे आपके ऑथेंटिकेटर का कोड माँगा जाता है। इसे बंद करने के लिए भी एक मौजूदा कोड चाहिए — केवल साइन इन ब्राउज़र काफ़ी नहीं है, और यही इसका उद्देश्य है।',
    code: 'आपके ऑथेंटिकेटर का कोड',
    turnOff: 'दो-चरणीय प्रमाणीकरण बंद करें',
    scanHeading: 'इसे स्कैन करें, फिर प्रमाणित करें',
    typeKey: 'या यह कुंजी हाथ से लिखें:',
    nothingChanges:
      'जब तक आप नीचे कोड नहीं डालते, कुछ नहीं बदलता। यदि स्कैन नहीं हुआ, तो यहीं पता चल जाएगा।',
    turnOn: 'दो-चरणीय प्रमाणीकरण चालू करें',
    wrongCode: 'यह कोड सही नहीं है। अगला आज़माएँ।',
    offHeading: 'दो-चरणीय प्रमाणीकरण बंद है',
    offBody:
      'आपका खाता सदस्यों को स्वीकृति दे सकता है और विद्यालय के हर परिवार तक पहुँच सकता है। अकेला पासवर्ड ऐसी एक चीज़ है जिसे कोई अनुमान से या कहीं और से दोहराकर पा सकता है।',
    setUp: 'दो-चरणीय प्रमाणीकरण सेट करें',
  },

  markEntry: {
    correctFor: '{name} का अंक सुधारें',
    correcting: 'सुधारा जा रहा है…',
    corrected: 'सुधार दिया गया। यह बदलाव दर्ज कर लिया गया है।',
    newScoreFor: '{name} के लिए नया अंक',
    remarkFor: '{name} के लिए टिप्पणी — परिवार इसे देखेगा',
    remarkForPupil: '{name} के लिए टिप्पणी — विद्यार्थी और उनके अभिभावक इसे देखेंगे',
    staffNoteFor: '{name} के लिए स्टाफ़ टिप्पणी — परिवार को नहीं दिखाई जाती',
    scoreFor: '{name} के अंक',
    saveDraft: 'मसौदा सहेजें',
    saving: 'सहेजा जा रहा है…',
    savedDraft: 'सहेज दिया गया। अभी इसे कोई नहीं देख सकता।',
    publishHeading: 'प्रकाशित करें',
    publishExplained:
      'प्रकाशित करने पर हर अंक एक ही क्षण में उसके विद्यार्थी और अभिभावकों को दिख जाता है। उसके बाद बदलाव एक-एक करके होते हैं और दर्ज किए जाते हैं।',
    publishConfirm: 'हाँ, ये अंक प्रकाशित करें',
    publishing: 'प्रकाशित किए जा रहे हैं…',
    published: 'प्रकाशित हो गए। कक्षा को सूचित कर दिया गया है।',
    publishQuestionOne: '{title} को 1 विद्यार्थी के लिए प्रकाशित करें?',
    publishQuestionMany: '{title} को {count} विद्यार्थियों के लिए प्रकाशित करें?',
  },

  reportCardIssuer: {
    term: 'सत्र',
    issue: 'कक्षा के लिए जारी करें',
    reissue: 'कक्षा के लिए फिर से जारी करें',
    issuing: 'जारी किया जा रहा है…',
    reissuing: 'फिर से जारी किया जा रहा है…',
    issued: 'जारी हो गए। बाद में कोई अंक सुधारा भी जाए, तो इन पत्रों के अंक वही रहेंगे।',
    reissued: 'फिर से जारी हो गए। अब हर पत्र बताता है कि उसने किसकी जगह ली।',
    firstIssueNote:
      'जारी करते समय हर अंक की एक प्रति ले ली जाती है। बाद में सुधारा गया अंक पहले से जा चुके पत्र को नहीं बदलेगा।',
    reissueNote:
      'इस कक्षा के लिए इस सत्र के प्रगति पत्र पहले से हैं। दोबारा जारी करने पर वे बदल जाएँगे, और हर नया पत्र उस पत्र की तिथि दर्ज करेगा जिसकी उसने जगह ली।',
    comments: 'टिप्पणियाँ',
    commentsNote: 'प्रगति पत्र पर टाइप की जाने वाली एकमात्र बात। परिवार इसे पढ़ता है।',
  },

  analytics: {
    weeklyActive: 'साप्ताहिक सक्रिय',
    weeklyActiveCount: 'पिछले सात दिनों में {total} सत्यापित सदस्यों में से {count} सक्रिय रहे',
    weeklyActiveRate: 'आपके सत्यापित सदस्यों का {percent}',
    noActivityYet: 'अभी तक किसी ने साइन इन नहीं किया है।',
    historyFrom: '{date} से गतिविधि दर्ज की जा रही है।',
    nothingPublished: 'अभी कुछ प्रकाशित नहीं हुआ',
    roleSTUDENT: 'विद्यार्थी',
    rolePARENT: 'अभिभावक',
    roleTEACHER: 'शिक्षक',
    rolePRINCIPAL: 'प्रधानाचार्य',
    roleUSER: 'सामान्य सदस्य',
    itemHOMEWORK: 'गृहकार्य',
    itemASSIGNMENT: 'असाइनमेंट',
    itemPROJECT: 'परियोजनाएँ',
    statusRECEIVED: 'प्राप्त',
    statusAPPROVED: 'स्वीकृत',
    statusREJECTED: 'अस्वीकृत',
    statusCANCELLED: 'रद्द',
    statusOPEN: 'खुला',
    statusIN_REVIEW: 'समीक्षा में',
    statusRESOLVED: 'निपटा दिया गया',
    statusDISMISSED: 'ख़ारिज',
    yourSchool: 'आपका विद्यालय',
    summary: '{classes} और {subjects} में {members}।',
    memberOne: '1 सत्यापित सदस्य',
    memberMany: '{count} सत्यापित सदस्य',
    classOne: '1 कक्षा',
    classMany: '{count} कक्षाएँ',
    subjectOne: '1 विषय',
    subjectMany: '{count} विषय',
    members: 'सदस्य',
    publishedTitle: 'प्रकाशित',
    notices: 'सूचनाएँ',
    events: 'कार्यक्रम',
    readThrough: 'कितना पढ़ा गया',
    noticesRead: 'सूचनाएँ: {percent}',
    academicsRead: 'गृहकार्य और असाइनमेंट: {percent}',
    denominator: 'आपके {count} सत्यापित सदस्यों के सापेक्ष मापा गया।',
    leave: 'छुट्टी',
    feedback: 'शिकायतें और सुझाव',
  },

  schoolProfileForm: {
    submit: 'परिवर्तन सहेजें',
    saving: 'सहेजा जा रहा है…',
    saved: 'प्रोफ़ाइल अद्यतन हो गई।',
    name: 'विद्यालय का नाम',
    adminName: 'प्रशासक',
    phone: 'फ़ोन',
    city: 'शहर',
    state: 'राज्य',
    country: 'देश',
    established: 'स्थापना वर्ष',
    establishedHint: 'जिस वर्ष विद्यालय शुरू हुआ।',
    affiliation: 'संबद्धता',
  },

  timetableEditor: {
    MONDAY: 'सोमवार',
    TUESDAY: 'मंगलवार',
    WEDNESDAY: 'बुधवार',
    THURSDAY: 'गुरुवार',
    FRIDAY: 'शुक्रवार',
    SATURDAY: 'शनिवार',
    SUNDAY: 'रविवार',
    unknownSubject: 'अज्ञात विषय',
    nameRequired: 'इस कालांश को कोई नाम दें, जैसे अवकाश या प्रार्थना सभा।',
    addHeading: 'कालांश जोड़ें',
    day: 'दिन',
    starts: 'आरंभ',
    ends: 'समाप्ति',
    subject: 'विषय',
    somethingElse: 'कुछ और (अवकाश, सभा…)',
    periodName: 'कालांश का नाम',
    periodNameHint: 'अवकाश, प्रार्थना सभा, खेल…',
    submit: 'समय-सारणी प्रकाशित करें',
    publishing: 'प्रकाशित की जा रही है…',
    published: 'समय-सारणी प्रकाशित हो गई। इस कक्षा के सदस्य अब इसे देख सकते हैं।',
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
