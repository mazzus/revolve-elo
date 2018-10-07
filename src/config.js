const moment = require("moment");

const config = {
  defaultElo: 1000,
  seasonStart: moment("22.09.2018", "DD.MM.YYYY"),
  plotly: {
    username: "mazzus" || process.env.PLOTLY_USERNAME,
    apiKey: "" || process.env.PLOTLY_API_KEY
  }
};

module.exports = config;
