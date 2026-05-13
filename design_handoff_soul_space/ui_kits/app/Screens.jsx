// Soul Space session-flow screens. Self-contained click-thru prototype.
// All copy is verbatim from src/app/session/* and src/lib/seasons/index.ts.

const BRANCHES = [
  { id: 'A', text: "Something keeps pulling you back to a decision you thought you'd made." },
  { id: 'B', text: "You know what you feel but can't quite explain why." },
  { id: 'C', text: "You're not in crisis. But something isn't right." },
  { id: 'D', text: "You've been carrying this alone for a while." },
];
const EMOTION_TAGS = [
  'Overwhelmed','Stuck','Uncertain','Pressured','Anxious','Conflicted',
  'Exhausted','Resigned','Afraid','Numb','Relieved','Hopeful',
  'Frustrated','Lonely','Grief',
];
const SEASONS = {
  W: { name:'Winter', color:'#6B8CAE', bg:'rgba(20,32,50,.97)', text:'#C8DCF0', sec:'#8AAAC8',
       desc:'This may feel like a period of heaviness, confusion, or emotional fatigue. There may be uncertainty about what to do next, or a sense of being stuck between choices.',
       grounding:'Take a few moments to slow down your breathing and notice what feels most present right now.',
       reflection:'What feels unclear right now — and what part of that feels most important?',
       returnP:"Winter doesn't last forever. Come back in a few days — your season may already be shifting." },
  Sp:{ name:'Spring', color:'#2A8C7A', bg:'rgba(18,38,32,.97)', text:'#B8E8D4', sec:'#7ABDA0',
       desc:'This may feel like a phase of rebuilding or beginning again. There may still be uncertainty, but also a quiet sense of possibility or movement.',
       grounding:"Notice one small thing that feels like movement or progress, even if it's subtle.",
       reflection:"What is beginning to shift, even if you don't fully understand it yet?",
       returnP:'Spring moves at its own pace. Return soon — your clarity may already be growing.' },
  Su:{ name:'Summer', color:'#C9A84C', bg:'rgba(38,30,12,.97)', text:'#F2DFA0', sec:'#C8A860',
       desc:'This may feel like a time of clarity or steadiness. Decisions may feel more aligned, and there may be a sense of confidence in the direction ahead.',
       grounding:'Pause and acknowledge what feels steady or clear in this moment.',
       reflection:'What is helping you feel aligned right now?',
       returnP:"Clarity doesn't stay forever. Come back to capture what you learn from acting on it." },
  Au:{ name:'Autumn', color:'#C4784A', bg:'rgba(36,20,12,.97)', text:'#F0C8A0', sec:'#C88060',
       desc:'This may feel like a reflective period. There may be awareness of change, letting go, or processing something that has recently shifted.',
       grounding:'Take a moment to sit with what is changing, without trying to rush past it.',
       reflection:"What are you starting to understand that you didn't see before?",
       returnP:"Processing takes the time it takes. Come back when you're ready — there's no rush." },
};
const NEXT_STEPS = [
  'Write down the two things that are in tension, side by side, without trying to resolve them yet.',
  'Give yourself permission to not decide anything today — just for the next 24 hours.',
  'Talk to one person you trust — not to get advice, just to say it out loud.',
  "Take a 10-minute walk without your phone. Notice what rises up when you're quiet.",
];

const Container = ({ children, max = 640 }) => (
  <div className="animate-fade-in" style={{ padding: '24px 28px 48px', maxWidth: max, margin: '0 auto' }}>
    {children}
  </div>
);

