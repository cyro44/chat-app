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

  socket.join("global_chat");

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
  });

  const messagesFilePath = path.join(__dirname, "messages.json");
  if (!fs.existsSync(messagesFilePath)) {
    fs.writeFileSync(messagesFilePath, JSON.stringify([]));
  }

  let messages = [];
  if (fs.existsSync(messagesFilePath)) {
    const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
    if (fileContent) {
      messages = JSON.parse(fileContent);
    }
  }
  socket.emit("existing_messages", messages);

  socket.on("message", (messageObject, roomId) => {
    socket.broadcast.to(roomId).emit("message", messageObject);
    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }
    messages.push(messageObject);
    fs.writeFileSync(messagesFilePath, JSON.stringify(messages));
  });

  socket.on("get_room_messages", (roomId) => {
    let roomMessages = messages.filter((message) => message.roomId === roomId);
    socket.emit("room_messages", roomMessages);
  });

  socket.on("set_username", (username, profilePicture) => {
    users.set(socket.id, { username, profilePicture });

    const usersFilePath = path.join(__dirname, "users.json");
    if (!fs.existsSync(usersFilePath)) {
      fs.writeFileSync(usersFilePath, JSON.stringify([]));
    }

    let usersData = [];
    if (fs.existsSync(usersFilePath)) {
      const fileContent = fs.readFileSync(usersFilePath, "utf-8");
      if (fileContent) {
        usersData = JSON.parse(fileContent);
      }
    }

    const userIndex = usersData.findIndex((user) => user.id === socket.id);
    if (userIndex !== -1) {
      usersData[userIndex] = { id: socket.id, username, profilePicture };
    } else {
      usersData.push({ id: socket.id, username, profilePicture });
    }

    fs.writeFileSync(usersFilePath, JSON.stringify(usersData));
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    const user = users.get(socket.id);
    if (user) {
      io.emit("user_disconnected", user.username);
      users.delete(socket.id);
    
      const usersFilePath = path.join(__dirname, "users.json");
      let usersData = [];
      if (fs.existsSync(usersFilePath)) {
        const fileContent = fs.readFileSync(usersFilePath, "utf-8");
        if (fileContent) {
          usersData = JSON.parse(fileContent);
        }
      }
    
      usersData = usersData.filter((user) => user.id !== socket.id);
      fs.writeFileSync(usersFilePath, JSON.stringify(usersData));
    }
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

  socket.on("edit_message", (editedMessage) => {
    socket.broadcast.emit("edit_message", editedMessage);

    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }

    const messageIndex = messages.findIndex(
      (message) => message.id === editedMessage.id
    );

    if (messageIndex !== -1) {
      messages[messageIndex] = editedMessage;
    }

    fs.writeFileSync(messagesFilePath, JSON.stringify(messages));
  });

  socket.on("delete_message", (messageId) => {
    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }
    messages = messages.filter((message) => message.id !== messageId);
    fs.writeFileSync(messagesFilePath, JSON.stringify(messages));
    io.emit("delete_message", messageId);
  });
});

httpServer.listen(5173, () => console.log("Listening on port 5173"));
