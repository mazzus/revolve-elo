#!/usr/bin/env node

const fs = require("fs");
const express = require("express");
const app = express();
var bodyParser = require("body-parser");

var EloRank = require("elo-rank");
const joi = require("joi");

const MatchFile = "./matches.csv";

elo = new EloRank();

class Match {
  constructor(player1, player2, winner, date) {
    this.player1 = player1;
    this.player2 = player2;
    this.winner = winner;
    this.date = date;
  }
}

function SaveMatch(match) {
  fs.appendFileSync(MatchFile, `${match.player1},${match.player2},${match.winner}, ${match.date}\n`, "utf8");
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
      const [player1, player2, winner, date] = lineParts;
      return new Match(player1, player2, winner, date);
    })
    .filter(match => match != null);
}

function CalculateElos(matches) {
  console.debug("Elos");
  let playerRatings = {};

  for (const match of matches) {
    playerRatings = UpdateElos(playerRatings,match);
  }
  return playerRatings;
}

function UpdateElos(playerRatings, match) {
  const defaultElo = 1000;

  const { player1, player2, winner } = match;
  const player1Rating = playerRatings[player1] ? playerRatings[player1] : defaultElo;
  const player2Rating = playerRatings[player2] ? playerRatings[player2] : defaultElo;
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
  date: joi.date().iso()
};

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/match", validationMiddleware(postMatchSchema), async (req, res) => {
  const { player1, player2, winner, date } = req.body;
  if (!date) {
    date = new Date().toISOString();
  }
  const match = new Match(player1, player2, winner, date);
  console.log({ body: req.body });
  SaveMatch(match);
  res.sendStatus(201);
});

app.get("/elos", (req, res) => {
  res.json(CalculateElos(LoadMatches()));
});

app.get("/matches", (req, res) => {
  res.json(LoadMatches());
});

const port = 3000;
app.listen(port);
