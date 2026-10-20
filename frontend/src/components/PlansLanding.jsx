import React from "react";
import { Check, Crown, LogIn, Sparkles, ShieldCheck, Zap, Headphones, ArrowRight } from "lucide-react";

export default function PlansLanding({ appLang, settings, onFreeClick, onVipClick, isLoggingIn }) {
  const km = appLang === "km";
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const features = (items) => items.map((item) => (
    <li key={item}><Check size={16} aria-hidden="true" /> <span>{item}</span></li>
  ));
  return (
    <section className="plans-landing">
      <div className="landing-orb landing-orb-one" />
      <div className="landing-orb landing-orb-two" />
      <div className="plans-hero">
        {/* <div className="landing-brand"><span className="landing-brand-mark"><Sparkles size={22} /></span><span>Text-Speech <b>Studio</b></span></div> */}
        <h2>{km ? <>បម្លែងអត្ថបទទៅជា<br/><span className="hero-gradient-text">សំឡេងធម្មជាតិ</span></> : <>Turn your text into<br/><span className="hero-gradient-text">natural speech</span></>}</h2>
        <p>{km ? "បង្កើតសំឡេងសម្រាប់វីដេអូ មេរៀន និងមាតិការបស់អ្នកបានយ៉ាងងាយស្រួល។ ជ្រើសរើសគម្រោងដែលសមស្របនឹងការប្រើប្រាស់របស់អ្នក។" : "Create voiceovers for videos, lessons, and content in just a few clicks. Choose the plan that fits your workflow."}</p>
        <div className="hero-trust-row">
          <span><ShieldCheck size={16}/>{km ? "ការចូលប្រើមានសុវត្ថិភាព" : "Secure Google sign-in"}</span>
          <span><Zap size={16}/>{km ? "បង្កើតសំឡេងបានលឿន" : "Fast voice generation"}</span>
          <span><Headphones size={16}/>{km ? "សម្រាប់អ្នកបង្កើតមាតិកា" : "Made for creators"}</span>
        </div>
      </div>
      <div className="plans-section-heading">
        <div><span className="section-overline">{km ? "ជ្រើសរើសគម្រោង" : "SIMPLE PRICING"}</span><h3>{km ? "គម្រោងសម្រាប់អ្នក" : "Plans for every creator"}</h3></div>
        <p>{km ? "ចាប់ផ្តើមដោយឥតគិតថ្លៃ ឬដំឡើងគម្រោងសម្រាប់ដែនកំណត់ខ្ពស់ជាងមុន។" : "Start free, then upgrade whenever you need more."}</p>
      </div>
      <div className="plans-grid">
        <article className="plan-card plan-card-free">
          <div className="plan-card-top"><div className="plan-icon free-icon"><LogIn size={22} /></div><span className="plan-label">{km ? "ចាប់ផ្តើម" : "STARTER"}</span></div>
          <h3>{km ? "ឥតគិតថ្លៃ" : "Free"}</h3>
          <p className="plan-description">{km ? "សាកល្បងបង្កើតសំឡេង មុនពេលដំឡើងគម្រោង។" : "Explore text-to-speech with no payment required."}</p>
          <div className="plan-price">$0 <span>/{km ? "ជានិច្ច" : "forever"}</span></div>
          <div className="plan-divider" />
          <ul>{features([`${Number(settings.freeLimit || 200).toLocaleString()} ${km ? "តួអក្សរសរុប" : "total characters included"}`, km ? "សំឡេង TTS ស្តង់ដារ" : "Standard TTS access", km ? "ចូលប្រើដោយ Google" : "Google account sign-in"])}</ul>
          <button className="plan-button plan-button-free" onClick={onFreeClick} disabled={isLoggingIn}>{isLoggingIn ? (km ? "កំពុងចូល..." : "Signing in...") : <>{km ? "ចាប់ផ្តើមដោយឥតគិតថ្លៃ" : "Get started free"}<ArrowRight size={17}/></>}</button>
        </article>
        <article className="plan-card plan-card-vip">
          <div className="popular-ribbon">{km ? "ពេញនិយម" : "MOST POPULAR"}</div>
          <div className="plan-card-top"><div className="plan-icon vip-icon"><Crown size={22} /></div><span className="plan-label">PLUS</span></div>
          <h3>Plus</h3>
          <p className="plan-description">{km ? "សម្រាប់អ្នកបង្កើតមាតិកាដែលត្រូវការដែនកំណត់សរុប 10,000 តួអក្សរ។" : "For creators who need a 10,000-character total allowance."}</p>
          <div className="plan-price">{money(settings.vipProPrice)} <span>/{km ? "ខែ" : "month"}</span></div>
          <div className="plan-divider" />
          <ul>{features([`${Number(settings.vipProLimit || 10000).toLocaleString()} ${km ? "តួអក្សរសរុប" : "total characters included"}`, km ? "ជម្រើសសំឡេង និងរបៀបអាន" : "Voice and reading-style options", km ? "បើកប្រើក្រោយ Admin អនុម័ត" : "Access after admin approval"])}</ul>
          <button className="plan-button plan-button-vip" onClick={() => onVipClick("pro")} disabled={isLoggingIn}><Crown size={17}/>{km ? "ជ្រើសរើស Plus" : "Choose Plus"}<ArrowRight size={17}/></button>
        </article>
        <article className="plan-card plan-card-unlimited">
          <div className="plan-card-top"><div className="plan-icon unlimited-icon"><Sparkles size={22} /></div><span className="plan-label">{km ? "ការប្រើប្រាស់ច្រើន" : "POWER USERS"}</span></div>
          <h3>VIP</h3>
          <p className="plan-description">{km ? "សម្រាប់អ្នកត្រូវការដែនកំណត់ខ្ពស់ និងការងារច្រើន។" : "For heavy workloads and frequent voice generation."}</p>
          <div className="plan-price">{money(settings.vipUnlimitedPrice)} <span>/{km ? "ខែ" : "month"}</span></div>
          <div className="plan-divider" />
          <ul>{features([`${Number(settings.vipUnlimitedLimit || 50000).toLocaleString()} ${km ? "តួអក្សរសរុប" : "total characters included"}`, km ? "សម្រាប់ការងារច្រើន" : "More room for larger projects", km ? "បើកប្រើក្រោយ Admin អនុម័ត" : "Access after admin approval"])}</ul>
          <button className="plan-button plan-button-outline" onClick={() => onVipClick("unlimited")} disabled={isLoggingIn}>{km ? "ជ្រើសរើស VIP" : "Choose VIP"}<ArrowRight size={17}/></button>
        </article>
      </div>
      <div className="landing-help-note"><ShieldCheck size={18}/><p>{km ? "មានគណនី VIP រួចហើយ? ចុចគម្រោង VIP របស់អ្នក ហើយចូលដោយ Gmail ដែល Admin បានអនុម័ត។ បើមិនទាន់អនុម័ត ប្រព័ន្ធនឹងបង្ហាញ QR Code និងព័ត៌មានទំនាក់ទំនង។" : "Already approved for VIP? Select your plan and sign in with the Gmail address approved by the admin. If not approved yet, payment QR and contact details will appear."}</p></div>
      <p className="plans-footnote">{km ? "ការចូលប្រើ VIP ត្រូវផ្ទៀងផ្ទាត់តាមគណនី Google និងស្ថានភាពអនុម័តការទូទាត់។" : "VIP access is verified against your Google account and payment approval status."}</p>
    </section>
  );
}