// ---- AGE GATE ---------------------------------------------------------------
function AgeGate({ go }) {
  return (
    <main data-screen-label="01 Age gate" style={{ background:'#060E18', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div className="animate-fade-in" style={{ width:'100%', maxWidth:360, textAlign:'center' }}>
        <Logo size="lg" />
        <div style={{ width:32, height:1, margin:'16px auto 20px', background:'rgba(201,168,76,.2)' }} />
        <p style={{ fontSize:8, letterSpacing:'.2em', textTransform:'uppercase', color:'var(--mist)', marginBottom:16 }}>Before you enter</p>
        <h1 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:24, margin:'0 0 8px' }}>How old are you?</h1>
        <p style={{ fontSize:12, color:'var(--mist)', marginBottom:28, lineHeight:1.55 }}>
          Soul Space is designed for people 13 and older.<br/>We don't store your answer.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
          <button onClick={() => alert('Soul Space is designed for ages 13+.')} style={{ padding:'16px 22px', borderRadius:12, fontSize:16, fontFamily:'var(--font-serif)', fontStyle:'italic', cursor:'pointer', border:'1px solid rgba(212,64,64,.28)', color:'rgba(240,133,133,.85)', background:'transparent' }}>Under 13</button>
          <button onClick={() => go('resonance')} style={{ padding:'16px 22px', borderRadius:12, fontSize:16, cursor:'pointer', border:'1px solid rgba(124,58,237,.3)', color:'#a78bfa', background:'transparent' }}>
            <span style={{ fontFamily:'var(--font-serif)', fontStyle:'italic' }}>Ages 13–17</span>
            <div style={{ fontSize:12, marginTop:4, color:'rgba(167,139,250,.7)' }}>Teen-safe experience · AADC compliant</div>
          </button>
          <button onClick={() => go('resonance')} style={{ padding:'16px 22px', borderRadius:12, fontSize:16, fontFamily:'var(--font-serif)', fontStyle:'italic', cursor:'pointer', border:'1px solid rgba(201,168,76,.4)', color:'var(--gold2)', background:'rgba(201,168,76,.06)' }}>18 or older →</button>
        </div>
        <p style={{ fontSize:12, color:'rgba(139,167,184,.55)', lineHeight:1.6 }}>
          No data collected or stored from this screen.<br/>CPRA · AADC · COPPA compliant
        </p>
      </div>
    </main>
  );
}

// ---- RESONANCE ENTRY --------------------------------------------------------
function Resonance({ go, set }) {
  const [selected, setSelected] = React.useState(null);
  const tap = (id) => { setSelected(id); set('branch', id); setTimeout(() => go('emotions'), 280); };
  return (
    <main data-screen-label="02 Resonance entry" style={{ background:'#060E18', minHeight:'100vh' }}>
      <SessionNav />
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'28px 20px 48px' }}>
        <div className="animate-fade-in" style={{ width:'100%', maxWidth:640 }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <Affirm style={{ marginBottom:20, fontSize:16 }}>You do not need to explain everything right away.<br/>Let's begin with what feels closest.</Affirm>
            <h1 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:32, lineHeight:1.15, margin:'0 0 10px' }}>
              Right now, something feels<br/><em style={{ color:'var(--gold2)' }}>like this —</em>
            </h1>
            <p style={{ fontSize:14, color:'var(--mist)' }}>You may be carrying more than one thing. Tap the one that fits most.</p>
          </div>
          {BRANCHES.map(({ id, text }) => (
            <button key={id} onClick={() => tap(id)} style={{
              width:'100%', textAlign:'left', padding:'18px 48px 18px 20px', borderRadius:12,
              fontFamily:'var(--font-serif)', fontSize:17, fontStyle:'italic',
              cursor:'pointer', marginBottom:12, position:'relative',
              border:`1px solid ${selected === id ? 'rgba(201,168,76,1)' : 'rgba(201,168,76,.18)'}`,
              background: selected === id ? 'rgba(201,168,76,.08)' : 'transparent',
              color: selected === id ? 'var(--gold2)' : 'var(--sand)', lineHeight:1.5,
            }}>“{text}”
              <span style={{ position:'absolute', right:18, top:'50%', transform:'translateY(-50%)', color:'rgba(201,168,76,.4)', fontStyle:'normal', fontSize:14, fontFamily:'var(--font-sans)' }}>→</span>
            </button>
          ))}
          <p style={{ textAlign:'center', fontSize:12, color:'rgba(139,167,184,.55)', marginTop:18, lineHeight:1.6 }}>
            No need to get it perfect. No wrong answer.<br/>Everything that follows adapts to your selection.
          </p>
        </div>
      </div>
    </main>
  );
}

