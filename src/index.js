#!/usr/bin/env node

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const config = require("./config");

const EloRank = require("elo-rank");
const joi = require("joi");
const moment = require("moment");
const fs = require("fs");

const { plotWeeklyStats, plotWeeklyStatsForAllWeeks } = require("./plot");
const { Match, LoadMatches, SaveMatch } = require("./match");

const {seasonStart, defaultElo} = config;

elo = new EloRank();

function UpdatePlayerStats(match, playerStats) {
  const { player1, player2, winner } = match;
  let player1Count = playerStats.hasOwnProperty(player1)
    ? playerStats[player1]
    : { won: 0, lost: 0 };
  let player2Count = playerStats.hasOwnProperty(player2)
    ? playerStats[player2]
    : { won: 0, lost: 0 };

  if (winner === 1) {
    player1Count.won += 1;
    player2Count.lost += 1;
  } else {
    player1Count.lost += 1;
    player2Count.won += 1;
  }

  playerStats[player1] = player1Count;
  playerStats[player2] = player2Count;

  return playerStats;
}

function UpdateElos(playerRatings, match) {
  

  const { player1, player2, winner } = match;
  const player1Rating = playerRatings.hasOwnProperty(player1)
    ? playerRatings[player1]
    : defaultElo;
  const player2Rating = playerRatings.hasOwnProperty(player2)
    ? playerRatings[player2]
    : defaultElo;
  const expected1 = elo.getExpected(player1Rating, player2Rating);
  const expected2 = elo.getExpected(player2Rating, player1Rating);

  const player1NewRating = elo.updateRating(
    expected1,
    winner === 1 ? 1 : 0,
    player1Rating
  );
  const player2NewRating = elo.updateRating(
    expected2,
    winner === 2 ? 1 : 0,
    player2Rating
  );
  playerRatings[player1] = player1NewRating;
  playerRatings[player2] = player2NewRating;

  return playerRatings;
}

function divideMatchesPerWeek(matches) {
  const latestDay = matches[matches.length - 1].day;

  const latestWeek = Math.floor(latestDay / 7);

  let weeks = [];
  for (let i = 0; i < latestWeek + 1; i++) {
    weeks.push([]);
  }

  for (let match of matches) {
    const week = Math.floor(match.day / 7);
    weeks[week].push(match);
  }

  return weeks;
}

function createWeeklyStats(weeks) {
  let playerRatings = {};
  let playerStats = {};
  let weeklyStats = [];

  for (const week of weeks) {
    for (const match of week) {
      playerRatings = UpdateElos(playerRatings, match);
      playerStats = UpdatePlayerStats(match, playerStats);
    }
    weeklyStats.push({
      playerRatings: Object.assign({}, playerRatings),
      playerStats: Object.assign({}, playerStats)
    });
  }

  return weeklyStats;
}

function validationMiddleware(schema) {
  return async (req, res, next) => {
    try {
      if (!req.body) {
        throw new Error("No body provided");
      }

      const validatedBody = await joi.validate(req.body, schema);
      req.body = validatedBody;
      next();
    } catch (err) {
      res.status(400).send(err);
    }
  };
}
const postMatchSchema = {
  player1: joi.string().required(),
  player2: joi.string().required(),
  winner: joi
    .number()
    .integer()
    .min(1)
    .max(2)
    .required()
};

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.post(
  "/match",
  validationMiddleware(postMatchSchema),
  async (req, res, next) => {
    const { player1, player2, winner } = req.body;

    const matchDay = moment();
    const daysSinceSeasonStart = matchDay.diff(seasonStart, "days");

    const match = new Match(player1.toLowerCase(), player2.toLowerCase(), winner, daysSinceSeasonStart);

    SaveMatch(match);
    res.redirect("./matchcreated.html");
  }
);

function createScoreboard(playerRatings, playerStats) {
  const scoreBoard = [];
  for (const player of Object.keys(playerRatings)) {
    scoreBoard.push({ name: player, score: playerRatings[player] });
  }
  scoreBoard
    .sort((a, b) => {
      if (a.score > b.score) {
        return 1;
      } else if (a.score < b.score) {
        return -1;
      } else {
        return 0;
      }
    })
    .reverse();

  const text = scoreBoard.reduce((acc, entry, index) => {
    const stats = playerStats[entry.name];
    return (
      acc +
      createScoreBoardLine(
        index + 1,
        entry.name,
        entry.score,
        stats.won,
        stats.lost
      )
    );
  }, createScoreBoardLine());
  return text;
}

function createWeeklyScoreboards(weeklyStats) {
  let index = 0;
  for (const weeklyStat of weeklyStats) {
    const text = createScoreboard(
      weeklyStat.playerRatings,
      weeklyStat.playerStats
    );
    fs.writeFileSync(`week-${index}-scoreboard.txt`, text);
    index++;
  }
}

function createScoreBoardLine(position, name, score, won, lost) {
  let total;
  if (
    position === undefined ||
    name === undefined ||
    score === undefined ||
    won === undefined ||
    lost === undefined
  ) {
    position = "pos";
    name = "name";
    score = "score";
    won = "won";
    lost = "lost";
    total = "total";
  } else {
    total = won + lost;
  }

  return (
    `${position}`.padStart(3, " ") +
    "   " +
    `${name}`.padEnd(15, " ") +
    `${score}`.padStart(6, " ") +
    `${won}`.padStart(8, " ") +
    `${lost}`.padStart(8, " ") +
    `${total}`.padStart(8, " ") +
    "\n"
  );
}


const weeklyStats = createWeeklyStats(divideMatchesPerWeek(LoadMatches()));
plotWeeklyStatsForAllWeeks(weeklyStats);

createWeeklyScoreboards(weeklyStats);

const port = 3000;
app.listen(port);
