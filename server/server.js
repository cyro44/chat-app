import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});

app.use(express.static(path.join(__dirname, "../chat-app/dist")));

const users = new Map();

io.on("connection", (socket) => {
    console.log("Client connected");

    const messagesFilePath = path.join(__dirname, 'messages.json');
    if (!fs.existsSync(messagesFilePath)) {
        fs.writeFileSync(messagesFilePath, JSON.stringify([]));
    }

    const messages = JSON.parse(fs.readFileSync(messagesFilePath, 'utf-8'));
    socket.emit("existing_messages", messages);

    socket.on("message", (messageObject) => {
        io.emit("message", messageObject);
        const messages = JSON.parse(fs.readFileSync(messagesFilePath, 'utf-8'));
        messages.push(messageObject);
        fs.writeFileSync(messagesFilePath, JSON.stringify(messages));
    });

    socket.on("set_username", (username) => {
        users.set(socket.id, username);
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
        const username = users.get(socket.id);
        io.emit("user_disconnected", username);
        users.delete(socket.id);
    });

    socket.on("typing", (username) => {
        socket.broadcast.emit("typing", username);
    });

    socket.on("start_typing", (username) => {
        socket.broadcast.emit("typing", username);
    });

    socket.on("stop_typing", () => {
        socket.broadcast.emit("typing", null);
    });

    socket.on('edit_message', (editedMessage) => {
        socket.broadcast.emit('edit_message', editedMessage);
    });

    socket.on("delete_message", (deletedMessage) => {
        io.emit("delete_message", deletedMessage);
    });
});

httpServer.listen(5173, () => console.log("Listening on port 5173"));
