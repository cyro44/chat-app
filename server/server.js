import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, "../chat-app/dist")));

io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("message", (messageObject) => {
        io.emit("message", messageObject);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

httpServer.listen(5173, () => console.log("Listening on port 5173"));