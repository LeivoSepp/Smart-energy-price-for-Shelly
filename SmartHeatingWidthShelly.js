/*
This Shelly script is designed to retrieve energy market prices from Elering and
activate heating during the most cost-effective hours each day, employing various algorithms. 

1. Dynamic calculation of heating time for the next day based on weather forecasts.
2. Division of heating into time periods, with activation during the cheapest hour within each period.
3. Utilization of min-max price levels to maintain the Shelly system consistently on or off.
The script executes daily after 23:00 to establish heating timeslots for the following day.

created by Leivo Sepp, 25.12.2023
https://github.com/LeivoSepp/Smart-heating-management-with-Shelly
*/

/*
Elektrilevi electricity transmission fees (EUR/MWh):
*/
let vork1 = { dayRt: 72, nightRt: 72 };
let vork2 = { dayRt: 87, nightRt: 50 };
let vork2kuu = { dayRt: 56, nightRt: 33 };
let vork4 = { dayRt: 37, nightRt: 21 };
let none = { dayRt: 0, nightRt: 0 };
/**
USER SETTINGS, START MODIFICATION. 
 */
let s = {
    timePeriod: 24,             // duration of each time period in hours, (0 -> only min-max price used, 24 -> period is one day)
    heatingTime: 5,             // duration of heating in hours during each designated period
    elektrilevi: vork2kuu,      // Elektrilevi transmission fee: vork1 / vork2 / vork2kuu / vork4 / none
    alwaysOnMaxPrice: 10,       // keep heating always ON if energy price lower than this value (EUR/MWh)
    alwaysOffMinPrice: 300,     // keep heating always OFF if energy price higher than this value (EUR/MWh)
    isOutputInverted: false,    // configures the relay state to either normal or inverted. (inverted required by Nibe, Thermia)
    relayID: 0,                 // Shelly relay ID
    defaultTimer: 60,           // default timer duration, in minutes, for toggling the Shelly state 
    country: "ee",              // Estonia-ee, Finland-fi, Lithuania-lt, Latvia-lv
    isWeatherFcstUsed: false,   // Using weather forecast to calculate heating duration.
    heatingCurve: 0,            // shifting heating curve to the left or right (-10 -> less heating, 10 -> more heating) 
    powerFactor: 0.5,           // adjusts the heating curve to be either more flat or more aggressive (0 -> flat, 1 -> steep)
}
/**
USER SETTINGS, END OF MODIFICATION. 

Heating time dependency on heating curve and outside temperature (power factor 0.5)

   |   --------   heating curve   --------   |  
°C |-10	-8  -6  -4  -2  0   2   4   6   8   10
______________________________________________
17 | 0	0   0   0   0   0   0   0   0   0   0
15 | 0	0   0   0   0   0   0   2   4   6   8
10 | 0	0   0   0   0   1   3   5   7   9   11
5  | 0	0   0   0   1   3   5   7   9   11  13
0  | 0	0   0   2   4   6   8   10  12  14  16
-5 | 0	0   2   4   6   8   10  12  14  16  18
-10| 1	3   5   7   9   11  13  15  17  19  21
-15| 3	5   7   9   11  13  15  17  19  21  23
-20| 6	8   10  12  14  16  18  20  22  24  24
-25| 8	10  12  14  16  18  20  22  24  24  24

Forecast temp °C is "feels like": more information here: https://en.wikipedia.org/wiki/Apparent_temperature
*/


let _ = {
    openMeteo: "https://api.open-meteo.com/v1/forecast?daily=apparent_temperature_max&timezone=auto",
    elering: "https://dashboard.elering.ee/api/nps/price/csv?fields=" + s.country,
    elUrl: '',
    omUrl: '',
    heatTime: '',
    ctPeriods: s.timePeriod <= 0 ? 0 : Math.ceil((24 * 100) / (s.timePeriod * 100)),
    tsPrices: '',
    tsFcst: '',
    loopRunning: false,
    dayInSec: 60 * 60 * 24,
    sId: Shelly.getCurrentScriptId(),
    pId: "Id" + Shelly.getCurrentScriptId() + ": ",
    loopFreq: 60, //seconds
    maxRpcCalls: 3,
    callsCntr: 0,
    newScheds: [],
    schedIDs: [],
};

