#!/usr/bin/env node

const fs = require("fs");
const express = require("express");
const app = express();
var bodyParser = require("body-parser");

var EloRank = require("elo-rank");
const joi = require("joi");
const moment = require("moment");

const MatchFile = "./matches.csv";
const SeasonFirstDay = moment("28.8.2018", "DD.MM.YYYY");

elo = new EloRank();

class Match {
  constructor(player1, player2, winner, day) {
    this.player1 = player1;
    this.player2 = player2;
    this.winner = winner;
    this.day = day;
  }
}

function SaveMatch(match) {
  fs.appendFileSync(MatchFile, `${match.player1},${match.player2},${match.winner},${match.day}\n`, "utf8");
}

function LoadMatches() {
  let fileContent = "";
  try {
    fileContent = fs.readFileSync(MatchFile, "utf8");
  } catch (err) {}

  const lines = fileContent.split("\n");
  return lines
    .map(line => {
      const lineParts = line.split(",");
      if (lineParts.length != 4) {
        console.warn(`Skipping line: \"${line}\"`);
        return null;
      }
      const [player1, player2, winner, day] = lineParts;
      return new Match(player1, player2, winner, day);
    })
    .filter(match => match != null);
}

function CalculateElos(matches) {
  console.debug("Elos");
  let playerRatings = {};

  for (const match of matches) {
    playerRatings = UpdateElos(playerRatings, match);
  }
  return playerRatings;
}

function CreatePlayerStats(matches) {
  let playerStats = {};
  for (const match of matches) {
    const { player1, player2, winner } = match;
    let player1Count = playerStats.hasOwnProperty(player1) ? playerStats[player1] : { won: 0, lost: 0 };
    let player2Count = playerStats.hasOwnProperty(player2) ? playerStats[player2] : { won: 0, lost: 0 };

    if (winner == 1) {
      player1Count.won += 1;
      player2Count.lost += 1;
    } else {
      player1Count.lost += 1;
      player2Count.won += 1;
    }

    playerStats[player1] = player1Count;
    playerStats[player2] = player2Count;
  }
  return playerStats;
}

function UpdateElos(playerRatings, match) {
  const defaultElo = 1000;

  const { player1, player2, winner } = match;
  const player1Rating = playerRatings.hasOwnProperty(player1) ? playerRatings[player1] : defaultElo;
  const player2Rating = playerRatings.hasOwnProperty(player2) ? playerRatings[player2] : defaultElo;
  const expectedScore1 = elo.getExpected(player1Rating, player2Rating);
  const expectedScore2 = elo.getExpected(player2Rating, player1Rating);

  const player1NewRating = elo.updateRating(expectedScore1, winner == 1 ? 1 : 0, player1Rating);
  const player2NewRating = elo.updateRating(expectedScore2, winner == 2 ? 1 : 0, player2Rating);
  playerRatings[player1] = player1NewRating;
  playerRatings[player2] = player2NewRating;

  return playerRatings;
}

function validationMiddleware(schema) {
  return async (req, res, next) => {
    try {
      if (!req.body) {
        throw new Error("No body provided");
      }
      console.debug({ body: req.body });
      const validatedBody = await joi.validate(req.body, schema);
      req.body = validatedBody;
      next();
    } catch (err) {
      console.error(err);
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
    .required(),
  day: joi.number().required(),
  month: joi.number().required(),
  year: joi.number().required()
};

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/match", validationMiddleware(postMatchSchema), async (req, res) => {
  const { player1, player2, winner, day, month, year } = req.body;

  const matchDay = moment(`${day}.${month}.${year}`, "DD.MM.YYYY");
  const daysSinceSeasonStart = matchDay.diff(SeasonFirstDay, "days");
  console.debug({ daysSinceSeasonStart });
  const match = new Match(player1, player2, winner, daysSinceSeasonStart);
  console.log({ body: req.body });
  SaveMatch(match);
  res.sendStatus(201);
});

app.get("/scoreboard", (req, res) => {
  const matches = LoadMatches();
  const eloMap = CalculateElos(matches);
  const scoreBoard = [];
  for (const player of Object.keys(eloMap)) {
    scoreBoard.push({ name: player, score: eloMap[player] });
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

  const stats = CreatePlayerStats(matches);
  const text = scoreBoard.reduce((acc, entry, index) => {
    const playerStats = stats[entry.name];
    return acc + createScoreBoardLine(index + 1, entry.name, entry.score, playerStats.won, playerStats.lost);
  }, createScoreBoardLine());
  console.log(text);
  res.header("Content-Type", "text/plain");
  res.send(text);
});

function createScoreBoardLine(position, name, score, won, lost) {
  let total;
  if (position == undefined || name == undefined || score == undefined || won == undefined || lost == undefined) {
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
    "\t" +
    `${name}`.padEnd(15, " ") +
    `${score}`.padStart(6, " ") +
    `${won}`.padStart(8, " ") +
    `${lost}`.padStart(8, " ") +
    `${total}`.padStart(8, " ") +
    "\n"
  );
}

app.get("/counts", (req, res) => {
  res.json(CountPlayerMatches(LoadMatches()));
});

app.get("/matches", (req, res) => {
  res.json(LoadMatches());
});

const port = 3000;
app.listen(port);
