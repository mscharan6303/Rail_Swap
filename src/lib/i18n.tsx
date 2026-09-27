import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const dict = {
  en: {
    appName: "RailSwap",
    tagline: "Swap train seats with ease",
    home: "Home", create: "Create", requests: "Requests", chats: "Chats", profile: "Profile",
    alerts: "Alerts", trips: "Trips", you: "You", myRequests: "My Requests",
    welcome: "Welcome back",
    findSeat: "Find your perfect seat swap",
    postOrBrowse: "Post a request or browse fellow passengers travelling with you.",
    createRequest: "Create request",
    open: "Open", yours: "Yours", trust: "Trust",
    nearbyMatches: "Nearby matches", viewAll: "View all",
    searchPlaceholder: "Search train, route…",
    noOpen: "No open requests yet",
    settings: "Settings", appearance: "Appearance", darkMode: "Dark mode",
    language: "Language", appLanguage: "App language",
    account: "Account", signOut: "Sign out",
    editProfile: "Edit profile", name: "Name", gender: "Gender", bio: "About you",
    save: "Save", cancel: "Cancel", saving: "Saving…",
    male: "Male", female: "Female", other: "Other",
    disclaimer: "This app is not affiliated with IRCTC or Indian Railways.",
    signIn: "Sign in", about: "About", privacy: "Privacy", terms: "Terms", help: "Help"
  },
  hi: {
    appName: "RailSwap",
    tagline: "ट्रेन की सीटें आसानी से बदलें",
    home: "होम", create: "बनाएं", requests: "अनुरोध", chats: "चैट", profile: "प्रोफ़ाइल",
    alerts: "सूचनाएं", trips: "यात्राएं", you: "आप", myRequests: "मेरे अनुरोध",
    welcome: "वापसी पर स्वागत है",
    findSeat: "अपनी पसंदीदा सीट अदला-बदली खोजें",
    postOrBrowse: "अनुरोध पोस्ट करें या साथी यात्रियों को देखें।",
    createRequest: "अनुरोध बनाएं",
    open: "खुले", yours: "आपके", trust: "विश्वास",
    nearbyMatches: "नज़दीकी मिलान", viewAll: "सभी देखें",
    searchPlaceholder: "ट्रेन, मार्ग खोजें…",
    noOpen: "अभी कोई खुला अनुरोध नहीं",
    settings: "सेटिंग्स", appearance: "रूप", darkMode: "डार्क मोड",
    language: "भाषा", appLanguage: "ऐप भाषा",
    account: "खाता", signOut: "साइन आउट",
    editProfile: "प्रोफ़ाइल संपादित करें", name: "नाम", gender: "लिंग", bio: "अपने बारे में",
    save: "सहेजें", cancel: "रद्द करें", saving: "सहेजा जा रहा है…",
    male: "पुरुष", female: "महिला", other: "अन्य",
    disclaimer: "यह ऐप IRCTC या भारतीय रेलवे से संबद्ध नहीं है।",
    signIn: "साइन इन", about: "हमारे बारे में", privacy: "गोपनीयता", terms: "शर्तें", help: "मदद"
  },
  te: {
    appName: "RailSwap",
    tagline: "రైలు సీట్లను సులభంగా మార్పిడి చేయండి",
    home: "హోమ్", create: "సృష్టించు", requests: "అభ్యర్థనలు", chats: "చాట్", profile: "ప్రొఫైల్",
    alerts: "నోటిఫికేషన్లు", trips: "ప్రయాణాలు", you: "మీరు", myRequests: "నా అభ్యర్థనలు",
    welcome: "తిరిగి స్వాగతం",
    findSeat: "మీ సరైన సీటు మార్పిడిని కనుగొనండి",
    postOrBrowse: "అభ్యర్థన పోస్ట్ చేయండి లేదా తోటి ప్రయాణికులను చూడండి.",
    createRequest: "అభ్యర్థన సృష్టించు",
    open: "ఓపెన్", yours: "మీవి", trust: "నమ్మకం",
    nearbyMatches: "సమీప మ్యాచ్‌లు", viewAll: "అన్నీ చూడండి",
    searchPlaceholder: "రైలు, మార్గం వెతకండి…",
    noOpen: "ఇంకా ఓపెన్ అభ్యర్థనలు లేవు",
    settings: "సెట్టింగ్‌లు", appearance: "రూపం", darkMode: "డార్క్ మోడ్",
    language: "భాష", appLanguage: "యాప్ భాష",
    account: "ఖాతా", signOut: "సైన్ అవుట్",
    editProfile: "ప్రొఫైల్ సవరించు", name: "పేరు", gender: "లింగం", bio: "మీ గురించి",
    save: "సేవ్", cancel: "రద్దు", saving: "సేవ్ చేస్తోంది…",
    male: "పురుషుడు", female: "స్త్రీ", other: "ఇతర",
    disclaimer: "ఈ యాప్ IRCTC లేదా భారతీయ రైల్వేతో అనుబంధం లేదు.",
    signIn: "సైన్ ఇన్", about: "మా గురించి", privacy: "గోప్యత", terms: "నిబంధనలు", help: "సహాయం"
  },
} as const;

export type Lang = keyof typeof dict;
export type TKey = keyof typeof dict["en"];

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string } | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (stored && dict[stored]) setLangState(stored);
  }, []);
  const value = useMemo(() => {
    const setLang = (l: Lang) => {
      setLangState(l);
      if (typeof localStorage !== "undefined") localStorage.setItem("lang", l);
      if (typeof document !== "undefined") document.documentElement.lang = l;
    };
    const t = (k: TKey) => (dict[lang][k] ?? dict.en[k]) as string;
    return { lang, setLang, t };
  }, [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
