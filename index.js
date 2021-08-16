const http = require("http");
const path = require("path");
const fs = require("fs");

/** 
 * Returns number in seconds given a duration in string format
 * e.g. 12:34 into 754 seconds
*/
function durationInSeconds(duration) {
  let substringArr = duration.split(':');
  return (+substringArr[0] * 60) + +substringArr[1];
}

/**
 * Returns string in duration format given time in seconds
 * e.g. 754 seconds into 12:34
 */
function durationToString(time) {
  var timeInSeconds = +time;
  var minutes = Math.floor(timeInSeconds / 60);
  var seconds = (timeInSeconds % 60);
  // Check for single digit numbers
  return seconds < 10 ? `${minutes}:0${seconds}` : `${minutes}:${seconds}`;
}

/**
 * Merges objects with same key and accumulates values.
 * Returns first element from array of objects, 
 * previously sorted by numeric values (asc)
 */
function reducer(array) {
  return array.reduce((prev, current, index) => {
    if (!(current.piloto in prev.keys)) {
      prev.keys[current.piloto] = index;
      prev.result.push(current);
    }
    // Accumulate pilot times
    else prev.result[prev.keys[current.piloto]].tiempo += current.tiempo;
    return prev;
  }, { result: [], keys: [] })
    // Numeric sort by pilot time
    .result.sort((a, b) => {
      return a.tiempo - b.tiempo
    })[0];
}

// Setup server
const server = http.createServer((req, res) => {
  // url home
  if (req.url === '/') {
    fs.readFile(
      path.join(__dirname, 'public', 'rally-argentina.json'),
      (err, content) => {
        if (err) throw err;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(content);
      }
    );
  }

  // url /results
  if (req.url === '/results') {
    fs.readFile(
      path.join(__dirname, 'public', 'rally-argentina.json'),
      (err, content) => {
        if (err) throw err;
        res.writeHead(200, { 'Content-Type': 'application/json' });

        // Get json from file
        const data = JSON.parse(content.toString('utf8'));

        // JSON to send as response
        var json = { metadata: {}, etapas: [] };

        var stages = data.etapas;
        var enrolledPilots = [];
        for (let stage of stages) {
          let pilots = stage.resultados;

          // Stage winner
          let stageWinner = pilots.sort((a, b) => {
            return durationInSeconds(a.tiempo) - durationInSeconds(b.tiempo);
          })[0];

          const stageData = { ...stage, ganador: stageWinner };
          delete stageData.resultados;
          json.etapas.push(stageData);

          for (let pilot of pilots) {
            enrolledPilots.push({ piloto: pilot.piloto, tiempo: durationInSeconds(pilot.tiempo) })
          }
        }

        // Rally winner
        var winner = reducer(enrolledPilots);

        winner.tiempo = durationToString(winner.tiempo);
        json.metadata['ganador'] = winner;

        // Morning winner
        var morning = [];
        var morningStages = stages.filter(stage => stage.horario === "mañana");

        for (let ms of morningStages) {
          for (let r of ms.resultados) morning.push({ piloto: r.piloto, tiempo: durationInSeconds(r.tiempo) });
        }

        var morningWinner = reducer(morning);

        morningWinner.tiempo = durationToString(morningWinner.tiempo);
        json.metadata['ganadorMañana'] = morningWinner;

        // Afternoon winner
        var afternoon = [];
        var afternoonStages = stages.filter(stage => stage.horario === "tarde");
        for (let as of afternoonStages) {
          for (let r of as.resultados) afternoon.push({ piloto: r.piloto, tiempo: durationInSeconds(r.tiempo) });
        }

        var afternoonWinner = reducer(afternoon);

        afternoonWinner.tiempo = durationToString(afternoonWinner.tiempo);
        json.metadata['ganadorTarde'] = afternoonWinner;

        res.end(JSON.stringify(json));
      }
    );
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));