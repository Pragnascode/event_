import express from "express";
const app = express();
app.listen(8081, () => {
  console.log("Listening on 8081");
});
setInterval(() => {
  console.log("Still alive");
}, 1000);
