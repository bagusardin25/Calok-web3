import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, LocateFixed, MapPin } from 'lucide-react'
import { CopyButton, Notice, TxStatus } from '../components/Bits'
import { BotChainBar } from '../components/Chrome'
import type { MapController } from '../components/MapCanvas'
import { MapStage } from '../components/MapStage'
import { Pictogram } from '../components/Pictograms'
import { AMENITIES, PLACES, RULES, STATUS } from '../config/site'
import { cellsInBounds, isValidLat, isValidLng, toMicro } from '../geo/cells'
import type { Bounds } from '../geo/cells'
import { fetchPinsInCells, prepare } from '../lib/contract'
import { byteLength, cleanText } from '../lib/format'
import { absoluteUrl, href, navigate } from '../lib/router'
import { getMapView, markJustAdded, requestLocation, setMapView, useDeviceLocation } from '../lib/store'
import { useTx } from '../lib/tx'
import { useAsync } from '../lib/useAsync'

type Errors = Partial<Record<'coords' | 'amenities' | 'place' | 'name' | 'note', string>>

const fixed5 = (n: number) => n.toFixed(5)

export function AddPage() {
  const location = useDeviceLocation()
  const [start] = useState(() => {
    const v = getMapView()
    if (location.status === 'granted') return { lat: location.lat, lng: location.lng, zoom: 17 }
    return v ? { ...v, zoom: Math.max(v.zoom, 15) } : { lat: -6.17539, lng: 106.82715, zoom: 15 }
  })
  const controller = useRef<MapController | null>(null)
  const [latText, setLatText] = useState(fixed5(start.lat))
  const [lngText, setLngText] = useState(fixed5(start.lng))
  const editingCoords = useRef(false)
  const [amenities, setAmenities] = useState(0)
  const [place, setPlace] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [addedId, setAddedId] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState<string | null>(null)
  const tx = useTx()
  const ids = useId()

  // Spots already on the map are drawn (not clickable), so people can see a duplicate coming.
  const [area, setArea] = useState<Bounds | null>(null)
  const cells = area ? cellsInBounds(area) : null
  const existing = useAsync(cells ? `add-area:${cells.join(',')}` : null, () => fetchPinsInCells(cells!), { keep: true })
  const errorSummary = useRef<HTMLDivElement>(null)

  const nameBytes = byteLength(cleanText(name))
  const noteBytes = byteLength(cleanText(note))

  const lat = Number(latText)
  const lng = Number(lngText)

  useEffect(() => {
    if (Object.keys(errors).length > 0) errorSummary.current?.focus()
  }, [errors])

  const locateMe = async () => {
    setLocating(true)
    setLocationNote(null)
    const next = await requestLocation()
    setLocating(false)
    if (next.status === 'granted') {
      setLatText(fixed5(next.lat))
      setLngText(fixed5(next.lng))
      controller.current?.flyTo(next.lat, next.lng, 18)
      setLocationNote(
        next.accuracy > 50
          ? `Your device placed you within about ${Math.round(next.accuracy)} m. Check the crosshair before you add.`
          : null,
      )
    } else if (next.status === 'denied') {
      setLocationNote('Location is blocked for this site. Move the map or type the coordinates instead.')
    } else {
      setLocationNote('Your device could not find its position. Move the map or type the coordinates instead.')
    }
  }

  const applyTypedCoords = () => {
    editingCoords.current = false
    if (latText.trim() !== '' && lngText.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      controller.current?.flyTo(lat, lng)
    }
  }

  const validate = (): Errors => {
    const e: Errors = {}
    const latM = toMicro(lat)
    const lngM = toMicro(lng)
    if (latText.trim() === '' || lngText.trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || !isValidLat(latM) || !isValidLng(lngM)) {
      e.coords = 'Enter a latitude between −90 and 90 and a longitude between −180 and 180, or move the map.'
    }
    if (amenities === 0) e.amenities = 'Pick at least one thing this spot offers.'
    if (place === '') e.place = 'Pick the kind of place.'
    if (nameBytes < RULES.nameMin) e.name = `Give it a name of at least ${RULES.nameMin} characters.`
    else if (nameBytes > RULES.nameMax) e.name = `The name is ${nameBytes} bytes; the limit is ${RULES.nameMax}.`
    if (noteBytes > RULES.noteMax) e.note = `The note is ${noteBytes} bytes; the limit is ${RULES.noteMax}.`
    return e
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    const latM = toMicro(lat)
    const lngM = toMicro(lng)
    const done = await tx.run((who) =>
      prepare.addSpot(who, latM, lngM, amenities, Number(place), cleanText(name), cleanText(note)),
    )
    if (done) {
      const id = Number(done.result)
      setAddedId(id)
      markJustAdded(id)
      setMapView({ lat: latM / 1e6, lng: lngM / 1e6, zoom: 16 })
    }
  }

  const describedBy = (field: keyof Errors, hint?: string) =>
    [hint, errors[field] ? `${ids}-${field}-error` : undefined].filter(Boolean).join(' ') || undefined

  if (addedId !== null) {
    const link = absoluteUrl(href.spot(addedId))
    return (
      <main id="main" className="add-page add-page--done">
        <section className="add-done" aria-labelledby="done-title">
          <p className="sign-label">Spot No. {addedId}</p>
          <h1 id="done-title" tabIndex={-1} ref={(el) => el?.focus()}>
            <Check size={28} strokeWidth={3} aria-hidden="true" /> Added to the map
          </h1>
          <p>
            It shows as <strong>New</strong> until two other people confirm it. Share the link with someone who passes by, so
            they can press <strong>Still here</strong>.
          </p>
          <p className="mono wrap-anywhere add-done__link">{link}</p>
          <div className="vote__row">
            <CopyButton text={link} label="Copy link" dark />
            <a className="btn btn--yellow" href={href.spot(addedId)}>
              <MapPin size={18} aria-hidden="true" />
              View the spot
            </a>
          </div>
          <button
            type="button"
            className="btn btn--ghost-dark btn--sm"
            onClick={() => {
              setAddedId(null)
              setName('')
              setNote('')
              setAmenities(0)
              setPlace('')
              tx.reset()
            }}
          >
            Add another spot
          </button>
        </section>
        <BotChainBar />
      </main>
    )
  }

  return (
    <main id="main" className="add-page">
      <div className="add-layout">
        <div className="add-map" aria-label="Map for placing the spot">
          <MapStage
            initial={start}
            pins={existing.data?.pins.filter((p) => p.status !== STATUS.ReportedGone) ?? []}
            interactivePins={false}
            controller={controller}
            failHint={<p>You can still add the spot: type its coordinates in the form or use your location.</p>}
            overlay={
              <>
                <div className="crosshair" aria-hidden="true">
                  <span className="crosshair__h" />
                  <span className="crosshair__v" />
                  <span className="crosshair__ring" />
                </div>
                <p className="crosshair-readout mono" aria-hidden="true">
                  {latText}, {lngText}
                </p>
              </>
            }
            onMove={(m) => {
              setArea(m.bounds)
              setMapView({ lat: m.lat, lng: m.lng, zoom: m.zoom })
              if (!editingCoords.current) {
                setLatText(fixed5(m.lat))
                setLngText(fixed5(((m.lng + 540) % 360) - 180))
              }
            }}
          />
        </div>

        <form className="add-form" onSubmit={submit} noValidate aria-labelledby="add-title">
          <p className="sign-label">New spot</p>
          <h1 id="add-title">Add a spot</h1>
          <p className="add-form__lead">Public places only: a station, library, park, campus, mall, place of worship or café.</p>

          {Object.keys(errors).length > 0 ? (
            <div className="error-summary" ref={errorSummary} tabIndex={-1} role="alert">
              <p>Fix {Object.keys(errors).length === 1 ? 'this' : 'these'} before adding:</p>
              <ul>
                {Object.entries(errors).map(([field, msg]) => (
                  <li key={field}>
                    <a
                      href={`#${ids}-${field}`}
                      onClick={(e) => {
                        // Hash routing owns the fragment: focus the field instead of following the link.
                        e.preventDefault()
                        document.getElementById(`${ids}-${field}`)?.focus()
                      }}
                    >
                      {msg}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <fieldset className="field-group">
            <legend>
              <span className="step">1</span> Where is it?
            </legend>
            <p className="hint" id={`${ids}-coords-hint`}>
              Move the map until the crosshair sits on the spot, or type the coordinates. They are rounded to five decimals,
              about one metre. Pins already on the map are spots someone added: if yours is one of them, open it and confirm it
              instead.
            </p>
            <div className="coords">
              <label className="field">
                <span className="field__label">Latitude</span>
                <input
                  id={`${ids}-coords`}
                  className="input mono"
                  inputMode="decimal"
                  autoComplete="off"
                  value={latText}
                  aria-invalid={!!errors.coords}
                  aria-describedby={describedBy('coords', `${ids}-coords-hint`)}
                  onFocus={() => (editingCoords.current = true)}
                  onChange={(e) => setLatText(e.target.value)}
                  onBlur={applyTypedCoords}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyTypedCoords()
                    }
                  }}
                />
              </label>
              <label className="field">
                <span className="field__label">Longitude</span>
                <input
                  className="input mono"
                  inputMode="decimal"
                  autoComplete="off"
                  value={lngText}
                  aria-invalid={!!errors.coords}
                  aria-describedby={describedBy('coords', `${ids}-coords-hint`)}
                  onFocus={() => (editingCoords.current = true)}
                  onChange={(e) => setLngText(e.target.value)}
                  onBlur={applyTypedCoords}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyTypedCoords()
                    }
                  }}
                />
              </label>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void locateMe()} disabled={locating}>
              <LocateFixed size={18} aria-hidden="true" />
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
            {locationNote ? <p className="hint hint--warn">{locationNote}</p> : null}
            {errors.coords ? (
              <p className="field-error" id={`${ids}-coords-error`}>
                {errors.coords}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="field-group" aria-describedby={describedBy('amenities')}>
            <legend id={`${ids}-amenities`} tabIndex={-1}>
              <span className="step">2</span> What is there?
            </legend>
            <div className="amenity-picks">
              {AMENITIES.map((a) => {
                const on = (amenities & a.bit) !== 0
                return (
                  <label key={a.key} className={`amenity-pick${on ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => setAmenities((m) => m ^ a.bit)} />
                    <span className="amenity-pick__icon">
                      <Pictogram amenity={a.key} size={26} />
                    </span>
                    <span className="amenity-pick__label">{a.label}</span>
                  </label>
                )
              })}
            </div>
            {errors.amenities ? (
              <p className="field-error" id={`${ids}-amenities-error`}>
                {errors.amenities}
              </p>
            ) : null}
          </fieldset>

          <div className="field-group">
            <label className="field">
              <span className="field__label">
                <span className="step">3</span> Kind of place
              </span>
              <select
                id={`${ids}-place`}
                className="input"
                value={place}
                aria-invalid={!!errors.place}
                aria-describedby={describedBy('place')}
                onChange={(e) => setPlace(e.target.value)}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {PLACES.map((p, i) => (
                  <option key={p} value={i}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {errors.place ? (
              <p className="field-error" id={`${ids}-place-error`}>
                {errors.place}
              </p>
            ) : null}
          </div>

          <div className="field-group">
            <label className="field">
              <span className="field__label">
                <span className="step">4</span> Name
              </span>
              <input
                id={`${ids}-name`}
                className="input"
                value={name}
                maxLength={96}
                autoComplete="off"
                placeholder="e.g. Station concourse, east gate"
                aria-invalid={!!errors.name}
                aria-describedby={describedBy('name', `${ids}-name-count`)}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className={`counter${nameBytes > RULES.nameMax ? ' is-over' : ''}`} id={`${ids}-name-count`}>
              {nameBytes} / {RULES.nameMax} bytes
            </p>
            {errors.name ? (
              <p className="field-error" id={`${ids}-name-error`}>
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="field-group">
            <label className="field">
              <span className="field__label">
                <span className="step">5</span> Where exactly? <span className="optional">Optional</span>
              </span>
              <textarea
                id={`${ids}-note`}
                className="input"
                rows={3}
                value={note}
                maxLength={320}
                placeholder="e.g. On the pillar by the east door, level 2"
                aria-invalid={!!errors.note}
                aria-describedby={describedBy('note', `${ids}-note-count`)}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className={`counter${noteBytes > RULES.noteMax ? ' is-over' : ''}`} id={`${ids}-note-count`}>
              {noteBytes} / {RULES.noteMax} bytes
            </p>
            {errors.note ? (
              <p className="field-error" id={`${ids}-note-error`}>
                {errors.note}
              </p>
            ) : null}
          </div>

          <Notice title="Before you add">
            <ul className="rules">
              <li>Only public places. No homes, private offices or restricted areas; the moderator hides them.</li>
              <li>The name and note are public and permanent. Leave out names of people and phone numbers.</li>
              <li>Only the crosshair position is recorded. Your device location is never written to the chain.</li>
            </ul>
          </Notice>

          <div className="add-form__submit">
            <button type="submit" className="btn btn--yellow btn--lg" disabled={tx.busy}>
              Add this spot
            </button>
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => navigate(href.map)} disabled={tx.busy}>
              Cancel
            </button>
          </div>
          <TxStatus state={tx.state} doneText="Spot added." />
        </form>
      </div>
      <BotChainBar />
    </main>
  )
}
