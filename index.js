const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { nanoid } = require("nanoid");

const downloadsDirname = "downloads";
fs.mkdirSync(downloadsDirname, { recursive: true });
const downloadsDir = path.resolve(downloadsDirname);

express()
  .use(express.urlencoded({ extended: true }))
  .get("/", (req, res) => {
    res.send(`
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <form action="/yt" method="POST">
        <input name="url" placeholder="Paste url here" />
        <input type="submit" />
      </form>
    `);
  })
  .post("/yt", async (req, res) => {
    const { url } = req.body;
    const id = nanoid();
    const fileDir = path.join(downloadsDir, id);

    await fs.promises.mkdir(fileDir);

    res.write(`
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        p {
          margin: 0.3em 0;
        }
      </style>
    </head>
    `);

    const print = (s) => {
      res.write(`<p>${s}</p>`);
    };

    const proc = spawn(
      "yt-dlp",
      [
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--embed-thumbnail",
        "-o",
        "%(channel)s - %(title)s.%(ext)s",
        url,
      ],
      { cwd: fileDir }
    )
      .on("error", (e) => {
        print("ERROR: " + e);
      })
      .on("close", (code) => {
        print("DONE: " + code);
        print(`<a href="/dl?id=${id}">Download</a>`);
        print('<a href="/">Convert next</a>');
        res.end();
      });

    let tid;

    const trickHeroku = () => {
      clearInterval(tid);
      tid = setInterval(() => {
        if (proc.exitCode === null) res.write(".");
        else clearInterval(tid);
      }, 2000);
    };

    proc.stdout.setEncoding("utf8").on("data", (data) => {
      print(data);
      trickHeroku();
    });

    proc.stderr.setEncoding("utf8").on("data", (data) => {
      print(data);
    });
  })
  .get("/dl", async (req, res) => {
    const { id } = req.query;
    const fileDir = path.join(downloadsDir, id);
    const files = await fs.promises.readdir(fileDir);
    const filename = files.find((f) => f.endsWith(".mp3"));
    const file = path.join(fileDir, filename);
    res.download(file);
  })
  .listen(process.env.PORT);
