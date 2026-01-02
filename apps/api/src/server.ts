import { createServer } from "./app";
import { env } from "./config/env";

const app = createServer();

app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});
