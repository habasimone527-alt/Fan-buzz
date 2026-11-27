import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'

// Clé "publishable" : faite pour être publique, protégée par les règles RLS.
const supabase = createClient(
  'https://onxashralzqvqvgjgrzp.supabase.co',
  'sb_publishable_WnTFcP4YvUT6tQQcM0W6Ug_JVkMJqNF'
)
const SITE = 'FANBASE'

function useHash() {
  const [h, setH] = useState(window.location.hash)
  useEffect(() => {
    const f = () => { setH(window.location.hash); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}

function Home() {
  const [artists, setArtists] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.from('artists').select('slug,name,bio,avatar_url')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => (error ? setErr(error.message) : setArtists(data)))
  }, [])
  return (
    <div className="wrap">
      <h1>Artistes</h1>
      <p className="mut">Suivez vos artistes et ne ratez aucune nouveauté.</p>
      {err && <p className="ko">Erreur : {err}</p>}
      {!artists && !err && <p className="mut">Chargement…</p>}
      {artists && artists.length === 0 && <p className="mut">Aucun artiste pour le moment.</p>}
      <div className="grid">
        {artists && artists.map(a => (
          <a key={a.slug} className="card" href={'#/a/' + a.slug}>
            {a.avatar_url
              ? <img className="av" src={a.avatar_url} alt={a.name} />
              : <div className="ph">{a.name[0]}</div>}
            <div className="in"><strong>{a.name}</strong></div>
          </a>
        ))}
      </div>
    </div>
  )
}

function Subscribe({ artistId }) {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('subscribers').insert({ artist_id: artistId, email: email.trim() })
    if (!error) { setMsg({ ok: true, t: 'Merci, vous êtes inscrit !' }); setEmail('') }
    else if (error.code === '23505') setMsg({ ok: true, t: 'Vous êtes déjà inscrit.' })
    else setMsg({ ok: false, t: 'Email invalide ou erreur, réessayez.' })
  }
  return (
    <form className="card post" onSubmit={submit}>
      <strong>Recevoir les nouveautés</strong>
      <input type="email" required placeholder="Votre email" value={email} onChange={e => setEmail(e.target.value)} />
      <button className="btn" type="submit">Je m'abonne</button>
      {msg && <div className={'msg ' + (msg.ok ? 'ok' : 'ko')}>{msg.t}</div>}
    </form>
  )
}

function Artist({ slug }) {
  const [a, setA] = useState(undefined)
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  useEffect(() => {
    (async () => {
      const { data: art } = await supabase.from('artists').select('*').eq('slug', slug).maybeSingle()
      setA(art || null)
      if (!art) return
      const [p, e] = await Promise.all([
        supabase.from('posts').select('*').eq('artist_id', art.id).eq('published', true).order('created_at', { ascending: false }),
        supabase.from('events').select('*').eq('artist_id', art.id).gte('starts_at', new Date().toISOString()).order('starts_at')
      ])
      setPosts(p.data || [])
      setEvents(e.data || [])
    })()
  }, [slug])

  if (a === undefined) return <div className="wrap mut">Chargement…</div>
  if (a === null) return <div className="wrap"><p>Artiste introuvable.</p><a className="btn" href="#/">Retour</a></div>
  const socials = Object.entries(a.socials || {})
  return (
    <div className="wrap">
      <div className="cover" style={a.cover_url ? { backgroundImage: `url(${a.cover_url})` } : {}} />
      <div className="hero">
        {a.avatar_url ? <img className="av" src={a.avatar_url} alt="" /> : <div className="av ph" style={{ fontSize: '2rem' }}>{a.name[0]}</div>}
        <h1>{a.name}</h1>
      </div>
      {a.bio && <p>{a.bio}</p>}
      {socials.length > 0 && <p>{socials.map(([k, v]) => <a key={k} className="mut" href={v} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{k}</a>)}</p>}
      <Subscribe artistId={a.id} />
      {events.length > 0 && <h2>Concerts</h2>}
      {events.map(ev => {
        const d = new Date(ev.starts_at)
        return (
          <div key={ev.id} className="card ev">
            <div className="date">{d.getDate()}<br /><small>{d.toLocaleDateString('fr-FR', { month: 'short' })}</small></div>
            <div style={{ flex: 1 }}>
              <strong>{ev.title}</strong>
              <div className="mut">{[ev.venue, ev.city].filter(Boolean).join(' · ')}</div>
            </div>
            {ev.ticket_url && <a className="btn" href={ev.ticket_url} target="_blank" rel="noreferrer">Billets</a>}
          </div>
        )
      })}
      <h2>Actualités</h2>
      {posts.length === 0 && <p className="mut">Rien pour le moment.</p>}
      {posts.map(p => (
        <div key={p.id} className="card post">
          <strong>{p.title}</strong>
          <div className="mut"><small>{new Date(p.created_at).toLocaleDateString('fr-FR')}</small></div>
          {p.media_type === 'image' && p.media_url && <img src={p.media_url} alt="" />}
          {p.body && <p>{p.body}</p>}
          {p.external_url && <a className="btn" href={p.external_url} target="_blank" rel="noreferrer">{p.external_label || 'Voir la suite'}</a>}
        </div>
      ))}
    </div>
  )
}

function App() {
  const hash = useHash()
  const m = hash.match(/^#\/a\/([a-z0-9-]+)/)
  return (
    <>
      <div className="top">
        <a className="logo" href="#/">{SITE}</a>
      </div>
      {m ? <Artist slug={m[1]} /> : <Home />}
    </>
  )
}

createRoot(document.getElementById('root')).render(<App />)
