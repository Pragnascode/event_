import { app } from "./app";
import { env } from "./utils/env";

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

setInterval(() => {
  // console.log("Still alive");
}, 10000);

process.on("exit", (code) => {
  console.log(`Process exit with code: ${code}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
