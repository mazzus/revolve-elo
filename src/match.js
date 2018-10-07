const fs = require("fs");

const MatchFile = "./matches.csv";
class Match {
  constructor(player1, player2, winner, day) {
    this.player1 = player1;
    this.player2 = player2;
    this.winner = winner;
    this.day = day;
  }
}

function SaveMatch(match) {
  fs.appendFileSync(
    MatchFile,
    `${match.player1},${match.player2},${match.winner},${match.day}\n`,
    "utf8"
  );
}

function LoadMatches() {
  let fileContent = "";
  try {
    fileContent = fs.readFileSync(MatchFile, "utf8");
  } catch (err) {}

  const lines = fileContent.split("\n");
  return lines
    .map(line => {
      const lineParts = line.split(",").map(x => x.toLowerCase())
      if (lineParts.length != 4) {
        
        return null;
      }
      const [player1, player2, winner, day] = lineParts;
      return new Match(player1, player2, parseInt(winner, "10"), parseInt(day,"10"));
    })
    .filter(match => match != null);
}

module.exports = { Match, SaveMatch, LoadMatches };
