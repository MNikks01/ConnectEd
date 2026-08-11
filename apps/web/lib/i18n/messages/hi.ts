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