/*
This is the start of the script.
Get old scheduler IDs from the KVS storage
*/
function start() {
    Shelly.call('KVS.Get', { key: "schedulerIDs" + _.sId }, function (res, err, msg, data) {
        if (res) {
            _.schedIDs = JSON.parse(res.value);
        }
        delOldSched();
    });
}

/*
Before anything else delete all the old schedulers created by this script. 
*/
function delOldSched() {
    //logic below is a non-blocking method for RPC calls to delete all schedulers one by one
    if (_.callsCntr < 6 - _.maxRpcCalls) {
        for (let i = 0; i < _.maxRpcCalls && i < _.schedIDs.length; i++) {
            let id = _.schedIDs.splice(0, 1)[0];
            _.callsCntr++;
            Shelly.call("Schedule.Delete", { id: id },
                function (res, err, msg, data) {
                    if (err !== 0) {
                        print(_.pId, "Schedule ", data.id, " delete FAILED.");
                    }
                    else {
                        print(_.pId, "Schedule ", data.id, " delete SUCCEEDED.");
                    }
                    _.callsCntr--;
                },
                { id: id }
            );
        }
    }
    //if there are more calls in the queue
    if (_.schedIDs.length > 0) {
        Timer.set(
            1000, //the delay
            false,
            function () {
                delOldSched();
            }
        );
    }
    else {
        main(); //start the main logic
    }
}

/**
This is the main script where all the logic starts.
This one is called after all the old schedulers are deleted.
*/
function main() {
    //wait until all the schedulers are deleted
    if (_.callsCntr !== 0) {
        Timer.set(
            1000,
            false,
            function () {
                main();
            })
        return;
    }
    //all old schedulers are now deleted, start the main flow
    //find Shelly timezone
    let shEpochUtc = Shelly.getComponentStatus("sys").unixtime;
    let shDt = new Date(shEpochUtc * 1000);
    let shHr = shDt.getHours();
    let shUtcHr = shDt.toISOString().slice(11, 13);
    let tz = shHr - shUtcHr;
    if (tz > 12) { tz -= 24; }
    if (tz < -12) { tz += 24; }
    let tzInSec = tz * 60 * 60;

    // After 23:00 tomorrow's energy prices are used
    // before 23:00 today's energy prices are used.
    let addDays = shHr >= 23 ? 0 : -1;

    // build datetime for Elering query
    let isoTime = new Date((shEpochUtc + tzInSec + _.dayInSec * addDays) * 1000).toISOString().slice(0, 10);
    let isoTimePlusDay = new Date((shEpochUtc + tzInSec + (_.dayInSec * (addDays + 1))) * 1000).toISOString().slice(0, 10);
    let hrStart = JSON.stringify(24 - tz);
    let hrEnd = JSON.stringify(24 - tz - 1);
    let dtStart = isoTime + "T" + hrStart + ":00Z";
    let dtEnd = isoTimePlusDay + "T" + hrEnd + ":00Z";
    _.elUrl = _.elering + "&start=" + dtStart + "&end=" + dtEnd;

    print(_.pId, "Shelly ", shDt);
    shDt = null;
    shEpochUtc = null;

    _.heatTime = s.heatingTime;
    //if weather forecast used for heating hours
    if (s.isWeatherFcstUsed) {
        getForecast(isoTimePlusDay);
    } else {
        getElering();
    }
}

/**
Get Open-Meteo min and max "feels like" temperatures
 */
function getForecast(fcstDt) {
    let lat = JSON.stringify(Shelly.getComponentConfig("sys").location.lat);
    let lon = JSON.stringify(Shelly.getComponentConfig("sys").location.lon);
    _.omUrl = _.openMeteo + "&latitude=" + lat + "&longitude=" + lon + "&start_date=" + fcstDt + "&end_date=" + fcstDt;
    print(_.pId, "Get forecast from: ", _.omUrl)
    try {
        Shelly.call("HTTP.GET", { url: _.omUrl, timeout: 5, ssl_ca: "*" }, fcstCalc);
    }
    catch (error) {
        print(_.pId, "Oh no, OpenMeteo ", error);
        print(_.pId, "Get forecast failed, checking again in ", _.loopFreq, " seconds.");
        _.loopRunning = false;
    }
}

