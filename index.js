// ---------- Persisted state (nullish coalescing gives defaults when localStorage is empty) ----------
const load = (key, fallback) => JSON.parse(localStorage.getItem(key)) ?? fallback
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val))

let watchlist = load("watchlist", ["bitcoin", "ethereum", "solana"])
let is24Hour = load("is24Hour", true)
let units = load("units", "metric") // "metric" -> °C, "imperial" -> °F

const CG = "https://api.coingecko.com/api/v3"

// ---------- Background image + author credit ----------
const FALLBACK_BG = {
    url: "https://images.unsplash.com/photo-1560008511-11c63416e52d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920",
    credit: `<a target="_blank" href="https://unsplash.com/@dodiachmad">Photo credit: Dodi Achmad</a>`,
}

// Show the last good image instantly on load, so the screen is never blank and never
// flashes a half-loaded frame — the new image is only swapped in once fully decoded.
const cachedBg = load("bg", null)
if (cachedBg) {
    document.body.style.backgroundImage = `url(${cachedBg.url})`
    document.getElementById("author").innerHTML = cachedBg.credit
}

// Apply a background only after it has fully decoded; on failure, fall back cleanly.
function applyBackground({ url, credit }, onFail) {
    const img = new Image()
    img.onload = () => {
        document.body.style.backgroundImage = `url(${url})`
        document.getElementById("author").innerHTML = credit
        save("bg", { url, credit })
    }
    img.onerror = () => { if (onFail) onFail() }
    img.src = url
}

fetch("https://apis.scrimba.com/unsplash/photos/random?orientation=landscape&query=nature")
    .then(res => res.json())
    .then(data => {
        // Size the image to the actual screen (DPR-aware, capped) so it's sharp but still bounded.
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const w = Math.min(Math.ceil(window.innerWidth * dpr), 2560)
        const base = data.urls.raw || data.urls.full
        const url = `${base}&w=${w}&q=80&fm=jpg&fit=max`
        const credit = `<a target="_blank" href="https://www.instagram.com/${data.user.instagram_username}/">Photo credit: ${data.user.name}</a>`
        applyBackground({ url, credit }, () => applyBackground(FALLBACK_BG))
    })
    .catch(() => { if (!cachedBg) applyBackground(FALLBACK_BG) })

// ---------- Crypto watchlist ----------
const cryptoEl = document.getElementById("crypto")

function paintCrypto(coins) {
    const byId = Object.fromEntries(coins.map(c => [c.id, c]))
    const rows = watchlist.map(id => byId[id]).filter(Boolean)
    if (!rows.length) return false
    cryptoEl.innerHTML = rows.map(c => {
        const change = c.price_change_percentage_24h ?? 0
        const dir = change >= 0 ? "up" : "down"
        const sign = change >= 0 ? "+" : ""
        return `
            <div class="crypto-row" data-id="${c.id}">
                <img src="${c.image}" alt="${c.name}">
                <div class="crypto-info">
                    <span class="crypto-name">${c.name}</span>
                    <span class="crypto-symbol">${c.symbol}</span>
                </div>
                <div class="crypto-values">
                    <div class="crypto-price">$${c.current_price.toLocaleString()}</div>
                    <div class="crypto-change ${dir}">${sign}${change.toFixed(2)}%</div>
                </div>
                <button class="crypto-remove" data-remove="${c.id}" title="Remove">&times;</button>
            </div>`
    }).join("")
    return true
}

// Fetch with one retry, since CoinGecko's free tier occasionally 429s transiently.
function fetchJson(url, retries = 1) {
    return fetch(url).then(res => {
        if (!res.ok) throw Error(res.status)
        return res.json()
    }).catch(err => {
        if (retries > 0) return new Promise(r => setTimeout(r, 1200)).then(() => fetchJson(url, retries - 1))
        throw err
    })
}

function renderCrypto() {
    if (!watchlist.length) {
        cryptoEl.innerHTML = `<p class="crypto-error">Search to add a coin</p>`
        return
    }
    // Show cached prices immediately so the list is never blank while (re)fetching.
    const cached = load("cryptoCache", null)
    if (cached) paintCrypto(cached)

    fetchJson(`${CG}/coins/markets?vs_currency=usd&ids=${watchlist.join(",")}&price_change_percentage=24h`)
        .then(coins => {
            save("cryptoCache", coins)
            if (!paintCrypto(coins)) cryptoEl.innerHTML = `<p class="crypto-error">Couldn't load crypto data</p>`
        })
        .catch(() => {
            // Keep whatever cached data is on screen; only show an error if we have nothing.
            if (!cached || !paintCrypto(cached)) {
                cryptoEl.innerHTML = `<p class="crypto-error">Rate limited — retry in a moment</p>`
            }
        })
}
renderCrypto()

