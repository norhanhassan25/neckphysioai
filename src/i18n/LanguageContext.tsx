import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
export type Language = 'ar' | 'en';
const Ctx = createContext<{language:Language;setLanguage:(v:Language)=>void}>({language:'en',setLanguage:()=>{}});
export function LanguageProvider({children}:{children:ReactNode}) {
 const [language,setLanguage] = useState<Language>(()=>localStorage.getItem('neckphysio:language')==='ar'?'ar':'en');
 useEffect(()=>{localStorage.setItem('neckphysio:language',language);document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';},[language]);
 const value=useMemo(()=>({language,setLanguage}),[language]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useLanguage=()=>useContext(Ctx);
export function LanguageSwitch(){const {language,setLanguage}=useLanguage();return <div role="group" aria-label="Website language / لغة الموقع" style={{display:'inline-flex',gap:4,padding:5,background:'var(--surface)',border:'2px solid var(--line)',borderRadius:24,boxShadow:'var(--plush-tiny)'}}><button type="button" aria-pressed={language==='ar'} onClick={()=>setLanguage('ar')} style={{padding:'7px 13px',fontWeight:800,border:0,cursor:'pointer',borderRadius:18,background:language==='ar'?'var(--mint)':'transparent'}}>العربية</button><button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')} style={{padding:'7px 13px',fontWeight:800,border:0,cursor:'pointer',borderRadius:18,background:language==='en'?'var(--mint)':'transparent'}}>English</button></div>}