// ---- EMOTIONS ---------------------------------------------------------------
function Emotions({ go, set }) {
  const [selected, setSelected] = React.useState([]);
  const toggle = (t) => setSelected(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  return (
    <main data-screen-label="03 Emotions" style={{ background:'#060E18', minHeight:'100vh' }}>
      <SessionNav right="Step 1 of 3" />
      <Container>
        <ProgressBar step={1} total={3} />
        <Affirm style={{ marginBottom:14, fontSize:16 }}>Something here already has a shape.<br/>You do not have to name all of it.</Affirm>
        <h2 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:30, margin:'0 0 8px', lineHeight:1.2 }}>
          What are you carrying <em style={{ color:'var(--gold2)' }}>right now?</em>
        </h2>
        <p style={{ fontSize:15, color:'var(--mist)', marginBottom:20 }}>Choose what feels most present. More than one can be true.</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {EMOTION_TAGS.map(t => (
            <button key={t} onClick={() => toggle(t)} style={{
              padding:'9px 16px', borderRadius:999, fontSize:14, cursor:'pointer',
              border:`1px solid ${selected.includes(t) ? 'rgba(201,168,76,.55)' : 'rgba(201,168,76,.22)'}`,
              background: selected.includes(t) ? 'rgba(201,168,76,.08)' : 'transparent',
              color: selected.includes(t) ? 'var(--gold2)' : 'var(--mist)',
            }}>{t}</button>
          ))}
        </div>
        {selected.length > 0 && <p style={{ fontSize:12, color:'rgba(139,167,184,.55)', marginBottom:22 }}>{selected.length} selected</p>}
        <button onClick={() => { set('emotions', selected); go('intensity'); }}
                disabled={selected.length === 0} className="btn-primary">Continue →</button>
      </Container>
    </main>
  );
}

// ---- INTENSITY --------------------------------------------------------------
function Intensity({ go, set }) {
  const [v, setV] = React.useState(7);
  const pct = ((v - 1) / 9) * 100;
  return (
    <main data-screen-label="04 Intensity" style={{ background:'#060E18', minHeight:'100vh' }}>
      <SessionNav right="Step 2 of 3" />
      <Container>
        <ProgressBar step={2} total={3} />
        <h2 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:30, margin:'0 0 26px', lineHeight:1.2 }}>
          How <em style={{ color:'var(--gold2)' }}>heavy</em> does this feel right now?
        </h2>
        <div style={{ borderRadius:12, padding:24, marginBottom:22, background:'rgba(15,30,46,.6)', border:'1px solid rgba(245,237,216,.08)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontSize:15, color:'var(--mist)' }}>Weight</span>
            <span style={{ fontFamily:'var(--font-serif)', color:'var(--gold2)', fontSize:26 }}>{v} / 10</span>
          </div>
          <div style={{ position:'relative', height:2, borderRadius:2, background:'rgba(245,237,216,.07)', marginBottom:8 }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, borderRadius:2, background:'linear-gradient(90deg, rgba(201,168,76,.4), var(--gold))' }} />
            <div style={{ position:'absolute', top:'50%', left:`${pct}%`, transform:'translate(-50%, -50%)', width:18, height:18, borderRadius:'50%', background:'var(--gold)', boxShadow:'0 0 12px rgba(201,168,76,.5)' }} />
            <input type="range" min={1} max={10} value={v} onChange={e => setV(Number(e.target.value))} style={{ position:'absolute', inset:0, width:'100%', opacity:0, cursor:'pointer', height:20, top:-9 }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:10 }}>
            <span style={{ color:'var(--mist)' }}>Barely there</span>
            <span style={{ color:'var(--gold2)', fontFamily:'var(--font-serif)', fontStyle:'italic' }}>Hard to think clearly</span>
            <span style={{ color:'var(--mist)' }}>Overwhelming</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => go('resonance')} className="btn-outline" style={{ fontSize:14 }}>Back</button>
          <button onClick={() => { set('intensity', v); go('context'); }} className="btn-primary" style={{ fontSize:14 }}>Continue →</button>
        </div>
      </Container>
    </main>
  );
}