/**
Calculate heating hours
*/
function fcstCalc(res, err, msg) {
    try {
        if (err != 0 || res === null || res.code != 200 || JSON.parse(res.body)["error"]) {
            print(_.pId, "Get forecast failed, checking again in ", _.loopFreq, " seconds.");
            _.loopRunning = false;
        }
        else {
            let jsonFcst = JSON.parse(res.body); //open-meteo json response
            let tempFcst = Math.ceil(jsonFcst["daily"]["apparent_temperature_max"][0]); //round temperature up
            let dtFcst = (jsonFcst["daily"]["time"][0]);

            //store the timestamp into memory
            let now = new Date();
            let dtF = new Date(dtFcst);
            _.tsFcst = epoch(new Date(dtF.getFullYear(), dtF.getMonth(), dtF.getDate(), now.getHours(), now.getMinutes()));
            print(_.pId, "We got weather forecast from Open Meteo at ", dtF);

            // calculating heating hours
            let startTemp = 16;
            let fcstHeatTime = ((startTemp - tempFcst) * (s.powerFactor - 1) + (startTemp - tempFcst + s.heatingCurve - 2));
            fcstHeatTime = fcstHeatTime > 24 ? 24 : fcstHeatTime; //heating time can't be more than 24h
            fcstHeatTime = fcstHeatTime < 0 || tempFcst > startTemp ? 0 : fcstHeatTime; //heating time can't be negative
            _.heatTime = Math.floor(fcstHeatTime); //round heating time down
            print(_.pId, "Temperture forecast width windchill is ", tempFcst, " °C, and heating enabled for ", _.heatTime, " hours.");

            //clear memory
            res = null;
            jsonFcst = null;
            getElering(); //call elering
        }
    } catch (error) {
        print(_.pId, "Oh no, OpenMeteo JSON ", error);
        print(_.pId, "Get forecast failed, checking again in ", _.loopFreq, " seconds.");
        _.loopRunning = false;
    }
}

/**
Get electricity market price CSV file from Elering. 
Script will continue regardless of the error.
 */
function getElering() {
    print(_.pId, "Get Elering prices from: ", _.elUrl);
    try {
        Shelly.call("HTTP.GET", { url: _.elUrl, timeout: 5, ssl_ca: "*" }, priceCalc);
    }
    catch (error) {
        print(_.pId, "Oh no, Elering ", error);
        print(_.pId, "Get Elering failed, checking again in ", _.loopFreq, " seconds.");
        _.loopRunning = false;
    }
}

