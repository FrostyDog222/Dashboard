let cryptoValue = ""
let timeFormat = ""
let temperature = ""
let units = ""
const cryptoBtn = document.getElementById("crypto-btn")
const cryptoInput = document.getElementById("crypto-input")
const cryptoName = document.getElementById("crypto-input")
const formatBtn = document.getElementById("time-format")
const tempBtn = document.getElementById("change-units")

//Using a nullish coalescing operator to assign a default value in case the localStorage returns null
let cryptoValueFromLocalStorage  = JSON.parse(localStorage.getItem("cryptoValue")) ?? "bitcoin"
let timeFormatFromLocalStorage = JSON.parse(localStorage.getItem("timeFormat")) ?? "en"
let temperatureFromLocalStorage = JSON.parse(localStorage.getItem("temperature")) ?? "°F"
let unitsFromLocalStorage = JSON.parse(localStorage.getItem("units")) ?? "imperial"
cryptoValue = cryptoValueFromLocalStorage
timeFormat = timeFormatFromLocalStorage
temperature = temperatureFromLocalStorage
units = unitsFromLocalStorage

// Background Picture and author and also links us to the author instagram profile using an anchor tag
fetch("https://apis.scrimba.com/unsplash/photos/random?orientation=landscape&query=nature")
    .then(res => res.json())
    .then(data => {
        document.body.style.backgroundImage = `url(${data.urls.full})`
		document.getElementById("author").innerHTML = `<a target="blank_" 
            href="https://www.instagram.com/${data.user.instagram_username}/">
            Photo credit: ${data.user.name}
            </a>
            `
    })
    //Default background image/author in case of an error
    .catch(err => {
        document.body.style.backgroundImage = `
        url(https://images.unsplash.com/photo-1560008511-11c63416e52d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwyMTEwMjl8MHwxfHJhbmRvbXx8fHx8fHx8fDE2MjI4NDIxMTc&ixlib=rb-1.2.1&q=80&w=1080)
        `
		document.getElementById("author").innerHTML = `<a target="blank_" 
        href="https://unsplash.com/@dodiachmad">Photo credit: Dodi Achmad
        </a>
        `
    })

        // Changing the crypto you want to display by searching the cryptocurrency name
        cryptoBtn.addEventListener(`click`, getCryptoData)
        function getCryptoData(){
            if (cryptoInput && cryptoInput.value) {
                cryptoValue = cryptoInput.value
            }else{
                cryptoValue = cryptoValueFromLocalStorage
            }
            localStorage.removeItem("cryptoValue")
            localStorage.setItem("cryptoValue", JSON.stringify(cryptoValue))
            renderCrypto()
            cryptoInput.value = ""
        }
        getCryptoData()

    // Render the crypto info using an api to get crypto values
    function renderCrypto(){
        fetch(`https://api.coingecko.com/api/v3/coins/${cryptoValue.toLowerCase().replace(" ", "-")}`)
        .then(res => {
            if (!res.ok) {
                throw Error("Something went wrong")
            }
            return res.json()
        })
        .then(data => {
            document.getElementById("crypto-top").innerHTML = `
                <img src=${data.image.small} />
                <span>${data.name}<span>
            `
            document.getElementById("crypto-bottom").innerHTML = `
                <p class="crypto">🎯: $${data.market_data.current_price.usd}</p>
                <p class="crypto">⬆️: $${data.market_data.high_24h.usd}</p>
                <p class="crypto">⬇️: $${data.market_data.low_24h.usd}</p>
            `
        })
        //  Display an error message in case of an error with the crypto api
        .catch(err => {
            document.getElementById("crypto-top").innerHTML = `
            <p>Invalid data try again</p>
            `
            document.getElementById("crypto-bottom").innerHTML = ``

        })
    }

// Make a search bar for the crypto search
fetch('https://api.coingecko.com/api/v3/coins/list')
    .then(res => res.json())
    .then(data => {
        console.log(data)
    })


    // Getting the device time and displaying using new Date() 
    // timeFormat is changing the clock format from 12 Hours to 24 Hours and vice versa
    // timestyle is telling us how to show the time medium = hours:mins:sec / short = hours:mins: sec etc
    function getCurrentTime() {
        const date = new Date()
        document.getElementById("time").textContent = date.toLocaleTimeString(`${timeFormat}`, {timeStyle: "medium"})
    }
    setInterval(getCurrentTime, 1000)

    // timeToLocalStorage() is saving the time format we want into the localStorage for the next page refresh
    function timeToLocalStorage(){
            localStorage.removeItem("timeFormat")
            localStorage.setItem("timeFormat", JSON.stringify(timeFormat))
    }
       // Changing the format when pressing the Change Format button
        formatBtn.addEventListener(`click`, function(){
                if(timeFormat === "ro"){
                    timeFormat = "en"
                }else if(timeFormat === "en"){
                    timeFormat = "ro"
                }
                timeToLocalStorage()
            })

        // Temperature button 
            if(temperature === "°C"){
                tempBtn.textContent = "°F"
            }else if(temperature === "°F"){
                tempBtn.textContent = "°C"
            }

            function tempLocalStorage(){
                localStorage.removeItem("temperature")
                localStorage.removeItem("units")
                localStorage.setItem("temperature", JSON.stringify(temperature))
                localStorage.setItem("units", JSON.stringify(units))
            }

       tempBtn.addEventListener(`click`, function(){
                if(temperature === "°F" && units === "imperial"){
                    tempBtn.textContent = "°F"
                    temperature = "°C"
                    units = "metric"
                }else if(temperature === "°C" && units === "metric"){
                    tempBtn.textContent = "°C"
                    temperature = "°F"
                    units = "imperial"
                }
                tempLocalStorage()
                getWeatherData()
            })

// Geolocation is finding your latitude and longitude and by using a weather api it can get the best weather data from your area
function getWeatherData(){
    navigator.geolocation.getCurrentPosition(position => {
        fetch(`https://apis.scrimba.com/openweathermap/data/2.5/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}&units=${units}`)
                .then(res => {
                    if (!res.ok) {
                        throw Error("Weather data not available")
                    }
                    return res.json()
                })
                .then(data => {
                // Getting the wheather icons for every weather
                    const iconUrl = `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
                    document.getElementById("weather").innerHTML = `
                        <img src=${iconUrl} />
                        <p class="weather-temp">${Math.round(data.main.temp)}${temperature}</p>
                        <p class="weather-description">${data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1)}</p>
                        <p class="weather-city">${data.name}</p>
                    `
                })
                // Display an error message in case of an error with the weather api
                .catch(err => {
                    document.getElementById(`weather`).innerHTML = `
                        <p>Couldn't load weather data</p>
                    `
                })
    });
}    
    getWeatherData()
    // Render a random useless fact from the api with the same name
    function uselessFacts(){
        fetch(`https://uselessfacts.jsph.pl/random.json?language=en`)
            .then(res => res.json())
            .then(data => {
                document.getElementById(`random-fact`).textContent = data.text
            })
        }   
uselessFacts()
document.getElementById(`new-fact`).addEventListener(`click`, uselessFacts)