// ---- CONTEXT (free-text) ----------------------------------------------------
function Context({ go, set }) {
  const [t, setT] = React.useState('');
  return (
    <main data-screen-label="05 Context" style={{ background:'#060E18', minHeight:'100vh' }}>
      <SessionNav right="Step 3 of 3" />
      <Container>
        <ProgressBar step={3} total={3} />
        <h2 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:30, margin:'0 0 10px', lineHeight:1.2 }}>
          What's <em style={{ color:'var(--gold2)' }}>happening?</em>
        </h2>
        <p style={{ fontSize:15, color:'var(--mist)', marginBottom:16 }}>In your own words. As much or as little as feels right.</p>
        <textarea rows={5} value={t} onChange={e => setT(e.target.value.slice(0, 800))} placeholder="Start wherever feels natural..." style={{
          width:'100%', padding:'16px 18px', borderRadius:12, fontSize:15, lineHeight:1.55, color:'var(--sand)',
          background:'rgba(245,237,216,.04)', border:'1px solid rgba(245,237,216,.18)',
          fontFamily:'var(--font-sans)', fontStyle:'italic', resize:'none', boxSizing:'border-box', outline:'none',
        }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8, marginBottom:20 }}>
          <span style={{ fontSize:12, color:'var(--mist)', fontStyle:'italic' }}>Just start — no minimum</span>
          <span style={{ fontSize:12, color:'var(--mist)' }}>{t.length} / 800</span>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => go('intensity')} className="btn-outline" style={{ fontSize:14 }}>Back</button>
          <button onClick={() => { set('context', t); go('loading'); }} className="btn-primary" style={{ fontSize:14 }}>See your reflection →</button>
        </div>
      </Container>
    </main>
  );
}

// ---- LOADING ----------------------------------------------------------------
function Loading({ go }) {
  React.useEffect(() => { const id = setTimeout(() => go('mirror'), 2200); return () => clearTimeout(id); }, []);
  return (
    <main data-screen-label="06 Mirror loading" style={{ background:'#060E18', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, padding:32, textAlign:'center' }}>
      <div className="animate-spin-slow" style={{ width:48, height:48, borderRadius:'50%', border:'2px solid rgba(201,168,76,.08)', borderTopColor:'var(--gold)' }} />
      <div className="animate-fade-in">
        <h2 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:26, lineHeight:1.2, margin:'0 0 16px' }}>
          Finding the <em style={{ color:'var(--gold2)' }}>shape</em><br/>of what you shared.
        </h2>
        <p style={{ fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:16, color:'rgba(139,167,184,.7)', lineHeight:1.7, margin:0 }}>
          Not judging. Just trying to find<br/>what sits underneath it.
        </p>
      </div>
    </main>
  );
}