/**
Price calculation logic.
Creating time windows etc.
*/
function priceCalc(res, err, msg) {
    if (err != 0 || res === null || res.code != 200 || !res.body_b64) {
        print(_.pId, "Get Elering failed, checking again in ", _.loopFreq, " seconds.");
        _.loopRunning = false;
    }
    else {
        //clear memory
        res.headers = null;
        res.message = null;
        msg = null;

        //Converting base64 to text
        res.body_b64 = atob(res.body_b64);

        //Discarding header
        res.body_b64 = res.body_b64.substring(res.body_b64.indexOf("\n") + 1);

        let eleringPrices = [];
        let activePos = 0;
        while (activePos >= 0) {
            res.body_b64 = res.body_b64.substring(activePos);
            activePos = 0;

            let row = [0, 0];
            activePos = res.body_b64.indexOf("\"", activePos) + 1;

            if (activePos === 0) {
                //" character not found -> end of data
                break;
            }

            //epoch
            row[0] = Number(res.body_b64.substring(activePos, res.body_b64.indexOf("\"", activePos)));

            //skip "; after timestamp
            activePos = res.body_b64.indexOf("\"", activePos) + 2;

            //price
            activePos = res.body_b64.indexOf(";\"", activePos) + 2;
            row[1] = Number(res.body_b64.substring(activePos, res.body_b64.indexOf("\"", activePos)).replace(",", "."));

            //Add transfer fees (if any)
            let hour = new Date(row[0] * 1000).getHours();
            let day = new Date(row[0] * 1000).getDay();
            if (hour < 7 || hour >= 22 || day === 6 || day === 0) {
                row[1] += s.elektrilevi.nightRt; //night fee
            }
            else {
                row[1] += s.elektrilevi.dayRt; //day fee
            }

            //Adding stuff
            eleringPrices.push(row);
            //find next row
            activePos = res.body_b64.indexOf("\n", activePos);
        }
        res = null; //to save memory

        //store the timestamp into memory
        let now = new Date();
        let dtE = new Date(eleringPrices[0][0] * 1000);
        _.tsPrices = epoch(new Date(dtE.getFullYear(), dtE.getMonth(), dtE.getDate(), now.getHours(), now.getMinutes()));
        print(_.pId, "We got market prices from Elering ", dtE);

        setShellyTimer(s.isOutputInverted, s.defaultTimer); //set default timer

        //if heating is based only on the alwaysOnMaxPrice and alwaysOffMinPrice
        if (s.timePeriod <= 0) {
            for (let a = 0; a < eleringPrices.length; a++) {
                if ((eleringPrices[a][1] < s.alwaysOnMaxPrice) && !(eleringPrices[a][1] > s.alwaysOffMinPrice)) {
                    _.newScheds.push([new Date((eleringPrices[a][0]) * 1000).getHours(), eleringPrices[a][1]]);
                    print(_.pId, "Energy price + transfer fee " + eleringPrices[a][1] + " EUR/MWh at " + new Date((eleringPrices[a][0]) * 1000).getHours() + ":00 is less than min price and used for heating.")
                }
            }

            if (!_.newScheds.length) {
                print(_.pId, "No energy prices below min price level. No heating.")
            }
        }

        //heating windows calculation 
        let period = [];
        let sortedPeriod = [];
        // Create an array for each heating window, sort, and push the prices 
        for (let i = 0; i < _.ctPeriods; i++) {
            let k = 0;
            let hoursInPeriod = (i + 1) * s.timePeriod > 24 ? 24 : (i + 1) * s.timePeriod;
            for (let j = i * s.timePeriod; j < hoursInPeriod; j++) {
                period[k] = eleringPrices[j];
                k++;
            }
            sortedPeriod = sort(period, 1); //sort by price
            let heatingHours = sortedPeriod.length < _.heatTime ? sortedPeriod.length : _.heatTime; //finds max hours to heat in that window 

            for (let a = 0; a < sortedPeriod.length; a++) {
                if ((a < heatingHours || sortedPeriod[a][1] < s.alwaysOnMaxPrice) && !(sortedPeriod[a][1] > s.alwaysOffMinPrice)) {
                    _.newScheds.push([new Date((sortedPeriod[a][0]) * 1000).getHours(), sortedPeriod[a][1]]);
                }

                //If some hours are too expensive to use for heating, then just let user know for this
                if (a < heatingHours && sortedPeriod[a][1] > s.alwaysOffMinPrice) {
                    print(_.pId, "Energy price + transfer fee " + sortedPeriod[a][1] + " EUR/MWh at " + new Date((sortedPeriod[a][0]) * 1000).getHours() + ":00 is more expensive than max price and not used for heating.")
                }
            }
        }
        //clearing memory
        eleringPrices = null;
        sortedPeriod = null;
        period = null;
    }
    listScheds();
}

/**
Get all the existing schedulers to check duplications
 */
function listScheds() {
    Shelly.call("Schedule.List", {},
        function (res, err, msg, data) {
            if (res === 0) {
                print(_.pId, "No existing schedulers found.");
                createScheds([]);
            }
            else {
                print(_.pId, "Found ", res.jobs.length, " schedulers.");
                createScheds(res.jobs);
            }
        },
    );
}

/**
Create all schedulers, the limit is 20.
 */
function createScheds(listScheds) {
    //logic below is a non-blocking method for RPC calls to create all schedulers one by one
    if (_.callsCntr < 6 - _.maxRpcCalls) {
        for (let i = 0; i < _.maxRpcCalls && i < _.newScheds.length; i++) {
            let isExist = false;
            let hour = _.newScheds[0][0];
            let price = _.newScheds.splice(0, 1)[0][1]; //cut the array one-by-one
            let timespec = "0 0 " + hour + " * * *";
            //looping through existing schedulers
            for (let k = 0; k < listScheds.length; k++) {
                let t = listScheds[k].timespec;
                let p = listScheds[k].calls[0].params;
                //check if the scheduler exist 
                if (p.id === s.relayID && t.split(" ").join("") === timespec.split(" ").join("")) {
                    print(_.pId, "Skipping scheduler at: ", hour + ":00 for relay:", s.relayID, " as it is already exist.");
                    isExist = true;
                    break;
                }
            }
            // only create unique schedulers
            if (!isExist) {
                _.callsCntr++;
                Shelly.call("Schedule.Create", {
                    "id": 0, "enable": true, "timespec": timespec,
                    "calls": [{
                        "method": "Switch.Set",
                        "params": {
                            "id": s.relayID,
                            "on": !s.isOutputInverted
                        }
                    }]
                },
                    function (res, err, msg, data) {
                        if (err !== 0) {
                            print(_.pId, "Scheduler at: ", data.hour + ":00 price: ", data.price, " EUR/MWh (energy price + transmission). FAILED, 20 schedulers is the limit.");
                        }
                        else {
                            print(_.pId, "Scheduler starts at: ", data.hour + ":00 price: ", data.price, " EUR/MWh (energy price + transmission). ID:", res.id, " SUCCESS");
                            _.schedIDs.push(res.id); //create an array of scheduleIDs
                        }
                        _.callsCntr--;
                    },
                    { hour: hour, price: price }
                );
            }
        }
    }

    //if there are more calls in the queue
    if (_.newScheds.length > 0) {
        Timer.set(
            1000, //the delay
            false,
            function () {
                createScheds(listScheds);
            }
        );
    }
    else {
        setKVS();
    }
}

