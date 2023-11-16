import cors from "cors";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import multer from "multer";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, "data", "users.json");
const apiRouter = express.Router();

const app = express();
const httpServer = createServer(app);

app.use(cors());

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use("/api", apiRouter);

apiRouter.get("/messages", (res) => {
  const messages = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "messages.json"), "utf8")
  );
  res.json({ messages });
});

apiRouter.get("/users", (res) => {
  const users = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "messages.json"), "utf8")
  );
  res.json({ users });
});

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("image"), (req, res) => {
  const tempPath = req.file.path;
  const targetPath = path.join(
    __dirname,
    "./data/uploads/",
    req.body.userId + path.extname(req.file.originalname)
  );

  const dir = path.join(__dirname, "./data/uploads/");

  fs.readdirSync(dir).forEach((file) => {
    if (file.startsWith(req.body.userId)) {
      fs.unlinkSync(path.join(dir, file));
    }
  });

  fs.rename(tempPath, targetPath, (err) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "Failed to upload image" });
      return;
    }

    const imageUrl = `http://localhost:8080/${req.file.originalname}`;
    const usersData = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    const user = usersData.find((user) => user.userId === req.body.userId);

    if (user) {
      user.pfp = imageUrl;
      fs.writeFileSync(usersFilePath, JSON.stringify(usersData));
    }

    res.status(200).json({ success: true, imageUrl });
  });
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

  const messagesFilePath = path.join(__dirname, "data", "messages.json");
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

    messageObject.roomId = roomId;
    messages.push(messageObject);
    fs.writeFileSync(messagesFilePath, JSON.stringify(messages));
  });

  socket.on("get_room_messages", (roomId) => {
    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }
    let roomMessages = messages.filter((message) => message.roomId === roomId);
    socket.emit("room_messages", roomMessages);
  });

  socket.on("set_username", (username, userId) => {
    users.set(socket.id, { username, userId });

    if (!fs.existsSync(usersFilePath)) {
      fs.writeFileSync(
        path.join(__dirname, "data", "users.json"),
        JSON.stringify([])
      );
    }

    let usersData = [];
    const fileContent = fs.readFileSync(
      path.join(__dirname, "data", "users.json"),
      "utf8"
    );
    if (fileContent) {
      usersData = JSON.parse(fileContent);
    }

    const userIndex = usersData.findIndex((user) => user.id === socket.id);
    if (userIndex !== -1) {
      usersData[userIndex] = { id: socket.id, username, userId };
    } else {
      usersData.push({ id: socket.id, username, userId });
    }

    fs.writeFileSync(
      path.join(__dirname, "data", "users.json"),
      JSON.stringify(usersData)
    );
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    const user = users.get(socket.id);
    if (user) {
      io.emit("user_disconnected", user.username);
      users.delete(socket.id);
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

    fs.writeFileSync(
      path.join(__dirname, "data", "messages.json"),
      JSON.stringify(messages)
    );
  });

  socket.on("delete_message", (messageId) => {
    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(
        path.join(__dirname, "data", "messages.json"),
        "utf8"
      );
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }
    messages = messages.filter((message) => message.id !== messageId);
    fs.writeFileSync(
      path.join(__dirname, "data", "messages.json"),
      JSON.stringify(messages)
    );
    io.emit("delete_message", messageId);
  });
});

httpServer.listen(8080, () => console.log("Listening on port 8080"));
