import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Disc3, Mic2, Radio, Satellite, Sparkles, Star, Zap } from 'lucide-react';
import { AlienPortrait, AvatarPreview } from './World.jsx';
import './hall-of-fame.css';

const ALIEN_TITLES = [
  'CERTIFIED SPACE MENACE', 'WANTED FOR BAD DANCING', 'MOONWALKING SUSPECT',
  'PROFESSIONAL EARTHLING', 'INTERSTELLAR MIC THIEF', 'UNLICENSED ROCKSTAR',
  'DISCO PLANET FUGITIVE', 'PROBABLY FRIENDLY', 'GALAXY CLASS GOOFBALL',
  'COSMIC NOISE EXPERT', 'MOTHERSHIP FAVORITE', 'PART-TIME UFO PILOT',
];
const ALIEN_QUOTES = [
  'I DID NOT EAT THE MICROPHONE.', 'MY SPACESHIP HAS BETTER AUTOTUNE.',
  'TAKE ME TO YOUR DJ.', 'THE MOON MADE ME DO IT.', 'EARTH HAS GREAT SNACKS.',
  'NO THOUGHTS. JUST BASS.', 'PLEASE IGNORE MY EXTRA ELBOWS.',
  'I CAME. I SAW. I SANG.', 'MY UFO IS DOUBLE PARKED.',
  'THESE ANTENNAE ARE NATURAL.', 'THE CROWD WAS MOSTLY COWS.',
  'UNABLE TO STOP GROOVING.',
];
const ACCENTS = ['#c7ff54', '#fa91dc', '#9b94ff', '#ffbb65', '#7fe9df'];

function alienNumber(id) {
  let value = 0;
  for (const char of String(id)) value = (Math.imul(value, 31) + char.charCodeAt(0)) | 0;
  return Math.abs(value);
}
function formatDate(date) {
  const stamp = new Date(date);
  if (!Number.isFinite(stamp.getTime())) return 'UNKNOWN EARTH DATE';
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(stamp).toUpperCase();
}

/** One character per participant, retaining their most recent song and best score. */
export function hallMembers(records) {
  const members = new Map();
  const latest = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const record of latest) {
    const original = members.get(record.profileId);
    if (original) {
      original.plays += 1;
      original.bestScore = Math.max(original.bestScore, record.score);
      if (!original.profile.photo && record.photo) {
        original.profile.photo = record.photo;
        original.profile.faceVersion = record.faceVersion;
      }
      continue;
    }
    const number = alienNumber(record.profileId);
    members.set(record.profileId, {
      id: record.profileId, number, nickname: record.nickname, song: record.song,
      createdAt: record.createdAt, plays: 1, bestScore: record.score,
      title: ALIEN_TITLES[number % ALIEN_TITLES.length],
      quote: ALIEN_QUOTES[Math.floor(number / 7) % ALIEN_QUOTES.length],
      accent: ACCENTS[number % ACCENTS.length],
      profile: { nickname: record.nickname, photo: record.photo, faceVersion: record.faceVersion },
    });
  }
  return [...members.values()];
}

/** Render full-body GPU portraits only as their gallery cards approach the viewport. */
function HallCharacterAvatar({ member }) {
  const host = useRef(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [visible]);
  return <span className="hall-character-dance" ref={host}>
    {visible ? <AlienPortrait profile={member.profile} seed={member.number % 9} size={240} variant="full" />
      : <svg className="hall-alien-loading" viewBox="0 0 100 130" aria-hidden="true"><path fill="#b4ee79" d="M44 63h12l8 43 10 23-24-12-24 12 10-23zM32 71L14 104l7 4 25-34zm36 0 18 33-7 4-25-34z"/><ellipse cx="50" cy="40" rx="36" ry="40" fill="#b4ee79"/><ellipse cx="36" cy="40" rx="9" ry="15" transform="rotate(-28 36 40)" fill="#101629"/><ellipse cx="64" cy="40" rx="9" ry="15" transform="rotate(28 64 40)" fill="#101629"/></svg>}
  </span>;
}