// ---- MIRROR OUTPUT ----------------------------------------------------------
function Mirror({ go, data }) {
  const [tap, setTap] = React.useState(null);
  return (
    <main data-screen-label="07 Mirror output" style={{ background:'#060E18', minHeight:'100vh' }}>
      <SessionNav right={<span style={{ color:'var(--gold)' }}>Your reflection</span>} />
      <Container max={672}>
        <Affirm style={{ marginBottom:16 }}>This is not a diagnosis.<br/>It is what seems to be here, from what you shared.</Affirm>
        <h2 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:30, margin:'0 0 10px', lineHeight:1.2 }}>
          Here is what <em style={{ color:'var(--gold2)' }}>seems to be present.</em>
        </h2>
        {data.emotions?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14, marginBottom:24 }}>
            {data.emotions.map(t => (
              <span key={t} style={{ padding:'7px 14px', borderRadius:999, fontSize:13, color:'var(--gold2)', border:'1px solid rgba(201,168,76,.55)', background:'rgba(201,168,76,.08)' }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
          <div>
            {[
              ['carrying',"What you're carrying",'Two real things in genuine tension. The decision keeps returning because neither has given way.'],
              ['underneath','What appears underneath','The urgency may be less about the decision itself — and more about not wanting to carry this weight any longer.'],
            ].map(([k, l, t]) => (
              <div key={k} style={{ background:'var(--ink2)', borderRadius:12, padding:18, marginBottom:12, border:'1px solid rgba(201,168,76,.14)' }}>
                <div style={{ fontSize:11, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:10 }}>{l}</div>
                <p style={{ margin:0, fontFamily:'var(--font-serif)', fontStyle:'italic', color:'var(--sand)', lineHeight:1.55, fontSize:16 }}>{t}</p>
              </div>
            ))}
            <div style={{ borderRadius:12, padding:18, marginBottom:10, background:'rgba(42,140,122,.1)', border:'1px solid rgba(42,140,122,.32)' }}>
              <div style={{ fontSize:11, letterSpacing:'.12em', textTransform:'uppercase', color:'#5FD4BA', marginBottom:10 }}>One question back to you</div>
              <p style={{ margin:0, fontFamily:'var(--font-serif)', fontStyle:'italic', color:'var(--sand2)', lineHeight:1.5, fontSize:16 }}>
                If the deadline disappeared entirely — would the conflict itself change, or would the same two things still be in tension?
              </p>
            </div>
          </div>
          <div>
            <div style={{ background:'rgba(15,30,46,.8)', border:'1px solid rgba(201,168,76,.2)', borderRadius:12, padding:18, marginBottom:14 }}>
              <div style={{ fontSize:12, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:14, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                Did this feel accurate?
                <span style={{ fontSize:10, padding:'3px 8px', borderRadius:4, background:'rgba(201,168,76,.14)', border:'1px solid rgba(201,168,76,.4)', color:'var(--gold2)' }}>KEY METRIC</span>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setTap('accurate')} style={{
                  flex:1, padding:'12px 14px', borderRadius:10, fontSize:14, cursor:'pointer',
                  color:'#5FD4BA',
                  border:`1px solid ${tap === 'accurate' ? 'rgba(42,140,122,.85)' : 'rgba(42,140,122,.5)'}`,
                  background: tap === 'accurate' ? 'rgba(42,140,122,.22)' : 'rgba(42,140,122,.1)',
                }}>This felt accurate</button>
                <button onClick={() => setTap('not_quite')} style={{
                  flex:1, padding:'12px 14px', borderRadius:10, fontSize:14, cursor:'pointer', color:'var(--mist)',
                  border:`1px dashed ${tap === 'not_quite' ? 'rgba(245,237,216,.35)' : 'rgba(139,167,184,.35)'}`,
                  background: tap === 'not_quite' ? 'rgba(245,237,216,.05)' : 'transparent',
                }}>Not quite</button>
              </div>
              <p style={{ fontSize:12, color:'var(--mist)', marginTop:12, lineHeight:1.55 }}>
                One tap. No text required. The most important data point in Phase 1.
              </p>
            </div>
            <button onClick={() => go('season')} className="btn-primary" style={{ width:'100%', fontSize:14 }}>See your season →</button>
          </div>
        </div>
      </Container>
    </main>
  );
}

// ---- SEASON CARD ------------------------------------------------------------
const SEASON_ICONS = {
  W: <svg width="36" height="36" viewBox="0 0 44 44" fill="none" stroke="#6B8CAE" strokeWidth="1.2" strokeLinecap="round"><path d="M22 4v36M4 22h36M8.5 8.5l27 27M35.5 8.5l-27 27"/><circle cx="22" cy="22" r="4"/></svg>,
  Sp: <svg width="36" height="36" viewBox="0 0 44 44" fill="none" stroke="#2A8C7A" strokeWidth="1.2" strokeLinecap="round"><path d="M22 40V18M15 25l7-7 7 7M10 36c0-9 5-15 12-17M34 36c0-9-5-15-12-17"/><circle cx="22" cy="10" r="3"/></svg>,
  Su: <svg width="36" height="36" viewBox="0 0 44 44" fill="none" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round"><circle cx="22" cy="22" r="7"/><path d="M22 5v4M22 35v4M5 22h4M35 22h4M10 10l3 3M31 31l3 3M34 10l-3 3M13 31l-3 3"/></svg>,
  Au: <svg width="36" height="36" viewBox="0 0 44 44" fill="none" stroke="#C4784A" strokeWidth="1.2" strokeLinecap="round"><path d="M14 38c0-12 7-20 18-22-2 8-7 14-18 22z"/><path d="M26 34c0-8 5-13 14-14"/><path d="M22 38V26M18 32l4-6 4 6"/></svg>,
};
function SeasonScreen({ go }) {
  const [s, setS] = React.useState('Su');
  const season = SEASONS[s];
  return (
    <main data-screen-label="08 Season" style={{ background:'#060E18', minHeight:'100vh' }}>
      <SessionNav right={<span style={{ color: season.color }}>Your season</span>} />
      <Container>
        <ClinicalBadge>Clinically reviewed · Dr. Sofia Georgiadou · March 2026 · Verbatim — do not modify</ClinicalBadge>
        <div style={{ borderRadius:16, padding:24, marginTop:14, marginBottom:14, background: season.bg, border:`1px solid ${season.color}33`, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:1, opacity:.6, background:`linear-gradient(90deg, transparent, ${season.color}, transparent)` }} />
          <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>{SEASON_ICONS[s]}</div>
          <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color: season.color, textAlign:'center', marginBottom:10 }}>Your current season</div>
          <h2 style={{ fontFamily:'var(--font-serif)', fontWeight:300, textAlign:'center', fontSize:42, margin:'0 0 14px', lineHeight:1.15, color: season.text }}>
            This may feel like <em>{season.name}.</em>
          </h2>
          <p style={{ fontSize:15, textAlign:'center', color: season.sec, maxWidth:560, margin:'0 auto 26px', lineHeight:1.7 }}>{season.desc}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
            {[['Grounding', season.grounding],['Reflection', season.reflection],['Return', season.returnP]].map(([l, t]) => (
              <div key={l} style={{ borderRadius:10, padding:'14px 16px', background:`${season.color}14`, border:`1px solid ${season.color}33` }}>
                <div style={{ fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color: season.color, marginBottom:8 }}>{l}</div>
                <p style={{ margin:0, fontSize:13, color:'var(--sand)', lineHeight:1.5 }}>{t}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign:'center', marginTop:24 }}>
          <button onClick={() => go('nextstep')} className="btn-primary">Choose your next step →</button>
          <div style={{ marginTop:20, display:'flex', justifyContent:'center', gap:10 }}>
            {['W','Sp','Su','Au'].map(k => (
              <button key={k} onClick={() => setS(k)} title={SEASONS[k].name} style={{
                width:30, height:30, borderRadius:'50%', cursor:'pointer',
                border:`1px solid ${k === s ? SEASONS[k].color : 'rgba(245,237,216,.06)'}`,
                background: SEASONS[k].color, opacity: k === s ? 1 : .35,
              }} />
            ))}
          </div>
          <p style={{ fontSize:11, color:'rgba(139,167,184,.35)', marginTop:10 }}>preview the four season variants</p>
        </div>
      </Container>
    </main>
  );
}

// ---- NEXT STEP --------------------------------------------------------------
function NextStep({ go }) {
  const [sel, setSel] = React.useState(null);
  return (
    <main data-screen-label="09 Next step" style={{ background:'#060E18', minHeight:'100vh' }}>
      <SessionNav right="Your next step" />
      <Container>
        <Affirm style={{ marginBottom:20, fontSize:16 }}>You do not need to resolve anything today.<br/>One small thing is enough.</Affirm>
        <h2 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:36, margin:'0 0 10px', lineHeight:1.2 }}>
          Choose one action <em style={{ color:'var(--gold2)' }}>for today.</em>
        </h2>
        <p style={{ fontSize:15, color:'var(--mist)', marginBottom:24 }}>No prescription. This is entirely yours.</p>
        <div style={{ marginBottom:28 }}>
          {NEXT_STEPS.map((s, i) => (
            <button key={i} onClick={() => setSel(i)} style={{
              width:'100%', textAlign:'left', display:'flex', alignItems:'flex-start', gap:12,
              borderRadius:14, padding:'16px 18px', marginBottom:10, fontSize:14, lineHeight:1.55, cursor:'pointer',
              border: sel === i ? '1px solid rgba(201,168,76,.45)' : '1px solid rgba(201,168,76,.1)',
              background: sel === i ? 'rgba(201,168,76,.06)' : 'transparent',
              color: sel === i ? 'var(--gold2)' : 'var(--sand)', fontFamily:'var(--font-sans)',
            }}>
              <span style={{ width:8, height:8, borderRadius:'50%', marginTop:8, flexShrink:0, background: sel === i ? 'var(--gold)' : 'rgba(201,168,76,.25)' }} />
              {s}
            </button>
          ))}
          <div style={{ borderRadius:14, padding:'16px 18px', marginBottom:10, border:'1px dashed rgba(201,168,76,.15)', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'rgba(245,237,216,.07)', flexShrink:0 }} />
            <input placeholder="Write your own — what would actually feel right?" style={{ width:'100%', background:'transparent', border:0, outline:'none', fontSize:14, color:'var(--mist)', fontFamily:'var(--font-sans)' }} />
          </div>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => go('age')} className="btn-outline" style={{ fontSize:14 }}>Save session</button>
          <button onClick={() => go('age')} className="btn-primary">I'm done for now</button>
        </div>
        <p style={{ fontSize:12, color:'rgba(139,167,184,.3)', marginTop:24, lineHeight:1.6 }}>
          Session saved. Session count tracked for 7-day return measurement.<br/>No subscription prompt in Phase 1.
        </p>
      </Container>
    </main>
  );
}