/**
Storing the scheduler IDs in KVS to not loose them in case of power outage
 */
function setKVS() {
    //wait until all the schedulerIDs are collected
    if (_.callsCntr !== 0) {
        Timer.set(
            1000,
            false,
            function () {
                setKVS();
            })
        return;
    }
    //schedulers are created, store the IDs to KVS
    Shelly.call("KVS.set", { key: "timestamp" + _.sId, value: new Date().toString() });
    Shelly.call("KVS.set", { key: "schedulerIDs" + _.sId, value: JSON.stringify(_.schedIDs) },
        function () {
            print(_.pId, "All good now, loop finished.");
            _.loopRunning = false;
        });
}

/**
Set countdown timer to flip Shelly status
 */
function setShellyTimer(isOutInv, timerMin) {
    let is_on = isOutInv ? "on" : "off";
    let timerSec = timerMin * 60; //time in seconds
    print(_.pId, "Set Shelly auto " + is_on + " timer for ", timerMin, " minutes.");
    Shelly.call("Switch.SetConfig", {
        "id": 0,
        config: {
            "name": "Switch0",
            "auto_on": isOutInv,
            "auto_on_delay": timerSec,
            "auto_off": !isOutInv,
            "auto_off_delay": timerSec
        }
    })
}

// Shelly doesnt support Javascript sort function so this basic math algorithm will do the sorting job
function sort(array, sortby) {
    // Sorting array from smallest to larger
    let i, j, k, min, max, min_indx, max_indx, tmp;
    j = array.length - 1;
    for (i = 0; i < j; i++) {
        min = max = array[i][sortby];
        min_indx = max_indx = i;
        for (k = i; k <= j; k++) {
            if (array[k][sortby] > max) {
                max = array[k][sortby];
                max_indx = k;
            }
            else if (array[k][sortby] < min) {
                min = array[k][sortby];
                min_indx = k;
            }
        }
        tmp = array[i];
        array.splice(i, 1, array[min_indx]);
        array.splice(min_indx, 1, tmp);

        if (array[min_indx][sortby] === max) {
            tmp = array[j];
            array.splice(j, 1, array[min_indx]);
            array.splice(min_indx, 1, tmp);
        }
        else {
            tmp = array[j];
            array.splice(j, 1, array[max_indx]);
            array.splice(max_indx, 1, tmp);
        }
        j--;
    }
    return array;
}

function epoch(date) {
    return Math.floor((date ? date.getTime() : Date.now()) / 1000.0);
}

/**
Getting prices or forecast for today if 
    * prices or forecast have never been fetched OR 
    * prices or forecast are not from today or tomorrow OR 
    * after 23 prices or forecast are not for tomorrow
 */
function isUpdtReq(ts) {
    let chkT = 23;
    let now = new Date();
    let isToday = new Date(ts * 1000).getDate() === now.getDate();
    let isTomorrow = new Date(ts * 1000).getDate() === new Date(now + _.dayInSec * 1000).getDate();
    let isTsAfter23h = new Date(ts * 1000).getHours() === chkT;
    let is23h = now.getHours() === chkT;
    return (is23h && !isTsAfter23h) || !(isToday || isTomorrow);
}

/**
 This loop runs in every xx seconds
 */
function loop() {
    if (_.loopRunning) {
        return;
    }
    _.loopRunning = true;
    if (isUpdtReq(_.tsPrices) || (s.isWeatherFcstUsed && isUpdtReq(_.tsFcst))) {
        start();
    } else {
        _.loopRunning = false;
    }
}

Timer.set(_.loopFreq * 1000, true, loop);
loop();