export default function HallOfFame({ records, reducedMotion=false }) {
  const members = useMemo(() => hallMembers(records), [records]);
  const [activeId, setActiveId] = useState(null);
  const spotlight = useRef(null);
  const selectedIndex = Math.max(0, members.findIndex(member => member.id === activeId));
  const selected = members[selectedIndex];
  const chooseRelative = delta => setActiveId(members[(selectedIndex + delta + members.length) % members.length].id);
  const spotlightMember = id => {
    setActiveId(id);
    spotlight.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  };

  return <div className="hall-of-fame">
    <div className="hall-intro">
      <span className="eyebrow"><Satellite size={15}/> MOTHERSHIP ARCHIVE / SECTOR 07</span>
      <div className="hall-intro-line">
        <div>
          <h2>THE GALACTIC<br/><em>YEARBOOK.</em></h2>
          <p>Meet the actual aliens who've grabbed the mic. Every face has a story. Most of the stories are deeply suspicious.</p>
        </div>
        <div className="hall-counter"><strong>{String(members.length).padStart(2, '0')}</strong><span>ALIENS<br/>SIGHTED</span></div>
      </div>
    </div>

    {members.length === 0 ? <div className="hall-empty">
      <div className="hall-empty-orbit" aria-hidden="true"><span>?</span></div>
      <h3>NO ALIENS HAVE BEEN SPOTTED. YET.</h3>
      <p>Sing a song and your ridiculous new alien avatar will join the gallery right here.</p>
      <span><Radio size={15}/> AWAITING FIRST TRANSMISSION</span>
    </div> : <>
      <div className="hall-spotlight" ref={spotlight} style={{ '--hall-accent': selected.accent }}>
        <div className="hall-spotlight-stage">
          <span className="hall-stage-kicker"><span className="hall-blink"/> LIVE ALIEN SIGHTING</span>
          <div className="hall-stage-halo" aria-hidden="true"/>
          <AvatarPreview profile={selected.profile} transparent/>
          <div className="hall-stage-floor" aria-hidden="true"/>
          <span className="hall-speech" aria-hidden="true">{selected.quote}</span>
          <span className="hall-stage-corner" aria-hidden="true">✳ ZONE 07</span>
        </div>
        <div className="hall-spotlight-info">
          <span className="hall-stamp"><Zap size={14}/> CURRENTLY UNDER INVESTIGATION</span>
          <span className="hall-id">SUBJECT {String(selectedIndex + 1).padStart(3, '0')} / {String(members.length).padStart(3, '0')}</span>
          <h3>{selected.nickname}</h3>
          <strong className="hall-title">{selected.title}</strong>
          <div className="hall-last-song"><Disc3 size={17}/><div><span>LAST HEARD SINGING</span><b>{selected.song}</b></div></div>
          <div className="hall-stat-row">
            <div><b>{selected.plays}</b><span>{selected.plays===1?'PERFORMANCE':'PERFORMANCES'}</span></div>
            <div><b>{selected.bestScore}<small> / 100</small></b><span>BEST SPACE LUCK</span></div>
          </div>
          <span className="hall-last-seen">LAST SPOTTED · {formatDate(selected.createdAt)}</span>
          <div className="hall-pager"><button aria-label="Previous alien" onClick={() => chooseRelative(-1)}><ArrowLeft size={19}/></button><span>FLIP THROUGH THE SUSPECTS</span><button aria-label="Next alien" onClick={() => chooseRelative(1)}><ArrowRight size={19}/></button></div>
        </div>
      </div>
      <div className="hall-roster-heading"><div><span className="eyebrow"><Sparkles size={15}/> THE SUSPECT LINEUP</span><h3>THE WHOLE WEIRD CREW.</h3></div><span>{members.length} VERIFIED SIGHTINGS · {records.length} TOTAL PLAYS</span></div>
      <div className="hall-roster">
        {members.map((member, index) => <button
          className={`hall-character ${member.id===selected.id?'chosen':''}`}
          type="button" key={member.id} aria-pressed={member.id===selected.id}
          aria-label={`Spotlight ${member.nickname}`}
          onClick={() => spotlightMember(member.id)}
          style={{ '--hall-accent':member.accent, '--hall-tilt': `${(member.number % 9) - 4}deg`, '--hall-delay':`${-(member.number%20)*0.17}s` }}>
          <div className="hall-card-head"><span>ALIEN FILE · {String(index+1).padStart(3,'0')}</span><Star size={15}/></div>
          <div className="hall-character-stage">
            <span className="hall-orbit" aria-hidden="true"/>
            <HallCharacterAvatar member={member}/>
            <span className="hall-character-shadow" aria-hidden="true"/>
            <span className="hall-card-sticker">{member.title}</span>
          </div>
          <div className="hall-card-data"><strong>{member.nickname}</strong><span>{member.song}</span></div>
          <div className="hall-card-foot"><span><Mic2 size={13}/> {member.plays} {member.plays===1?'GIG':'GIGS'}</span><span>VIEW ALIEN <ArrowRight size={14}/></span></div>
        </button>)}
      </div>
      <div className="hall-endnote"><Radio size={16}/> ALL PHOTOS AND PERFORMANCE RECORDS LIVE ONLY IN THIS BROWSER. NO ACTUAL ALIENS WERE ARRESTED.</div>
    </>}
  </div>;
}
