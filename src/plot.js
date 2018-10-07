const config = require("./config")

var plotly = require("plotly")(config.plotly.username, config.plotly.apiKey);
var fs = require("fs");

;

function plotWeeklyStatsForAllWeeks(weeklyStats) {
  let partlyStats = [];

  let index = 0;
  for (const weeklyStat of weeklyStats) {
    partlyStats.push(weeklyStat);
    plotWeeklyStats(partlyStats, `week-${index}-plot.png`);
    index++;
  }
}

function plotWeeklyStats(weeklyStats, filename) {
  const lastWeek = weeklyStats[weeklyStats.length - 1];
  let players = Object.keys(lastWeek.playerRatings);

  players = players.sort((a, b) => {
    if (lastWeek.playerRatings[a] < lastWeek.playerRatings[b]) {
      return 1;
    } else if (lastWeek.playerRatings[a] > lastWeek.playerRatings[b]) {
      return -1;
    } else {
      return 0;
    }
  });

  console.log(players.map(p => lastWeek[p]))

  
  const playersToPlot = players.slice(0, 5);
  console.log({playersToPlot})
  
  const data = players
    .filter(player => playersToPlot.indexOf(player) >= 0)
    .map(player => {
      const dataPoints = weeklyStats
        .map((weeklyStat, index) => {
          if (!weeklyStat.playerRatings.hasOwnProperty(player)) {
            return null;
          } else {
            return [index, weeklyStat.playerRatings[player]];
          }
        })
        .filter(point => point !== null);
      return {
        x: dataPoints.map(point => point[0]),
        y: dataPoints.map(point => point[1]),
        type: "scatter",
        name: player
      };
    });

  const figure = { data };
  var imgOpts = {
    format: "png",
    width: 1000,
    height: 500
  };

  plotly.getImage(figure, imgOpts, function(error, imageStream) {
    if (error) return console.log(error);
    var fileStream = fs.createWriteStream(filename);
    imageStream.pipe(fileStream);
  });
}

module.exports = { plotWeeklyStats, plotWeeklyStatsForAllWeeks };