// ---- CRISIS -----------------------------------------------------------------
function Crisis({ go }) {
  return (
    <main data-screen-label="10 Crisis" style={{ background:'#060E18', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 48px', textAlign:'center' }}>
      <div className="animate-fade-in" style={{ maxWidth:520 }}>
        <div style={{ width:64, height:64, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px', border:'2px solid rgba(212,64,64,.3)', background:'rgba(212,64,64,.05)' }}>
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="#D44040" strokeWidth="1.5" strokeLinecap="round"><path d="M10 2l7 4v6C17 16.5 13.8 19.5 10 20.5 6.2 19.5 3 16.5 3 12V6l7-4z"/></svg>
        </div>
        <p style={{ fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(212,64,64,.7)', marginBottom:16 }}>Outside Soul Space's scope</p>
        <h1 style={{ fontFamily:'var(--font-serif)', fontWeight:300, color:'var(--sand2)', fontSize:34, margin:'0 0 16px', maxWidth:520, lineHeight:1.2 }}>
          We noticed something outside the scope of Soul Space.
        </h1>
        <p style={{ fontSize:16, color:'var(--mist)', maxWidth:480, margin:'0 auto 32px', lineHeight:1.6 }}>
          If you are in crisis or having thoughts of harming yourself or others, please reach out now:
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:12, width:'100%', maxWidth:420, margin:'0 auto 28px' }}>
          <a style={{ display:'block', padding:'18px 20px', borderRadius:14, textAlign:'left', textDecoration:'none', background:'rgba(212,64,64,.05)', border:'1px solid rgba(212,64,64,.18)' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--sand2)', marginBottom:4 }}>988 Suicide &amp; Crisis Lifeline</div>
            <div style={{ fontSize:13, color:'var(--mist)' }}>Call or text 988 · Available 24/7</div>
          </a>
          <div style={{ padding:'18px 20px', borderRadius:14, textAlign:'left', background:'rgba(212,64,64,.05)', border:'1px solid rgba(212,64,64,.18)' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--sand2)', marginBottom:4 }}>Crisis Text Line</div>
            <div style={{ fontSize:13, color:'var(--mist)' }}>Text HOME to 741741</div>
          </div>
        </div>
        <p style={{ fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:16, color:'var(--mist)', marginBottom:24 }}>
          Soul Space will be here when you are ready to return.
        </p>
        <button onClick={() => go('age')} className="btn-outline" style={{ fontSize:14 }}>Return to Soul Space</button>
      </div>
    </main>
  );
}

Object.assign(window, { AgeGate, Resonance, Emotions, Intensity, Context, Loading, Mirror, SeasonScreen, NextStep, Crisis });