// Remove a coin (event delegation)
cryptoEl.addEventListener("click", e => {
    const id = e.target.dataset.remove
    if (!id) return
    watchlist = watchlist.filter(c => c !== id)
    save("watchlist", watchlist)
    renderCrypto()
})

// ---------- Crypto search with autocomplete ----------
const input = document.getElementById("crypto-input")
const suggestionsEl = document.getElementById("crypto-suggestions")
let searchTimer

function hideSuggestions() {
    suggestionsEl.hidden = true
    suggestionsEl.innerHTML = ""
}

function showSuggestions(coins) {
    if (!coins.length) {
        suggestionsEl.innerHTML = `<li class="s-empty">No coins found</li>`
    } else {
        suggestionsEl.innerHTML = coins.slice(0, 8).map(c => `
            <li data-id="${c.id}">
                <img src="${c.thumb}" alt="">
                <span class="s-name">${c.name}</span>
                <span class="s-sym">${c.symbol}</span>
            </li>`).join("")
    }
    suggestionsEl.hidden = false
}

function addCoin(id) {
    if (!watchlist.includes(id)) {
        watchlist = [...watchlist, id]
        save("watchlist", watchlist)
        renderCrypto()
    }
    input.value = ""
    hideSuggestions()
}

input.addEventListener("input", () => {
    const q = input.value.trim()
    clearTimeout(searchTimer)
    if (!q) { hideSuggestions(); return }
    searchTimer = setTimeout(() => {
        fetchJson(`${CG}/search?query=${encodeURIComponent(q)}`)
            .then(data => showSuggestions(data.coins || []))
            .catch(() => {
                suggestionsEl.innerHTML = `<li class="s-empty">Rate limited — try again</li>`
                suggestionsEl.hidden = false
            })
    }, 300)
})

suggestionsEl.addEventListener("click", e => {
    const li = e.target.closest("li[data-id]")
    if (li) addCoin(li.dataset.id)
})

// Enter picks the first suggestion; Escape/outside click closes
input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        e.preventDefault()
        const first = suggestionsEl.querySelector("li[data-id]")
        if (first) addCoin(first.dataset.id)
    } else if (e.key === "Escape") {
        hideSuggestions()
        input.blur()
    }
})

document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) hideSuggestions()
})

// "/" keyboard shortcut focuses search
document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== input) {
        e.preventDefault()
        input.focus()
    }
})

// ---------- Clock ----------
function getCurrentTime() {
    const now = new Date()
    document.getElementById("time").textContent =
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !is24Hour })
    document.getElementById("date").textContent =
        now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })
}
getCurrentTime()
setInterval(getCurrentTime, 1000)

document.getElementById("time-format").addEventListener("click", () => {
    is24Hour = !is24Hour
    save("is24Hour", is24Hour)
    getCurrentTime()
})

// ---------- Weather ----------
const weatherEl = document.getElementById("weather")

