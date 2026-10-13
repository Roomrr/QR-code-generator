// Creates an isolated PostgreSQL cluster and real local SMTP inbox. Never uses the application's database.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { SMTPServer } from "smtp-server";
const mode = process.argv[2] || "unit";
const bin =
  process.env.PG_BIN ||
  (process.platform === "darwin" ? "/opt/homebrew/opt/postgresql@17/bin" : "");
const executable = (name) => (bin ? path.join(bin, name) : name);
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relay-saas-tests-"));
const dataDir = path.join(dir, "postgres");
const mailbox = path.join(dir, "mailbox.json");
const port = await new Promise((resolve) => {
  const server = net.createServer();
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
let child,
  started = false,
  closed = false;
const messages = {};
await fs.writeFile(mailbox, "{}", { mode: 0o600 });
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS", "AUTH"],
  onData(stream, session, done) {
    let raw = "";
    stream.on("data", (c) => (raw += c));
    stream.on("end", async () => {
      try {
        for (const recipient of session.envelope.rcptTo) {
          messages[recipient.address.toLowerCase()] = raw;
        }
        await fs.writeFile(mailbox, JSON.stringify(messages), { mode: 0o600 });
        done();
      } catch (e) {
        done(e);
      }
    });
  },
});
const smtpPort = await new Promise((resolve, reject) => {
  smtp.on("error", reject);
  smtp.listen(0, "127.0.0.1", () => resolve(smtp.server.address().port));
});
async function cleanup() {
  if (closed) return;
  closed = true;
  child?.kill("SIGTERM");
  if (started) {
    try {
      execFileSync(
        executable("pg_ctl"),
        ["-D", dataDir, "-m", "fast", "-w", "stop"],
        { stdio: "ignore" },
      );
    } catch {}
  }
  await new Promise((resolve) => smtp.close(resolve));
  await fs.rm(dir, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await cleanup();
    process.exit(130);
  });
try {
  execFileSync(
    executable("initdb"),
    [
      "-D",
      dataDir,
      "-U",
      "relay_test",
      "--auth=trust",
      "--encoding=UTF8",
      "--no-locale",
    ],
    { stdio: "pipe" },
  );
  execFileSync(
    executable("pg_ctl"),
    [
      "-D",
      dataDir,
      "-l",
      path.join(dir, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -c unix_socket_directories=''`,
      "-w",
      "start",
    ],
    { stdio: "pipe" },
  );
  started = true;
  execFileSync(
    executable("createdb"),
    ["-h", "127.0.0.1", "-p", String(port), "-U", "relay_test", "relay_test"],
    { stdio: "pipe" },
  );
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: mode === "browser" ? "3019" : "3001",
    API_PROXY_URL: "http://localhost:3019",
    DATABASE_URL: `postgresql://relay_test@127.0.0.1:${port}/relay_test`,
    DB_NAME: "relay_test",
    DB_USER: "relay_test",
    DB_PASSWORD: "",
    DB_HOST: "127.0.0.1",
    DB_PORT: String(port),
    DATABASE_SSL: "false",
    EMAIL_HOST: "127.0.0.1",
    EMAIL_PORT: String(smtpPort),
    EMAIL_HOST_USER: "",
    EMAIL_HOST_PASSWORD: "",
    EMAIL_USE_TLS: "false",
    DEFAULT_FROM_EMAIL: "Relay Tests <tests@example.test>",
    APP_SECRET: "isolated-test-secret-not-for-production-0123456789",
    APP_ORIGIN:
      mode === "browser" ? "http://localhost:5179" : "http://localhost:5173",
    PUBLIC_BASE_URL:
      mode === "browser" ? "http://localhost:5179" : "http://localhost:5173",
    QR_BASE_URL:
      mode === "browser" ? "http://localhost:3019" : "https://go.example.test",
    COOKIE_SECURE: "false",
    ALLOW_REGISTRATION: "true",
    AUTH_REQUEST_LIMIT: "500",
    TEST_MAILBOX_PATH: mailbox,
  };
  const args =
    mode === "browser"
      ? ["node_modules/@playwright/test/cli.js", "test"]
      : [
          "--test",
          "--test-concurrency=1",
          "tests/api.test.js",
          "tests/backup.test.js",
        ];
  child = spawn(process.execPath, args, { env, stdio: "inherit" });
  const code = await new Promise((resolve) =>
    child.once("exit", (code) => resolve(code ?? 1)),
  );
  await cleanup();
  process.exitCode = code;
} catch (e) {
  console.error("Isolated test services failed:", e.message);
  console.error(
    "Install PostgreSQL 17 tools and set PG_BIN to their bin directory.",
  );
  await cleanup();
  process.exitCode = 1;
}