// Inline SVG weather icons keyed by OpenWeather icon code — crisp at any size, no image files.
const svg = inner => `<svg class="wicon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
const cloud = (c = "#e5e7eb") => `<path fill="${c}" d="M45 47H20a11 11 0 0 1-1.8-21.9A15 15 0 0 1 47 29a9 9 0 0 1-2 18z"/>`
const sunRays = (cx, cy, r) => {
    const rays = [[0,-1],[0,1],[-1,0],[1,0],[-0.7,-0.7],[0.7,0.7],[0.7,-0.7],[-0.7,0.7]]
    return `<g stroke="#fbbf24" stroke-width="3" stroke-linecap="round">` +
        rays.map(([dx,dy]) =>
            `<line x1="${cx+dx*(r+3)}" y1="${cy+dy*(r+3)}" x2="${cx+dx*(r+9)}" y2="${cy+dy*(r+9)}"/>`).join("") +
        `</g>`
}
const dropsSvg = xs => xs.map(x =>
    `<line x1="${x}" y1="50" x2="${x-3}" y2="58" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>`).join("")

const ICON = {
    sun: svg(`${sunRays(32,32,12)}<circle cx="32" cy="32" r="12" fill="#fbbf24"/>`),
    moon: svg(`<path fill="#dbeafe" d="M42 44A19 19 0 0 1 27 14a19 19 0 1 0 21 28 19 19 0 0 1-6 2z"/>`),
    fewDay: svg(`${sunRays(23,22,7)}<circle cx="23" cy="22" r="7" fill="#fbbf24"/>${cloud()}`),
    fewNight: svg(`<path fill="#dbeafe" d="M26 26a12 12 0 0 1-8-19 12 12 0 1 0 13 18 12 12 0 0 1-5 1z"/>${cloud()}`),
    clouds: svg(`${cloud("#9ca3af").replace('d="M45 47H20','d="M52 40H30')}${cloud()}`),
    rain: svg(`${cloud()}${dropsSvg([24,32,40])}`),
    shower: svg(`${cloud("#9ca3af")}${dropsSvg([20,28,36,44])}`),
    thunder: svg(`${cloud("#9ca3af")}<path fill="#fbbf24" d="M34 46l10-16h-8l4-8-14 18h7z"/>`),
    snow: svg(`${cloud()}${[24,32,40].map(x => `<circle cx="${x}" cy="54" r="2.6" fill="#e0f2fe"/>`).join("")}`),
    mist: svg(`<g stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"><line x1="14" y1="26" x2="50" y2="26"/><line x1="10" y1="34" x2="46" y2="34"/><line x1="16" y1="42" x2="52" y2="42"/></g>`),
}

function weatherSvg(code) {
    const day = code.endsWith("d")
    switch (code.slice(0, 2)) {
        case "01": return day ? ICON.sun : ICON.moon
        case "02": return day ? ICON.fewDay : ICON.fewNight
        case "03":
        case "04": return ICON.clouds
        case "09": return ICON.shower
        case "10": return ICON.rain
        case "11": return ICON.thunder
        case "13": return ICON.snow
        case "50": return ICON.mist
        default: return day ? ICON.sun : ICON.moon
    }
}

let coords = null // cached so unit toggles don't re-run the slow geolocation lookup

function fetchWeather() {
    if (!coords) return
    fetch(`https://apis.scrimba.com/openweathermap/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=${units}`)
        .then(res => {
            if (!res.ok) throw Error("Weather data not available")
            return res.json()
        })
        .then(data => {
            const sym = units === "metric" ? "°C" : "°F"
            const desc = data.weather[0].description
            weatherEl.innerHTML = `
                ${weatherSvg(data.weather[0].icon)}
                <div class="weather-main">
                    <p class="weather-temp">${Math.round(data.main.temp)}${sym}</p>
                    <p class="weather-description">${desc.charAt(0).toUpperCase() + desc.slice(1)}</p>
                    <p class="weather-feels">Feels like ${Math.round(data.main.feels_like)}${sym}</p>
                    <button class="unit-toggle" title="Switch units">
                        <span class="${units === "metric" ? "active" : ""}">°C</span>
                        <span class="${units === "imperial" ? "active" : ""}">°F</span>
                    </button>
                </div>`
        })
        .catch(() => {
            weatherEl.innerHTML = `<p class="weather-description">Couldn't load weather</p>`
        })
}

function getWeatherData() {
    if (!navigator.geolocation) {
        weatherEl.innerHTML = `<p class="weather-description">Location unavailable</p>`
        return
    }
    navigator.geolocation.getCurrentPosition(
        position => {
            coords = { lat: position.coords.latitude, lon: position.coords.longitude }
            fetchWeather()
        },
        () => { weatherEl.innerHTML = `<p class="weather-description">Location denied</p>` }
    )
}
getWeatherData()

// Toggle °C / °F with the unit button — instant, reuses cached coords.
weatherEl.addEventListener("click", e => {
    if (!e.target.closest(".unit-toggle")) return
    units = units === "metric" ? "imperial" : "metric"
    save("units", units)
    if (coords) fetchWeather()
    else getWeatherData()
})

// ---------- Daily fact ----------
function uselessFacts() {
    fetch("https://uselessfacts.jsph.pl/random.json?language=en")
        .then(res => res.json())
        .then(data => { document.getElementById("random-fact").textContent = data.text })
        .catch(() => { document.getElementById("random-fact").textContent = "Couldn't load a fact right now." })
}
uselessFacts()
document.getElementById("new-fact").addEventListener("click", uselessFacts)
